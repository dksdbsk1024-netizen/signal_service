"""core.kis — 토큰 캐시/갱신, 인증실패 vs 데이터실패 구분, 현재가·분봉 폴백 체인.

네트워크를 타지 않는다. monkeypatch 로 requests.post/get 을 대체한다.
"""

import datetime
import json
import time

import pandas as pd
import pytest

from backend.core import kis
from backend.core.providers import KISProvider

KEY, SECRET = "appkey", "appsecret"

# KIS inquire-price 정상 응답의 output (필요한 필드만).
OK_OUTPUT = {
    "rprs_mrkt_kor_name": "KOSPI200",
    "bstp_kor_isnm": "전기·전자",
    "stck_prpr": "78900",
    "prdy_vrss": "900",
    "prdy_ctrt": "1.15",
    "prdy_vrss_sign": "2",
    "stck_oprc": "78000",
    "stck_hgpr": "79200",
    "stck_lwpr": "77800",
    "acml_vol": "12345678",
}


class FakeResp:
    def __init__(self, status_code=200, body=None, text=""):
        self.status_code = status_code
        self._body = body
        self.text = text

    def json(self):
        if self._body is None:
            raise ValueError("no json")
        return self._body


@pytest.fixture(autouse=True)
def clean_state(monkeypatch, tmp_path):
    """캐시·토큰 파일을 테스트마다 격리. 재시도 백오프는 0 으로.

    `_initial_hour` 는 실시간을 읽으므로 고정한다 — 안 그러면 테스트 결과가
    '언제 돌렸느냐'에 따라 달라진다(장 시작 전이면 빈 응답 경로를 탄다).
    """
    monkeypatch.setattr(kis, "_TOKEN", {})
    monkeypatch.setattr(kis, "_PRICE_CACHE", {})
    monkeypatch.setattr(kis, "_OHLCV_CACHE", {})
    monkeypatch.setattr(kis, "TOKEN_FILE", tmp_path / ".kis_token.json")
    monkeypatch.setattr(kis, "_RETRY_BACKOFF_SEC", 0)
    monkeypatch.setattr(kis, "_initial_hour", lambda: kis._MARKET_CLOSE)


def _token_body(expires_in=86400):
    return {"access_token": "tok-abc", "expires_in": expires_in}


def _set_expiry(expires_at: float):
    """메모리·디스크 두 캐시의 만료를 함께 옮긴다 (실제로는 같이 만료된다)."""
    kis._TOKEN["expires_at"] = expires_at
    kis.TOKEN_FILE.write_text(json.dumps(kis._TOKEN), encoding="utf-8")


# ── 토큰 ───────────────────────────────────────────────────────
def test_token_reused_within_expiry(monkeypatch):
    calls = []
    monkeypatch.setattr(
        kis.requests, "post", lambda *a, **k: (calls.append(1), FakeResp(200, _token_body()))[1]
    )
    assert kis.get_access_token(KEY, SECRET) == "tok-abc"
    assert kis.get_access_token(KEY, SECRET) == "tok-abc"
    assert len(calls) == 1  # 두 번째는 메모리 캐시


def test_token_refreshed_when_expired(monkeypatch):
    calls = []
    monkeypatch.setattr(
        kis.requests, "post", lambda *a, **k: (calls.append(1), FakeResp(200, _token_body()))[1]
    )
    kis.get_access_token(KEY, SECRET)
    _set_expiry(time.time() - 1)  # 만료시킴
    kis.get_access_token(KEY, SECRET)
    assert len(calls) == 2


def test_token_refreshed_within_skew_window(monkeypatch):
    """만료 10분 전(_TOKEN_SKEW_SEC)이면 아직 유효해도 선갱신."""
    calls = []
    monkeypatch.setattr(
        kis.requests, "post", lambda *a, **k: (calls.append(1), FakeResp(200, _token_body()))[1]
    )
    kis.get_access_token(KEY, SECRET)
    _set_expiry(time.time() + 60)  # 아직 안 만료, 하지만 skew 안쪽
    kis.get_access_token(KEY, SECRET)
    assert len(calls) == 2


def _write_disk_token(token="from-disk", app_key=KEY, expires_in=86400):
    kis.TOKEN_FILE.write_text(
        json.dumps({
            "access_token": token,
            "expires_at": time.time() + expires_in,
            "key_fp": kis._key_fingerprint(app_key),
        }),
        encoding="utf-8",
    )


