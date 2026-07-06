"""종합 신호 + 매매 계획 (탭1). 게이지·기여도·매매계획을 한 응답에."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Query

from ...core import scoring
from ..deps import load_indicators, stock_header

router = APIRouter(prefix="/api", tags=["signal"])


@router.get("/signal/{ticker}")
def get_signal(
    ticker: str,
    account: float = Query(10_000_000, description="계좌 크기(원)"),
    risk_pct: float = Query(2.0, description="감당 리스크(%)"),
    entry: float | None = Query(None, description="진입가(미지정 시 현재가)"),
    direction: str = Query("long", pattern="^(long|short)$"),
):
    ohlcv, _flow, ind = load_indicators(ticker)
    result = scoring.score_stock(ind)

    entry_price = entry if entry is not None else ind.last_close
    plan = scoring.risk_plan(entry_price, ind.last_atr, direction)
    position = scoring.position_size(account, risk_pct, plan["entry"], plan["stop"])

    return {
        "ticker": ticker,
        "header": stock_header(ticker, ohlcv),
        "signal": {
            "final_score": result.final_score,
            "label": result.label,
            "contributions": [asdict(c) for c in result.contributions],
        },
        "trade_plan": {**plan, "position": position},
    }
