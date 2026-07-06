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
        volatility={"pct_b": 1.0},
        flow={"smart_money": 100.0, "program": 50.0},
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
        volatility={"pct_b": 0.0},
        flow={"smart_money": -100.0, "program": -50.0},
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
        flow={"smart_money": 100.0, "program": 0.0},  # 수급만 강한 매수
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
        flow={"smart_money": 0.0, "program": 0.0},
        last_close=10000.0,
        last_atr=100.0,
    )
    result = scoring.score_stock(ind)
    assert result.final_score == 0.0
    assert result.label == "중립"
