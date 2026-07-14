"""장 초반 워밍업 — 봉이 지표 기간만큼 안 쌓인 구간.

09:00 개장. 1분봉은 1분에 하나씩 쌓인다. 09:09 면 봉이 10개뿐이라 ATR(14)·RSI(14)는
계산 자체가 불가능하다. 예전엔 NaN 을 0.0 으로 뭉갰고, 그 결과:

- RSI 0.0 → scoring 이 -100점(극단적 과매도)으로 읽어 멀쩡한 종목이 "매도"로 찍혔다.
- ATR 0.0 → risk_plan 이 ValueError 를 던져 /api/signal 이 통째로 500 났다.
  데이트레이딩에 가장 중요한 시간대에 탭1이 죽었다.

원칙: 데이터가 없으면 (a) 가짜 값으로 채우지 않고, (b) 앱을 죽이지도 않고,
(c) 왜 못 보여주는지 말한다.
"""

from __future__ import annotations

import json

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from backend.api import deps
from backend.api.main import app
from backend.core import collector, config, scoring
from backend.core.indicators import compute_indicators
from backend.core.providers import MockProvider
from backend.core.snapshot_store import SnapshotStore, close_store, get_store

client = TestClient(app)
TICKER = "005930"

ATR_BARS = config.INDICATOR_MIN_BARS["atr"]  # 14


def session_ohlcv(bars: int) -> pd.DataFrame:
    """09:00 개장 후 `bars` 분이 지난 시점의 분봉. MockProvider 세션의 앞머리를 자른다.

    시간을 앞으로 감는 게 아니라 봉을 잘라낸다 — 지표 입장에서 둘은 같다.
    """
    full = MockProvider().get_minute_ohlcv(TICKER)
    return full.head(bars).copy()


class WarmupProvider:
    """분봉만 `bars` 개로 자르고 나머지는 MockProvider 그대로."""

    def __init__(self, bars: int) -> None:
        self._bars = bars
        self._mock = MockProvider()

    def get_minute_ohlcv(self, ticker: str, interval: str = "1m") -> pd.DataFrame:
        full = self._mock.get_minute_ohlcv(ticker, interval)
        out = full.head(self._bars).copy()
        out.attrs = dict(full.attrs)
        return out

    def __getattr__(self, name):
        return getattr(self._mock, name)


@pytest.fixture(autouse=True)
def fresh_store():
    close_store()
    yield
    close_store()


@pytest.fixture()
def store():
    s = SnapshotStore(":memory:")
    yield s
    s.close()


# ── 지표: 없으면 None, 0.0 이 아니다 ────────────────────────
def test_warmup_indicators_are_none_not_zero():
    """봉 10개 — 기간 14~60짜리 지표는 전부 None. 0.0 이 하나라도 있으면 거짓말이다."""
    ind = compute_indicators(session_ohlcv(10), {"foreign": 10, "institution": 5, "program": 0})

    assert ind.bars == 10
    assert ind.last_atr is None            # ATR(14) — 매매계획이 여기 걸린다
    assert ind.momentum["rsi"] is None     # RSI(14) — 0.0 이면 -100점(극단 과매도)이 된다
    assert ind.momentum["stoch_k"] is None       # 스토캐스틱(14+3)
    assert ind.momentum["macd_hist"] is None     # MACD(26+9)
    assert ind.volatility["pct_b"] is None       # 볼린저(20)
    assert ind.volatility["atr_band"] is None    # ATR밴드(20)
    assert ind.volume["surge"] is None           # 거래량 급증(20+1)
    assert ind.flow["obv"] is None               # OBV 다이버전스(20+1)
    assert ind.trend["ma_alignment"] is None     # 이평 배열(60)


def test_vwap_survives_the_first_bar():
    """VWAP 은 누적이라 첫 봉부터 나온다 — 워밍업 중 유일하게 살아 있는 추세 지표."""
    ind = compute_indicators(session_ohlcv(1), {})

    assert ind.trend["price_vs_vwap"] is not None
    assert ind.last_close > 0