def test_token_loaded_from_disk(monkeypatch):
    """메모리가 비어도 디스크 토큰을 재사용 — 프로세스 재시작 시 재발급 방지."""
    _write_disk_token()

    def boom(*a, **k):
        raise AssertionError("디스크 토큰이 있는데 발급 요청을 보냈다")

    monkeypatch.setattr(kis.requests, "post", boom)
    assert kis.get_access_token(KEY, SECRET) == "from-disk"


def test_disk_token_from_other_appkey_not_reused(monkeypatch):
    """앱키를 바꿔 끼우면 이전 키의 캐시 토큰을 쓰면 안 된다.

    안 그러면 틀린 키가 토큰 만료(24h)까지 조용히 동작하는 것처럼 보인다.
    """
    _write_disk_token(app_key="old-key")
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    assert kis.get_access_token("new-key", SECRET) == "tok-abc"  # 재발급됨


def test_memory_token_from_other_appkey_not_reused(monkeypatch):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    kis.get_access_token(KEY, SECRET)
    # 다른 키로 요청 → 메모리 토큰 재사용 금지, 발급 시도(그리고 여기선 403)
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(403, {"error_code": "EGW00121"}))
    with pytest.raises(kis.KISAuthError):
        kis.get_access_token("other-key", SECRET)


def test_token_persisted_to_disk(monkeypatch):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    kis.get_access_token(KEY, SECRET)
    saved = json.loads(kis.TOKEN_FILE.read_text(encoding="utf-8"))
    assert saved["access_token"] == "tok-abc"
    assert saved["expires_at"] > time.time()


def test_corrupt_token_file_ignored(monkeypatch):
    kis.TOKEN_FILE.write_text("{not json", encoding="utf-8")
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    assert kis.get_access_token(KEY, SECRET) == "tok-abc"


def test_missing_keys_raise_auth_error():
    with pytest.raises(kis.KISAuthError):
        kis.get_access_token("", "")


def test_token_issue_not_retried(monkeypatch):
    """발급은 1분 1회 제한 — 실패해도 재시도하면 안 된다(EGW00133 낭비)."""
    calls = []
    monkeypatch.setattr(
        kis.requests,
        "post",
        lambda *a, **k: (
            calls.append(1),
            FakeResp(403, {"error_code": "EGW00133", "error_description": "토큰 존재"}),
        )[1],
    )
    with pytest.raises(kis.KISAuthError) as ei:
        kis.get_access_token(KEY, SECRET)
    assert len(calls) == 1
    assert ei.value.msg_cd == "EGW00133"


# ── 현재가: 인증 실패는 Mock 으로 숨기지 않는다 ────────────────
def test_auth_error_not_masked_as_mock(monkeypatch):
    monkeypatch.setattr(
        kis.requests, "post", lambda *a, **k: FakeResp(403, {"error_code": "EGW00121"})
    )
    with pytest.raises(kis.KISAuthError):
        kis.build_current_price("005930", "bogus", "bogus")


def test_price_401_triggers_one_forced_refresh(monkeypatch):
    """서버가 토큰을 거부하면 1회 재발급 후 재시도. 두 번째 401 은 KISAuthError."""
    posts, gets = [], []
    monkeypatch.setattr(
        kis.requests, "post", lambda *a, **k: (posts.append(1), FakeResp(200, _token_body()))[1]
    )
    monkeypatch.setattr(
        kis.requests, "get", lambda *a, **k: (gets.append(1), FakeResp(401, None, "unauthorized"))[1]
    )
    with pytest.raises(kis.KISAuthError):
        kis.build_current_price("005930", KEY, SECRET)
    assert len(posts) == 2   # 최초 발급 + 강제 갱신 1회
    assert len(gets) == 2    # 재발급 후 재시도 1회 (재시도 루프가 더 돌지 않음)


def test_price_401_then_success(monkeypatch):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    responses = [FakeResp(401, None, "expired"), FakeResp(200, {"rt_cd": "0", "output": OK_OUTPUT})]
    monkeypatch.setattr(kis.requests, "get", lambda *a, **k: responses.pop(0))
    data = kis.build_current_price("005930", KEY, SECRET)
    assert data["price"] == 78900
    assert data["mock"] is False


