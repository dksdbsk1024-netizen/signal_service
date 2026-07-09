"""core.kis — 토큰 캐시/갱신, 인증실패 vs 데이터실패 구분, 현재가 폴백 체인.

네트워크를 타지 않는다. monkeypatch 로 requests.post/get 을 대체한다.
"""

import json
import time

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
    """캐시·토큰 파일을 테스트마다 격리. 재시도 백오프는 0 으로."""
    monkeypatch.setattr(kis, "_TOKEN", {})
    monkeypatch.setattr(kis, "_PRICE_CACHE", {})
    monkeypatch.setattr(kis, "TOKEN_FILE", tmp_path / ".kis_token.json")
    monkeypatch.setattr(kis, "_RETRY_BACKOFF_SEC", 0)


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


# ── KISProvider 위임 + 나머지 stub 유지 ────────────────────────
def test_provider_delegates_current_price(monkeypatch):
    monkeypatch.setattr(kis.requests, "post", lambda *a, **k: FakeResp(200, _token_body()))
    monkeypatch.setattr(
        kis.requests, "get", lambda *a, **k: FakeResp(200, {"rt_cd": "0", "output": OK_OUTPUT})
    )
    assert KISProvider(KEY, SECRET).get_current_price("005930")["price"] == 78900


def test_kis_provider_current_price_is_abc_method():
    """get_current_price 가 StockProvider 인터페이스로 승격됐고 Mock 도 구현한다."""
    from backend.core.providers import MockProvider, StockProvider

    assert "get_current_price" in StockProvider.__abstractmethods__
    px = MockProvider().get_current_price("005930")
    assert set(px) >= {"ticker", "price", "change", "change_pct", "open", "high",
                       "low", "volume", "as_of", "source", "mock", "stale"}
    assert px["price"] > 0 and px["mock"] is True
