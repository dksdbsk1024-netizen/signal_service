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


def soft_saturate(x: float, half: float) -> float:
    """포화 없는 단조 압축. |x|=half 에서 ±50, x→±∞ 에서 ±100에 점근.

    clamp와 달리 상한에 '붙지' 않아 극단값 사이의 순서(변별력)가 남는다.
    """
    if half <= 0:
        raise ValueError("half must be positive")
    return 100.0 * x / (abs(x) + half)


def score_flow(smart_ratio: float, program_ratio: float) -> float:
    """수급: 당일 거래대금 대비 순매수 비율 → 점수.

    절대 금액(억원)을 쓰면 거래대금이 큰 종목일수록 무조건 상한이라 신호가 죽는다.
    비율로 정규화해 종목 크기를 소거하고(삼성전자 vs 소형주 공정 비교),
    soft_saturate로 압축해 ±100에 도달하지 않게 한다.
    """
    smart = soft_saturate(smart_ratio, config.FLOW_HALF_RATIO)
    prog = soft_saturate(program_ratio, config.FLOW_HALF_RATIO)
    w = config.FLOW_PROGRAM_WEIGHT
    return clamp((smart + w * prog) / (1 + w))


def score_obv(divergence: float) -> float:
    """OBV 다이버전스(−1~+1 근사) → 점수. 상승 다이버전스=+, 하락=−."""
    return clamp(divergence * 100)


def score_atr_band(pos: float) -> float:
    """ATR밴드 위치 0~1. 상단(1)=+100, 하단(0)=−100, 중앙(0.5)=0. score_pct_b 동형."""
    return clamp((pos - 0.5) * 200)


# ── 카테고리 집계 ──────────────────────────────────────────────
# 봉 부족으로 못 구한 지표는 IndicatorSet 에서 None 으로 온다. 여기서 0 이나 중립값으로
# 치환하면 안 된다 — RSI 결측을 50(중립)으로 치면 "모멘텀 중립"이라는 없는 관측을
# 만들어내고, 0 으로 치면 -100점(극단 과매도)이 된다. 없는 지표는 빼고 평균한다.
def _optional(fn, *args) -> float | None:
    """인자에 None 이 하나라도 있으면 점수도 None. 아니면 fn 을 태운다."""
    return None if any(a is None for a in args) else fn(*args)


def _category_scores(ind: IndicatorSet) -> dict[str, tuple[float | None, dict]]:
    """카테고리별 (점수, 세부 지표 점수 dict). 세부는 UI 드릴다운·검증용.

    세부 지표 점수가 None 이면 그 지표는 평균에서 빠진다. 한 카테고리의 지표가
    전부 None 이면 카테고리 점수도 None — 그 카테고리는 최종 스코어에서 통째로 빠지고
    가중치는 나머지 카테고리로 재분배된다(score_stock).
    """
    vwap_gap = ind.trend.get("price_vs_vwap")
    if vwap_gap is None:
        direction_sign = None  # 방향을 모르면 거래량 급증의 부호도 못 정한다
    else:
        direction_sign = 0.0 if vwap_gap == 0 else math.copysign(1.0, vwap_gap)

    trend_detail = {
        "ma_alignment": _optional(score_ma_alignment, ind.trend.get("ma_alignment")),
        "price_vs_vwap": _optional(score_price_vs_vwap, vwap_gap),
    }
    momentum_detail = {
        "rsi": _optional(score_rsi, ind.momentum.get("rsi")),
        "macd_hist": _optional(score_macd_hist, ind.momentum.get("macd_hist"), ind.last_close),
        "stoch": _optional(score_stoch, ind.momentum.get("stoch_k")),
    }
    volume_detail = {
        "surge": _optional(score_volume, ind.volume.get("surge"), direction_sign),
    }
    volatility_detail = {
        "pct_b": _optional(score_pct_b, ind.volatility.get("pct_b")),
        "atr_band": _optional(score_atr_band, ind.volatility.get("atr_band")),
    }
    flow_detail = {
        "smart_money": _optional(
            score_flow, ind.flow.get("smart_money_ratio"), ind.flow.get("program_ratio")
        ),
        "obv": _optional(score_obv, ind.flow.get("obv")),
    }

    def weighted(detail: dict, cat: str) -> float | None:
        """세부지표 점수를 config.INDICATOR_WEIGHTS로 가중평균(가용 지표 내 합=1 재정규화).

        None 인 지표는 분자·분모 양쪽에서 빠진다 — 남은 지표들만의 가중평균이 된다.
        전부 None 이면 카테고리 점수도 None.
        """
        usable = {k: v for k, v in detail.items() if v is not None}
        if not usable:
            return None
        w = config.INDICATOR_WEIGHTS.get(cat, {})
        total_w = sum(w.get(k, 1.0) for k in usable) or 1.0
        return clamp(sum(usable[k] * w.get(k, 1.0) for k in usable) / total_w)

    return {
        "trend": (weighted(trend_detail, "trend"), trend_detail),
        "momentum": (weighted(momentum_detail, "momentum"), momentum_detail),
        "volume": (weighted(volume_detail, "volume"), volume_detail),
        "volatility": (weighted(volatility_detail, "volatility"), volatility_detail),
        "flow": (weighted(flow_detail, "flow"), flow_detail),
    }