# ── 현재가: 데이터 실패 → 재시도 → stale → Mock ───────────────
def test_current_price_normalizes_output(monkeypatch):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(
        kis.requests, "get", lambda *a, **k: FakeResp(200, {"rt_cd": "0", "output": OK_OUTPUT})
    )
    data = kis.build_current_price("005930", KEY, SECRET)
    assert data["ticker"] == "005930"
    assert data["market"] == "KOSPI200"
    assert data["sector"] == "전기·전자"
    assert data["price"] == 78900
    assert data["change"] == 900
    assert data["change_pct"] == 1.15
    assert data["volume"] == 12345678
    assert (data["source"], data["mock"], data["stale"]) == ("kis", False, False)


def test_data_error_falls_back_to_mock_when_no_cache(monkeypatch):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(
        kis.requests, "get", lambda *a, **k: FakeResp(200, {"rt_cd": "1", "msg_cd": "X", "msg1": "err"})
    )
    data = kis.build_current_price("005930", KEY, SECRET)
    assert data["mock"] is True
    assert data["source"] == "mock"
    assert data["stale"] is False


def test_data_error_falls_back_to_stale_cache(monkeypatch):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    ok = FakeResp(200, {"rt_cd": "0", "output": OK_OUTPUT})
    monkeypatch.setattr(kis.requests, "get", lambda *a, **k: ok)
    first = kis.build_current_price("005930", KEY, SECRET)
    assert first["stale"] is False

    kis._PRICE_CACHE["005930"]["ts"] = time.time() - 999  # TTL 만료시켜 재요청 유도
    monkeypatch.setattr(kis.requests, "get", lambda *a, **k: FakeResp(500, None, "boom"))
    stale = kis.build_current_price("005930", KEY, SECRET)
    assert stale["stale"] is True
    assert stale["mock"] is False
    assert stale["price"] == 78900  # 직전 실데이터 유지


def test_data_error_retried(monkeypatch):
    """데이터 실패는 재시도한다 (총 3회 시도)."""
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    calls = []
    monkeypatch.setattr(
        kis.requests, "get", lambda *a, **k: (calls.append(1), FakeResp(500, None, "boom"))[1]
    )
    kis.build_current_price("005930", KEY, SECRET)
    assert len(calls) == kis._FETCH_RETRIES + 1


def test_price_cache_ttl(monkeypatch):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    calls = []
    monkeypatch.setattr(
        kis.requests,
        "get",
        lambda *a, **k: (calls.append(1), FakeResp(200, {"rt_cd": "0", "output": OK_OUTPUT}))[1],
    )
    kis.build_current_price("005930", KEY, SECRET)
    kis.build_current_price("005930", KEY, SECRET)
    assert len(calls) == 1  # TTL 내 두 번째는 캐시


def test_mock_current_price_schema():
    data = kis.mock_current_price("005930")
    assert set(data) >= {"ticker", "price", "change_pct", "as_of", "source", "mock", "stale"}
    assert data["mock"] is True


# ── 분봉: 가짜 KIS 분봉 서버 ───────────────────────────────────
# 2026-07-09 정규장 09:00~15:30 = 391 봉.
# stck_cntg_hour 는 봉의 **시작** 시각이다(실 응답 확인). 첫 봉이 090000.
_SESSION_START = datetime.datetime(2026, 7, 9, 9, 0)
_SESSION_BARS = 391


def _row_for(i: int) -> dict:
    ts = _SESSION_START + datetime.timedelta(minutes=i)
    close = 70_000 + i
    return {
        "stck_bsop_date": ts.strftime("%Y%m%d"),
        "stck_cntg_hour": ts.strftime("%H%M%S"),
        "stck_oprc": str(close - 10),
        "stck_hgpr": str(close + 20),
        "stck_lwpr": str(close - 30),
        "stck_prpr": str(close),
        "cntg_vol": str(1_000 + i),
    }


ALL_ROWS = [_row_for(i) for i in range(_SESSION_BARS)]


def _fake_minute_get(calls: list):
    """FID_INPUT_HOUR_1 이전 30봉을 최신→과거 순으로. 실제 KIS 페이징과 같은 규약."""

    def _get(url, headers=None, params=None, **k):
        calls.append(params["FID_INPUT_HOUR_1"])
        assert headers["tr_id"] == kis.TR_MINUTE_OHLCV
        upto = params["FID_INPUT_HOUR_1"]
        rows = [r for r in ALL_ROWS if r["stck_cntg_hour"] <= upto]
        page = sorted(rows, key=lambda r: r["stck_cntg_hour"], reverse=True)[:30]
        return FakeResp(200, {"rt_cd": "0", "output1": {}, "output2": page})

    return _get


