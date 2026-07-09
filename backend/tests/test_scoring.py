"""scoring.py — 정규화 범위·라벨 경계·기여도 합·가중치 검증."""

import pytest

from backend.core import config, scoring
from backend.core.indicators import IndicatorSet


def test_clamp_range():
    assert scoring.clamp(500) == 100
    assert scoring.clamp(-500) == -100
    assert scoring.clamp(37) == 37


@pytest.mark.parametrize(
    "score,expected",
    [
        (100, "적극매수"),
        (80, "적극매수"),
        (60, "적극매수"),
        (59.9, "매수"),
        (20, "매수"),
        (19.9, "중립"),
        (0, "중립"),
        (-20, "중립"),
        (-20.1, "매도"),
        (-60, "매도"),
        (-60.1, "적극매도"),
        (-100, "적극매도"),
    ],
)
def test_label_bands(score, expected):
    assert scoring.label_for(score) == expected


def _bullish_indicators() -> IndicatorSet:
    """모든 카테고리가 강한 매수 신호인 합성 지표."""
    return IndicatorSet(
        trend={"ma_alignment": 1.0, "price_vs_vwap": 5.0},
        momentum={"rsi": 75, "macd_hist": 10.0, "stoch_k": 90, "stoch_d": 85},
        volume={"surge": 3.0},
        volatility={"pct_b": 1.0, "atr_band": 1.0},
        flow={"smart_money_ratio": 0.30, "program_ratio": 0.20, "obv": 1.0},
        last_close=10000.0,
        last_atr=150.0,
    )


def test_bullish_all_positive_and_active_buy():
    result = scoring.score_stock(_bullish_indicators())
    assert result.final_score > 60
    assert result.label == "적극매수"
    assert all(c.score > 0 for c in result.contributions)


def test_bearish_symmetry():
    bear = IndicatorSet(
        trend={"ma_alignment": -1.0, "price_vs_vwap": -5.0},
        momentum={"rsi": 25, "macd_hist": -10.0, "stoch_k": 10, "stoch_d": 15},
        volume={"surge": 3.0},
        volatility={"pct_b": 0.0, "atr_band": 0.0},
        flow={"smart_money_ratio": -0.30, "program_ratio": -0.20, "obv": -1.0},
        last_close=10000.0,
        last_atr=150.0,
    )
    result = scoring.score_stock(bear)
    assert result.final_score < -60
    assert result.label == "적극매도"


def test_contribution_sum_equals_final():
    result = scoring.score_stock(_bullish_indicators())
    total = sum(c.contribution for c in result.contributions)
    # 각 기여도 소수1자리 반올림 오차 누적 허용
    assert abs(total - result.final_score) < 0.5


def test_final_score_within_range():
    result = scoring.score_stock(_bullish_indicators())
    assert -100 <= result.final_score <= 100
    for c in result.contributions:
        assert -100 <= c.score <= 100


def test_weights_affect_result():
    ind = IndicatorSet(
        trend={"ma_alignment": 0.0, "price_vs_vwap": 0.0},
        momentum={"rsi": 50, "macd_hist": 0.0, "stoch_k": 50, "stoch_d": 50},
        volume={"surge": 1.0},
        volatility={"pct_b": 0.5},
        flow={"smart_money_ratio": 0.10, "program_ratio": 0.0},  # 수급만 강한 매수
        last_close=10000.0,
        last_atr=100.0,
    )
    high_flow = scoring.score_stock(ind, {"flow": 80, "trend": 5, "momentum": 5, "volume": 5, "volatility": 5})
    low_flow = scoring.score_stock(ind, {"flow": 10, "trend": 30, "momentum": 30, "volume": 15, "volatility": 15})
    # 수급 가중이 클수록 최종 스코어 높음
    assert high_flow.final_score > low_flow.final_score


def test_contributions_sorted_by_magnitude():
    result = scoring.score_stock(_bullish_indicators())
    mags = [abs(c.contribution) for c in result.contributions]
    assert mags == sorted(mags, reverse=True)


def test_neutral_indicators_near_zero():
    ind = IndicatorSet(
        trend={"ma_alignment": 0.0, "price_vs_vwap": 0.0},
        momentum={"rsi": 50, "macd_hist": 0.0, "stoch_k": 50, "stoch_d": 50},
        volume={"surge": 1.0},
        volatility={"pct_b": 0.5},
        flow={"smart_money_ratio": 0.0, "program_ratio": 0.0},
        last_close=10000.0,
        last_atr=100.0,
    )
    result = scoring.score_stock(ind)
    assert result.final_score == 0.0
    assert result.label == "중립"


def test_category_weights_sum_100():
    assert sum(config.DEFAULT_WEIGHTS.values()) == 100


