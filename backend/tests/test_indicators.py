"""indicators.py — 알려진 입력으로 수치 검증."""

import numpy as np
import pandas as pd
import pytest

from backend.core import indicators as ind


def test_sma_last_value():
    s = pd.Series([1, 2, 3, 4, 5], dtype=float)
    assert ind.sma(s, 3).iloc[-1] == 4.0  # (3+4+5)/3


def test_rsi_all_rising_is_100():
    close = pd.Series(np.arange(1, 30, dtype=float))  # 단조 상승
    assert ind.rsi(close).iloc[-1] == 100.0


def test_rsi_all_falling_near_zero():
    close = pd.Series(np.arange(30, 1, -1, dtype=float))  # 단조 하락
    assert ind.rsi(close).iloc[-1] < 1.0


def test_atr_constant_range():
    # 매 봉 high-low=10, 갭 없음 → ATR 수렴값 10
    n = 50
    close = pd.Series(np.full(n, 100.0))
    high = close + 5
    low = close - 5
    atr = ind.atr(high, low, close)
    assert abs(atr.iloc[-1] - 10.0) < 0.5


def test_bollinger_pctb_bounds():
    rng = np.random.default_rng(0)
    close = pd.Series(100 + np.cumsum(rng.normal(0, 1, 100)))
    _, mid, _, pct_b = ind.bollinger(close)
    # 중앙선에서 %b ≈ 0.5
    at_mid = pct_b[(close - mid).abs() < 1e-9]
    for v in at_mid.dropna():
        assert abs(v - 0.5) < 0.05


def test_macd_hist_sign_on_uptrend():
    close = pd.Series(np.linspace(100, 200, 100))  # 강한 상승
    _, _, hist = ind.macd(close)
    assert hist.iloc[-1] > 0


def test_vwap_between_low_and_high():
    df = pd.DataFrame(
        {
            "open": [100, 101, 102],
            "high": [105, 106, 107],
            "low": [95, 96, 97],
            "close": [101, 102, 103],
            "volume": [1000, 1000, 1000],
        }
    )
    vw = ind.vwap(df).iloc[-1]
    assert df["low"].min() <= vw <= df["high"].max()


def test_ma_alignment_perfect_uptrend():
    close = pd.Series(np.linspace(100, 300, 100))  # 정배열
    assert ind.ma_alignment(close) == 1.0


def test_compute_indicators_shape():
    rng = np.random.default_rng(1)
    n = 120
    close = pd.Series(100 + np.cumsum(rng.normal(0, 1, n)))
    df = pd.DataFrame(
        {
            "open": close,
            "high": close + 2,
            "low": close - 2,
            "close": close,
            "volume": rng.integers(1000, 5000, n).astype(float),
        }
    )
    result = ind.compute_indicators(df, {"foreign": 10, "institution": 5, "program": -3})
    assert set(result.momentum) == {"rsi", "macd_hist", "stoch_k", "stoch_d"}
    assert result.last_close > 0
    assert result.last_atr > 0
    assert result.flow["smart_money"] == 15  # 10 + 5
    # 수급 비율 = 순매수 / 당일 거래대금(억원)
    assert result.flow["turnover"] == pytest.approx(ind.turnover(df))
    assert result.flow["smart_money_ratio"] == pytest.approx(15 / result.flow["turnover"])
    assert result.flow["program_ratio"] == pytest.approx(-3 / result.flow["turnover"])
    # 신규: OBV 다이버전스는 flow, ATR밴드 위치는 volatility에 원시값으로
    assert "obv" in result.flow
    assert "atr_band" in result.volatility
    assert 0.0 <= result.volatility["atr_band"] <= 1.0


def test_obv_monotonic_up_on_rising_close():
    close = pd.Series([10, 11, 12, 13, 14], dtype=float)
    volume = pd.Series([100, 100, 100, 100, 100], dtype=float)
    o = ind.obv(close, volume)
    # 첫 봉(diff NaN→0)=0, 이후 매봉 +100 누적
    assert o.iloc[-1] == 400.0


