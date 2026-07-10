"""종합 신호 + 매매 계획 (탭1). 게이지·기여도·매매계획을 한 응답에.

지표·스코어는 수집기가 미리 계산해 스냅샷에 넣어 둔 걸 읽는다.
매매계획(trade_plan)은 저장하지 않는다 — 스냅샷의 last_close·last_atr 과
사용자 입력(계좌·리스크·진입가)만으로 나오는 순수 함수라 매 요청에 계산한다.
"""

from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Query

from ...core import collector, scoring
from ...core.snapshot_store import get_store

router = APIRouter(prefix="/api", tags=["signal"])


def _universe_name(ticker: str) -> str:
    for entry in collector.load_universe():
        if entry["ticker"] == ticker:
            return entry["name"]
    return ticker


def _snapshot_or_collect(ticker: str) -> dict:
    """스냅샷을 읽고, 없으면 그 종목만 1회 수집한다.

    유니버스 밖 종목도 조회할 수 있어야 해서 404 대신 온디맨드로 받는다.
    이 호출도 kis._RATE 토큰버킷을 지나므로 수집기와 유량을 나눠 쓴다.
    """
    store = get_store()
    snapshot = store.get(ticker)
    if snapshot is not None:
        return snapshot

    try:
        collector.collect_ticker(ticker, _universe_name(ticker), store=store)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=404,
                            detail=f"{ticker} 스냅샷 없음 — 수집 실패: {e}") from e

    snapshot = store.get(ticker)
    if snapshot is None:
        raise HTTPException(status_code=404, detail=f"{ticker} 스냅샷 없음")
    return snapshot


def _header(snapshot: dict) -> dict:
    """StockHeader 컴포넌트용 종목 요약 스트립 — 전환 전 deps.stock_header 와 같은 키.

    as_of 는 KIS 가 준 시세 시각이다. 스냅샷을 만든 시각은 응답 최상위 as_of 로 따로 나간다.
    """
    return {
        "ticker": snapshot["ticker"],
        "price": snapshot["price"],
        "change": snapshot["change"],
        "change_pct": snapshot["change_pct"],
        "volume": snapshot["volume"],
        "day_open": snapshot["day_open"],
        "day_high": snapshot["day_high"],
        "day_low": snapshot["day_low"],
        "as_of": snapshot["quote_as_of"],
        "market_status": snapshot["market_status"],
        "source": snapshot["source"],
        "mock": bool(snapshot["mock"]),
        "stale": bool(snapshot["stale"]),
    }


@router.get("/signal/{ticker}")
def get_signal(
    ticker: str,
    account: float = Query(10_000_000, description="계좌 크기(원)"),
    risk_pct: float = Query(2.0, description="감당 리스크(%)"),
    entry: float | None = Query(None, description="진입가(미지정 시 현재가)"),
    direction: str = Query("long", pattern="^(long|short)$"),
):
    snapshot = _snapshot_or_collect(ticker)

    entry_price = entry if entry is not None else snapshot["last_close"]
    plan = scoring.risk_plan(entry_price, snapshot["last_atr"], direction)
    position = scoring.position_size(account, risk_pct, plan["entry"], plan["stop"])

    return {
        "ticker": ticker,
        "header": _header(snapshot),
        "signal": {
            "final_score": snapshot["final_score"],
            "label": snapshot["label"],
            "contributions": json.loads(snapshot["contributions_json"]),
        },
        "trade_plan": {**plan, "position": position},
        # 수집 시각. 프론트가 "N초 전 갱신" / "지연" 배지에 쓴다.
        "as_of": snapshot["as_of"],
        "stale": bool(snapshot["stale"]),
    }
