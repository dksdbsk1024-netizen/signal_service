"""수급 (탭3). 호가창 + 투자자 순매수(스냅샷+추이) + 프로그램/체결강도 + 거래원."""

from __future__ import annotations

from fastapi import APIRouter

from ..deps import get_provider, stock_header

router = APIRouter(prefix="/api", tags=["flow"])


@router.get("/flow/{ticker}")
def get_flow(ticker: str):
    provider = get_provider()
    return {
        "ticker": ticker,
        "header": stock_header(ticker),  # 호가창 중심가·등락 표시용
        "orderbook": provider.get_orderbook(ticker),
        "investor_flow": provider.get_investor_flow(ticker),  # 당일 스냅샷
        "series": provider.get_investor_flow_series(ticker),  # 일별 추이(외국인·기관·프로그램)
        "trade_strength": provider.get_trade_strength(ticker),
        "brokers": provider.get_broker_activity(ticker),
    }