@pytest.fixture
def kis_minute(monkeypatch):
    """토큰 발급 + 분봉 페이징을 가짜로. 반환값은 호출된 기준시각 목록."""
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    calls: list = []
    monkeypatch.setattr(kis.requests, "get", _fake_minute_get(calls))
    return calls


def test_minute_ohlcv_schema_matches_mock(kis_minute):
    """프론트가 안 바뀌려면 MockProvider 와 컬럼·인덱스·정렬이 같아야 한다."""
    from backend.core.providers import MockProvider

    df = kis.build_minute_ohlcv("005930", KEY, SECRET, bars=240)
    mock = MockProvider(bars=240).get_minute_ohlcv("005930")

    assert list(df.columns) == list(mock.columns) == ["open", "high", "low", "close", "volume"]
    assert isinstance(df.index, pd.DatetimeIndex)
    assert df.index.is_monotonic_increasing
    assert len(df) == 240
    assert (df.attrs["source"], df.attrs["mock"], df.attrs["stale"]) == ("kis", False, False)
    # 마지막 봉 = 세션 마지막 봉(15:30 시작). 값이 정규화돼 들어왔는지.
    last = df.iloc[-1]
    assert df.index[-1] == datetime.datetime(2026, 7, 9, 15, 30)
    assert last["close"] == 70_000 + _SESSION_BARS - 1
    assert last["high"] == last["close"] + 20
    assert last["volume"] == 1_000 + _SESSION_BARS - 1
    # OHLC 관계가 깨지지 않았는지 (컬럼 매핑 실수 방지)
    assert (df["high"] >= df[["open", "close"]].max(axis=1)).all()
    assert (df["low"] <= df[["open", "close"]].min(axis=1)).all()


def test_minute_ohlcv_pages_backwards_until_enough(kis_minute):
    """응답 1건당 30봉 — 240봉이면 정확히 8회 호출, 기준시각은 과거로 밀린다."""
    df = kis.build_minute_ohlcv("005930", KEY, SECRET, bars=240)
    assert len(kis_minute) == 8
    assert kis_minute[0] == "153000"
    assert kis_minute[1] == "150000"  # 15:01 봉 직전
    assert kis_minute == sorted(kis_minute, reverse=True)
    assert len(df) == 240


def test_minute_ohlcv_dedupes_overlapping_pages(kis_minute):
    df = kis.build_minute_ohlcv("005930", KEY, SECRET, bars=240)
    assert df.index.is_unique


def test_minute_ohlcv_capped_by_max_pages(kis_minute):
    """페이징은 무한하지 않다 — 12페이지(360봉)에서 끊긴다."""
    df = kis.build_minute_ohlcv("005930", KEY, SECRET, bars=400)
    assert len(kis_minute) == kis._MINUTE_MAX_PAGES
    assert len(df) == 30 * kis._MINUTE_MAX_PAGES


def test_minute_ohlcv_stops_at_market_open(monkeypatch, kis_minute):
    """장 시작 이전으로는 안 내려간다. 세션 전체(391봉)를 긁고 멈춘다."""
    monkeypatch.setattr(kis, "_MINUTE_MAX_PAGES", 20)
    df = kis.build_minute_ohlcv("005930", KEY, SECRET, bars=500)
    assert len(df) == _SESSION_BARS
    assert df.index[0] == datetime.datetime(2026, 7, 9, 9, 0)


def test_minute_ohlcv_resampled_for_multi_minute_interval(kis_minute):
    """KIS 는 1분봉만 준다. 5m 는 1분봉 5개를 합쳐 만든다 (o=first, h=max, v=sum).

    봉 시각이 **시작** 시각이므로 15:00 봉은 15:00~15:04 의 1분봉 5개를 덮는다.
    """
    df = kis.build_minute_ohlcv("005930", KEY, SECRET, interval="5m", bars=12)
    assert len(df) == 12
    assert (df.index.to_series().diff().dropna() == pd.Timedelta(minutes=5)).all()

    row = df.loc[pd.Timestamp("2026-07-09 15:00")]
    i0 = 360  # 09:00 + 360분 = 15:00
    assert row["open"] == (70_000 + i0) - 10
    assert row["close"] == 70_000 + i0 + 4
    assert row["high"] == (70_000 + i0 + 4) + 20
    assert row["low"] == (70_000 + i0) - 30
    assert row["volume"] == sum(1_000 + i for i in range(i0, i0 + 5))


