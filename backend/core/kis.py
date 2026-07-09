"""KIS(한국투자증권) 실연동 — OAuth 토큰 발급·캐시.

core.macro / core.quotes 와 같은 역할 분담: HTTP·캐시·재시도·폴백은 이 모듈이 맡고,
providers.KISProvider 는 얇게 위임만 한다. 로직은 프레임워크 독립.

**인증 실패는 데이터 실패와 다르게 다룬다.** 키가 틀렸는데 조용히 Mock 값이 뜨면
실연동이 안 되는 걸 알아채지 못한다. KISAuthError 는 그대로 위로 던진다.
데이터 실패(rt_cd != "0", 네트워크, 타임아웃)만 재시도·캐시·Mock 폴백 대상이다.

토큰:
    KIS 는 appkey 당 토큰 발급을 **1분에 1회**로 제한한다(초과 시 EGW00133).
    발급된 토큰은 약 24시간 유효하다. 메모리 캐시만 쓰면 프로세스 재시작이나
    `uvicorn --reload` 가 1분 안에 두 번 걸리는 순간 발급이 막히므로,
    토큰을 디스크(TOKEN_FILE)에도 저장해 재시작을 넘어 재사용한다.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path

import requests

from .macro import _FETCH_RETRIES, _RETRY_BACKOFF_SEC  # 재시도 상수 재사용

# 실전투자 도메인. 모의투자(openapivts...:29443)는 이번 단계 범위 밖.
BASE = "https://openapi.koreainvestment.com:9443"
TOKEN_PATH = "/oauth2/tokenP"

# 토큰 캐시 파일. backend/.kis_token.json (gitignore). 프로세스 재시작 넘어 재사용.
TOKEN_FILE = Path(__file__).resolve().parents[1] / ".kis_token.json"

# 만료 10분 전에 미리 갱신. 요청 도중 만료되는 경계 케이스 회피.
_TOKEN_SKEW_SEC = 600


# ── 예외: 인증 실패 ≠ 데이터 실패 ─────────────────────────────
class KISError(Exception):
    """KIS 연동 공통 베이스."""


class KISAuthError(KISError):
    """키 오류·토큰 발급 실패·401/403. 재시도·Mock 폴백 대상이 아니다."""

    def __init__(self, message: str, msg_cd: str = "", msg1: str = ""):
        super().__init__(message)
        self.msg_cd = msg_cd
        self.msg1 = msg1


class KISDataError(KISError):
    """rt_cd != "0", 네트워크, 타임아웃, 파싱 실패. 재시도 → 캐시 → Mock 대상."""

    def __init__(self, message: str, msg_cd: str = "", msg1: str = ""):
        super().__init__(message)
        self.msg_cd = msg_cd
        self.msg1 = msg1


# ── 캐시 (프로세스 수명) ───────────────────────────────────────
# {"access_token": str, "expires_at": epoch_seconds} 또는 빈 dict.
_TOKEN: dict = {}


# ── 재시도: 인증 실패는 재시도하지 않는다 ──────────────────────
def _retry_on_data(once):
    """`once()` 를 최대 `_FETCH_RETRIES` 회 재시도. 모두 실패하면 마지막 예외.

    macro._retry 와 같은 선형 백오프지만 bare `except Exception` 이 아니다.
    KISAuthError 는 재시도해도 결과가 같고, 그 사이 토큰 발급 rate limit 만
    소모하므로 즉시 위로 던진다.
    """
    last_err: Exception | None = None
    for attempt in range(_FETCH_RETRIES + 1):
        try:
            return once()
        except KISAuthError:
            raise
        except Exception as e:  # noqa: BLE001 — 네트워크/HTTP/JSON 모두 재시도 대상
            last_err = e
            if attempt < _FETCH_RETRIES:
                time.sleep(_RETRY_BACKOFF_SEC * (attempt + 1))
    raise last_err  # type: ignore[misc]


# ── 토큰 ───────────────────────────────────────────────────────
def _key_fingerprint(app_key: str) -> str:
    """앱키 지문. 토큰 캐시가 어느 키로 발급됐는지 식별한다(원본 키는 저장 안 함)."""
    return hashlib.sha256(app_key.encode()).hexdigest()[:16]


def _load_token_file(app_key: str) -> dict:
    """디스크 토큰 캐시 로드. 없거나 깨졌거나 **다른 앱키로 발급됐으면** 빈 dict.

    키를 바꿔 끼웠는데 이전 키의 토큰을 재사용하면, 잘못된 키가 24시간 동안
    조용히 동작하는 것처럼 보인다. 지문이 다르면 캐시를 무시하고 재발급한다.
    """
    try:
        with open(TOKEN_FILE, encoding="utf-8") as f:
            data = json.load(f)
        if (
            isinstance(data, dict)
            and data.get("access_token")
            and data.get("expires_at")
            and data.get("key_fp") == _key_fingerprint(app_key)
        ):
            return data
    except (OSError, ValueError):
        pass
    return {}


def _save_token_file(token: dict) -> None:
    """디스크에 토큰 저장. 실패해도 메모리 캐시는 살아있으므로 조용히 넘어간다."""
    try:
        with open(TOKEN_FILE, "w", encoding="utf-8") as f:
            json.dump(token, f)
        os.chmod(TOKEN_FILE, 0o600)  # Windows 에서는 사실상 no-op
    except OSError:
        pass


def _is_fresh(token: dict, app_key: str) -> bool:
    """만료 전(skew 감안)이고 같은 앱키로 발급된 토큰인가."""
    return (
        bool(token)
        and token.get("key_fp") == _key_fingerprint(app_key)
        and token.get("expires_at", 0) - _TOKEN_SKEW_SEC > time.time()
    )


def _issue_token(app_key: str, app_secret: str) -> dict:
    """POST /oauth2/tokenP. 재시도 없음 — 발급은 appkey 당 1분에 1회 제한."""
    try:
        resp = requests.post(
            f"{BASE}{TOKEN_PATH}",
            json={
                "grant_type": "client_credentials",
                "appkey": app_key,
                "appsecret": app_secret,
            },
            headers={"content-type": "application/json"},
            timeout=10,
        )
    except requests.RequestException as e:
        raise KISAuthError(f"KIS 토큰 발급 요청 실패: {e}") from e

    try:
        body = resp.json()
    except ValueError:
        body = {}

    if resp.status_code != 200 or not body.get("access_token"):
        # EGW00133 = "일분간 등록한 토큰이 존재합니다" (발급 rate limit)
        msg_cd = str(body.get("error_code") or body.get("msg_cd") or "")
        msg1 = str(body.get("error_description") or body.get("msg1") or resp.text[:200])
        raise KISAuthError(
            f"KIS 토큰 발급 실패 (HTTP {resp.status_code}) {msg_cd} {msg1}".strip(),
            msg_cd=msg_cd,
            msg1=msg1,
        )

    expires_in = int(body.get("expires_in", 86400))
    return {
        "access_token": body["access_token"],
        "expires_at": time.time() + expires_in,
        "key_fp": _key_fingerprint(app_key),
    }


def get_access_token(app_key: str, app_secret: str, force: bool = False) -> str:
    """유효한 access_token. 메모리 → 디스크 → 신규 발급 순.

    `force=True` 면 캐시를 건너뛰고 재발급한다(서버가 토큰을 거부한 경우).
    """
    global _TOKEN

    if not app_key or not app_secret:
        raise KISAuthError("KIS_APP_KEY / KIS_APP_SECRET 이 설정되지 않았습니다")

    if not force:
        if _is_fresh(_TOKEN, app_key):
            return _TOKEN["access_token"]
        from_disk = _load_token_file(app_key)
        if _is_fresh(from_disk, app_key):
            _TOKEN = from_disk
            return _TOKEN["access_token"]

    _TOKEN = _issue_token(app_key, app_secret)
    _save_token_file(_TOKEN)
    return _TOKEN["access_token"]
