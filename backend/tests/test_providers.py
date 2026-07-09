"""MockProvider — 결정성·형태·as_of + end-to-end 스코어링."""

import pandas as pd

from backend.core import scoring
from backend.core.indicators import compute_indicators
from backend.core.providers import MockProvider


def test_ohlcv_columns_and_shape():
    mp = MockProvider(bars=120)
    df = mp.get_minute_ohlcv("005930")
    assert list(df.columns) == ["open", "high", "low", "close", "volume"]
    assert len(df) == 120
    assert isinstance(df.index, pd.DatetimeIndex)
    # high >= low, high >= close >= 0
    assert (df["high"] >= df["low"]).all()
    assert (df["close"] > 0).all()


def test_deterministic_same_ticker():
    a = MockProvider().get_minute_ohlcv("035420")
    b = MockProvider().get_minute_ohlcv("035420")
    assert a.equals(b)


def test_different_tickers_differ():
    a = MockProvider().get_minute_ohlcv("005930")
    b = MockProvider().get_minute_ohlcv("000660")
    assert not a["close"].equals(b["close"])


def test_investor_flow_has_as_of():
    flow = MockProvider().get_investor_flow("005930")
    assert "as_of" in flow
    assert {"foreign", "institution", "program"} <= set(flow)


def test_economic_indicator_surprise():
    ind = MockProvider().get_economic_indicator("미국 CPI")
    assert ind["surprise"] == round(ind["actual"] - ind["forecast"], 2)
    assert "as_of" in ind


def test_end_to_end_scoring():
    """MockProvider → 지표 계산 → 스코어. 정상 라벨·기여도 5개."""
    mp = MockProvider()
    df = mp.get_minute_ohlcv("005930")
    flow = mp.get_investor_flow("005930")
    indicators = compute_indicators(df, flow)
    result = scoring.score_stock(indicators)

    assert -100 <= result.final_score <= 100
    assert result.label in {"적극매수", "매수", "중립", "매도", "적극매도"}
    assert len(result.contributions) == 5
    # 리스크 계획도 연결되는지
    plan = scoring.risk_plan(indicators.last_close, indicators.last_atr, "long")
    assert plan["stop"] < indicators.last_close


def test_orderbook_ten_levels():
    ob = MockProvider().get_orderbook("005930")
    assert len(ob["asks"]) == 10
    assert len(ob["bids"]) == 10
    # 매도호가 > 매수호가
    assert ob["asks"][0]["price"] > ob["bids"][0]["price"]


def test_investor_flow_series_deterministic():
    a = MockProvider().get_investor_flow_series("005930", days=20)
    b = MockProvider().get_investor_flow_series("005930", days=20)
    assert a == b
    assert len(a["foreign"]) == 20 and len(a["dates"]) == 20


def test_broker_activity():
    data = MockProvider().get_broker_activity("005930")
    assert len(data["sellers"]) == len(data["buyers"]) == 5

    for side in ("sellers", "buyers"):
        rows = data[side]
        assert [r["rank"] for r in rows] == [1, 2, 3, 4, 5]
        # 상위 5 는 수량 내림차순. 비중은 KIS 규약대로 수량 / 거래량 × 100.
        assert [r["qty"] for r in rows] == sorted((r["qty"] for r in rows), reverse=True)
        for r in rows:
            assert abs(r["pct"] - r["qty"] / data["volume"] * 100) < 0.01
        assert sum(r["qty"] for r in rows) <= data["volume"]

    f = data["foreign"]
    assert f["net_qty"] == f["buy_qty"] - f["sell_qty"]
    # 외국계 집계는 상위 5 밖 창구까지 포함 → 상위 5 안의 외국계 합보다 크다 (실데이터와 같은 성질).
    assert f["sell_qty"] >= sum(r["qty"] for r in data["sellers"] if r["foreign"])
