"""종합 신호 + 매매 계획 (탭1). 게이지·기여도·매매계획을 한 응답에.

스코어링은 두 단계다:
- 무거운 쪽(지표 계산, KIS 필요)은 수집기가 미리 해서 스냅샷에 넣어 둔다.
- 가벼운 쪽(지표 → 점수 → 카테고리 가중합)은 순수 계산이라 여기서 매 요청 한다.

그래서 사용자 가중치(?weights=)로 재채점해도 KIS 를 부르지 않는다 — 읽기전용 유지.
매매계획(trade_plan)도 같은 이유로 저장하지 않는다: last_close·last_atr 과
사용자 입력(계좌·리스크·진입가)만으로 나오는 순수 함수다.
"""

from __future__ import annotations

import json
from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Query

from ...core import collector, config, scoring
from ...core.indicators import IndicatorSet
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


def _parse_weights(raw: str | None) -> dict[str, float] | None:
    """?weights={"flow":45,...} → 검증된 카테고리 가중치. 미지정이면 None.

    부분 지정을 안 받는 이유: score_stock 은 weights.get(cat, 0) 이라 빠진
    카테고리가 조용히 가중치 0이 된다 — 오타 하나가 지표를 통째로 지운다.
    합이 100 일 필요는 없다. score_stock 이 total_w 로 정규화한다.
    """
    if raw is None:
        return None

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"weights 가 JSON 이 아니다: {e}") from e

    if not isinstance(parsed, dict) or set(parsed) != set(config.CATEGORIES):
        raise HTTPException(400, f"weights 키는 정확히 {config.CATEGORIES} 여야 한다")

    weights: dict[str, float] = {}
    for cat, value in parsed.items():
        # bool 은 int 의 서브클래스다 — True 가 가중치 1로 통과하는 걸 막는다.
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise HTTPException(400, f"{cat} 가중치가 숫자가 아니다")
        if not 0 <= value <= 100:
            raise HTTPException(400, f"{cat} 가중치는 0~100 이어야 한다 (받은 값: {value})")
        weights[cat] = float(value)

    if sum(weights.values()) <= 0:
        raise HTTPException(400, "가중치 합이 0이면 스코어가 정의되지 않는다")
    return weights


def _signal(snapshot: dict, weights: dict[str, float] | None) -> dict:
    """스냅샷 → 신호 블록. 가중치를 주면 원지표에서 재채점한다.

    coverage 는 스코어에 실제로 반영된 가중치 비율이다. 워밍업 중에는 1 미만이고,
    프론트가 "신뢰도 낮음" 배지로 쓴다. final_score 가 None 이면 가용 지표가 0개다.
    """
    if weights is None:
        # 기본 경로 — 수집 시점에 DEFAULT_WEIGHTS 로 구운 값을 그대로 낸다.
        return {
            "final_score": snapshot["final_score"],
            "label": snapshot["label"],
            "contributions": json.loads(snapshot["contributions_json"]),
            "weights": config.DEFAULT_WEIGHTS,
            "coverage": snapshot["coverage"],
            "bars": snapshot["bars"],
        }

    # 재채점 — 순수 계산이다. provider 를 건드리지 않으므로 읽기전용을 깨지 않는다.
    ind = IndicatorSet(**json.loads(snapshot["indicators_json"]))
    result = scoring.score_stock(ind, weights=weights)
    return {
        "final_score": result.final_score,
        "label": result.label,
        "contributions": [asdict(c) for c in result.contributions],
        "weights": weights,
        "coverage": result.coverage,
        "bars": ind.bars,
    }


def _trade_plan(snapshot: dict, entry: float | None, direction: str,
                account: float, risk_pct: float) -> tuple[dict | None, dict | None]:
    """(매매계획, 불가 사유). 손절·목표는 ATR 기반이라 ATR 이 없으면 만들 수 없다.

    장 시작 후 14분간(1분봉 14개 미만) ATR 이 없다. 예전엔 ATR 을 0.0 으로 채워
    risk_plan 이 ValueError 를 던졌고 /api/signal 이 통째로 500 났다 — 데이트레이딩에
    가장 중요한 시간대에 탭1이 죽었다. 이제 계획만 비우고 나머지는 정상으로 내보낸다.

    가짜 손절가를 만들지 않는 이유는 자명하다: 손절가 0원은 손절이 아니라 파산이다.
    """
    atr_value = snapshot["last_atr"]
    if atr_value is None or atr_value <= 0:
        required = config.INDICATOR_MIN_BARS["atr"]
        return None, {
            "reason": "insufficient_bars",
            "bars": snapshot["bars"],
            "required": required,
            "message": (
                f"봉 {snapshot['bars']}/{required}개 — ATR({config.ATR_PERIOD}) 계산 불가라 "
                f"손절·목표가를 낼 수 없습니다. 봉이 쌓이면 자동으로 나옵니다."
            ),
        }

    entry_price = entry if entry is not None else snapshot["last_close"]
    plan = scoring.risk_plan(entry_price, atr_value, direction)
    position = scoring.position_size(account, risk_pct, plan["entry"], plan["stop"])
    return {**plan, "position": position}, None


@router.get("/signal/{ticker}")
def get_signal(
    ticker: str,
    account: float = Query(10_000_000, description="계좌 크기(원)"),
    risk_pct: float = Query(2.0, description="감당 리스크(%)"),
    entry: float | None = Query(None, description="진입가(미지정 시 현재가)"),
    direction: str = Query("long", pattern="^(long|short)$"),
    weights: str | None = Query(
        None, description='카테고리 가중치 JSON. 예: {"flow":45,...}. 미지정 시 기본 가중치'
    ),
):
    snapshot = _snapshot_or_collect(ticker)
    plan, plan_unavailable = _trade_plan(snapshot, entry, direction, account, risk_pct)

    return {
        "ticker": ticker,
        "header": _header(snapshot),
        "signal": _signal(snapshot, _parse_weights(weights)),
        "trade_plan": plan,
        # 계획이 없을 때만 채워진다. 프론트가 매매계획 섹션에 이 message 를 띄운다.
        "trade_plan_unavailable": plan_unavailable,
        # 수집 시각. 프론트가 "N초 전 갱신" / "지연" 배지에 쓴다.
        "as_of": snapshot["as_of"],
        "stale": bool(snapshot["stale"]),
    }
