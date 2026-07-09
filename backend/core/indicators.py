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


def obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    """On-Balance Volume. 상승봉 +거래량, 하락봉 −거래량 누적."""
    direction = np.sign(close.diff().fillna(0.0))
    return (direction * volume).cumsum()


def obv_divergence(
    close: pd.Series, volume: pd.Series, lookback: int = config.OBV_LOOKBACK
) -> float:
    """창(lookback) 내 OBV 상대강도 − 가격 상대강도. 상승 다이버전스=+, 하락=−, 동행≈0.

    각 변화량을 창 내 범위로 정규화(−1~+1)해 스케일 차이를 제거한다.
    """
    if len(close) < lookback + 1:
        return 0.0
    ob = obv(close, volume)
    c = close.iloc[-(lookback + 1):]
    o = ob.iloc[-(lookback + 1):]
    c_rng = c.max() - c.min()
    o_rng = o.max() - o.min()
    if c_rng == 0 or o_rng == 0:
        return 0.0
    price_norm = (c.iloc[-1] - c.iloc[0]) / c_rng
    obv_norm = (o.iloc[-1] - o.iloc[0]) / o_rng
    return float(obv_norm - price_norm)


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


def atr_band(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = config.BB_PERIOD,
    mult: float = config.ATR_BAND_MULT,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """ATR 밴드 → (upper, mid, lower). 중심=SMA(close,period), 폭=mult×ATR(14)."""
    mid = close.rolling(window=period, min_periods=period).mean()
    a = atr(high, low, close)
    upper = mid + mult * a
    lower = mid - mult * a
    return upper, mid, lower


def atr_band_position(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = config.BB_PERIOD,
    mult: float = config.ATR_BAND_MULT,
) -> float:
    """현재가의 ATR밴드 내 위치. 0=하단, 0.5=중심, 1=상단."""
    upper, _mid, lower = atr_band(high, low, close, period, mult)
    u, l, c = upper.iloc[-1], lower.iloc[-1], close.iloc[-1]
    width = u - l
    if pd.isna(width) or width == 0:
        return 0.5
    return float((c - l) / width)


# ── 차트 오버레이 전용 (스코어 무관) ───────────────────────────
def ichimoku(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    conv: int = 9,
    base: int = 26,
    span_b: int = 52,
    disp: int = 26,
) -> tuple[pd.Series, pd.Series, pd.Series, pd.Series, pd.Series]:
    """일목균형표 → (전환선, 기준선, 선행스팬A, 선행스팬B, 후행스팬).

    선행스팬은 +disp 미래 전위, 후행스팬은 −disp 과거 전위. 배열 길이는 입력과
    같게 유지 — 마지막 캔들 너머 미래 구름은 드롭(분봉 스캘핑엔 최근 구름이 핵심).
    """
    def mid(period: int) -> pd.Series:
        hh = high.rolling(window=period, min_periods=period).max()
        ll = low.rolling(window=period, min_periods=period).min()
        return (hh + ll) / 2

    tenkan = mid(conv)
    kijun = mid(base)
    senkou_a = ((tenkan + kijun) / 2).shift(disp)
    senkou_b = mid(span_b).shift(disp)
    chikou = close.shift(-disp)
    return tenkan, kijun, senkou_a, senkou_b, chikou


def fibonacci_levels(
    high: pd.Series,
    low: pd.Series,
    ratios: tuple[float, ...] = (0.0, 0.236, 0.382, 0.5, 0.618, 1.0),
) -> dict:
    """최근 스윙 고/저 기준 피보나치 되돌림.

    고점·저점의 발생 순서로 스윙 방향 판정. 상승(저점→고점)이면 0%=고점에서
    저점으로 내려가는 되돌림, 하락이면 0%=저점에서 고점으로 올라가는 되돌림.
    """
    hi = float(high.max())
    lo = float(low.min())
    hi_idx = int(np.asarray(high).argmax())
    lo_idx = int(np.asarray(low).argmin())
    direction = "up" if lo_idx <= hi_idx else "down"
    diff = hi - lo
    levels = []
    for r in ratios:
        price = hi - diff * r if direction == "up" else lo + diff * r
        levels.append({"ratio": r, "price": round(price, 2)})
    return {
        "swing_high": round(hi, 2),
        "swing_low": round(lo, 2),
        "direction": direction,
        "levels": levels,
    }


# ── 수급 ───────────────────────────────────────────────────────
def turnover(ohlcv: pd.DataFrame) -> float:
    """조회 구간 누적 거래대금(억원). 종가×거래량의 합.

    수급 순매수의 분모다. 시가총액을 쓰려면 상장주식수가 필요한데 provider
    인터페이스에 없어, 같은 구간에서 얻을 수 있는 거래대금을 규모 척도로 쓴다.
    """
    total = float((ohlcv["close"] * ohlcv["volume"]).sum())
    return total / 1e8  # 원 → 억원


def flow_metrics(investor_flow: dict, turnover_eok: float = 0.0) -> dict[str, float]:
    """투자자별 순매수 dict를 수급 지표로 정리.

    investor_flow: {"foreign": 억원, "institution": 억원, "program": 억원, "retail": 억원}
    (양수=순매수). 스마트머니(외국인+기관)와 프로그램을 별도로 유지해 scoring이 활용.

    turnover_eok(억원)가 주어지면 거래대금 대비 비율도 함께 낸다 — scoring은 절대
    금액이 아니라 이 비율을 쓴다(종목 크기 중립화). 거래대금이 0이면 비율 0(중립).
    """
    foreign = float(investor_flow.get("foreign", 0.0))
    institution = float(investor_flow.get("institution", 0.0))
    program = float(investor_flow.get("program", 0.0))
    smart_money = foreign + institution
    denom = turnover_eok if turnover_eok > 0 else 0.0
    return {
        "foreign": foreign,
        "institution": institution,
        "program": program,
        "smart_money": smart_money,  # 외국인+기관 순매수 합
        "turnover": denom,
        "smart_money_ratio": (smart_money / denom) if denom else 0.0,
        "program_ratio": (program / denom) if denom else 0.0,
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
    obv_div = obv_divergence(close, volume)
    atr_pos = atr_band_position(high, low, close)

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
        volatility={"pct_b": last(pct_b), "atr_band": atr_pos},
        flow={**flow_metrics(investor_flow or {}, turnover(ohlcv)), "obv": obv_div},
        last_close=last(close),
        last_atr=last(atr_series),
    )
