"""기술적 분석 (탭2). 캔들 + 오버레이 + 지표 테이블."""

from __future__ import annotations

import pandas as pd

from fastapi import APIRouter, Query

from ...core import config, indicators as ind_mod, scoring
from ..deps import get_provider, run_parallel

router = APIRouter(prefix="/api", tags=["technical"])


def _signal_label(score: float) -> str:
    """지표 점수(-100~100) → 매수/중립/매도 (테이블 표시용)."""
    if score >= 20:
        return "매수"
    if score <= -20:
        return "매도"
    return "중립"


def _clean(series: pd.Series) -> list:
    """NaN → None (JSON 직렬화)."""
    return [None if pd.isna(v) else round(float(v), 2) for v in series]


@router.get("/technical/{ticker}")
def get_technical(
    ticker: str,
    # 검증 없이 넘기면 KIS 경로에서 ValueError → 500. 여기서 걸러 422로 돌려준다.
    interval: str = Query("1m", pattern=config.INTERVAL_PATTERN),
    bars: int = Query(120, ge=20, le=480),
):
    provider = get_provider()
    # 분봉·수급은 서로 독립적인 KIS 호출 — 동시에 받는다.
    fetched = run_parallel({
        "ohlcv": lambda: provider.get_minute_ohlcv(ticker, interval),
        "flow": lambda: provider.get_investor_flow(ticker),
    })
    ohlcv = fetched["ohlcv"].tail(bars)
    flow = fetched["flow"]
    ind = ind_mod.compute_indicators(ohlcv, flow)

    close = ohlcv["close"]
    candles = [
        {
            "t": t.isoformat(),
            "o": round(float(o), 1),
            "h": round(float(h), 1),
            "l": round(float(low), 1),
            "c": round(float(c), 1),
            "v": int(v),
        }
        for t, o, h, low, c, v in zip(
            ohlcv.index, ohlcv["open"], ohlcv["high"], ohlcv["low"], close, ohlcv["volume"]
        )
    ]

    bb_upper, bb_mid, bb_lower, _pctb = ind_mod.bollinger(close)
    overlays = {
        "ma5": _clean(ind_mod.sma(close, 5)),
        "ma20": _clean(ind_mod.sma(close, 20)),
        "ma60": _clean(ind_mod.sma(close, 60)),
        "vwap": _clean(ind_mod.vwap(ohlcv)),
        "bb_upper": _clean(bb_upper),
        "bb_mid": _clean(bb_mid),
        "bb_lower": _clean(bb_lower),
    }

    # 차트 오버레이 전용 (스코어 무관)
    high, low = ohlcv["high"], ohlcv["low"]
    tenkan, kijun, senkou_a, senkou_b, chikou = ind_mod.ichimoku(high, low, close)
    overlays["ichimoku"] = {
        "tenkan": _clean(tenkan),
        "kijun": _clean(kijun),
        "senkou_a": _clean(senkou_a),
        "senkou_b": _clean(senkou_b),
        "chikou": _clean(chikou),
    }
    overlays["fibonacci"] = ind_mod.fibonacci_levels(high, low)

    # 지표 테이블 — 현재값 + 신호 (scoring 정규화 재사용).
    # 봉이 모자란 지표는 value=None, signal="봉 부족" 이다. 0.0 을 찍어 놓고 "중립"이라
    # 하면, 그 "중립"은 관측이 아니라 우리가 지어낸 말이 된다.
    def _row(name: str, key: str, value: float | None, digits: int, score_fn=None) -> dict:
        required = config.INDICATOR_MIN_BARS[key]
        if value is None:
            return {"name": name, "value": None, "signal": "봉 부족",
                    "required_bars": required, "bars": ind.bars}
        signal = _signal_label(score_fn(value)) if score_fn else "-"
        return {"name": name, "value": round(value, digits), "signal": signal,
                "required_bars": required, "bars": ind.bars}

    table = [
        _row("RSI(14)", "rsi", ind.momentum["rsi"], 1, scoring.score_rsi),
        _row("MACD Hist", "macd_hist", ind.momentum["macd_hist"], 2,
             lambda v: scoring.score_macd_hist(v, ind.last_close)),
        _row("스토캐스틱 %K", "stoch_k", ind.momentum["stoch_k"], 1, scoring.score_stoch),
        _row("볼린저 %b", "pct_b", ind.volatility["pct_b"], 2, scoring.score_pct_b),
        _row("이평 배열", "ma_alignment", ind.trend["ma_alignment"], 2, scoring.score_ma_alignment),
        _row("VWAP 괴리(%)", "price_vs_vwap", ind.trend["price_vs_vwap"], 2,
             scoring.score_price_vs_vwap),
        _row("OBV 다이버전스", "obv", ind.flow["obv"], 2, scoring.score_obv),
        _row("ATR밴드 위치", "atr_band", ind.volatility["atr_band"], 2, scoring.score_atr_band),
        _row("ATR(14)", "atr", ind.last_atr, 1),
    ]

    # 분봉 출처 배지 — provider 가 df.attrs 에 달아둔 플래그를 그대로 올린다.
    # (다른 라우트의 dict 응답이 싣는 source/mock/stale 과 같은 규약)
    attrs = ohlcv.attrs
    return {
        "ticker": ticker,
        "interval": interval,
        "candles": candles,
        "overlays": overlays,
        "indicators_table": table,
        "bars": ind.bars,
        "params": {"ma": config.MA_PERIODS, "rsi": config.RSI_PERIOD},
        "source": attrs.get("source", "mock"),
        "mock": bool(attrs.get("mock", True)),
        "stale": bool(attrs.get("stale", False)),
    }