def test_indicator_weights_cover_all_categories():
    assert set(config.INDICATOR_WEIGHTS) == set(config.CATEGORIES)
    assert "obv" in config.INDICATOR_WEIGHTS["flow"]
    assert "atr_band" in config.INDICATOR_WEIGHTS["volatility"]


def test_score_obv_sign():
    assert scoring.score_obv(1.0) > 0
    assert scoring.score_obv(-1.0) < 0
    assert scoring.score_obv(0.0) == 0.0


def test_score_atr_band_bounds():
    assert scoring.score_atr_band(1.0) == 100.0
    assert scoring.score_atr_band(0.0) == -100.0
    assert scoring.score_atr_band(0.5) == 0.0


def test_new_indicators_in_contribution_detail():
    result = scoring.score_stock(_bullish_indicators())
    by_cat = {c.category: c for c in result.contributions}
    assert "obv" in by_cat["flow"].detail
    assert "atr_band" in by_cat["volatility"].detail


# ── 수급 정규화 (거래대금 대비 비율) ───────────────────────────
def test_soft_saturate_half_point_and_bounds():
    assert scoring.soft_saturate(config.FLOW_HALF_RATIO, config.FLOW_HALF_RATIO) == 50.0
    assert scoring.soft_saturate(-config.FLOW_HALF_RATIO, config.FLOW_HALF_RATIO) == -50.0
    assert scoring.soft_saturate(0.0, 0.05) == 0.0
    assert abs(scoring.soft_saturate(1e9, 0.05)) < 100.0


def test_score_flow_never_saturates_and_stays_monotonic():
    """실데이터 극단(거래대금의 20%, 50%, 100%)에서도 순서가 유지돼야 한다."""
    scores = [scoring.score_flow(r, 0.0) for r in (0.01, 0.05, 0.2, 0.5, 1.0)]
    assert scores == sorted(scores)
    assert all(s2 > s1 for s1, s2 in zip(scores, scores[1:]))  # 동점(포화) 없음
    assert scores[-1] < 100.0


def test_score_flow_size_neutral():
    """대형주와 소형주가 같은 비율이면 같은 점수 — 절대 금액에 의존하지 않는다."""
    samsung = scoring.score_flow(2700 / 15_000, 3770 / 15_000)  # 억원 / 거래대금 억원
    small_cap = scoring.score_flow(9 / 50, 12.6 / 50)  # 같은 비율, 300배 작은 종목
    assert abs(samsung - small_cap) < 0.5


def test_score_flow_real_kis_scale_is_not_pinned_at_100():
    """삼성전자 실수급(외국인 +2,700억·프로그램 +3,770억, 거래대금 1.5조)."""
    score = scoring.score_flow(2700 / 15_000, 3770 / 15_000)
    assert 60 < score < 95  # 강한 매수지만 상한에 붙지 않음


def test_score_flow_program_weight_is_half():
    only_smart = scoring.score_flow(0.05, 0.0)
    only_prog = scoring.score_flow(0.0, 0.05)
    assert abs(only_smart - 2 * only_prog) < 1e-9  # 프로그램 가중 0.5


def test_flow_score_distribution_over_mock_universe():
    """Mock 40종목: 수급 점수가 포화 없이 -100~+100 사이에 퍼지는지."""
    from backend.core.indicators import compute_indicators
    from backend.core.providers import MockProvider

    mp = MockProvider()
    tickers = [f"{i:06d}" for i in range(100, 140)]
    flow_scores = []
    for t in tickers:
        ind = compute_indicators(mp.get_minute_ohlcv(t), mp.get_investor_flow(t))
        detail = scoring._category_scores(ind)["flow"][1]
        flow_scores.append(detail["smart_money"])

    assert all(-100 < s < 100 for s in flow_scores)  # 포화 없음
    assert max(flow_scores) > 20 and min(flow_scores) < -20  # 양쪽으로 의미 있게 퍼짐
    spread = max(flow_scores) - min(flow_scores)
    assert spread > 60, f"수급 점수가 뭉쳐 있다 (spread={spread:.1f})"


def test_final_scores_spread_over_mock_universe():
    """최종 스코어도 한쪽에 몰리지 않아야 한다(라벨이 2종 이상 나옴)."""
    from backend.core.indicators import compute_indicators
    from backend.core.providers import MockProvider

    mp = MockProvider()
    labels = set()
    for i in range(100, 140):
        t = f"{i:06d}"
        ind = compute_indicators(mp.get_minute_ohlcv(t), mp.get_investor_flow(t))
        labels.add(scoring.score_stock(ind).label)
    assert len(labels) >= 2
