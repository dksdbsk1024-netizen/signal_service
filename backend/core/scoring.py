"""스코어링 엔진 — 제품 핵심 (DESIGN.md §8).

원시 지표(indicators.IndicatorSet)를 카테고리별 -100~+100 점수로 정규화하고,
가중합해 최종 스코어·라벨을 낸다. 모든 정규화 매핑을 작은 순수 함수로 분리해
"왜 이 신호인지"를 지표 단위로 추적·검증할 수 있게 한다(투명성).

부호 규약: 양수 = 매수 우호(국내 관습에서 빨강). 음수 = 매도 우호(파랑).

리스크 계산(탭1 매매계획)도 여기 둔다 — 판단(신호)→실행(계획)이 한 로직 흐름.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from . import config
from .indicators import IndicatorSet


# ── 보조 ───────────────────────────────────────────────────────
def clamp(x: float, lo: float = -100.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, x))


# ── 지표별 정규화 (각각 -100~+100) ─────────────────────────────
# 매핑은 의도적으로 선형·단조로 유지 — 규칙이 눈에 보여야 사용자가 신뢰한다.
def score_ma_alignment(alignment: float) -> float:
    """이평 배열 -1~+1 → -100~+100."""
    return clamp(alignment * 100)


def score_price_vs_vwap(gap_pct: float) -> float:
    """VWAP 괴리율(%). ±5% 에서 포화."""
    return clamp(gap_pct * 20)


def score_rsi(rsi: float) -> float:
    """RSI 50 중심. 75→+100, 25→-100."""
    return clamp((rsi - 50) * 4)


def score_macd_hist(hist: float, last_close: float) -> float:
    """MACD 히스토그램을 종가 대비로 정규화. 종가의 ±0.5% 에서 포화."""
    if last_close <= 0:
        return 0.0
    return clamp(hist / (0.005 * last_close) * 100)


def score_stoch(k: float) -> float:
    """%K 50 중심. 90→+100, 10→-100."""
    return clamp((k - 50) * 2.5)


def score_pct_b(pct_b: float) -> float:
    """볼린저 %b. 상단(1.0)=+100, 하단(0.0)=-100, 중앙(0.5)=0."""
    return clamp((pct_b - 0.5) * 200)


def score_volume(surge: float, direction_sign: float) -> float:
    """거래량 급증은 '현재 방향에 대한 확신'으로 본다.

    급증 강도(배수-1)를 현재가의 VWAP 대비 방향 부호와 곱한다.
    평균거래량(surge=1) → 0. 방향이 모호(sign=0)하면 0.
    """
    strength = clamp((surge - 1) * 80, 0, 100)
    return clamp(strength * direction_sign)


def score_flow(smart_money: float, program: float) -> float:
    """수급: 외국인+기관 순매수(억원)에 프로그램을 절반 가중. 점수≈억원."""
    return clamp(smart_money + 0.5 * program)


def score_obv(divergence: float) -> float:
    """OBV 다이버전스(−1~+1 근사) → 점수. 상승 다이버전스=+, 하락=−."""
    return clamp(divergence * 100)


def score_atr_band(pos: float) -> float:
    """ATR밴드 위치 0~1. 상단(1)=+100, 하단(0)=−100, 중앙(0.5)=0. score_pct_b 동형."""
    return clamp((pos - 0.5) * 200)


# ── 카테고리 집계 ──────────────────────────────────────────────
def _category_scores(ind: IndicatorSet) -> dict[str, tuple[float, dict]]:
    """카테고리별 (점수, 세부 지표 점수 dict). 세부는 UI 드릴다운·검증용."""
    vwap_gap = ind.trend.get("price_vs_vwap", 0.0)
    direction_sign = 0.0 if vwap_gap == 0 else math.copysign(1.0, vwap_gap)

    trend_detail = {
        "ma_alignment": score_ma_alignment(ind.trend.get("ma_alignment", 0.0)),
        "price_vs_vwap": score_price_vs_vwap(vwap_gap),
    }
    momentum_detail = {
        "rsi": score_rsi(ind.momentum.get("rsi", 50.0)),
        "macd_hist": score_macd_hist(ind.momentum.get("macd_hist", 0.0), ind.last_close),
        "stoch": score_stoch(ind.momentum.get("stoch_k", 50.0)),
    }
    volume_detail = {
        "surge": score_volume(ind.volume.get("surge", 1.0), direction_sign),
    }
    volatility_detail = {
        "pct_b": score_pct_b(ind.volatility.get("pct_b", 0.5)),
        "atr_band": score_atr_band(ind.volatility.get("atr_band", 0.5)),
    }
    flow_detail = {
        "smart_money": score_flow(
            ind.flow.get("smart_money", 0.0), ind.flow.get("program", 0.0)
        ),
        "obv": score_obv(ind.flow.get("obv", 0.0)),
    }

    def weighted(detail: dict, cat: str) -> float:
        """세부지표 점수를 config.INDICATOR_WEIGHTS로 가중평균(카테고리 내 합=1 재정규화).

        가중치 미지정 지표는 1.0. 전부 1.0이면 단순평균과 동일.
        """
        w = config.INDICATOR_WEIGHTS.get(cat, {})
        total_w = sum(w.get(k, 1.0) for k in detail) or 1.0
        return clamp(sum(detail[k] * w.get(k, 1.0) for k in detail) / total_w)

    return {
        "trend": (weighted(trend_detail, "trend"), trend_detail),
        "momentum": (weighted(momentum_detail, "momentum"), momentum_detail),
        "volume": (weighted(volume_detail, "volume"), volume_detail),
        "volatility": (weighted(volatility_detail, "volatility"), volatility_detail),
        "flow": (weighted(flow_detail, "flow"), flow_detail),
    }


# ── 결과 타입 ──────────────────────────────────────────────────
@dataclass
class ContributionEntry:
    """한 카테고리의 기여도. UI ContributionBar 1행에 대응."""

    category: str  # 영문 키
    name: str      # 한글 표시명
    score: float   # -100~+100
    weight: float  # %
    contribution: float  # = score * weight / 100 (최종 스코어 기여분)
    detail: dict = field(default_factory=dict)  # 세부 지표별 점수


@dataclass
class SignalResult:
    final_score: float
    label: str
    contributions: list[ContributionEntry]


def label_for(score: float) -> str:
    """최종 스코어 → 5단계 라벨 (config.LABEL_BANDS)."""
    for low, high, label in config.LABEL_BANDS:
        # 최상단 밴드는 high(100) 포함, 그 외는 [low, high)
        if (low <= score < high) or (high == 100 and score == 100):
            return label
    return "중립"


def score_stock(
    ind: IndicatorSet, weights: dict[str, float] | None = None
) -> SignalResult:
    """지표 묶음 → 최종 스코어·라벨·기여도 분해.

    가중치 합이 100이 아니어도 정규화해 최종 스코어를 [-100,100]로 유지한다.
    """
    weights = weights or config.DEFAULT_WEIGHTS
    total_w = sum(weights.get(c, 0) for c in config.CATEGORIES) or 1.0
    cats = _category_scores(ind)

    contributions: list[ContributionEntry] = []
    final = 0.0
    for cat in config.CATEGORIES:
        score, detail = cats[cat]
        w = weights.get(cat, 0)
        contribution = score * w / total_w  # 정규화된 기여분
        final += contribution
        contributions.append(
            ContributionEntry(
                category=cat,
                name=config.CATEGORY_LABELS[cat],
                score=round(score, 1),
                weight=w,
                contribution=round(contribution, 1),
                detail={k: round(v, 1) for k, v in detail.items()},
            )
        )

    final = round(clamp(final), 1)
    # 기여 절대값 큰 순으로 정렬 (UI 상위 4~5개 노출)
    contributions.sort(key=lambda c: abs(c.contribution), reverse=True)
    return SignalResult(final_score=final, label=label_for(final), contributions=contributions)


# ── 리스크 계산 (탭1 매매계획) ──────────────────────────────────
def risk_plan(entry: float, atr: float, direction: str = "long") -> dict:
    """ATR 기반 손절/목표 + R:R.

    손절 = 1×ATR, 목표 = config.ATR_MULTIPLES(1/1.5/2×ATR).
    long이면 손절 아래·목표 위, short이면 반대. R:R = 보상/위험.
    """
    if atr <= 0:
        raise ValueError("atr must be positive")
    if direction not in ("long", "short"):
        raise ValueError("direction must be 'long' or 'short'")

    sign = 1 if direction == "long" else -1
    risk_per_share = atr  # 1×ATR 손절
    stop = entry - sign * risk_per_share

    targets = []
    for m in config.ATR_MULTIPLES:
        target = entry + sign * m * atr
        rr = round((m * atr) / risk_per_share, 2)  # 보상/위험 = m
        targets.append({"mult": m, "price": round(target, 2), "rr": rr})

    return {
        "direction": direction,
        "entry": round(entry, 2),
        "atr": round(atr, 2),
        "stop": round(stop, 2),
        "risk_per_share": round(risk_per_share, 2),
        "targets": targets,
    }


def position_size(account: float, risk_pct: float, entry: float, stop: float) -> dict:
    """포지션 사이징: 감당 리스크(계좌×%)를 주당 리스크로 나눠 수량 산출."""
    per_share_risk = abs(entry - stop)
    if per_share_risk <= 0:
        raise ValueError("entry and stop must differ")
    risk_amount = account * risk_pct / 100
    qty = int(risk_amount // per_share_risk)
    return {
        "risk_amount": round(risk_amount, 0),
        "per_share_risk": round(per_share_risk, 2),
        "qty": qty,
        "invest_amount": round(qty * entry, 0),
    }
