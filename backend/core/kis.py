"""KIS 실연동 — 토큰 + 현재가 + 분봉 + 호가(Level 2) + 수급 + 체결강도 + 거래원.

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

분봉:
    FHKST03010200 은 **호출 1회당 최대 30봉**, 그리고 **당일 장중 데이터만** 준다.
    240봉을 채우려면 기준시각(FID_INPUT_HOUR_1)을 과거로 밀며 페이징해야 한다.
    장 시작 전이나 휴장일에는 응답이 비고, 그건 데이터 실패로 취급해 Mock 으로 폴백한다.
    과거 영업일 분봉은 다른 TR(FHKST03010230)이며 이번 범위 밖.

호가:
    FHKST01010200 은 1회 호출로 10호가 전부(askp1~10 / bidp1~10 + 각 잔량)를 준다.
    페이징이 없다. 장 마감 후·휴장일에는 가격이 전부 "0" 으로 오고, 이는 응답 성공
    (rt_cd=0)이지만 호가가 없는 상태다 — 데이터 실패로 취급해 Mock 으로 폴백한다.

체결강도:
    호가 응답에도 현재가 응답에도 없다. 별도 TR — FHKST01010300(주식현재가 체결)이
    최근 체결 **30틱**을 최신→과거 순으로 주고, 각 틱에 그 시점의 당일 누적 체결강도
    `tday_rltv` 가 실려 온다(100 기준: >100 매수 체결 우위). 틱마다 조금씩 움직이므로
    가장 최신 틱(output[0]) 하나만 쓴다. 같은 응답의 stck_prpr·prdy_ctrt 는 현재가
    TR(FHKST01010100)의 값과 정확히 일치한다 — 실데이터 교차검증 지점.

    체결강도는 당일 체결에서만 나온다. 장 시작 전·휴장일에는 rt_cd=0 이면서
    tday_rltv 가 "0" (또는 빈 문자열)로 오고, 이는 호가의 '전 단계가 0' 과 같은
    취급 — 데이터 실패로 올려 캐시/Mock 으로 폴백한다.

거래원(회원사):
    FHKST01010600 은 `output` 이 **1행짜리 리스트**다(다른 TR 의 dict 와 다름).
    한 응답에 매도 상위 5 + 매수 상위 5 + 외국계 집계가 모두 들어 있다.

    **두 상위 5 는 서로 다른 창구 집합이다.** 그래서 창구별 순매수 한 줄로 합칠 수 없다 —
    한쪽에만 든 창구의 반대편 수량은 0 이 아니라 미상이다. 자세한 이유는 _normalize_broker.

    창구 비중 `*_rlim` 은 `수량 / acml_vol × 100` 과 소수 둘째 자리까지 일치한다(실측).
    외국계 집계(glob_total_*)는 상위 5 밖 창구까지 합산한 값이라 상위 5 안의 외국계
    합보다 크다. `glob_ntby_qty == glob_total_shnu_qty - glob_total_seln_qty` 는 항등식.

수급(외국인·기관·프로그램):
    한 TR 로 다 안 나온다. 세 개를 합쳐야 한다.

    FHKST01010900(주식현재가 투자자) — 개인/외국인/기관 **확정** 순매수, 최근 30 영업일.
        순매수 대금 단위는 **백만원**(억원 = /100). 그런데 **당일 행은 장중 내내 빈
        문자열**이다 — 확정 수급은 장 종료 후에야 채워진다. 그래서 이것만으로는
        "오늘 외국인이 사고 있나"에 답할 수 없다.

    HHPTJ04160200(종목별 외인기관 추정가집계) — 장중 **가집계 추정치**. 금액이 아니라
        **수량(주)**이고, 09:30/10:00/11:20/13:20/14:30 다섯 시각(bsop_hour_gb 1~5)에
        갱신되는 **당일 누적** 순매수 추정 수량이다. 억원으로 보이려면 현재가를 곱한다
        (평균 체결가가 아니므로 근사 — 반환 dict 의 `estimated=True` 로 표시한다).

    FHPPG04650200(종목별 프로그램매매 일별) — 프로그램 순매수 대금, 단위 **원**(억원 = /1e8).
        FID_INPUT_DATE_1 은 **기준일**이고 거기서 과거로 30 영업일을 준다(DATE_2 는 무시).
        확정 투자자와 달리 **당일 행이 장중에도 실시간 누적으로 채워진다** — 실제로 첫 행이
        FHPPG04650100(체결 틱)의 최신 틱 누적값과 정확히 일치한다. 그래서 프로그램은
        일별 TR 하나로 스냅샷과 시계열을 모두 덮는다.

    스냅샷(build_investor_flow)이 값을 고르는 순서:
        1) 당일 행이 확정됐으면 확정치            (장 종료 후)
        2) 아니면 당일 장중 추정치                (estimated=True)
        3) 아니면 확정된 가장 최근 행             (개장~09:30, 휴장일 — as_of 에 날짜가 남는다)
    셋 다 없어야 데이터 실패다. 호가의 '전 단계가 0' 처럼, 세 값이 전부 0 인 응답도
    데이터 실패로 올려 캐시/Mock 으로 폴백한다.

    시계열(build_investor_flow_series)은 **확정 행만** 쓴다 — 장중 추정치를 확정 막대와
    같은 차트에 섞으면 마지막 봉만 성격이 다른 그래프가 된다.
"""

from __future__ import annotations

import datetime
import hashlib
import json
import os
import re
import threading
import time
from pathlib import Path

import pandas as pd
import requests

from .macro import _FETCH_RETRIES, _RETRY_BACKOFF_SEC  # 재시도 상수 재사용

# 실전투자 도메인. 모의투자(openapivts...:29443)는 이번 단계 범위 밖.
BASE = "https://openapi.koreainvestment.com:9443"
TOKEN_PATH = "/oauth2/tokenP"
PRICE_PATH = "/uapi/domestic-stock/v1/quotations/inquire-price"
MINUTE_PATH = "/uapi/domestic-stock/v1/quotations/inquire-time-itemchartprice"
ORDERBOOK_PATH = "/uapi/domestic-stock/v1/quotations/inquire-asking-price-exp-ccn"
CCNL_PATH = "/uapi/domestic-stock/v1/quotations/inquire-ccnl"
MEMBER_PATH = "/uapi/domestic-stock/v1/quotations/inquire-member"
INVESTOR_PATH = "/uapi/domestic-stock/v1/quotations/inquire-investor"
ESTIMATE_PATH = "/uapi/domestic-stock/v1/quotations/investor-trend-estimate"
PROGRAM_PATH = "/uapi/domestic-stock/v1/quotations/program-trade-by-stock-daily"

# 국내주식 현재가 시세 조회 거래ID.
TR_CURRENT_PRICE = "FHKST01010100"
# 국내주식 당일 분봉 조회 거래ID.
TR_MINUTE_OHLCV = "FHKST03010200"
# 국내주식 호가/예상체결 조회 거래ID.
TR_ORDERBOOK = "FHKST01010200"
# 주식현재가 체결 — 최근 30틱. 각 틱에 당일 누적 체결강도(tday_rltv).
TR_TRADE_STRENGTH = "FHKST01010300"
# 주식현재가 회원사(거래원) — 매도 상위 5 + 매수 상위 5 + 외국계 집계.
TR_BROKER = "FHKST01010600"
# 주식현재가 투자자 — 개인/외국인/기관 확정 순매수(일별 30행). 당일 행은 장 종료 후 채워짐.
TR_INVESTOR_DAILY = "FHKST01010900"
# 종목별 외인기관 추정가집계 — 장중 가집계 순매수 '수량'(당일 누적, 5개 시각).
TR_INVESTOR_ESTIMATE = "HHPTJ04160200"
# 종목별 프로그램매매 일별 — 프로그램 순매수 대금(원). 당일 행도 장중 실시간 누적.
TR_PROGRAM_DAILY = "FHPPG04650200"