def _category_coverage(cat: str, detail: dict) -> float:
    """카테고리 안에서 실제로 쓰인 지표 가중치의 비율 (0~1).

    카테고리 단위로만 세면 신뢰도가 과장된다: 추세는 VWAP(첫 봉부터) + 이평배열(60봉)
    인데, 봉 21개면 VWAP 하나로 "추세 100% 반영"이라고 말하게 된다. 지표 단위로 센다.
    """
    w = config.INDICATOR_WEIGHTS.get(cat, {})
    total = sum(w.get(k, 1.0) for k in detail)
    if not total:
        return 0.0
    usable = sum(w.get(k, 1.0) for k, v in detail.items() if v is not None)
    return usable / total


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
    final_score: float | None
    label: str | None
    contributions: list[ContributionEntry]
    # 가용 카테고리 가중치 / 요청 가중치 합. 1.0 = 전 지표 사용, 0.4 = 40% 만 사용.
    # 워밍업 중에는 1.0 미만이 정상이다 — UI 가 "신뢰도" 로 표시한다.
    coverage: float = 1.0
    # 봉 부족으로 빠진 카테고리(영문 키). UI 가 "무엇이 빠졌는지" 를 말할 근거.
    unavailable: list[str] = field(default_factory=list)


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

    봉 부족으로 점수를 못 내는 카테고리는 통째로 빠지고, 그 가중치는 남은
    카테고리로 재분배된다(분모에서 제외). "빠진 카테고리 = 0점" 으로 치면 신호가
    중립 쪽으로 끌려가 왜곡되므로 그렇게 하지 않는다.

    가용 카테고리가 하나도 없으면 final_score·label 은 None 이다 — 0.0/"중립"이
    아니다. 스코어를 못 내는 것과 "중립"은 다른 말이다.
    """
    weights = weights or config.DEFAULT_WEIGHTS
    requested_w = sum(weights.get(c, 0) for c in config.CATEGORIES)
    cats = _category_scores(ind)

    available = [c for c in config.CATEGORIES if cats[c][0] is not None]
    unavailable = [c for c in config.CATEGORIES if cats[c][0] is None]
    # 재정규화 분모: 가용 카테고리의 가중치만 더한다.
    usable_w = sum(weights.get(c, 0) for c in available)

    if not available or usable_w <= 0:
        return SignalResult(
            final_score=None,
            label=None,
            contributions=[],
            coverage=0.0,
            unavailable=unavailable,
        )

    contributions: list[ContributionEntry] = []
    final = 0.0
    for cat in available:
        score, detail = cats[cat]
        w = weights.get(cat, 0)
        contribution = score * w / usable_w  # 가용 가중치 기준 재정규화
        final += contribution
        contributions.append(
            ContributionEntry(
                category=cat,
                name=config.CATEGORY_LABELS[cat],
                score=round(score, 1),
                weight=w,
                contribution=round(contribution, 1),
                # 세부에서도 None 인 지표는 뺀다 — UI 드릴다운이 "0점"을 보면 안 된다.
                detail={k: round(v, 1) for k, v in detail.items() if v is not None},
            )
        )

    final = round(clamp(final), 1)
    # 기여 절대값 큰 순으로 정렬 (UI 상위 4~5개 노출)
    contributions.sort(key=lambda c: abs(c.contribution), reverse=True)

    # 신뢰도 = 카테고리 가중치 × 그 카테고리 안에서 실제로 쓰인 지표 비율, 의 합.
    # 빠진 카테고리는 0 으로 들어간다. 전 지표가 데워져야 1.0 이 된다.
    covered = sum(
        weights.get(cat, 0) * _category_coverage(cat, cats[cat][1])
        for cat in config.CATEGORIES
    )
    return SignalResult(
        final_score=final,
        label=label_for(final),
        contributions=contributions,
        coverage=round(covered / requested_w, 3) if requested_w else 0.0,
        unavailable=unavailable,
    )


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
