"""종목 목록 / 스크리너 (탭5). 시가총액 상위 종목의 종합신호 + 시세 요약.

여러 종목을 한 표에서 훑어보고(현재가·등락률·거래량·종합신호), 행을 누르면
그 종목의 종합 신호(탭1)로 이동하는 목록 뷰. 스코어·라벨은 탭1과 동일한
scoring.score_stock 결과 그대로다(같은 종합신호를 목록에도 요약).

여기서 KIS 를 긁지 않는다. 백그라운드 수집기가 채워 둔 스냅샷만 읽는다 —
예전엔 종목 하나에 GET 12번이라 16종목 첫 페인트에 ~190회 왕복이 몰렸다.
"""

from __future__ import annotations

import json
import os

from fastapi import APIRouter

from ...core import collector
from ...core.snapshot_store import get_store

router = APIRouter(prefix="/api", tags=["screener"])

# 저장소가 비었을 때(부팅 직후·볼륨 초기화) 요청 스레드에서 즉석 수집할 종목 수.
# 200종목을 여기서 태우면 2,400 GET · 160초가 첫 요청에 걸린다. 나머지는 다음 사이클이 채운다.
SCREENER_COLD_LIMIT = 16


def _cold_limit() -> int:
    return int(os.getenv("SCREENER_COLD_LIMIT", str(SCREENER_COLD_LIMIT)))


def _row(snapshot: dict) -> dict:
    """스냅샷 1행 → 스크리너 표 1행. 응답 스키마는 전환 전과 동일하다."""
    contributions = json.loads(snapshot["contributions_json"])
    top = contributions[0]  # score_stock 이 기여 절대값 내림차순으로 정렬해 둔다
    return {
        "ticker": snapshot["ticker"],
        "name": snapshot["name"],
        "final_score": snapshot["final_score"],
        "label": snapshot["label"],
        "top_contributor": {"name": top["name"], "contribution": top["contribution"]},
        # 목록 표 컬럼용 시세 (탭1 헤더와 동일 소스)
        "price": snapshot["price"],
        "change": snapshot["change"],
        "change_pct": snapshot["change_pct"],
        "volume": snapshot["volume"],
        "market_status": snapshot["market_status"],
        "mock": bool(snapshot["mock"]),
    }


def _warm_cold_store(store) -> None:
    """스냅샷이 하나도 없으면 유니버스 앞머리만 즉석 수집한다(빈 화면 방지)."""
    for entry in collector.load_universe()[: _cold_limit()]:
        try:
            collector.collect_ticker(entry["ticker"], entry["name"],
                                     store=store, tier=entry.get("tier", 0))
        except Exception:  # noqa: BLE001 — 한 종목 실패가 화면 전체를 죽이지 않게
            continue


@router.get("/screener")
def get_screener():
    store = get_store()
    snapshots = store.get_all()
    if not snapshots:
        _warm_cold_store(store)
        snapshots = store.get_all()

    rows = [_row(s) for s in snapshots]  # 저장소가 이미 final_score 내림차순
    # 가장 오래된 스냅샷 시각 — 프론트가 목록 전체의 신선도를 이걸로 표시한다.
    as_of = min((s["as_of"] for s in snapshots), default=None)
    return {"count": len(rows), "rows": rows, "as_of": as_of}