READ_INDICATOR = {
    "atr": lambda i: i.last_atr,
    "rsi": lambda i: i.momentum["rsi"],
    "stoch_k": lambda i: i.momentum["stoch_k"],
    "macd_hist": lambda i: i.momentum["macd_hist"],
    "pct_b": lambda i: i.volatility["pct_b"],
    "atr_band": lambda i: i.volatility["atr_band"],
    "surge": lambda i: i.volume["surge"],
    "obv": lambda i: i.flow["obv"],
    "ma_alignment": lambda i: i.trend["ma_alignment"],
    "price_vs_vwap": lambda i: i.trend["price_vs_vwap"],
}


@pytest.mark.parametrize("key", sorted(READ_INDICATOR))
def test_indicator_becomes_available_exactly_at_its_declared_min_bars(key):
    """config.INDICATOR_MIN_BARS 가 실제 계산식과 정확히 일치해야 한다.

    이 숫자는 "봉 10/14" 로 사용자 화면에 그대로 나간다. 계산식과 어긋나면 우리가
    사용자에게 거짓 약속을 하는 셈이다(14개째에 나온다더니 15개째에 나오는 식).
    실제로 이 테스트가 RSI 의 오프바이원(diff 가 첫 봉을 먹는다)을 잡아냈다.
    """
    read = READ_INDICATOR[key]
    need = config.INDICATOR_MIN_BARS[key]

    at = compute_indicators(session_ohlcv(need), {})
    assert read(at) is not None, f"{key}: 봉 {need}개면 나와야 한다"

    if need > 1:
        before = compute_indicators(session_ohlcv(need - 1), {})
        assert read(before) is None, f"{key}: 봉 {need - 1}개에선 값이 나오면 안 된다"


def test_missing_lists_what_could_not_be_computed():
    ind = compute_indicators(session_ohlcv(10), {})

    assert set(ind.missing()) >= {"rsi", "atr", "macd_hist", "stoch_k", "pct_b", "ma_alignment"}


# ── 스코어링: 없는 지표를 빼고 재정규화 ─────────────────────
def test_warmup_score_excludes_unavailable_categories_rather_than_zeroing_them():
    ind = compute_indicators(session_ohlcv(10), {"foreign": 10, "institution": 5, "program": 0})
    result = scoring.score_stock(ind)

    # 모멘텀(RSI·MACD·스토캐스틱)은 전부 봉 부족 → 카테고리 통째로 빠진다.
    assert "momentum" in result.unavailable
    assert "volatility" in result.unavailable
    assert all(c.category != "momentum" for c in result.contributions)
    # 수급·추세는 살아 있다 → 스코어는 나온다.
    assert result.final_score is not None
    assert 0 < result.coverage < 1  # 일부만 반영 = 신뢰도 낮음


def test_warmup_does_not_fabricate_an_extreme_sell_signal():
    """이게 원래 버그다 — RSI 결측을 0.0 으로 뭉개면 score_rsi((0-50)*4) = -100 이 된다.

    봉이 모자란 것과 "극단적 과매도"는 완전히 다른 말이다.
    """
    ind = compute_indicators(session_ohlcv(10), {})
    detail = scoring._category_scores(ind)

    momentum_score, momentum_detail = detail["momentum"]
    assert momentum_score is None
    assert momentum_detail["rsi"] is None  # -100 이면 회귀다


def test_coverage_reaches_one_when_every_indicator_is_warm():
    ind = compute_indicators(session_ohlcv(120), {"foreign": 10, "institution": 5, "program": 0})
    result = scoring.score_stock(ind)

    assert result.coverage == 1.0
    assert result.unavailable == []


def test_coverage_is_counted_per_indicator_not_per_category():
    """카테고리 단위로 세면 신뢰도가 과장된다.

    봉 21개면 추세 카테고리는 "살아 있다"(VWAP 이 있으니). 하지만 이평 배열(60봉)은
    아직 없다. 카테고리만 세면 coverage 1.0 — "전 지표 반영"이라는 거짓말이 된다.
    """
    ind = compute_indicators(session_ohlcv(21), {"foreign": 10, "institution": 5, "program": 0})
    result = scoring.score_stock(ind)

    assert result.unavailable == []            # 카테고리는 전부 살아 있지만
    assert ind.trend["ma_alignment"] is None   # 이평 배열은 아직 없다
    assert result.coverage < 1.0               # → 신뢰도는 1.0 이면 안 된다


