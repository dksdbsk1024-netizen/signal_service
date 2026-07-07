"""시세 정리 (yfinance 실데이터) — DESIGN.md §7 매크로 레이어 섹션 B.

경제지표(core.macro)와 달리 '발표치'가 아니라 실시간 시세다. 지수(코스피·코스닥·
S&P500·나스닥)·환율(원/달러)·변동성(VIX)을 yfinance 로 받아 현재값 + 전일대비
등락률(%)로 정리한다. 키 불필요.

안정성 구조는 core.macro 와 동일 원칙(캐시·재시도·stale 폴백)을 공유한다. 공통
재시도 래퍼(`_retry`)와 TTL 상수(`CACHE_TTL_SEC`)를 macro 에서 그대로 재사용하고,
시세용 캐시만 별도로 둔다.
- fetch 성공: 캐시 갱신 후 반환.
- fetch 실패(재시도까지): 직전 실데이터가 있으면 stale, 없으면 Mock.
"""

from __future__ import annotations

import time

from .macro import CACHE_TTL_SEC, _retry  # 공통 안정성 헬퍼 재사용

# 시세 레지스트리. 표시명 → yfinance 심볼 + 종류(index|fx|vix).
#   name 은 라우트/프론트가 쓰는 표시명(코스피 등)과 일치.
QUOTES: dict[str, dict] = {
    "코스피":  {"symbol": "^KS11", "kind": "index"},
    "코스닥":  {"symbol": "^KQ11", "kind": "index"},
    "S&P500":  {"symbol": "^GSPC", "kind": "index"},
    "나스닥":  {"symbol": "^IXIC", "kind": "index"},
    "VIX":     {"symbol": "^VIX",  "kind": "vix"},
    # 환율: yfinance KRW=X = USD/KRW. pair 는 프론트 표시용.
    "원/달러": {"symbol": "KRW=X", "kind": "fx", "pair": "USD/KRW"},
}

# get_fx(pair) 진입점이 쓰는 이름(라우트는 "USD/KRW" 로 호출).
FX_NAME = "원/달러"

# name → {"data": quote_dict, "ts": epoch_seconds}. 프로세스 수명 동안 유지.
_QUOTE_CACHE: dict[str, dict] = {}

# Mock 폴백 값(value, change_pct). 최초 fetch 실패/오프라인 시 스키마 유지용.
_MOCK_VALUES: dict[str, tuple[float, float]] = {
    "코스피": (2680.0, 0.42), "코스닥": (870.0, -0.31),
    "S&P500": (5500.0, 0.18), "나스닥": (18000.0, -0.25),
    "VIX": (17.3, 2.1), "원/달러": (1352.4, -0.28),
}


def _fetch_yf(symbol: str) -> tuple[float, float, str]:
    """yfinance 일봉 → (현재값, 전일종가, 기준일). 최근 2영업일 종가로 등락 산출."""
    import yfinance as yf  # 지연 import (무거운 의존)

    def once():
        hist = yf.Ticker(symbol).history(period="7d", interval="1d", auto_adjust=False)
        closes = hist["Close"].dropna()
        if len(closes) < 2:
            raise ValueError(f"yfinance {symbol}: 종가 데이터 부족")
        last = float(closes.iloc[-1])
        prev = float(closes.iloc[-2])
        as_of = closes.index[-1].strftime("%Y-%m-%d")  # 최신 종가 기준일
        return last, prev, as_of

    return _retry(once)


def mock_quote(name: str) -> dict:
    """실패/오프라인 폴백. 실데이터와 동일 스키마 유지."""
    meta = QUOTES.get(name, {})
    value, change_pct = _MOCK_VALUES.get(name, (0.0, 0.0))
    data = {
        "name": name,
        "value": value,
        "change_pct": change_pct,
        "as_of": "Mock",
        "symbol": meta.get("symbol"),
        "source": "mock",   # UI 배지: 실데이터 아님
        "mock": True,
        "stale": False,
    }
    if meta.get("pair"):
        data["pair"] = meta["pair"]
    return data


def build_quote(name: str) -> dict:
    """시세 하나 정리. 캐시 → yfinance(재시도) → stale 캐시 → Mock 순 폴백."""
    meta = QUOTES.get(name)
    if meta is None:
        return mock_quote(name)

    now = time.time()
    cached = _QUOTE_CACHE.get(name)
    # 신선한 캐시(TTL 내) → 재요청 없이 반환. 매 새로고침 값 안정 + 폴백 튐 방지.
    if cached and now - cached["ts"] < CACHE_TTL_SEC:
        return dict(cached["data"])

    try:
        last, prev, as_of = _fetch_yf(meta["symbol"])
        change_pct = (last / prev - 1) * 100 if prev else 0.0
        data = {
            "name": name,
            "value": round(last, 2),
            "change_pct": round(change_pct, 2),
            "as_of": as_of,
            "symbol": meta["symbol"],
            "source": "yfinance",
            "mock": False,
            "stale": False,          # 캐시 폴백 시 True (UI '갱신 지연' 표시)
        }
        if meta.get("pair"):
            data["pair"] = meta["pair"]
        _QUOTE_CACHE[name] = {"data": data, "ts": now}
        return dict(data)
    except Exception:
        # 재시도까지 실패. 직전 실데이터가 있으면 Mock 대신 '오래된 캐시'.
        if cached:
            stale = dict(cached["data"])
            stale["stale"] = True
            return stale
        return mock_quote(name)
