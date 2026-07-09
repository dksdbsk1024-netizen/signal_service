"""KIS(한국투자증권) 실연동 — OAuth 토큰 + 현재가.

core.macro / core.quotes 와 같은 역할 분담: HTTP·캐시·재시도·폴백은 이 모듈이 맡고,
providers.KISProvider 는 얇게 위임만 한다. 로직은 프레임워크 독립.

안정성 구조는 quotes.build_quote 와 동일한 4단 폴백:
    신선한 캐시(TTL 내) → KIS fetch(재시도) → stale 캐시 → Mock

단 **인증 실패는 이 체인을 타지 않는다.** 키가 틀렸는데 조용히 Mock 값이 뜨면
실연동이 안 되는 걸 알아채지 못한다. KISAuthError 는 그대로 위로 던진다.
데이터 실패(rt_cd != "0", 네트워크, 타임아웃)만 캐시/Mock 으로 폴백한다.

토큰:
    KIS 는 appkey 당 토큰 발급을 **1분에 1회**로 제한한다(초과 시 EGW00133).
    발급된 토큰은 약 24시간 유효하다. 메모리 캐시만 쓰면 프로세스 재시작이나
    `uvicorn --reload` 가 1분 안에 두 번 걸리는 순간 발급이 막히므로,
    토큰을 디스크(TOKEN_FILE)에도 저장해 재시작을 넘어 재사용한다.
"""

from __future__ import annotations

import datetime
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
PRICE_PATH = "/uapi/domestic-stock/v1/quotations/inquire-price"

# 국내주식 현재가 시세 조회 거래ID.
TR_CURRENT_PRICE = "FHKST01010100"

# 현재가는 실시간성이 생명 — macro.CACHE_TTL_SEC(20분)를 재사용하면 안 된다.
# 10초: 새로고침 연타로 API 호출량이 튀는 것만 막고 체감 지연은 없게.
PRICE_CACHE_TTL_SEC = 10

# 토큰 캐시 파일. backend/.kis_token.json (gitignore). 프로세스 재시작 넘어 재사용.
TOKEN_FILE = Path(__file__).resolve().parents[1] / ".kis_token.json"

# 만료 10분 전에 미리 갱신. 요청 도중 만료되는 경계 케이스 회피.
_TOKEN_SKEW_SEC = 600

KST = datetime.timezone(datetime.timedelta(hours=9))


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
# ticker → {"data": price_dict, "ts": epoch_seconds}
_PRICE_CACHE: dict[str, dict] = {}

# {"access_token": str, "expires_at": epoch_seconds} 또는 빈 dict.
_TOKEN: dict = {}

# Mock 폴백 값(price, change, change_pct). 최초 fetch 실패 + 캐시 없음일 때만.
_MOCK_VALUES: dict[str, tuple[int, int, float]] = {
    "005930": (78_900, 900, 1.15),
}


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


# ── 현재가 fetch ───────────────────────────────────────────────
def _to_int(v) -> int:
    return int(float(v)) if v not in (None, "") else 0


def _to_float(v) -> float:
    return float(v) if v not in (None, "") else 0.0


def _fetch_price(ticker: str, token: str, app_key: str, app_secret: str) -> dict:
    """GET inquire-price → KIS `output` dict 원본. 실패는 Auth/Data 로 분류."""
    try:
        resp = requests.get(
            f"{BASE}{PRICE_PATH}",
            headers={
                "authorization": f"Bearer {token}",
                "appkey": app_key,
                "appsecret": app_secret,
                "tr_id": TR_CURRENT_PRICE,
                "custtype": "P",
            },
            params={"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": ticker},
            timeout=10,
        )
    except requests.RequestException as e:
        raise KISDataError(f"KIS 현재가 요청 실패: {e}") from e

    if resp.status_code in (401, 403):
        raise KISAuthError(f"KIS 인증 거부 (HTTP {resp.status_code}): {resp.text[:200]}")
    if resp.status_code != 200:
        raise KISDataError(f"KIS 현재가 HTTP {resp.status_code}: {resp.text[:200]}")

    try:
        body = resp.json()
    except ValueError as e:
        raise KISDataError(f"KIS 현재가 응답 파싱 실패: {e}") from e

    # rt_cd: "0" 정상. 그 외는 msg_cd/msg1 에 사유.
    if body.get("rt_cd") != "0":
        raise KISDataError(
            f"KIS 현재가 오류: {body.get('msg_cd')} {body.get('msg1')}",
            msg_cd=str(body.get("msg_cd", "")),
            msg1=str(body.get("msg1", "")),
        )

    output = body.get("output") or {}
    if not output.get("stck_prpr"):
        raise KISDataError(f"KIS 현재가 응답에 stck_prpr 없음 (ticker={ticker})")
    return output


