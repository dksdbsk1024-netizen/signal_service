"""수급 (탭3). 호가창 + 투자자 순매수(스냅샷+추이) + 프로그램/체결강도 + 거래원.

여섯 조각(현재가·호가·수급 스냅샷·수급 추이·체결강도·거래원)은 서로 독립적인 KIS
호출이라, 콜드 캐시에서 순차로 받으면 지연이 그대로 쌓인다(6회). run_parallel 로 한꺼번에
던져 총 지연을 '가장 느린 하나'로 줄인다. 각 provider 메서드는 자기 캐시에만 쓰므로
스레드 안전하고, 토큰 발급은 core.kis 의 락이 배치당 한 번만 일어나도록 보장한다.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..deps import get_provider, run_parallel, stock_header

router = APIRouter(prefix="/api", tags=["flow"])


@router.get("/flow/{ticker}")
def get_flow(ticker: str):
    provider = get_provider()
    res = run_parallel({
        "header": lambda: stock_header(ticker),                      # 호가창 중심가·등락 표시용
        "orderbook": lambda: provider.get_orderbook(ticker),
        "investor_flow": lambda: provider.get_investor_flow(ticker),         # 당일 스냅샷
        "series": lambda: provider.get_investor_flow_series(ticker),         # 일별 추이
        "trade_strength": lambda: provider.get_trade_strength(ticker),
        "brokers": lambda: provider.get_broker_activity(ticker),
    })
    return {
        "ticker": ticker,
        "header": res["header"],
        "orderbook": res["orderbook"],
        "investor_flow": res["investor_flow"],
        "series": res["series"],
        "trade_strength": res["trade_strength"],
        "brokers": res["brokers"],
    }