def test_coverage_climbs_monotonically_as_bars_accumulate():
    """봉이 쌓이는 동안 신뢰도는 뒷걸음질치지 않는다."""
    seen = [
        scoring.score_stock(compute_indicators(session_ohlcv(n), {})).coverage
        for n in (1, 14, 20, 21, 34, 60)
    ]

    assert seen == sorted(seen)
    assert seen[0] < 1.0 and seen[-1] == 1.0  # 봉 60개(이평 배열)에서 비로소 완전체


def test_score_is_none_when_nothing_is_computable():
    """가용 지표가 0개면 스코어도 None — 0.0/"중립"이 아니다."""
    from backend.core.indicators import IndicatorSet

    empty = IndicatorSet(trend={"price_vs_vwap": None}, momentum={"rsi": None},
                         volume={"surge": None}, volatility={"pct_b": None},
                         flow={"smart_money_ratio": None, "program_ratio": None, "obv": None},
                         last_close=1000.0, last_atr=None, bars=1)
    result = scoring.score_stock(empty)

    assert result.final_score is None
    assert result.label is None
    assert result.coverage == 0.0
    assert result.contributions == []


# ── 수집기·저장소 ───────────────────────────────────────────
def test_collector_stores_null_atr_rather_than_zero(store, monkeypatch):
    monkeypatch.setattr(deps, "PROVIDER", WarmupProvider(bars=10))

    row = collector.collect_ticker(TICKER, "삼성전자", store=store)

    assert row["last_atr"] is None  # 0.0 이면 risk_plan 이 "손절가 = 진입가" 를 만든다
    assert row["bars"] == 10
    assert 0 < row["coverage"] < 1
    assert store.get(TICKER)["last_atr"] is None  # NULL 로 왕복


def test_snapshot_rejects_none_in_a_column_that_must_have_a_value(store):
    """NULLABLE 아닌 컬럼의 None 은 여전히 버그다 — 조용히 NULL 을 쓰지 않는다."""
    from backend.tests.test_snapshot_store import _row

    with pytest.raises(ValueError, match="필수 컬럼"):
        store.upsert({**_row(), "price": None})


# ── 라우트: 500 대신 정직한 응답 ────────────────────────────
def test_signal_serves_200_during_warmup_instead_of_500(monkeypatch):
    """원래 버그: ValueError: atr must be positive → 500. 이제 200 이어야 한다."""
    monkeypatch.setattr(deps, "PROVIDER", WarmupProvider(bars=10))

    res = client.get(f"/api/signal/{TICKER}")

    assert res.status_code == 200


def test_signal_trade_plan_is_null_with_a_reason_during_warmup(monkeypatch):
    monkeypatch.setattr(deps, "PROVIDER", WarmupProvider(bars=10))

    body = client.get(f"/api/signal/{TICKER}").json()

    assert body["trade_plan"] is None  # 가짜 손절가(0원)를 만들지 않는다
    unavailable = body["trade_plan_unavailable"]
    assert unavailable["reason"] == "insufficient_bars"
    assert (unavailable["bars"], unavailable["required"]) == (10, ATR_BARS)
    assert "10/14" in unavailable["message"]  # 사용자가 읽을 수 있는 사유


def test_signal_still_serves_price_and_score_during_warmup(monkeypatch):
    """매매계획만 비고, 나머지(헤더·현재가·가능한 지표)는 정상이어야 한다."""
    monkeypatch.setattr(deps, "PROVIDER", WarmupProvider(bars=10))

    body = client.get(f"/api/signal/{TICKER}").json()

    assert body["header"]["price"] > 0
    assert body["signal"]["final_score"] is not None
    assert body["signal"]["bars"] == 10
    assert 0 < body["signal"]["coverage"] < 1


