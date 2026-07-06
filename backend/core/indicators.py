"""종목 지표 계산 — 순수 함수 (pandas/numpy 직접 구현).

원시 지표값만 계산한다. -100~+100 정규화·가중은 scoring.py가 담당한다.
외부 TA 라이브러리에 의존하지 않아 계산식이 완전히 공개된다(제품 차별점: 로직 투명성).
입력 OHLCV는 open/high/low/close/volume 컬럼을 가진 pandas.DataFrame(시간 오름차순)을 가정한다.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from . import config


# ── 추세 ───────────────────────────────────────────────────────
def sma(close: pd.Series, period: int) -> pd.Series:
    """단순이동평균."""
    return close.rolling(window=period, min_periods=period).mean()


def ma_alignment(close: pd.Series, periods: list[int] | None = None) -> float:
    """이동평균 배열 상태를 -1.0~+1.0으로. 정배열(단기>장기)=+, 역배열=-.

    인접 이평 쌍(5>20, 20>60 ...)의 대소를 세어 정규화한다.
    +1.0 = 완전 정배열, -1.0 = 완전 역배열, 0 = 혼조.
    """
    periods = periods or config.MA_PERIODS
    mas = [sma(close, p).iloc[-1] for p in periods]
    if any(pd.isna(m) for m in mas):
        return 0.0
    pairs = len(mas) - 1
    if pairs <= 0:
        return 0.0
    ups = sum(1 for i in range(pairs) if mas[i] > mas[i + 1])
    downs = sum(1 for i in range(pairs) if mas[i] < mas[i + 1])
    return (ups - downs) / pairs


def vwap(df: pd.DataFrame) -> pd.Series:
    """거래량가중평균가격(누적). 전형적 가격=(H+L+C)/3."""
    typical = (df["high"] + df["low"] + df["close"]) / 3
    cum_vol = df["volume"].cumsum()
    cum_pv = (typical * df["volume"]).cumsum()
    return cum_pv / cum_vol.replace(0, np.nan)


def price_vs_vwap(df: pd.DataFrame) -> float:
    """현재가의 VWAP 대비 괴리율(%). +면 VWAP 위(매수 우위)."""
    vw = vwap(df).iloc[-1]
    price = df["close"].iloc[-1]
    if pd.isna(vw) or vw == 0:
        return 0.0
    return float((price - vw) / vw * 100)


# ── 모멘텀 ─────────────────────────────────────────────────────
def rsi(close: pd.Series, period: int = config.RSI_PERIOD) -> pd.Series:
    """RSI (Wilder 평활). 0~100."""
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    # Wilder = alpha 1/period 지수평활
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    out = 100 - 100 / (1 + rs)
    # loss가 0(전부 상승)이면 RSI=100
    out = out.where(avg_loss != 0, 100.0)
    return out


def macd(
    close: pd.Series,
    fast: int = config.MACD_FAST,
    slow: int = config.MACD_SLOW,
    signal: int = config.MACD_SIGNAL,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """MACD → (macd_line, signal_line, histogram)."""
    ema_fast = close.ewm(span=fast, adjust=False).mean()
    ema_slow = close.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    hist = macd_line - signal_line
    return macd_line, signal_line, hist


def stochastic(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    k: int = config.STOCH_K,
    d: int = config.STOCH_D,
    smooth: int = config.STOCH_SMOOTH,
) -> tuple[pd.Series, pd.Series]:
    """스토캐스틱 → (%K, %D). 0~100."""
    lowest = low.rolling(window=k, min_periods=k).min()
    highest = high.rolling(window=k, min_periods=k).max()
    rng = (highest - lowest).replace(0, np.nan)
    raw_k = (close - lowest) / rng * 100
    pct_k = raw_k.rolling(window=smooth, min_periods=smooth).mean()
    pct_d = pct_k.rolling(window=d, min_periods=d).mean()
    return pct_k, pct_d


# ── 거래량 ─────────────────────────────────────────────────────
def volume_surge(volume: pd.Series, lookback: int = config.VOL_LOOKBACK) -> float:
    """최근 거래량 / 직전 lookback 평균. 1.0=평균, 2.0=평균의 2배(급증)."""
    if len(volume) < lookback + 1:
        return 1.0
    baseline = volume.iloc[-(lookback + 1):-1].mean()
    if baseline == 0 or pd.isna(baseline):
        return 1.0
    return float(volume.iloc[-1] / baseline)


# ── 변동성 ─────────────────────────────────────────────────────
def bollinger(
    close: pd.Series, period: int = config.BB_PERIOD, num_std: float = config.BB_STD
) -> tuple[pd.Series, pd.Series, pd.Series, pd.Series]:
    """볼린저밴드 → (upper, mid, lower, %b). %b: 0=하단, 1=상단."""
    mid = close.rolling(window=period, min_periods=period).mean()
    std = close.rolling(window=period, min_periods=period).std(ddof=0)
    upper = mid + num_std * std
    lower = mid - num_std * std
    width = (upper - lower).replace(0, np.nan)
    pct_b = (close - lower) / width
    return upper, mid, lower, pct_b


def atr(
    high: pd.Series, low: pd.Series, close: pd.Series, period: int = config.ATR_PERIOD
) -> pd.Series:
    """ATR (Wilder). True Range의 Wilder 평활."""
    prev_close = close.shift(1)
    tr = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()], axis=1
    ).max(axis=1)
    return tr.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()


# ── 수급 ───────────────────────────────────────────────────────
def flow_metrics(investor_flow: dict) -> dict[str, float]:
    """투자자별 순매수 dict를 수급 지표로 정리.

    investor_flow: {"foreign": 억원, "institution": 억원, "program": 억원, "retail": 억원}
    (양수=순매수). 스마트머니(외국인+기관)와 프로그램을 별도로 유지해 scoring이 활용.
    """
    foreign = float(investor_flow.get("foreign", 0.0))
    institution = float(investor_flow.get("institution", 0.0))
    program = float(investor_flow.get("program", 0.0))
    return {
        "foreign": foreign,
        "institution": institution,
        "program": program,
        "smart_money": foreign + institution,  # 외국인+기관 순매수 합
    }


# ── 오케스트레이터 ─────────────────────────────────────────────
@dataclass
class IndicatorSet:
    """한 종목의 계산된 원시 지표 묶음. scoring.score_stock의 입력."""

    trend: dict = field(default_factory=dict)
    momentum: dict = field(default_factory=dict)
    volume: dict = field(default_factory=dict)
    volatility: dict = field(default_factory=dict)
    flow: dict = field(default_factory=dict)
    # 리스크 계산·표시에 필요한 파생값
    last_close: float = 0.0
    last_atr: float = 0.0


def compute_indicators(ohlcv: pd.DataFrame, investor_flow: dict | None = None) -> IndicatorSet:
    """OHLCV(+수급)로 전 카테고리 원시 지표를 계산.

    말단(latest) 스칼라 위주로 반환한다 — 스코어링은 현재 시점 판단이 목적.
    """
    close, high, low, volume = ohlcv["close"], ohlcv["high"], ohlcv["low"], ohlcv["volume"]

    _, _, hist = macd(close)
    pct_k, pct_d = stochastic(high, low, close)
    _, _, _, pct_b = bollinger(close)
    atr_series = atr(high, low, close)

    def last(series: pd.Series) -> float:
        val = series.iloc[-1]
        return 0.0 if pd.isna(val) else float(val)

    return IndicatorSet(
        trend={
            "ma_alignment": ma_alignment(close),
            "price_vs_vwap": price_vs_vwap(ohlcv),
        },
        momentum={
            "rsi": last(rsi(close)),
            "macd_hist": last(hist),
            "stoch_k": last(pct_k),
            "stoch_d": last(pct_d),
        },
        volume={"surge": volume_surge(volume)},
        volatility={"pct_b": last(pct_b)},
        flow=flow_metrics(investor_flow or {}),
        last_close=last(close),
        last_atr=last(atr_series),
    )
