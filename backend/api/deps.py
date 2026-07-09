"""라우트 공용 의존성 — provider 주입 + 지표 로딩 헬퍼.

provider를 모듈 싱글턴으로 두어 라우트가 데이터 소스에 직접 의존하지 않게 한다.
"""

from __future__ import annotations

import datetime
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from ..core.indicators import IndicatorSet, compute_indicators
from ..core.providers import KISProvider, MacroDataProvider, MockProvider, StockProvider

# backend/.env 로드 (KIS·FRED 키 등). 이미 환경에 있으면 유지.
# 인자 없는 load_dotenv() 는 보통 이 파일 기준으로 상위를 훑어 backend/.env 를 찾지만,
# REPL·`python -c`·디버거(sys.gettrace)·frozen 에서는 cwd 기준으로 바뀐다. 리포 루트에는
# .env 가 없어 그때 조용히 Mock 으로 떨어진다 → 경로를 파일 기준으로 고정한다.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def _build_stock_provider() -> StockProvider:
    """KIS 키가 있으면 실데이터, 없으면 Mock (FRED/ECOS 와 같은 규약).

    STOCK_PROVIDER=mock 으로 키가 있어도 강제 Mock 이 된다 — pytest(conftest)와
    오프라인 개발용. 키 없는 PC 에서도 앱이 뜨는 게 폴백의 목적이다.
    """
    if os.getenv("STOCK_PROVIDER", "auto").strip().lower() == "mock":
        return MockProvider()
    app_key = os.getenv("KIS_APP_KEY")
    app_secret = os.getenv("KIS_APP_SECRET")
    if not (app_key and app_secret):
        return MockProvider()
    return KISProvider(app_key, app_secret, os.getenv("KIS_ACCOUNT_NO", ""))


PROVIDER: StockProvider = _build_stock_provider()
# 상단 배지용: 종목 데이터가 실데이터인지. 개별 응답의 source/mock 플래그가 더 정확하다.
STOCK_SOURCE = "live" if isinstance(PROVIDER, KISProvider) else "mock"

# 매크로: 항상 MacroDataProvider. 미국=FRED, 한국=ECOS(한국은행). 각 소스 키가 없으면
# core.macro 가 지표를 Mock(region 포함)으로 폴백하므로 키 없이도 UI 스키마가 동일하다.
# 지표 카드마다 source("fred"|"ecos"|"mock")를 실어 프론트가 소스를 구분 표시한다.
_FRED_KEY = os.getenv("FRED_API_KEY")
_ECOS_KEY = os.getenv("ECOS_API_KEY")
# 시세(yfinance)는 키가 없어도 네트워크를 탄다 → 키 비우기만으론 오프라인이 안 된다.
# MACRO_LIVE_QUOTES=0 이 STOCK_PROVIDER=mock 과 같은 역할(pytest·오프라인 개발).
_LIVE_QUOTES = os.getenv("MACRO_LIVE_QUOTES", "1").strip().lower() not in ("0", "false", "mock")
MACRO_PROVIDER = MacroDataProvider(_FRED_KEY, _ECOS_KEY, live_quotes=_LIVE_QUOTES)
# 상단 배지용 종합 상태: 실데이터 키가 하나라도 있으면 "live", 없으면 "mock".
MACRO_SOURCE = "live" if (_FRED_KEY or _ECOS_KEY) else "mock"


def get_provider() -> StockProvider:
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


_KST = datetime.timezone(datetime.timedelta(hours=9))


def market_status() -> str:
    """StockHeader 배지용: open(정규장) | after(시간외) | closed.

    KRX 휴장일은 모른다 — 휴장일이면 KIS 가 빈 응답을 주고 provider 가 Mock 으로
    폴백하므로, 배지보다 header["mock"] 이 더 정확한 신선도 신호다.
    """
    now = datetime.datetime.now(_KST)
    if now.weekday() >= 5:  # 토·일
        return "closed"
    hhmm = now.hour * 100 + now.minute
    if 900 <= hhmm < 1530:
        return "open"
    if 1530 <= hhmm < 1800:
        return "after"
    return "closed"


def stock_header(ticker: str) -> dict:
    """StockHeader 컴포넌트용 종목 요약 스트립.

    분봉 파생이 아니라 현재가 스냅샷(KIS 면 실시간)을 쓴다. 등락은 KIS 기준
    전일 종가 대비, Mock 은 당일 시가 대비다(MockProvider.get_current_price).
    """
    px = PROVIDER.get_current_price(ticker)
    return {
        "ticker": ticker,
        "price": px["price"],
        "change": px["change"],
        "change_pct": px["change_pct"],
        "volume": px["volume"],
        "day_open": px["open"],
        "day_high": px["high"],
        "day_low": px["low"],
        "as_of": px["as_of"],
        "market_status": market_status(),
        "source": px["source"],
        "mock": px["mock"],
        "stale": px["stale"],
    }