# 현재가는 실시간성이 생명 — macro.CACHE_TTL_SEC(20분)를 재사용하면 안 된다.
# 10초: 새로고침 연타로 API 호출량이 튀는 것만 막고 체감 지연은 없게.
PRICE_CACHE_TTL_SEC = 10

# 분봉 1건은 240봉 채우는 데 8회 호출이 든다. 봉은 1분에 한 번만 바뀌므로
# 30초 TTL 이면 새 봉을 최대 30초 늦게 보는 대신 호출량이 8배로 튀지 않는다.
OHLCV_CACHE_TTL_SEC = 30

# 호가 잔량은 초 단위로 바뀐다 — 현재가의 10초 TTL 을 쓰면 호가창이 눈에 띄게 굳는다.
# 3초: 새로고침 연타만 흡수하고 체감 지연은 없게.
ORDERBOOK_CACHE_TTL_SEC = 3

ORDERBOOK_LEVELS = 10            # KIS 가 주는 호가 단계 수(고정). MockProvider 와 동일.

# 체결강도는 당일 **누적** 비율이라 한 틱으로는 소수 둘째 자리만 움직인다(실측: 79.92→79.93).
# 호가의 3초는 과하고, 현재가와 같은 10초면 체감 지연 없이 새로고침 연타를 흡수한다.
STRENGTH_CACHE_TTL_SEC = 10

# 거래원도 당일 누적 수량이라 순위가 분 단위로만 바뀐다. 30초면 충분하다.
BROKER_CACHE_TTL_SEC = 30
BROKER_TOP_N = 5                 # KIS 가 주는 창구 수(고정). 매도·매수 각각 5.

# 확정 수급은 하루 한 번, 장중 추정치는 하루 다섯 번만 바뀐다 — 짧은 TTL 은 의미가 없다.
# 60초면 새로고침 연타를 흡수하면서 10:00 갱신을 1분 안에 따라잡는다.
FLOW_CACHE_TTL_SEC = 60
# 시계열은 확정 행만 쓰므로 장중엔 아예 안 바뀐다.
FLOW_SERIES_CACHE_TTL_SEC = 300

DEFAULT_FLOW_DAYS = 20           # MockProvider.get_investor_flow_series 기본값과 동일
# 두 일별 TR 모두 1회 호출당 30 영업일. 페이징 파라미터가 없어 이보다 길게는 못 본다.
FLOW_MAX_DAYS = 30

_EOK = 100_000_000.0             # 1억원 (프로그램 대금: 원 → 억원)
_PBMN_PER_EOK = 100.0            # 확정 순매수 대금: 백만원 → 억원

DEFAULT_MINUTE_BARS = 240        # MockProvider.bars 와 동일
_MINUTE_MAX_PAGES = 12           # 12 × 30봉 = 360봉. 정규장(09:00~15:30) 391분을 거의 덮는다.
_MARKET_OPEN_HOUR = 9
_MARKET_CLOSE = "153000"

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

# (ticker, interval) → {"data": DataFrame, "ts": epoch_seconds}
_OHLCV_CACHE: dict[tuple[str, str], dict] = {}

# ticker → {"data": orderbook_dict, "ts": epoch_seconds}
_ORDERBOOK_CACHE: dict[str, dict] = {}

# ticker → {"data": strength_dict, "ts": epoch_seconds}
_STRENGTH_CACHE: dict[str, dict] = {}

# ticker → {"data": broker_dict, "ts": epoch_seconds}
_BROKER_CACHE: dict[str, dict] = {}

# ticker → {"data": flow_dict, "ts": epoch_seconds}
_FLOW_CACHE: dict[str, dict] = {}

# (ticker, days) → {"data": series_dict, "ts": epoch_seconds}
_FLOW_SERIES_CACHE: dict[tuple[str, int], dict] = {}

# {"access_token": str, "expires_at": epoch_seconds} 또는 빈 dict.
_TOKEN: dict = {}
# 토큰 발급 직렬화 락. 라우트가 여러 KIS 호출을 동시에 던지면(병렬 fetch) 콜드 상태에서
# 여러 스레드가 동시에 _issue_token 을 때릴 수 있는데, 발급은 appkey 당 1분에 1회 제한이라
# 곧바로 실패한다. 이 락으로 발급을 한 번만 하고 나머지는 방금 받은 토큰을 재사용한다.
_TOKEN_LOCK = threading.Lock()
# 발급이 일어날 때마다 +1. force 재발급이 여러 스레드에서 동시에 걸려도(모두 401 을 받은
# 경우), 락을 먼저 잡은 하나만 발급하고 나머지는 '버전이 바뀌었다'를 보고 새 토큰을 재사용한다.
_TOKEN_VERSION = 0

# Mock 폴백 값(price, change, change_pct). 최초 fetch 실패 + 캐시 없음일 때만.
_MOCK_VALUES: dict[str, tuple[int, int, float]] = {
    "005930": (78_900, 900, 1.15),
}


# ── 유량 제한: 초당 15건 ──────────────────────────────────────
class _TokenBucket:
    """초당 `rate` 개씩 차오르고 최대 `capacity` 개까지 모이는 토큰 통.

    버킷이 이 모듈에 있는 이유: 종목 하나를 수집하면 여기서 GET 이 12번 나간다
    (분봉 8페이지 + 수급 4). 수집기 쪽 세마포어는 '종목'만 셀 뿐 GET 을 못 세므로
    한도를 지킬 수 없다. 유량은 requests.get 바로 앞에서만 정확히 셀 수 있다.
    """

    def __init__(self, rate: float, capacity: float,
                 monotonic=time.monotonic, sleep=time.sleep) -> None:
        self.rate = float(rate)
        self.capacity = float(capacity)
        self._tokens = float(capacity)
        self._monotonic = monotonic
        self._sleep = sleep
        self._updated = monotonic()
        self._lock = threading.Lock()

    def acquire(self) -> None:
        """토큰 하나를 쓴다. 모자라면 부족분이 찰 만큼 잔다.

        토큰을 먼저 빼고(잔량이 음수가 될 수 있다) 그 빚만큼만 잔다. '찰 때까지
        다시 확인' 루프를 돌면 (1-tokens)/rate 만큼 자도 부동소수 오차로 tokens 가
        0.9999… 에 걸려 무한히 잘게 도는 일이 생긴다. 빚 방식은 루프가 없고
        장기 평균 발급률이 정확히 rate 로 수렴한다.
        """
        with self._lock:
            now = self._monotonic()
            self._tokens = min(
                self.capacity, self._tokens + (now - self._updated) * self.rate
            )
            self._updated = now
            self._tokens -= 1.0
            if self._tokens >= 0.0:
                return
            wait = -self._tokens / self.rate
        # 락 밖에서 잔다. 안에서 자면 대기 중인 스레드까지 같이 묶인다.
        self._sleep(wait)