def test_signal_trade_plan_appears_the_moment_atr_is_computable(monkeypatch):
    """봉 13개 → 계획 없음. 14개 → 계획 있음. 경계가 정확해야 한다."""
    monkeypatch.setattr(deps, "PROVIDER", WarmupProvider(bars=ATR_BARS - 1))
    close_store()
    assert client.get(f"/api/signal/{TICKER}").json()["trade_plan"] is None

    monkeypatch.setattr(deps, "PROVIDER", WarmupProvider(bars=ATR_BARS))
    close_store()
    body = client.get(f"/api/signal/{TICKER}").json()

    assert body["trade_plan_unavailable"] is None
    assert body["trade_plan"]["stop"] > 0
    assert body["trade_plan"]["position"]["qty"] >= 0


def test_technical_table_says_bars_short_instead_of_crashing(monkeypatch):
    """round(None) → TypeError 로 500 나던 자리. 값은 null, 신호는 '봉 부족'."""
    monkeypatch.setattr(deps, "PROVIDER", WarmupProvider(bars=10))

    res = client.get(f"/api/technical/{TICKER}?interval=1m&bars=120")
    assert res.status_code == 200

    rows = {r["name"]: r for r in res.json()["indicators_table"]}
    assert rows["RSI(14)"]["value"] is None
    assert rows["RSI(14)"]["signal"] == "봉 부족"
    assert rows["RSI(14)"]["required_bars"] == config.INDICATOR_MIN_BARS["rsi"]
    # VWAP 은 첫 봉부터 나온다 — 살아 있는 행은 정상 신호를 유지한다.
    assert rows["VWAP 괴리(%)"]["value"] is not None
    assert rows["VWAP 괴리(%)"]["signal"] in {"매수", "중립", "매도"}


def test_screener_survives_warmup(monkeypatch):
    monkeypatch.setattr(deps, "PROVIDER", WarmupProvider(bars=10))

    res = client.get("/api/screener")

    assert res.status_code == 200


# ── 개장 09:00~09:14 분 단위 시뮬레이션 ─────────────────────
def test_market_open_minute_by_minute_never_500s(monkeypatch):
    """09:00 부터 1분씩. 단 한 번도 500 이 나면 안 되고, ATR 이 서는 순간 계획이 생긴다."""
    seen: list[tuple[int, int, bool]] = []

    for minute in range(1, 16):  # 09:00 첫 봉 ~ 09:14 (봉 1~15개)
        monkeypatch.setattr(deps, "PROVIDER", WarmupProvider(bars=minute))
        close_store()  # 분마다 새 스냅샷을 받게 한다

        res = client.get(f"/api/signal/{TICKER}")
        assert res.status_code == 200, f"09:{minute - 1:02d} (봉 {minute}개) 에서 {res.status_code}"

        body = res.json()
        seen.append((minute, body["signal"]["bars"], body["trade_plan"] is not None))

        # 현재가는 언제나 나와야 한다 — 봉 하나여도 시세는 있다.
        assert body["header"]["price"] > 0

    planned = [bars for _m, bars, has_plan in seen if has_plan]
    assert min(planned) == ATR_BARS  # 계획은 정확히 봉 14개에서 처음 등장한다
    assert [bars for _m, bars, has_plan in seen if not has_plan] == list(range(1, ATR_BARS))


def test_warmup_snapshot_roundtrips_none_through_json(monkeypatch, store):
    """indicators_json 의 null 이 IndicatorSet 의 None 으로 돌아와야 재채점도 견딘다."""
    monkeypatch.setattr(deps, "PROVIDER", WarmupProvider(bars=10))
    collector.collect_ticker(TICKER, "삼성전자", store=store)

    stored = json.loads(store.get(TICKER)["indicators_json"])
    assert stored["momentum"]["rsi"] is None
    assert stored["last_atr"] is None

    # 재채점(사용자 가중치)도 워밍업 스냅샷에서 터지지 않아야 한다.
    close_store()
    monkeypatch.setattr(deps, "PROVIDER", WarmupProvider(bars=10))
    res = client.get(
        f"/api/signal/{TICKER}",
        params={"weights": json.dumps(
            {"flow": 80, "trend": 5, "momentum": 5, "volume": 5, "volatility": 5}
        )},
    )
    assert res.status_code == 200
    assert res.json()["signal"]["final_score"] is not None