def _normalize(ticker: str, output: dict) -> dict:
    """KIS output → 앱 스키마. quotes.build_quote 반환 형태와 같은 플래그 규약."""
    # inquire-price 응답에 종목명(hts_kor_isnm)은 없다. 업종명·대표시장만 온다.
    # 종목명이 필요하면 별도 TR(종목정보 조회)을 붙여야 한다.
    return {
        "ticker": ticker,
        "market": output.get("rprs_mrkt_kor_name", ""),
        "sector": output.get("bstp_kor_isnm", ""),
        "price": _to_int(output.get("stck_prpr")),
        # prdy_vrss/prdy_ctrt 는 KIS 가 부호를 포함해 내려준다(하락 시 "-900").
        # prdy_vrss_sign 은 별도 코드: 1상한 2상승 3보합 4하한 5하락.
        "change": _to_int(output.get("prdy_vrss")),
        "change_pct": _to_float(output.get("prdy_ctrt")),
        "sign": output.get("prdy_vrss_sign", ""),
        "open": _to_int(output.get("stck_oprc")),
        "high": _to_int(output.get("stck_hgpr")),
        "low": _to_int(output.get("stck_lwpr")),
        "volume": _to_int(output.get("acml_vol")),
        # inquire-price 응답에 체결시각 필드가 없어 수신 시각(KST)을 쓴다.
        "as_of": datetime.datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "source": "kis",
        "mock": False,
        "stale": False,
    }


def mock_current_price(ticker: str) -> dict:
    """실패/오프라인 폴백. 실데이터와 동일 스키마 유지."""
    price, change, change_pct = _MOCK_VALUES.get(ticker, (50_000, 0, 0.0))
    return {
        "ticker": ticker,
        "market": "",
        "sector": "",
        "price": price,
        "change": change,
        "change_pct": change_pct,
        "sign": "2" if change > 0 else "5" if change < 0 else "3",
        "open": price - change,
        "high": price,
        "low": price - change,
        "volume": 0,
        "as_of": "Mock",
        "source": "mock",   # UI 배지: 실데이터 아님
        "mock": True,
        "stale": False,
    }


def build_current_price(ticker: str, app_key: str, app_secret: str) -> dict:
    """현재가 하나. 캐시 → KIS(재시도) → stale 캐시 → Mock 순 폴백.

    인증 실패(KISAuthError)만은 폴백 없이 그대로 던진다 — 키가 틀렸는데 Mock 값이
    조용히 뜨면 실연동 실패를 알아챌 수 없다.
    """
    now = time.time()
    cached = _PRICE_CACHE.get(ticker)
    # 신선한 캐시(TTL 내) → 재요청 없이 반환.
    if cached and now - cached["ts"] < PRICE_CACHE_TTL_SEC:
        return dict(cached["data"])

    token = get_access_token(app_key, app_secret)  # KISAuthError 는 여기서 그대로 전파
    refreshed = False  # 401 로 인한 강제 갱신은 호출당 1회만

    def once():
        nonlocal token, refreshed
        try:
            return _fetch_price(ticker, token, app_key, app_secret)
        except KISAuthError:
            # 디스크 토큰이 서버 쪽에서 이미 무효화된 경우. 1회만 재발급 후 재시도.
            if refreshed:
                raise
            refreshed = True
            token = get_access_token(app_key, app_secret, force=True)
            return _fetch_price(ticker, token, app_key, app_secret)

    try:
        output = _retry_on_data(once)
    except KISAuthError:
        raise
    except Exception:
        # 데이터 실패. 직전 실데이터가 있으면 Mock 대신 '오래된 캐시'.
        if cached:
            stale = dict(cached["data"])
            stale["stale"] = True
            return stale
        return mock_current_price(ticker)

    data = _normalize(ticker, output)
    _PRICE_CACHE[ticker] = {"data": data, "ts": now}
    return dict(data)
