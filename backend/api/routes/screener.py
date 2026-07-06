"""관심종목 / 스크리너 (탭5). 워치리스트 종목별 신호 요약.

다종목 스코어링 데모(UI 선구현). 실 데이터 연동은 v2 — API 호출 급증 이슈로 후순위.
"""

from __future__ import annotations

from fastapi import APIRouter

from ...core import scoring
from ..deps import load_indicators

router = APIRouter(prefix="/api", tags=["screener"])

# 데모 워치리스트 (코드 → 종목명)
WATCHLIST = [
    ("005930", "삼성전자"),
    ("000660", "SK하이닉스"),
    ("035420", "NAVER"),
    ("373220", "LG에너지솔루션"),
    ("035720", "카카오"),
    ("006400", "삼성SDI"),
]


@router.get("/screener")
def get_screener():
    rows = []
    for ticker, name in WATCHLIST:
        _ohlcv, _flow, ind = load_indicators(ticker)
        result = scoring.score_stock(ind)
        top = result.contributions[0]  # 기여 절대값 최상위
        rows.append({
            "ticker": ticker,
            "name": name,
            "final_score": result.final_score,
            "label": result.label,
            "top_contributor": {"name": top.name, "contribution": top.contribution},
        })
    # 최종 스코어 내림차순 (강한 매수 위로)
    rows.sort(key=lambda r: r["final_score"], reverse=True)
    return {"count": len(rows), "rows": rows}