def test_minute_ohlcv_bad_interval_raises():
    """interval 오타는 조용히 Mock 으로 폴백하면 안 된다 — 호출자 버그다."""
    with pytest.raises(ValueError):
        kis.build_minute_ohlcv("005930", KEY, SECRET, interval="1d")


def test_minute_ohlcv_cache_ttl(kis_minute):
    kis.build_minute_ohlcv("005930", KEY, SECRET, bars=60)
    n = len(kis_minute)
    kis.build_minute_ohlcv("005930", KEY, SECRET, bars=60)
    assert len(kis_minute) == n  # TTL 내 두 번째는 캐시


def test_minute_ohlcv_auth_error_not_masked_as_mock(monkeypatch):
    monkeypatch.setattr(
        kis.requests, "post", lambda *a, **k: FakeResp(403, {"error_code": "EGW00121"})
    )
    with pytest.raises(kis.KISAuthError):
        kis.build_minute_ohlcv("005930", "bogus", "bogus")


def test_minute_ohlcv_empty_response_falls_back_to_mock(monkeypatch):
    """장 시작 전·휴장일: KIS 가 빈 output2 를 준다 → Mock (mock=True 로 표시)."""
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(
        kis.requests, "get", lambda *a, **k: FakeResp(200, {"rt_cd": "0", "output2": []})
    )
    df = kis.build_minute_ohlcv("005930", KEY, SECRET, bars=240)
    assert (df.attrs["source"], df.attrs["mock"], df.attrs["stale"]) == ("mock", True, False)
    assert list(df.columns) == ["open", "high", "low", "close", "volume"]
    assert len(df) == 240


def test_minute_ohlcv_data_error_falls_back_to_stale_cache(monkeypatch, kis_minute):
    fresh = kis.build_minute_ohlcv("005930", KEY, SECRET, bars=60)
    assert fresh.attrs["stale"] is False

    kis._OHLCV_CACHE[("005930", "1m")]["ts"] = time.time() - 999  # TTL 만료 → 재요청
    monkeypatch.setattr(kis.requests, "get", lambda *a, **k: FakeResp(500, None, "boom"))
    stale = kis.build_minute_ohlcv("005930", KEY, SECRET, bars=60)

    assert (stale.attrs["mock"], stale.attrs["stale"]) == (False, True)
    pd.testing.assert_frame_equal(stale, fresh)  # 직전 실데이터 유지


def test_minute_ohlcv_data_error_retried(monkeypatch):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    calls = []
    monkeypatch.setattr(
        kis.requests, "get", lambda *a, **k: (calls.append(1), FakeResp(500, None, "boom"))[1]
    )
    kis.build_minute_ohlcv("005930", KEY, SECRET, bars=30)
    assert len(calls) == kis._FETCH_RETRIES + 1


def test_minute_ohlcv_401_triggers_one_forced_refresh(monkeypatch):
    posts, gets = [], []
    monkeypatch.setattr(
        kis.requests, "post", lambda *a, **k: (posts.append(1), FakeResp(200, _token_body()))[1]
    )
    monkeypatch.setattr(
        kis.requests, "get", lambda *a, **k: (gets.append(1), FakeResp(401, None, "unauthorized"))[1]
    )
    with pytest.raises(kis.KISAuthError):
        kis.build_minute_ohlcv("005930", KEY, SECRET, bars=30)
    assert len(posts) == 2
    assert len(gets) == 2


# ── KISProvider 위임 + 나머지 stub 유지 ────────────────────────
def test_provider_delegates_current_price(monkeypatch):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(
        kis.requests, "get", lambda *a, **k: FakeResp(200, {"rt_cd": "0", "output": OK_OUTPUT})
    )
    assert KISProvider(KEY, SECRET).get_current_price("005930")["price"] == 78900


def test_provider_delegates_minute_ohlcv(kis_minute):
    df = KISProvider(KEY, SECRET).get_minute_ohlcv("005930")
    assert len(df) == kis.DEFAULT_MINUTE_BARS
    assert df.attrs["source"] == "kis"


def test_kis_provider_current_price_is_abc_method():
    """get_current_price 가 StockProvider 인터페이스로 승격됐고 Mock 도 구현한다."""
    from backend.core.providers import MockProvider, StockProvider

    assert "get_current_price" in StockProvider.__abstractmethods__
    px = MockProvider().get_current_price("005930")
    assert set(px) >= {"ticker", "price", "change", "change_pct", "open", "high",
                       "low", "volume", "as_of", "source", "mock", "stale"}
    assert px["price"] > 0 and px["mock"] is True
