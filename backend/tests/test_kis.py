"""core.kis — 토큰 캐시/갱신, 인증실패 vs 데이터실패 구분, 현재가·분봉·호가 폴백 체인.

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
    monkeypatch.setattr(kis, "_ORDERBOOK_CACHE", {})
    monkeypatch.setattr(kis, "_FLOW_CACHE", {})
    monkeypatch.setattr(kis, "_FLOW_SERIES_CACHE", {})
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


# ── 호가: 10호가 정규화 + 폴백 체인 ────────────────────────────
# 실 응답(005930, 2026-07-09 10:02) 구조 그대로. 매도는 askp1 이 최저, 매수는 bidp1 이 최고.
def _orderbook_output(ask1: int = 286_500, tick: int = 500) -> dict:
    # total_*_rsqn 은 실 응답에서 10호가 잔량 합과 정확히 일치한다. 픽스처도 그렇게 맞춘다.
    out = {
        "aspr_acpt_hour": "100226",
        "total_askp_rsqn": str(sum(1_000 * i for i in range(1, 11))),   # 55,000
        "total_bidp_rsqn": str(sum(2_000 * i for i in range(1, 11))),   # 110,000
    }
    for i in range(1, 11):
        out[f"askp{i}"] = str(ask1 + tick * (i - 1))
        out[f"bidp{i}"] = str(ask1 - tick * i)
        out[f"askp_rsqn{i}"] = str(1_000 * i)
        out[f"bidp_rsqn{i}"] = str(2_000 * i)
    return out


OK_BOOK = {"rt_cd": "0", "output1": _orderbook_output(), "output2": {}}


def _fake_book_get(body=OK_BOOK, calls: list | None = None):
    def _get(url, headers=None, params=None, **k):
        if calls is not None:
            calls.append(params["FID_INPUT_ISCD"])
        assert headers["tr_id"] == kis.TR_ORDERBOOK
        return FakeResp(200, body)

    return _get


def test_orderbook_schema_matches_mock(monkeypatch):
    """프론트가 안 바뀌려면 MockProvider.get_orderbook 과 키·구조가 같아야 한다."""
    from backend.core.providers import MockProvider

    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(kis.requests, "get", _fake_book_get())
    book = kis.build_orderbook("005930", KEY, SECRET)
    mock = MockProvider().get_orderbook("005930")

    assert set(book) >= set(mock)  # asks/bids/as_of 는 최소 보장
    for side in ("asks", "bids"):
        assert len(book[side]) == len(mock[side]) == kis.ORDERBOOK_LEVELS
        assert all(set(r) == {"price", "qty"} for r in book[side])
        assert all(isinstance(r["price"], int) and isinstance(r["qty"], int) for r in book[side])
    assert (book["source"], book["mock"], book["stale"]) == ("kis", False, False)


def test_orderbook_normalizes_korean_convention(monkeypatch):
    """asks[0] = 최우선 매도(최저가), bids[0] = 최우선 매수(최고가). ask1 > bid1."""
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(kis.requests, "get", _fake_book_get())
    book = kis.build_orderbook("005930", KEY, SECRET)

    asks, bids = book["asks"], book["bids"]
    assert asks[0] == {"price": 286_500, "qty": 1_000}
    assert asks[-1] == {"price": 291_000, "qty": 10_000}
    assert bids[0] == {"price": 286_000, "qty": 2_000}
    assert bids[-1] == {"price": 281_500, "qty": 20_000}
    assert [r["price"] for r in asks] == sorted(r["price"] for r in asks)
    assert [r["price"] for r in bids] == sorted((r["price"] for r in bids), reverse=True)
    assert asks[0]["price"] > bids[0]["price"]

    # 총잔량 == 10호가 잔량 합 (실 응답에서 확인). 잔량 필드 매핑이 틀리면 여기서 깨진다.
    assert book["total_ask_qty"] == sum(r["qty"] for r in asks) == 55_000
    assert book["total_bid_qty"] == sum(r["qty"] for r in bids) == 110_000


def test_orderbook_as_of_uses_accept_hour(monkeypatch):
    """as_of 는 수신 시각이 아니라 호가 접수 시각(aspr_acpt_hour). 초까지 남긴다."""
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(kis.requests, "get", _fake_book_get())
    book = kis.build_orderbook("005930", KEY, SECRET)
    assert book["as_of"].endswith(" 10:02:26 KST")


def test_orderbook_all_zero_prices_falls_back_to_mock(monkeypatch):
    """장 마감 후·휴장일: rt_cd=0 이지만 가격이 전부 0 → 데이터 실패 → Mock."""
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    zeros = {f"{s}{i}": "0" for s in ("askp", "bidp") for i in range(1, 11)}
    zeros["askp1"] = "0"
    body = {"rt_cd": "0", "output1": {**zeros, "aspr_acpt_hour": "180000"}}
    # askp1 = "0" 은 falsy 가 아니므로 _fetch 를 통과하고 _normalize 에서 걸러진다.
    monkeypatch.setattr(kis.requests, "get", _fake_book_get(body))
    book = kis.build_orderbook("005930", KEY, SECRET)
    assert (book["source"], book["mock"], book["stale"]) == ("mock", True, False)
    assert len(book["asks"]) == kis.ORDERBOOK_LEVELS


def test_orderbook_auth_error_not_masked_as_mock(monkeypatch):
    monkeypatch.setattr(
        kis.requests, "post", lambda *a, **k: FakeResp(403, {"error_code": "EGW00121"})
    )
    with pytest.raises(kis.KISAuthError):
        kis.build_orderbook("005930", "bogus", "bogus")


def test_orderbook_data_error_falls_back_to_mock_when_no_cache(monkeypatch):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(
        kis.requests, "get", lambda *a, **k: FakeResp(200, {"rt_cd": "1", "msg_cd": "X", "msg1": "err"})
    )
    book = kis.build_orderbook("005930", KEY, SECRET)
    assert (book["source"], book["mock"], book["stale"]) == ("mock", True, False)


def test_orderbook_data_error_falls_back_to_stale_cache(monkeypatch):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(kis.requests, "get", _fake_book_get())
    fresh = kis.build_orderbook("005930", KEY, SECRET)
    assert fresh["stale"] is False

    kis._ORDERBOOK_CACHE["005930"]["ts"] = time.time() - 999  # TTL 만료 → 재요청
    monkeypatch.setattr(kis.requests, "get", lambda *a, **k: FakeResp(500, None, "boom"))
    stale = kis.build_orderbook("005930", KEY, SECRET)

    assert (stale["mock"], stale["stale"]) == (False, True)
    assert stale["asks"] == fresh["asks"]  # 직전 실데이터 유지


def test_orderbook_data_error_retried(monkeypatch):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    calls = []
    monkeypatch.setattr(
        kis.requests, "get", lambda *a, **k: (calls.append(1), FakeResp(500, None, "boom"))[1]
    )
    kis.build_orderbook("005930", KEY, SECRET)
    assert len(calls) == kis._FETCH_RETRIES + 1


def test_orderbook_401_triggers_one_forced_refresh(monkeypatch):
    posts, gets = [], []
    monkeypatch.setattr(
        kis.requests, "post", lambda *a, **k: (posts.append(1), FakeResp(200, _token_body()))[1]
    )
    monkeypatch.setattr(
        kis.requests, "get", lambda *a, **k: (gets.append(1), FakeResp(401, None, "unauthorized"))[1]
    )
    with pytest.raises(kis.KISAuthError):
        kis.build_orderbook("005930", KEY, SECRET)
    assert len(posts) == 2   # 최초 발급 + 강제 갱신 1회
    assert len(gets) == 2    # 재발급 후 재시도 1회


def test_orderbook_cache_ttl(monkeypatch):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    calls: list = []
    monkeypatch.setattr(kis.requests, "get", _fake_book_get(calls=calls))
    kis.build_orderbook("005930", KEY, SECRET)
    kis.build_orderbook("005930", KEY, SECRET)
    assert len(calls) == 1  # TTL 내 두 번째는 캐시


def test_orderbook_cache_not_poisoned_by_caller(monkeypatch):
    """캐시본을 얕은 복사로 주면 호출자가 asks 를 건드릴 때 캐시가 오염된다."""
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(kis.requests, "get", _fake_book_get())
    first = kis.build_orderbook("005930", KEY, SECRET)
    first["asks"][0]["qty"] = -1
    first["asks"].clear()

    second = kis.build_orderbook("005930", KEY, SECRET)  # TTL 내 → 캐시본
    assert len(second["asks"]) == kis.ORDERBOOK_LEVELS
    assert second["asks"][0]["qty"] == 1_000


def test_mock_orderbook_schema():
    book = kis.mock_orderbook("005930")
    assert set(book) >= {"ticker", "asks", "bids", "as_of", "source", "mock", "stale"}
    assert book["mock"] is True
    assert len(book["asks"]) == len(book["bids"]) == kis.ORDERBOOK_LEVELS


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


def test_provider_delegates_orderbook(monkeypatch):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(kis.requests, "get", _fake_book_get())
    book = KISProvider(KEY, SECRET).get_orderbook("005930")
    assert book["asks"][0]["price"] == 286_500
    assert book["source"] == "kis"


def test_kis_provider_unimplemented_trs_fall_back_to_mock():
    """체결강도·거래원은 TR 미연동 → Mock 위임. 앱이 NotImplementedError 로 죽지 않는다.

    체결강도는 별도 TR(FHKST01010300)이 필요하다.
    """
    p = KISProvider(KEY, SECRET)

    strength = p.get_trade_strength("005930")
    assert strength["strength"] > 0 and strength["mock"] is True

    brokers = p.get_broker_activity("005930")
    assert brokers and all(r["mock"] is True for r in brokers)


def test_kis_provider_current_price_is_abc_method():
    """get_current_price 가 StockProvider 인터페이스로 승격됐고 Mock 도 구현한다."""
    from backend.core.providers import MockProvider, StockProvider

    assert "get_current_price" in StockProvider.__abstractmethods__
    px = MockProvider().get_current_price("005930")
    assert set(px) >= {"ticker", "price", "change", "change_pct", "open", "high",
                       "low", "volume", "as_of", "source", "mock", "stale"}
    assert px["price"] > 0 and px["mock"] is True


# ── 수급: 확정치/추정치 선택 + 단위 환산 + 폴백 체인 ───────────
# 실 응답(005930) 구조 그대로. 확정 순매수 대금은 **백만원**, 프로그램은 **원**.
TODAY = "20260709"
YESTERDAY = "20260708"

# 개인+외국인+기관 ≈ 0 (실데이터의 항등식). 억원으로는 +5,837 / -8,710 / +2,836.
_CONFIRMED = {
    "stck_bsop_date": YESTERDAY, "stck_clpr": "277500",
    "prsn_ntby_qty": "2031705", "frgn_ntby_qty": "-3015093", "orgn_ntby_qty": "971031",
    "prsn_ntby_tr_pbmn": "583729", "frgn_ntby_tr_pbmn": "-870963",
    "orgn_ntby_tr_pbmn": "283642",
}
# 당일 행은 장중 내내 순매수 필드가 빈 문자열이다 — 확정은 장 종료 후.
_PENDING = {
    "stck_bsop_date": TODAY, "stck_clpr": "289000",
    "prsn_ntby_qty": "", "frgn_ntby_qty": "", "orgn_ntby_qty": "",
    "prsn_ntby_tr_pbmn": "", "frgn_ntby_tr_pbmn": "", "orgn_ntby_tr_pbmn": "",
}


def _investor_rows(n: int = 25, pending: bool = True) -> list[dict]:
    """최신→과거. pending=True 면 첫 행이 당일 미확정 행(장중)."""
    rows = [dict(_PENDING)] if pending else []
    for i in range(n):
        r = dict(_CONFIRMED)
        r["stck_bsop_date"] = f"202607{8 - i:02d}" if i < 8 else f"202606{38 - i:02d}"
        # 날짜별로 값을 달리해 순서 뒤집힘을 잡을 수 있게.
        r["frgn_ntby_tr_pbmn"] = str(-870963 - i * 1000)
        rows.append(r)
    return rows


def _program_rows(n: int = 25) -> list[dict]:
    # -580,895,102,500 원 = -5,808.95 억원.
    rows = [{"stck_bsop_date": TODAY, "whol_smtn_ntby_tr_pbmn": "326026179500"}]
    for i in range(n):
        d = f"202607{8 - i:02d}" if i < 8 else f"202606{38 - i:02d}"
        rows.append({"stck_bsop_date": d, "whol_smtn_ntby_tr_pbmn": str(-580895102500 - i * 10**9)})
    return rows


# 가집계 추정치는 **수량(주)**이고 당일 누적이다. bsop_hour_gb 가 클수록 늦은 시각.
_ESTIMATE = [
    {"bsop_hour_gb": "2", "frgn_fake_ntby_qty": "000000000000961000",
     "orgn_fake_ntby_qty": "000000000000468000"},
    {"bsop_hour_gb": "1", "frgn_fake_ntby_qty": "000000000000501000",
     "orgn_fake_ntby_qty": "000000000000000000"},
]


def _fake_flow_get(*, pending=True, estimate=None, calls=None):
    """tr_id 로 분기하는 requests.get 대역. 수급 스냅샷은 최대 4개 TR 을 부른다."""
    est = _ESTIMATE if estimate is None else estimate

    def _get(url, headers=None, params=None, **k):
        tr = headers["tr_id"]
        if calls is not None:
            calls.append(tr)
        if tr == kis.TR_INVESTOR_DAILY:
            return FakeResp(200, {"rt_cd": "0", "output": _investor_rows(pending=pending)})
        if tr == kis.TR_INVESTOR_ESTIMATE:
            return FakeResp(200, {"rt_cd": "0", "output2": est})
        if tr == kis.TR_PROGRAM_DAILY:
            return FakeResp(200, {"rt_cd": "0", "output": _program_rows()})
        if tr == kis.TR_CURRENT_PRICE:  # 추정 수량 → 억원 환산용
            return FakeResp(200, {"rt_cd": "0", "output": OK_OUTPUT})
        raise AssertionError(f"예상치 못한 tr_id: {tr}")

    return _get


@pytest.fixture
def flow_clock(monkeypatch):
    """'오늘'을 고정. 안 그러면 확정치/추정치 분기가 실행 날짜에 따라 달라진다."""
    monkeypatch.setattr(kis, "_today_kst", lambda: TODAY)


def _flow(monkeypatch, **kw):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(kis.requests, "get", _fake_flow_get(**kw))
    return kis.build_investor_flow("005930", KEY, SECRET)


def test_flow_schema_matches_mock(monkeypatch, flow_clock):
    """프론트·스코어링이 안 바뀌려면 MockProvider.get_investor_flow 와 키가 같아야 한다."""
    from backend.core.providers import MockProvider

    flow = _flow(monkeypatch)
    assert set(flow) >= set(MockProvider().get_investor_flow("005930"))
    assert (flow["source"], flow["mock"], flow["stale"]) == ("kis", False, False)
    assert flow["unit"] == "억원"


def test_flow_uses_confirmed_when_today_settled(monkeypatch, flow_clock):
    """장 종료 후: 당일 행이 채워지면 확정치. 백만원 → 억원(/100)."""
    flow = _flow(monkeypatch, pending=False)
    assert flow["estimated"] is False
    assert flow["foreign"] == -8709.6      # -870,963 백만원
    assert flow["institution"] == 2836.4
    assert flow["retail"] == 5837.3
    assert flow["program"] == -5809.0      # -580,895,102,500 원 / 1e8
    assert "확정" in flow["as_of"]


def test_flow_confirmed_satisfies_investor_identity(monkeypatch, flow_clock):
    """개인+외국인+기관 ≈ 0. 단위 환산이 틀리면 이 항등식이 먼저 깨진다."""
    flow = _flow(monkeypatch, pending=False)
    total = flow["foreign"] + flow["institution"] + flow["retail"]
    assert abs(total) < 0.05 * sum(abs(flow[k]) for k in ("foreign", "institution", "retail"))


def test_flow_uses_intraday_estimate_when_today_pending(monkeypatch, flow_clock):
    """장중: 당일 행이 비면 가집계 추정치 × 현재가. bsop_hour_gb 가 가장 큰 행을 쓴다."""
    flow = _flow(monkeypatch)
    price = int(OK_OUTPUT["stck_prpr"])  # 78,900
    assert flow["estimated"] is True
    assert flow["foreign"] == round(961_000 * price / 1e8, 1)     # 구간 2(누적), 구간 1 아님
    assert flow["institution"] == round(468_000 * price / 1e8, 1)
    # 추정 TR 에 개인은 없다 — Mock 과 같은 근사(반대편).
    assert flow["retail"] == round(-(flow["foreign"] + flow["institution"]), 1)
    assert flow["program"] == 3260.3      # 당일 프로그램은 장중에도 실시간 누적
    assert "장중 추정" in flow["as_of"] and TODAY[:4] in flow["as_of"]


def test_flow_skips_estimate_call_when_confirmed(monkeypatch, flow_clock):
    """확정치 경로에선 추정 TR·현재가 TR 을 아예 안 부른다(호출 절약)."""
    calls: list[str] = []
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(kis.requests, "get", _fake_flow_get(pending=False, calls=calls))
    kis.build_investor_flow("005930", KEY, SECRET)
    assert kis.TR_INVESTOR_ESTIMATE not in calls
    assert kis.TR_CURRENT_PRICE not in calls


def test_flow_falls_back_to_last_confirmed_row_when_no_estimate(monkeypatch, flow_clock):
    """개장~09:30 이나 휴장일: 당일 미확정 + 추정치 없음 → 직전 확정일. as_of 에 날짜가 남는다."""
    flow = _flow(monkeypatch, estimate=[])
    assert flow["estimated"] is False
    assert flow["foreign"] == -8709.6
    assert "2026-07-08 확정" == flow["as_of"]  # 오늘(07-09)이 아님을 as_of 가 드러낸다


def test_flow_all_zero_falls_back_to_mock(monkeypatch, flow_clock):
    """호가의 '전 단계가 0' 과 같은 취급 — 세 값이 모두 0 이면 데이터 실패."""
    zero = dict(_CONFIRMED, frgn_ntby_tr_pbmn="0", orgn_ntby_tr_pbmn="0",
                prsn_ntby_tr_pbmn="0")

    def _get(url, headers=None, params=None, **k):
        tr = headers["tr_id"]
        if tr == kis.TR_INVESTOR_DAILY:
            return FakeResp(200, {"rt_cd": "0", "output": [zero]})
        if tr == kis.TR_PROGRAM_DAILY:
            return FakeResp(200, {"rt_cd": "0",
                                  "output": [{"stck_bsop_date": YESTERDAY,
                                              "whol_smtn_ntby_tr_pbmn": "0"}]})
        return FakeResp(200, {"rt_cd": "0", "output2": []})

    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(kis.requests, "get", _get)
    flow = kis.build_investor_flow("005930", KEY, SECRET)
    assert flow["mock"] is True and flow["source"] == "mock"


def test_flow_estimate_not_converted_with_mock_price(monkeypatch, flow_clock):
    """현재가가 Mock 이면 추정 수량을 억원으로 못 바꾼다 — 실데이터인 척하는 값 금지."""
    def _get(url, headers=None, params=None, **k):
        tr = headers["tr_id"]
        if tr == kis.TR_INVESTOR_DAILY:
            return FakeResp(200, {"rt_cd": "0", "output": _investor_rows()})
        if tr == kis.TR_INVESTOR_ESTIMATE:
            return FakeResp(200, {"rt_cd": "0", "output2": _ESTIMATE})
        if tr == kis.TR_PROGRAM_DAILY:
            return FakeResp(200, {"rt_cd": "0", "output": _program_rows()})
        raise kis.requests.RequestException("현재가 실패")  # → build_current_price 가 Mock 반환

    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(kis.requests, "get", _get)
    flow = kis.build_investor_flow("005930", KEY, SECRET)
    assert flow["mock"] is True  # 스냅샷 전체가 Mock 폴백. 추정치를 Mock 가격으로 환산하지 않음


def test_flow_auth_error_not_masked_as_mock(monkeypatch, flow_clock):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(401, {}, "bad key"))
    with pytest.raises(kis.KISAuthError):
        kis.build_investor_flow("005930", "bogus", "bogus")


def test_flow_data_error_falls_back_to_mock_when_no_cache(monkeypatch, flow_clock):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(kis.requests, "get",
                        lambda *a, **k: FakeResp(200, {"rt_cd": "1", "msg1": "오류"}))
    flow = kis.build_investor_flow("005930", KEY, SECRET)
    assert flow["mock"] is True and flow["source"] == "mock"


def test_flow_data_error_falls_back_to_stale_cache(monkeypatch, flow_clock):
    fresh = _flow(monkeypatch, pending=False)
    assert fresh["stale"] is False
    kis._FLOW_CACHE["005930"]["ts"] = 0  # TTL 만료
    monkeypatch.setattr(kis.requests, "get",
                        lambda *a, **k: FakeResp(200, {"rt_cd": "1", "msg1": "오류"}))
    stale = kis.build_investor_flow("005930", KEY, SECRET)
    assert stale["stale"] is True and stale["mock"] is False
    assert stale["foreign"] == fresh["foreign"]


def test_flow_cache_ttl(monkeypatch, flow_clock):
    calls: list[str] = []
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(kis.requests, "get", _fake_flow_get(pending=False, calls=calls))
    kis.build_investor_flow("005930", KEY, SECRET)
    kis.build_investor_flow("005930", KEY, SECRET)
    assert calls.count(kis.TR_INVESTOR_DAILY) == 1  # 두 번째는 캐시


def test_flow_cache_not_poisoned_by_caller(monkeypatch, flow_clock):
    first = _flow(monkeypatch, pending=False)
    first["foreign"] = 999.9
    second = kis.build_investor_flow("005930", KEY, SECRET)  # TTL 내 → 캐시본
    assert second["foreign"] == -8709.6


def test_flow_401_triggers_one_forced_refresh(monkeypatch, flow_clock):
    posts, gets = [], []

    def _post(*a, **k):
        posts.append(1)
        return FakeResp(200, _token_body())

    def _get(url, headers=None, params=None, **k):
        gets.append(1)
        return FakeResp(401, {}, "token expired")

    monkeypatch.setattr(kis.requests, "post", _post)
    monkeypatch.setattr(kis.requests, "get", _get)
    with pytest.raises(kis.KISAuthError):
        kis.build_investor_flow("005930", KEY, SECRET)
    assert len(posts) == 2  # 최초 발급 + 강제 재발급 1회
    assert len(gets) == 2


# ── 수급 시계열 ────────────────────────────────────────────────
def _series(monkeypatch, days=kis.DEFAULT_FLOW_DAYS, **kw):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(kis.requests, "get", _fake_flow_get(**kw))
    return kis.build_investor_flow_series("005930", KEY, SECRET, days)


def test_series_schema_matches_mock(monkeypatch, flow_clock):
    from backend.core.providers import MockProvider

    series = _series(monkeypatch)
    assert set(series) >= set(MockProvider().get_investor_flow_series("005930"))
    assert (series["source"], series["mock"], series["stale"]) == ("kis", False, False)


def test_series_excludes_pending_today_row(monkeypatch, flow_clock):
    """장중 추정치를 확정 막대와 같은 차트에 섞지 않는다 — 오늘은 빠진다."""
    series = _series(monkeypatch)
    assert kis._mmdd(TODAY) not in series["dates"]
    assert series["dates"][-1] == kis._mmdd(YESTERDAY)
    assert series["as_of"] == "2026-07-08 확정"


def test_series_is_oldest_first(monkeypatch, flow_clock):
    """KIS 는 최신→과거. 차트는 왼쪽이 과거여야 하므로 뒤집혀 나와야 한다."""
    series = _series(monkeypatch)
    # 픽스처는 과거로 갈수록 외국인 순매도가 커진다 → 오름차순 정렬이면 마지막이 가장 큼.
    assert series["foreign"][-1] == -8709.6
    assert series["foreign"][0] < series["foreign"][-1]
    assert len(series["dates"]) == kis.DEFAULT_FLOW_DAYS


def test_series_days_capped_at_30(monkeypatch, flow_clock):
    """두 TR 모두 1회 호출당 30 영업일이고 페이징이 없다."""
    series = _series(monkeypatch, days=90)
    assert len(series["dates"]) <= kis.FLOW_MAX_DAYS


def test_series_rejects_bad_days(monkeypatch, flow_clock):
    """days 오류는 폴백 대상이 아니다 — interval 오류와 같은 규약."""
    with pytest.raises(ValueError):
        kis.build_investor_flow_series("005930", KEY, SECRET, days=0)


def test_series_data_error_falls_back_to_mock(monkeypatch, flow_clock):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(kis.requests, "get",
                        lambda *a, **k: FakeResp(200, {"rt_cd": "1", "msg1": "오류"}))
    series = kis.build_investor_flow_series("005930", KEY, SECRET)
    assert series["mock"] is True and len(series["dates"]) == kis.DEFAULT_FLOW_DAYS


def test_series_auth_error_not_masked_as_mock(monkeypatch, flow_clock):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(401, {}, "bad key"))
    with pytest.raises(kis.KISAuthError):
        kis.build_investor_flow_series("005930", "bogus", "bogus")


def test_series_cache_not_poisoned_by_caller(monkeypatch, flow_clock):
    first = _series(monkeypatch)
    first["foreign"][0] = 999.9
    first["dates"].append("99/99")
    second = kis.build_investor_flow_series("005930", KEY, SECRET)  # TTL 내 → 캐시본
    assert second["foreign"][0] != 999.9
    assert len(second["dates"]) == kis.DEFAULT_FLOW_DAYS


def test_provider_delegates_flow(monkeypatch, flow_clock):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(kis.requests, "get", _fake_flow_get(pending=False))
    p = KISProvider(KEY, SECRET)
    assert p.get_investor_flow("005930")["foreign"] == -8709.6
    assert p.get_investor_flow_series("005930")["source"] == "kis"
