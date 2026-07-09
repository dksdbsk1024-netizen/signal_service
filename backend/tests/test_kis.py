"""core.kis — 토큰 캐시/갱신, 인증실패 vs 데이터실패 구분.

네트워크를 타지 않는다. monkeypatch 로 requests.post/get 을 대체한다.
"""

import json
import time

import pytest

from backend.core import kis

KEY, SECRET = "appkey", "appsecret"


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
