"""라우트 공용 의존성 — provider 주입 + 지표 로딩 헬퍼.

provider를 모듈 싱글턴으로 두어 라우트가 데이터 소스에 직접 의존하지 않게 한다.
실 API 단계에서 PROVIDER만 KISProvider로 교체하면 라우트는 그대로 재사용된다.
"""

from __future__ import annotations

import os

import pandas as pd
from dotenv import load_dotenv

from ..core.indicators import IndicatorSet, compute_indicators
from ..core.providers import MacroDataProvider, MockProvider

# backend/.env 로드 (FRED_API_KEY 등). 이미 환경에 있으면 유지.
load_dotenv()

# 종목 데이터: 개발/UI 테스트용 결정적 합성. 실연동 시 KISProvider 로 교체.
PROVIDER = MockProvider()

# 매크로: 항상 MacroDataProvider. 키가 없으면 core.macro 가 지표를 Mock(region 포함)으로
# 폴백하므로 키 없이도 UI 스키마가 동일하게 동작한다.
_FRED_KEY = os.getenv("FRED_API_KEY")
MACRO_PROVIDER = MacroDataProvider(_FRED_KEY)
MACRO_SOURCE = "fred" if _FRED_KEY else "mock"


def get_provider() -> MockProvider:
    return PROVIDER


def get_macro_provider():
    """매크로 데이터 소스 (FRED 또는 Mock). FastAPI Depends + 테스트 override 용."""
    return MACRO_PROVIDER


def load_indicators(ticker: str) -> tuple[pd.DataFrame, dict, IndicatorSet]:
    """티커 → (OHLCV, 수급, 계산된 지표). signal/technical/screener 공용."""
    ohlcv = PROVIDER.get_minute_ohlcv(ticker)
    flow = PROVIDER.get_investor_flow(ticker)
    ind = compute_indicators(ohlcv, flow)
    return ohlcv, flow, ind


def stock_header(ticker: str, ohlcv: pd.DataFrame) -> dict:
    """StockHeader 컴포넌트용 종목 요약 스트립."""
    last = float(ohlcv["close"].iloc[-1])
    first = float(ohlcv["open"].iloc[0])
    change = last - first
    change_pct = (change / first * 100) if first else 0.0
    return {
        "ticker": ticker,
        "price": round(last, 1),
        "change": round(change, 1),
        "change_pct": round(change_pct, 2),
        "volume": int(ohlcv["volume"].sum()),
        "day_open": round(first, 1),
        "day_high": round(float(ohlcv["high"].max()), 1),
        "day_low": round(float(ohlcv["low"].min()), 1),
        "as_of": PROVIDER.as_of,
    }