# KIS 한도는 문서상 초당 약 20건(슬라이딩 윈도우)이지만, 실측에서 15건으로도
# EGW00201("초당 거래건수를 초과하였습니다")을 맞았다. 12로 낮춰 마진을 둔다.
KIS_MAX_RPS = float(os.getenv("KIS_MAX_RPS", "12"))
# capacity=1 — 버스트 금지. 통을 가득 채워 두면 초반 N개가 순식간에 나가고,
# KIS 의 1초 창에서는 그 N개와 뒤이은 정상 페이스가 겹쳐 한도를 넘는다.
_RATE = _TokenBucket(rate=KIS_MAX_RPS, capacity=1)


# ── HTTP 커넥션 재사용 ────────────────────────────────────────
# requests.get() 은 호출마다 Session 을 새로 만든다 = 매번 TCP + TLS 핸드셰이크.
# 수집기는 종목당 GET 18번, 200종목이면 3,600번을 던지므로 핸드셰이크가 사이클을 지배한다.
# 실측(동시 20건): 모듈 함수는 GET 당 중앙값 7.64초, 공유 Session 은 0.67초.
_POOL_SIZE = max(32, int(os.getenv("COLLECT_WORKERS", "8")) * 2)
_SESSION = requests.Session()
_SESSION.mount("https://", requests.adapters.HTTPAdapter(
    pool_connections=_POOL_SIZE, pool_maxsize=_POOL_SIZE))


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
    global _TOKEN, _TOKEN_VERSION

    if not app_key or not app_secret:
        raise KISAuthError("KIS_APP_KEY / KIS_APP_SECRET 이 설정되지 않았습니다")

    # 락 밖 빠른 경로 — 신선한 메모리 토큰이면 경쟁 없이 즉시 반환(대부분의 호출).
    if not force and _is_fresh(_TOKEN, app_key):
        return _TOKEN["access_token"]

    seen_version = _TOKEN_VERSION  # 락 대기 전 버전 스냅샷
    with _TOKEN_LOCK:
        # 락을 기다리는 사이 다른 스레드가 새로 발급했으면(버전이 바뀜) 그 토큰을 재사용.
        # force 로 들어온 스레드들이 여기서 걸러져, 발급은 배치당 한 번만 일어난다.
        if _TOKEN_VERSION != seen_version and _is_fresh(_TOKEN, app_key):
            return _TOKEN["access_token"]

        if not force:
            if _is_fresh(_TOKEN, app_key):
                return _TOKEN["access_token"]
            from_disk = _load_token_file(app_key)
            if _is_fresh(from_disk, app_key):
                _TOKEN = from_disk
                _TOKEN_VERSION += 1
                return _TOKEN["access_token"]

        _TOKEN = _issue_token(app_key, app_secret)
        _TOKEN_VERSION += 1
        _save_token_file(_TOKEN)
        return _TOKEN["access_token"]


# ── 공통 ───────────────────────────────────────────────────────
def _to_int(v) -> int:
    return int(float(v)) if v not in (None, "") else 0


def _to_float(v) -> float:
    return float(v) if v not in (None, "") else 0.0


def _get_json(path: str, tr_id: str, params: dict, token: str,
              app_key: str, app_secret: str, what: str) -> dict:
    """GET → 검증된 응답 body. 인증 실패(401/403)와 데이터 실패를 분리해 던진다.

    체결강도(1개)·수급(3개) TR 이 같은 20줄을 네 번 쓰는 대신 여기로 모았다.
    현재가·분봉·호가는 이 함수보다 먼저 쓰여 각자 인라인 fetch 를 갖고 있다.
    """
    _RATE.acquire()
    try:
        resp = _SESSION.get(
            f"{BASE}{path}",
            headers={
                "authorization": f"Bearer {token}",
                "appkey": app_key,
                "appsecret": app_secret,
                "tr_id": tr_id,
                "custtype": "P",
            },
            params=params,
            timeout=10,
        )
    except requests.RequestException as e:
        raise KISDataError(f"KIS {what} 요청 실패: {e}") from e

    if resp.status_code in (401, 403):
        raise KISAuthError(f"KIS 인증 거부 (HTTP {resp.status_code}): {resp.text[:200]}")
    if resp.status_code != 200:
        raise KISDataError(f"KIS {what} HTTP {resp.status_code}: {resp.text[:200]}")

    try:
        body = resp.json()
    except ValueError as e:
        raise KISDataError(f"KIS {what} 응답 파싱 실패: {e}") from e

    if body.get("rt_cd") != "0":
        raise KISDataError(
            f"KIS {what} 오류: {body.get('msg_cd')} {body.get('msg1')}",
            msg_cd=str(body.get("msg_cd", "")),
            msg1=str(body.get("msg1", "")),
        )
    return body


def _as_of_hhmmss(hhmmss) -> str:
    """KIS 의 HHMMSS 시각 → "YYYY-MM-DD HH:MM:SS KST". 형식이 아니면 수신 시각.

    호가 접수 시각·체결 시각처럼 **초 단위로 갱신되는** 값에 쓴다. 현재가의 분 단위
    as_of 로는 두 스냅샷을 구분할 수 없다. 날짜는 응답에 없어 수신 시각(KST)의 날짜.
    """
    now = datetime.datetime.now(KST)
    s = str(hhmmss or "")
    if len(s) == 6 and s.isdigit():
        return f"{now:%Y-%m-%d} {s[:2]}:{s[2:4]}:{s[4:]} KST"
    return now.strftime("%Y-%m-%d %H:%M:%S KST")


