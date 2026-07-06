"""indicators.py — 알려진 입력으로 수치 검증."""

import numpy as np
import pandas as pd

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