def test_obv_divergence_bullish_when_price_down_obv_up():
    # 가격은 하락 마감(92<100)이나 상승봉 거래량이 압도 → OBV 상승 = 상승 다이버전스(+)
    close = pd.Series([100, 90, 95, 85, 92], dtype=float)
    volume = pd.Series([100, 100, 1000, 100, 1000], dtype=float)
    div = ind.obv_divergence(close, volume, lookback=4)
    assert div > 0


def test_obv_divergence_zero_when_flat():
    close = pd.Series([100, 100, 100, 100, 100], dtype=float)
    volume = pd.Series([100, 100, 100, 100, 100], dtype=float)
    assert ind.obv_divergence(close, volume, lookback=4) == 0.0


def test_atr_band_position_mid_is_half():
    # 갭 없이 등락 폭 일정 → 종가가 SMA(중심) 근처면 위치 ≈ 0.5
    n = 40
    close = pd.Series(np.full(n, 100.0))
    high = close + 5
    low = close - 5
    pos = ind.atr_band_position(high, low, close, period=20, mult=2.0)
    assert abs(pos - 0.5) < 0.05


def test_atr_band_upper_above_lower():
    n = 40
    rng = np.random.default_rng(3)
    close = pd.Series(100 + np.cumsum(rng.normal(0, 1, n)))
    high = close + 2
    low = close - 2
    upper, mid, lower = ind.atr_band(high, low, close, period=20, mult=2.0)
    assert upper.iloc[-1] > mid.iloc[-1] > lower.iloc[-1]


def test_ichimoku_tenkan_above_kijun_on_uptrend():
    close = pd.Series(np.linspace(100, 300, 120))
    high = close + 1
    low = close - 1
    tenkan, kijun, senkou_a, senkou_b, chikou = ind.ichimoku(high, low, close)
    # 상승장: 단기(전환선) > 중기(기준선)
    assert tenkan.iloc[-1] > kijun.iloc[-1]
    # 선행스팬은 +26 전위 → 앞쪽 26개는 NaN
    assert senkou_a.iloc[:26].isna().all()
    # 후행스팬은 −26 전위 → 마지막 26개 NaN
    assert chikou.iloc[-26:].isna().all()
    assert len(tenkan) == len(close)


def test_fibonacci_uptrend_levels():
    # 저점(인덱스0) 이후 고점(인덱스 끝) → 상승 스윙
    low = pd.Series([100, 105, 110, 120, 130], dtype=float)
    high = pd.Series([102, 107, 112, 122, 132], dtype=float)
    fib = ind.fibonacci_levels(high, low)
    assert fib["direction"] == "up"
    assert fib["swing_high"] == 132.0
    assert fib["swing_low"] == 100.0
    by_ratio = {lv["ratio"]: lv["price"] for lv in fib["levels"]}
    assert by_ratio[0.0] == 132.0    # 0% = 고점
    assert by_ratio[1.0] == 100.0    # 100% = 저점
    assert by_ratio[0.5] == 116.0    # 중간


def test_fibonacci_downtrend_direction():
    # 고점(인덱스0) 이후 저점(인덱스 끝) → 하락 스윙
    high = pd.Series([132, 128, 120, 110, 102], dtype=float)
    low = pd.Series([130, 126, 118, 108, 100], dtype=float)
    fib = ind.fibonacci_levels(high, low)
    assert fib["direction"] == "down"
    by_ratio = {lv["ratio"]: lv["price"] for lv in fib["levels"]}
    assert by_ratio[0.0] == 100.0    # 하락: 0% = 저점
    assert by_ratio[1.0] == 132.0    # 100% = 고점


def test_flow_metrics_zero_turnover_is_neutral():
    """거래대금 0(휴장·빈 봉)이면 비율은 0 — ZeroDivision 대신 중립."""
    m = ind.flow_metrics({"foreign": 100, "institution": 50, "program": 20}, 0.0)
    assert m["smart_money_ratio"] == 0.0
    assert m["program_ratio"] == 0.0
    assert m["smart_money"] == 150  # 원시 금액은 그대로 보존