# ── 현재가 fetch ───────────────────────────────────────────────
def _fetch_price(ticker: str, token: str, app_key: str, app_secret: str) -> dict:
    """GET inquire-price → KIS `output` dict 원본. 실패는 Auth/Data 로 분류."""
    _RATE.acquire()
    try:
        resp = _SESSION.get(
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


# ── 분봉 OHLCV ─────────────────────────────────────────────────
_OHLCV_COLUMNS = ["open", "high", "low", "close", "volume"]
_RESAMPLE_AGG = {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}


def _interval_minutes(interval: str) -> int:
    """"1m"/"5m" → 1/5. KIS 가 주는 건 1분봉뿐이라 그 위는 resample 로 만든다."""
    m = re.fullmatch(r"(\d+)m", interval.strip())
    if not m or int(m.group(1)) < 1:
        raise ValueError(f"지원하지 않는 interval: {interval!r} (예: '1m', '5m')")
    return int(m.group(1))


def _tagged(df: pd.DataFrame, *, source: str, stale: bool, mock: bool) -> pd.DataFrame:
    """DataFrame 에는 source/mock/stale 을 담을 자리가 없어 attrs 로 붙인다.

    현재가 dict 의 동명 플래그와 같은 규약. `.tail()`/`.copy()` 를 지나도 살아남는다.
    """
    df.attrs.update({"source": source, "mock": mock, "stale": stale})
    return df


def _initial_hour() -> str:
    """페이징 시작 기준시각(HHMMSS). 장 마감 뒤엔 15:30 부터 거슬러 올라간다."""
    now = datetime.datetime.now(KST)
    hhmmss = now.strftime("%H%M%S")
    return _MARKET_CLOSE if hhmmss > _MARKET_CLOSE else hhmmss


def _parse_bar(row: dict) -> tuple | None:
    """KIS output2 한 행 → (ts, o, h, l, c, v). 필수 필드가 없으면 None(그 행만 버림)."""
    date, hour, close = row.get("stck_bsop_date"), row.get("stck_cntg_hour"), row.get("stck_prpr")
    if not date or not hour or not close:
        return None
    try:
        ts = datetime.datetime.strptime(f"{date}{hour}", "%Y%m%d%H%M%S")
    except ValueError:
        return None
    return (
        ts,
        _to_float(row.get("stck_oprc")),
        _to_float(row.get("stck_hgpr")),
        _to_float(row.get("stck_lwpr")),
        _to_float(close),
        _to_float(row.get("cntg_vol")),  # 해당 봉의 체결 거래량(누적 아님)
    )


def _fetch_minute_page(ticker: str, hhmmss: str, token: str, app_key: str, app_secret: str) -> list[dict]:
    """GET inquire-time-itemchartprice → output2(최대 30봉, 최신→과거). 빈 리스트 가능."""
    _RATE.acquire()
    try:
        resp = _SESSION.get(
            f"{BASE}{MINUTE_PATH}",
            headers={
                "authorization": f"Bearer {token}",
                "appkey": app_key,
                "appsecret": app_secret,
                "tr_id": TR_MINUTE_OHLCV,
                "custtype": "P",
            },
            params={
                "FID_ETC_CLS_CODE": "",
                "FID_COND_MRKT_DIV_CODE": "J",
                "FID_INPUT_ISCD": ticker,
                "FID_INPUT_HOUR_1": hhmmss,   # 이 시각 이전 30봉
                "FID_PW_DATA_INCU_YN": "N",   # 시간외단일가 제외 — 정규장 봉만
            },
            timeout=10,
        )
    except requests.RequestException as e:
        raise KISDataError(f"KIS 분봉 요청 실패: {e}") from e

    if resp.status_code in (401, 403):
        raise KISAuthError(f"KIS 인증 거부 (HTTP {resp.status_code}): {resp.text[:200]}")
    if resp.status_code != 200:
        raise KISDataError(f"KIS 분봉 HTTP {resp.status_code}: {resp.text[:200]}")

    try:
        body = resp.json()
    except ValueError as e:
        raise KISDataError(f"KIS 분봉 응답 파싱 실패: {e}") from e

    if body.get("rt_cd") != "0":
        raise KISDataError(
            f"KIS 분봉 오류: {body.get('msg_cd')} {body.get('msg1')}",
            msg_cd=str(body.get("msg_cd", "")),
            msg1=str(body.get("msg1", "")),
        )
    return body.get("output2") or []


def _fetch_minute_series(ticker: str, need: int, token: str, app_key: str, app_secret: str) -> list[tuple]:
    """`need` 개 이상의 1분봉을 모을 때까지 기준시각을 과거로 밀며 페이징.

    한 응답이 30봉뿐이라 240봉엔 8회 호출이 필요하다. 중복 봉은 ts 키로 덮어쓴다.
    장 시작(09:00) 이전으로 내려가거나 새 봉이 안 늘면 멈춘다 — 무한 페이징 방지.
    """
    bars: dict[datetime.datetime, tuple] = {}
    hour = _initial_hour()

    for _ in range(_MINUTE_MAX_PAGES):
        rows = _fetch_minute_page(ticker, hour, token, app_key, app_secret)
        if not rows:
            break
        before = len(bars)
        for row in rows:
            parsed = _parse_bar(row)
            if parsed:
                bars[parsed[0]] = parsed
        if len(bars) == before or len(bars) >= need:
            break  # 더 과거로 못 감 / 충분히 모음
        earliest = min(bars) - datetime.timedelta(minutes=1)
        if earliest.hour < _MARKET_OPEN_HOUR:
            break
        hour = earliest.strftime("%H%M%S")

    if not bars:
        raise KISDataError(
            f"KIS 분봉 데이터 없음 (ticker={ticker}) — 당일 장중 데이터만 제공됩니다"
        )
    return [bars[ts] for ts in sorted(bars)]


def _to_frame(rows: list[tuple], step: int) -> pd.DataFrame:
    """(ts,o,h,l,c,v) 리스트 → MockProvider 와 동일 스키마의 DataFrame."""
    idx = pd.DatetimeIndex([r[0] for r in rows])
    df = pd.DataFrame([r[1:] for r in rows], columns=_OHLCV_COLUMNS, index=idx, dtype=float)
    if step > 1:
        # KIS 는 1분봉만 준다. stck_cntg_hour 는 봉의 **시작** 시각이다 — 장 첫 봉이
        # 090000 이고 거기에 시가 단일가 체결량이 통째로 실려 온다. 그래서 왼쪽 닫힘/왼쪽 라벨.
        df = df.resample(f"{step}min", label="left", closed="left").agg(_RESAMPLE_AGG).dropna()
    return df


def mock_minute_ohlcv(
    ticker: str, interval: str = "1m", bars: int = DEFAULT_MINUTE_BARS
) -> pd.DataFrame:
    """실패/오프라인 폴백. MockProvider 를 그대로 써서 스키마가 갈라지지 않게 한다."""
    from .providers import MockProvider  # 지연 import (순환 방지)

    df = MockProvider(bars=bars).get_minute_ohlcv(ticker, interval)
    return _tagged(df, source="mock", stale=False, mock=True)


def build_minute_ohlcv(
    ticker: str,
    app_key: str,
    app_secret: str,
    interval: str = "1m",
    bars: int = DEFAULT_MINUTE_BARS,
) -> pd.DataFrame:
    """분봉 OHLCV. build_current_price 와 같은 4단 폴백: 캐시 → KIS → stale → Mock.

    인증 실패(KISAuthError)만은 폴백 없이 그대로 던진다.
    """
    step = _interval_minutes(interval)  # interval 오류는 폴백 대상이 아님 — 즉시 ValueError
    key = (ticker, interval)
    now = time.time()
    cached = _OHLCV_CACHE.get(key)
    if cached and now - cached["ts"] < OHLCV_CACHE_TTL_SEC:
        return _tagged(cached["data"].copy(), source="kis", stale=False, mock=False)

    token = get_access_token(app_key, app_secret)  # KISAuthError 는 그대로 전파
    refreshed = False  # 401 로 인한 강제 갱신은 호출당 1회만

    def once():
        nonlocal token, refreshed
        try:
            return _fetch_minute_series(ticker, bars * step, token, app_key, app_secret)
        except KISAuthError:
            if refreshed:
                raise
            refreshed = True
            token = get_access_token(app_key, app_secret, force=True)
            return _fetch_minute_series(ticker, bars * step, token, app_key, app_secret)

    try:
        rows = _retry_on_data(once)
    except KISAuthError:
        raise
    except Exception:
        if cached:
            return _tagged(cached["data"].copy(), source="kis", stale=True, mock=False)
        return mock_minute_ohlcv(ticker, interval, bars)

    df = _to_frame(rows, step).tail(bars)
    _OHLCV_CACHE[key] = {"data": df, "ts": now}
    return _tagged(df.copy(), source="kis", stale=False, mock=False)


# ── 호가 (Level 2) ─────────────────────────────────────────────
def _copy_book(book: dict) -> dict:
    """캐시본 반환용 복사. asks/bids 는 중첩 리스트라 dict() 로는 캐시와 공유된다."""
    out = dict(book)
    out["asks"] = [dict(r) for r in book["asks"]]
    out["bids"] = [dict(r) for r in book["bids"]]
    return out


def _fetch_orderbook(ticker: str, token: str, app_key: str, app_secret: str) -> dict:
    """GET inquire-asking-price-exp-ccn → `output1` dict 원본(10호가 + 총잔량).

    `output2`(예상체결)는 장 시작 전·마감 동시호가 때만 의미가 있어 쓰지 않는다.
    """
    _RATE.acquire()
    try:
        resp = _SESSION.get(
            f"{BASE}{ORDERBOOK_PATH}",
            headers={
                "authorization": f"Bearer {token}",
                "appkey": app_key,
                "appsecret": app_secret,
                "tr_id": TR_ORDERBOOK,
                "custtype": "P",
            },
            params={"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": ticker},
            timeout=10,
        )
    except requests.RequestException as e:
        raise KISDataError(f"KIS 호가 요청 실패: {e}") from e

    if resp.status_code in (401, 403):
        raise KISAuthError(f"KIS 인증 거부 (HTTP {resp.status_code}): {resp.text[:200]}")
    if resp.status_code != 200:
        raise KISDataError(f"KIS 호가 HTTP {resp.status_code}: {resp.text[:200]}")

    try:
        body = resp.json()
    except ValueError as e:
        raise KISDataError(f"KIS 호가 응답 파싱 실패: {e}") from e

    if body.get("rt_cd") != "0":
        raise KISDataError(
            f"KIS 호가 오류: {body.get('msg_cd')} {body.get('msg1')}",
            msg_cd=str(body.get("msg_cd", "")),
            msg1=str(body.get("msg1", "")),
        )

    output = body.get("output1") or {}
    if not output.get("askp1"):
        raise KISDataError(f"KIS 호가 응답에 askp1 없음 (ticker={ticker})")
    return output


def _normalize_orderbook(ticker: str, output: dict) -> dict:
    """KIS output1 → 앱 스키마(MockProvider.get_orderbook 과 동일한 asks/bids/as_of).

    국내 관습대로 **asks[0] 가 최우선 매도호가(askp1, 가장 싼 매도)**, bids[0] 가
    최우선 매수호가(bidp1, 가장 비싼 매수)다. Mock 도 mid 에서 1틱씩 멀어지는 순서로
    같은 규약을 쓴다. 화면상 "매도 위 / 매수 아래" 배치는 프론트가 가격 내림차순으로
    정렬해 만든다 — 여기서 뒤집지 않는다.

    호가가 없는 시간대(장 마감 후·휴장일)에는 KIS 가 rt_cd=0 으로 응답하면서 가격을
    전부 "0" 으로 준다. 잔량 0 짜리 호가창을 그리는 대신 데이터 실패로 올린다.
    """
    asks, bids = [], []
    for i in range(1, ORDERBOOK_LEVELS + 1):
        asks.append({"price": _to_int(output.get(f"askp{i}")),
                     "qty": _to_int(output.get(f"askp_rsqn{i}"))})
        bids.append({"price": _to_int(output.get(f"bidp{i}")),
                     "qty": _to_int(output.get(f"bidp_rsqn{i}"))})

    if asks[0]["price"] <= 0 and bids[0]["price"] <= 0:
        raise KISDataError(
            f"KIS 호가 전 단계가 0 (ticker={ticker}) — 장 마감 후·휴장일에는 호가가 없습니다"
        )

    return {
        "ticker": ticker,
        "asks": asks,
        "bids": bids,
        # KIS 가 계산해 주는 총잔량. 실응답 확인 결과 10호가 잔량 합과 정확히 같다
        # (시간외 잔량은 ovtm_total_* 로 따로 온다). 합이 어긋나면 필드 매핑이 틀린 것.
        "total_ask_qty": _to_int(output.get("total_askp_rsqn")),
        "total_bid_qty": _to_int(output.get("total_bidp_rsqn")),
        # 호가 접수 시각(aspr_acpt_hour). 초까지 남긴다 — 호가는 초 단위로 갱신된다.
        "as_of": _as_of_hhmmss(output.get("aspr_acpt_hour")),
        "source": "kis",
        "mock": False,
        "stale": False,
    }


def mock_orderbook(ticker: str) -> dict:
    """실패/오프라인 폴백. MockProvider 를 그대로 써서 스키마가 갈라지지 않게 한다."""
    from .providers import MockProvider  # 지연 import (순환 방지)

    book = MockProvider().get_orderbook(ticker)
    book.update({
        "ticker": ticker,
        "total_ask_qty": sum(r["qty"] for r in book["asks"]),
        "total_bid_qty": sum(r["qty"] for r in book["bids"]),
        "source": "mock",   # UI 배지: 실데이터 아님
        "mock": True,
        "stale": False,
    })
    return book


def build_orderbook(ticker: str, app_key: str, app_secret: str) -> dict:
    """10호가. build_current_price 와 같은 4단 폴백: 캐시 → KIS → stale 캐시 → Mock.

    인증 실패(KISAuthError)만은 폴백 없이 그대로 던진다.
    """
    now = time.time()
    cached = _ORDERBOOK_CACHE.get(ticker)
    if cached and now - cached["ts"] < ORDERBOOK_CACHE_TTL_SEC:
        return _copy_book(cached["data"])

    token = get_access_token(app_key, app_secret)  # KISAuthError 는 그대로 전파
    refreshed = False  # 401 로 인한 강제 갱신은 호출당 1회만

    def once():
        nonlocal token, refreshed
        try:
            return _normalize_orderbook(ticker, _fetch_orderbook(ticker, token, app_key, app_secret))
        except KISAuthError:
            if refreshed:
                raise
            refreshed = True
            token = get_access_token(app_key, app_secret, force=True)
            return _normalize_orderbook(ticker, _fetch_orderbook(ticker, token, app_key, app_secret))

    try:
        data = _retry_on_data(once)
    except KISAuthError:
        raise
    except Exception:
        if cached:
            stale = _copy_book(cached["data"])
            stale["stale"] = True
            return stale
        return mock_orderbook(ticker)

    _ORDERBOOK_CACHE[ticker] = {"data": data, "ts": now}
    return _copy_book(data)


# ── 체결강도 ───────────────────────────────────────────────────
def _fetch_trade_strength(ticker: str, token: str, app_key: str, app_secret: str) -> list[dict]:
    """GET inquire-ccnl → output(최근 30틱, 최신→과거). 빈 응답은 데이터 실패."""
    body = _get_json(
        CCNL_PATH, TR_TRADE_STRENGTH,
        {"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": ticker},
        token, app_key, app_secret, "체결강도",
    )
    rows = body.get("output") or []
    if not rows:
        raise KISDataError(f"KIS 체결강도 응답이 비었습니다 (ticker={ticker})")
    return rows


def _normalize_trade_strength(ticker: str, rows: list[dict]) -> dict:
    """KIS output → 앱 스키마(MockProvider.get_trade_strength 와 동일한 strength/as_of).

    응답은 최신→과거 순이라 rows[0] 이 마지막 체결이다. tday_rltv 는 그 시점의 당일
    누적 체결강도(100 기준, >100 매수 체결 우위) — Mock 이 주던 105.5 같은 값과 같은 척도.

    장 시작 전·휴장일에는 rt_cd=0 인데 tday_rltv 가 0 으로 온다. 호가의 '전 단계가 0'
    과 같은 취급 — 체결강도 0 인 종목이 아니라 당일 체결이 없는 것이므로 데이터 실패다.
    """
    head = rows[0]
    strength = _to_float(head.get("tday_rltv"))
    if strength <= 0:
        raise KISDataError(
            f"KIS 체결강도가 0 (ticker={ticker}) — 장 시작 전·휴장일에는 당일 체결이 없습니다"
        )
    return {
        "ticker": ticker,
        "strength": round(strength, 1),
        # 체결 시각(stck_cntg_hour). 틱 단위라 초까지 남긴다.
        "as_of": _as_of_hhmmss(head.get("stck_cntg_hour")),
        "source": "kis",
        "mock": False,
        "stale": False,
    }


def mock_trade_strength(ticker: str) -> dict:
    """실패/오프라인 폴백. MockProvider 를 그대로 써서 스키마가 갈라지지 않게 한다."""
    from .providers import MockProvider  # 지연 import (순환 방지)

    data = MockProvider().get_trade_strength(ticker)
    data.update({"ticker": ticker, "source": "mock", "mock": True, "stale": False})
    return data


def build_trade_strength(ticker: str, app_key: str, app_secret: str) -> dict:
    """당일 체결강도. build_orderbook 과 같은 4단 폴백: 캐시 → KIS → stale 캐시 → Mock.

    인증 실패(KISAuthError)만은 폴백 없이 그대로 던진다.
    """
    now = time.time()
    cached = _STRENGTH_CACHE.get(ticker)
    if cached and now - cached["ts"] < STRENGTH_CACHE_TTL_SEC:
        return dict(cached["data"])

    token = get_access_token(app_key, app_secret)  # KISAuthError 는 그대로 전파
    refreshed = False  # 401 로 인한 강제 갱신은 호출당 1회만

    def once():
        nonlocal token, refreshed
        try:
            return _normalize_trade_strength(
                ticker, _fetch_trade_strength(ticker, token, app_key, app_secret))
        except KISAuthError:
            if refreshed:
                raise
            refreshed = True
            token = get_access_token(app_key, app_secret, force=True)
            return _normalize_trade_strength(
                ticker, _fetch_trade_strength(ticker, token, app_key, app_secret))

    try:
        data = _retry_on_data(once)
    except KISAuthError:
        raise
    except Exception:
        if cached:
            stale = dict(cached["data"])
            stale["stale"] = True
            return stale
        return mock_trade_strength(ticker)

    _STRENGTH_CACHE[ticker] = {"data": data, "ts": now}
    return dict(data)


# ── 거래원 (회원사 창구) ───────────────────────────────────────
# 매도 상위와 매수 상위는 **필드 접두어만 다르고 구조가 같다**. glob_yn 만 인덱스 앞에 `_`.
_SELL_KEYS = ("seln_mbcr_name{i}", "total_seln_qty{i}", "seln_mbcr_rlim{i}", "seln_mbcr_glob_yn_{i}")
_BUY_KEYS = ("shnu_mbcr_name{i}", "total_shnu_qty{i}", "shnu_mbcr_rlim{i}", "shnu_mbcr_glob_yn_{i}")


def _fetch_broker(ticker: str, token: str, app_key: str, app_secret: str) -> dict:
    """GET inquire-member → output[0]. 이 TR 의 output 은 **1행짜리 리스트**다(dict 아님)."""
    body = _get_json(
        MEMBER_PATH, TR_BROKER,
        {"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": ticker},
        token, app_key, app_secret, "거래원",
    )
    rows = body.get("output") or []
    if not rows:
        raise KISDataError(f"KIS 거래원 응답이 비었습니다 (ticker={ticker})")
    return rows[0]


def _broker_side(output: dict, keys: tuple[str, ...]) -> list[dict]:
    """한쪽(매도 또는 매수) 상위 5 창구. 이름이 빈 자리는 건너뛴다(상장 직후·거래 부진 종목)."""
    name_k, qty_k, pct_k, glob_k = keys
    rows = []
    for i in range(1, BROKER_TOP_N + 1):
        name = str(output.get(name_k.format(i=i)) or "").strip()
        if not name:
            continue
        rows.append({
            "rank": len(rows) + 1,
            "name": name,
            "qty": _to_int(output.get(qty_k.format(i=i))),
            # KIS 가 주는 비중(%). 실측상 qty / acml_vol * 100 과 소수 둘째 자리까지 일치한다.
            "pct": _to_float(output.get(pct_k.format(i=i))),
            "foreign": str(output.get(glob_k.format(i=i)) or "").upper() == "Y",
        })
    return rows


def _normalize_broker(ticker: str, output: dict) -> dict:
    """KIS output → 앱 스키마. 매도/매수를 **분리한 두 리스트**로 낸다.

    합쳐서 창구별 순매수 한 줄로 만들 수 없다 — 매도 상위 5 와 매수 상위 5 는 서로 다른
    창구 집합이다. 한쪽에만 든 창구(실측: 005930 매도 4위 JP모간)의 반대편 수량은 0 이
    아니라 **미상**이다(그 쪽 5위 수량보다 작다는 것만 안다). 0 으로 채워 순매수를 만들면
    그 창구의 순매수가 실제 범위의 끝값으로 과장된다. HTS 관습대로 두 리스트로 보여준다.

    외국계는 개별 창구의 glob_yn 뿐 아니라 **상위 5 밖까지 합산한 집계**가 따로 온다
    (glob_total_*). 그래서 sellers 의 foreign 합보다 foreign.sell_qty 가 크다 — 정상이다.

    장 시작 전·휴장일에는 rt_cd=0 이면서 수량이 전부 0 으로 온다. 호가의 '전 단계가 0'
    과 같은 취급 — 데이터 실패로 올려 캐시/Mock 으로 폴백한다.
    """
    sellers = _broker_side(output, _SELL_KEYS)
    buyers = _broker_side(output, _BUY_KEYS)
    volume = _to_int(output.get("acml_vol"))

    if not sellers or not buyers:
        raise KISDataError(f"KIS 거래원 창구가 비었습니다 (ticker={ticker})")
    if all(r["qty"] == 0 for r in sellers + buyers):
        raise KISDataError(
            f"KIS 거래원 수량이 모두 0 (ticker={ticker}) — 장 시작 전·휴장일에는 창구 집계가 없습니다"
        )

    sell_qty = _to_int(output.get("glob_total_seln_qty"))
    buy_qty = _to_int(output.get("glob_total_shnu_qty"))
    return {
        "ticker": ticker,
        "sellers": sellers,
        "buyers": buyers,
        # 외국계 전체 집계(상위 5 밖 포함). net_qty 는 KIS 가 준 값을 그대로 쓴다 —
        # 실측상 buy_qty - sell_qty 와 정확히 일치한다(검증 스크립트가 등식으로 확인).
        "foreign": {
            "sell_qty": sell_qty,
            "buy_qty": buy_qty,
            "net_qty": _to_int(output.get("glob_ntby_qty")),
            "sell_pct": _to_float(output.get("glob_seln_rlim")),
            "buy_pct": _to_float(output.get("glob_shnu_rlim")),
        },
        "volume": volume,      # 당일 누적 거래량(주). 창구 비중의 분모.
        "unit": "주",
        # 이 TR 응답에는 시각 필드가 없다. 현재가와 같이 수신 시각(KST)을 쓴다.
        "as_of": datetime.datetime.now(KST).strftime("%Y-%m-%d %H:%M KST"),
        "source": "kis",
        "mock": False,
        "stale": False,
    }


def _copy_brokers(data: dict) -> dict:
    """캐시본 반환용 복사. sellers/buyers 는 중첩 리스트라 dict() 로는 캐시와 공유된다."""
    out = dict(data)
    out["sellers"] = [dict(r) for r in data["sellers"]]
    out["buyers"] = [dict(r) for r in data["buyers"]]
    out["foreign"] = dict(data["foreign"])
    return out


def mock_broker_activity(ticker: str) -> dict:
    """실패/오프라인 폴백. MockProvider 를 그대로 써서 스키마가 갈라지지 않게 한다."""
    from .providers import MockProvider  # 지연 import (순환 방지)

    data = MockProvider().get_broker_activity(ticker)
    data.update({"ticker": ticker, "source": "mock", "mock": True, "stale": False})
    return data


def build_broker_activity(ticker: str, app_key: str, app_secret: str) -> dict:
    """거래원 상위. build_orderbook 과 같은 4단 폴백: 캐시 → KIS → stale 캐시 → Mock.

    인증 실패(KISAuthError)만은 폴백 없이 그대로 던진다.
    """
    now = time.time()
    cached = _BROKER_CACHE.get(ticker)
    if cached and now - cached["ts"] < BROKER_CACHE_TTL_SEC:
        return _copy_brokers(cached["data"])

    token = get_access_token(app_key, app_secret)  # KISAuthError 는 그대로 전파
    refreshed = False  # 401 로 인한 강제 갱신은 호출당 1회만

    def once():
        nonlocal token, refreshed
        try:
            return _normalize_broker(ticker, _fetch_broker(ticker, token, app_key, app_secret))
        except KISAuthError:
            if refreshed:
                raise
            refreshed = True
            token = get_access_token(app_key, app_secret, force=True)
            return _normalize_broker(ticker, _fetch_broker(ticker, token, app_key, app_secret))

    try:
        data = _retry_on_data(once)
    except KISAuthError:
        raise
    except Exception:
        if cached:
            stale = _copy_brokers(cached["data"])
            stale["stale"] = True
            return stale
        return mock_broker_activity(ticker)

    _BROKER_CACHE[ticker] = {"data": data, "ts": now}
    return _copy_brokers(data)


# ── 수급 (외국인·기관·프로그램 순매수) ─────────────────────────
def _today_kst() -> str:
    return datetime.datetime.now(KST).strftime("%Y%m%d")


def _pbmn_to_eok(v) -> float:
    """확정 순매수 대금(백만원) → 억원."""
    return _to_float(v) / _PBMN_PER_EOK


def _won_to_eok(v) -> float:
    """프로그램 순매수 대금(원) → 억원."""
    return _to_float(v) / _EOK


def _ymd(date: str) -> str:
    """"20260708" → "2026-07-08". 형식이 아니면 원문 그대로."""
    return f"{date[:4]}-{date[4:6]}-{date[6:]}" if len(date) == 8 and date.isdigit() else date


def _mmdd(date: str) -> str:
    """"20260708" → "07/08". MockProvider 시계열의 dates 포맷과 같다."""
    return f"{date[4:6]}/{date[6:]}" if len(date) == 8 and date.isdigit() else date


def _fetch_investor_daily(ticker: str, token: str, app_key: str, app_secret: str) -> list[dict]:
    """GET inquire-investor → output(최근 30 영업일, 최신→과거).

    당일 행은 존재하지만 장중에는 순매수 필드가 전부 빈 문자열이다. 그 판정은 호출자 몫.
    """
    body = _get_json(
        INVESTOR_PATH, TR_INVESTOR_DAILY,
        {"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": ticker},
        token, app_key, app_secret, "투자자 수급",
    )
    rows = body.get("output") or []
    if not rows:
        raise KISDataError(f"KIS 투자자 수급 응답이 비었습니다 (ticker={ticker})")
    return rows


def _fetch_investor_estimate(ticker: str, token: str, app_key: str, app_secret: str) -> list[dict]:
    """GET investor-trend-estimate → output2(시각대별 가집계). 장 시작 직후엔 빈 리스트."""
    body = _get_json(
        ESTIMATE_PATH, TR_INVESTOR_ESTIMATE,
        {"MKSC_SHRN_ISCD": ticker},  # 이 TR 만 파라미터명이 다르다(FID_ 접두어 없음)
        token, app_key, app_secret, "수급 추정치",
    )
    return body.get("output2") or []


def _fetch_program_daily(ticker: str, base_date: str, token: str,
                         app_key: str, app_secret: str) -> dict[str, float]:
    """GET program-trade-by-stock-daily → {날짜: 프로그램 순매수 억원}.

    FID_INPUT_DATE_1 은 기준일이며 거기서 과거로 30 영업일을 준다. 당일 행도 실시간 누적.
    """
    body = _get_json(
        PROGRAM_PATH, TR_PROGRAM_DAILY,
        {"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": ticker,
         "FID_INPUT_DATE_1": base_date},
        token, app_key, app_secret, "프로그램매매",
    )
    rows = body.get("output") or []
    return {
        r["stck_bsop_date"]: _won_to_eok(r.get("whol_smtn_ntby_tr_pbmn"))
        for r in rows if r.get("stck_bsop_date")
    }


def _latest_estimate(rows: list[dict]) -> dict | None:
    """bsop_hour_gb 가 가장 큰(=가장 늦은 시각) 행. 값은 당일 누적 추정 순매수 수량."""
    graded = [r for r in rows if str(r.get("bsop_hour_gb", "")).isdigit()]
    return max(graded, key=lambda r: int(r["bsop_hour_gb"])) if graded else None


def _flow_dict(ticker: str, date: str, foreign: float, institution: float,
               retail: float, program: float, estimated: bool) -> dict:
    """앱 스키마(MockProvider.get_investor_flow 와 동일 키) + source/mock/stale/estimated.

    호가의 '전 단계가 0' 과 같은 취급 — 세 값이 모두 0 이면 수급이 없는 게 아니라
    응답이 비어 온 것이다(거래정지·매핑 오류). 데이터 실패로 올려 캐시/Mock 으로 넘긴다.
    """
    if foreign == 0 and institution == 0 and program == 0:
        raise KISDataError(
            f"KIS 수급 3개 값이 모두 0 (ticker={ticker}, date={date}) — 수급 데이터가 없습니다"
        )
    as_of = (
        f"{_ymd(date)} {datetime.datetime.now(KST):%H:%M} KST 장중 추정"
        if estimated else f"{_ymd(date)} 확정"
    )
    return {
        "ticker": ticker,
        "foreign": round(foreign, 1),
        "institution": round(institution, 1),
        "program": round(program, 1),
        "retail": round(retail, 1),
        "unit": "억원",
        "as_of": as_of,
        # 장중 추정치는 '수량 × 현재가' 라 확정 대금과 오차가 있다. UI 배지용.
        "estimated": estimated,
        "source": "kis",
        "mock": False,
        "stale": False,
    }


def _normalize_flow(ticker: str, inv_rows: list[dict], program_by_date: dict[str, float],
                    est_rows: list[dict], price_of) -> dict:
    """확정치 → 장중 추정치 → 직전 확정 행 순으로 당일 스냅샷을 만든다.

    `price_of()` 는 추정 수량을 억원으로 바꿀 때만 호출된다(확정치 경로에선 API 를 더 안 쓴다).
    """
    today = _today_kst()
    head = inv_rows[0]

    # 1) 당일 행이 아직 안 채워졌으면(장중) 가집계 추정치로 답한다.
    if head.get("stck_bsop_date") == today and not head.get("frgn_ntby_tr_pbmn"):
        est = _latest_estimate(est_rows)
        if est is not None:
            price = price_of()
            foreign = _to_float(est.get("frgn_fake_ntby_qty")) * price / _EOK
            institution = _to_float(est.get("orgn_fake_ntby_qty")) * price / _EOK
            return _flow_dict(
                ticker, today, foreign, institution,
                # 추정 TR 에 개인은 없다. Mock 과 같은 근사(개인 ≈ 반대편).
                retail=-(foreign + institution),
                program=program_by_date.get(today, 0.0),
                estimated=True,
            )

    # 2) 확정된 가장 최근 행. 장 시작~09:30 이나 휴장일이면 직전 영업일이 된다
    #    (as_of 에 그 날짜가 그대로 남으므로 오늘 값으로 오해되지 않는다).
    row = next((r for r in inv_rows if r.get("frgn_ntby_tr_pbmn")), None)
    if row is None:
        raise KISDataError(f"KIS 수급 확정 행이 없습니다 (ticker={ticker})")

    date = row["stck_bsop_date"]
    return _flow_dict(
        ticker, date,
        foreign=_pbmn_to_eok(row.get("frgn_ntby_tr_pbmn")),
        institution=_pbmn_to_eok(row.get("orgn_ntby_tr_pbmn")),
        retail=_pbmn_to_eok(row.get("prsn_ntby_tr_pbmn")),
        program=program_by_date.get(date, 0.0),
        estimated=False,
    )


def mock_investor_flow(ticker: str) -> dict:
    """실패/오프라인 폴백. MockProvider 를 그대로 써서 스키마가 갈라지지 않게 한다."""
    from .providers import MockProvider  # 지연 import (순환 방지)

    flow = MockProvider().get_investor_flow(ticker)
    flow.update({"ticker": ticker, "estimated": False,
                 "source": "mock", "mock": True, "stale": False})
    return flow


def build_investor_flow(ticker: str, app_key: str, app_secret: str) -> dict:
    """당일 수급 스냅샷. build_orderbook 과 같은 4단 폴백: 캐시 → KIS → stale 캐시 → Mock.

    인증 실패(KISAuthError)만은 폴백 없이 그대로 던진다.
    """
    now = time.time()
    cached = _FLOW_CACHE.get(ticker)
    if cached and now - cached["ts"] < FLOW_CACHE_TTL_SEC:
        return dict(cached["data"])

    token = get_access_token(app_key, app_secret)  # KISAuthError 는 그대로 전파
    refreshed = False  # 401 로 인한 강제 갱신은 호출당 1회만

    def price_of() -> float:
        """추정 수량 → 억원 환산용 현재가. Mock 가격으로 환산하면 실데이터인 척하는 값이 된다."""
        price = build_current_price(ticker, app_key, app_secret)
        if price["mock"]:
            raise KISDataError(f"현재가가 Mock 이라 수급 추정치를 환산할 수 없습니다 (ticker={ticker})")
        return float(price["price"])

    def fetch() -> dict:
        inv_rows = _fetch_investor_daily(ticker, token, app_key, app_secret)
        today = _today_kst()
        # 당일 행이 비었을 때만 추정치를 부른다 — 장 종료 후엔 이 호출이 통째로 빠진다.
        est_rows = (
            _fetch_investor_estimate(ticker, token, app_key, app_secret)
            if inv_rows[0].get("stck_bsop_date") == today
            and not inv_rows[0].get("frgn_ntby_tr_pbmn")
            else []
        )
        program_by_date = _fetch_program_daily(ticker, today, token, app_key, app_secret)
        return _normalize_flow(ticker, inv_rows, program_by_date, est_rows, price_of)

    def once():
        nonlocal token, refreshed
        try:
            return fetch()
        except KISAuthError:
            if refreshed:
                raise
            refreshed = True
            token = get_access_token(app_key, app_secret, force=True)
            return fetch()

    try:
        data = _retry_on_data(once)
    except KISAuthError:
        raise
    except Exception:
        if cached:
            stale = dict(cached["data"])
            stale["stale"] = True
            return stale
        return mock_investor_flow(ticker)

    _FLOW_CACHE[ticker] = {"data": data, "ts": now}
    return dict(data)


# ── 수급 시계열 (일별 추이) ────────────────────────────────────
def _copy_series(series: dict) -> dict:
    """캐시본 반환용 복사. dates/foreign/... 는 리스트라 dict() 로는 캐시와 공유된다."""
    out = dict(series)
    for k in ("dates", "foreign", "institution", "program"):
        out[k] = list(series[k])
    return out


def _normalize_flow_series(ticker: str, inv_rows: list[dict],
                           program_by_date: dict[str, float], days: int) -> dict:
    """확정 행만 골라 오래된→최신 순의 시계열로. 장중 추정치는 섞지 않는다."""
    rows = [r for r in inv_rows if r.get("frgn_ntby_tr_pbmn")][:days]
    if not rows:
        raise KISDataError(f"KIS 수급 시계열에 확정 행이 없습니다 (ticker={ticker})")
    rows.reverse()  # KIS 는 최신→과거. 차트는 왼쪽이 과거.

    dates = [r["stck_bsop_date"] for r in rows]
    return {
        "ticker": ticker,
        "dates": [_mmdd(d) for d in dates],
        "foreign": [round(_pbmn_to_eok(r.get("frgn_ntby_tr_pbmn")), 1) for r in rows],
        "institution": [round(_pbmn_to_eok(r.get("orgn_ntby_tr_pbmn")), 1) for r in rows],
        "program": [round(program_by_date.get(d, 0.0), 1) for d in dates],
        "unit": "억원",
        "as_of": f"{_ymd(dates[-1])} 확정",
        "source": "kis",
        "mock": False,
        "stale": False,
    }


def mock_investor_flow_series(ticker: str, days: int = DEFAULT_FLOW_DAYS) -> dict:
    """실패/오프라인 폴백. MockProvider 를 그대로 써서 스키마가 갈라지지 않게 한다."""
    from .providers import MockProvider  # 지연 import (순환 방지)

    series = MockProvider().get_investor_flow_series(ticker, days)
    series.update({"ticker": ticker, "source": "mock", "mock": True, "stale": False})
    return series


def build_investor_flow_series(ticker: str, app_key: str, app_secret: str,
                               days: int = DEFAULT_FLOW_DAYS) -> dict:
    """일별 수급 추이. build_investor_flow 와 같은 4단 폴백.

    두 TR 모두 1회 호출당 30 영업일이고 페이징이 없다 — days > 30 은 30 으로 잘린다.
    """
    if days < 1:
        raise ValueError(f"days 는 1 이상이어야 합니다: {days!r}")  # 폴백 대상 아님
    days = min(days, FLOW_MAX_DAYS)

    key = (ticker, days)
    now = time.time()
    cached = _FLOW_SERIES_CACHE.get(key)
    if cached and now - cached["ts"] < FLOW_SERIES_CACHE_TTL_SEC:
        return _copy_series(cached["data"])

    token = get_access_token(app_key, app_secret)  # KISAuthError 는 그대로 전파
    refreshed = False

    def fetch() -> dict:
        inv_rows = _fetch_investor_daily(ticker, token, app_key, app_secret)
        program_by_date = _fetch_program_daily(ticker, _today_kst(), token, app_key, app_secret)
        return _normalize_flow_series(ticker, inv_rows, program_by_date, days)

    def once():
        nonlocal token, refreshed
        try:
            return fetch()
        except KISAuthError:
            if refreshed:
                raise
            refreshed = True
            token = get_access_token(app_key, app_secret, force=True)
            return fetch()

    try:
        data = _retry_on_data(once)
    except KISAuthError:
        raise
    except Exception:
        if cached:
            stale = _copy_series(cached["data"])
            stale["stale"] = True
            return stale
        return mock_investor_flow_series(ticker, days)

    _FLOW_SERIES_CACHE[key] = {"data": data, "ts": now}
    return _copy_series(data)
