"""수집기 — 유니버스를 돌며 지표·스코어를 미리 계산해 스냅샷에 넣는다.

conftest 가 STOCK_PROVIDER=mock 을 강제하므로 여기서는 네트워크가 뜨지 않는다.
MockProvider 는 티커별 시드로 결정론적이라 같은 종목은 늘 같은 스코어가 나온다.
"""

from __future__ import annotations

import json

import pytest

from backend.api import deps
from backend.core import collector, scoring
from backend.core.indicators import IndicatorSet
from backend.core.kis import KISAuthError
from backend.core.snapshot_store import COLUMNS, SnapshotStore

TICKER = "005930"


@pytest.fixture()
def store():
    s = SnapshotStore(":memory:")
    yield s
    s.close()


# ── 유니버스 ────────────────────────────────────────────────
def test_load_universe_returns_two_hundred_unique_tickers():
    universe = collector.load_universe()

    assert len(universe) == 200
    assert len({u["ticker"] for u in universe}) == 200


def test_universe_tickers_are_six_digit_krx_codes():
    for row in collector.load_universe():
        assert len(row["ticker"]) == 6 and row["ticker"].isdigit()
        assert row["name"]


# ── 단일 종목 수집 ──────────────────────────────────────────
def test_collect_ticker_writes_every_snapshot_column(store):
    collector.collect_ticker(TICKER, "삼성전자", store=store)

    row = store.get(TICKER)
    assert row is not None
    assert set(row) == set(COLUMNS)
    assert all(row[c] is not None for c in COLUMNS)


def test_collect_ticker_score_matches_scoring_on_same_inputs(store):
    _ohlcv, _flow, ind = deps.load_indicators(TICKER)
    expected = scoring.score_stock(ind)

    collector.collect_ticker(TICKER, "삼성전자", store=store)

    row = store.get(TICKER)
    assert row["final_score"] == expected.final_score
    assert row["label"] == expected.label
    assert row["last_close"] == ind.last_close
    assert row["last_atr"] == ind.last_atr


def test_collect_ticker_serializes_contributions_like_the_signal_route(store):
    """프론트가 signal.contributions 를 그대로 먹는다 — 키 모양이 같아야 한다."""
    collector.collect_ticker(TICKER, "삼성전자", store=store)

    contributions = json.loads(store.get(TICKER)["contributions_json"])
    assert contributions
    assert set(contributions[0]) == {
        "category", "name", "score", "weight", "contribution", "detail",
    }


def test_collect_ticker_stores_indicators_that_roundtrip_losslessly(store):
    """signal 라우트가 이걸 IndicatorSet 으로 되살려 사용자 가중치로 재채점한다.

    한 필드라도 유실되면 재채점 결과가 조용히 달라진다 — 전체 동일성으로 고정한다.
    """
    _ohlcv, _flow, ind = deps.load_indicators(TICKER)

    collector.collect_ticker(TICKER, "삼성전자", store=store)

    stored = IndicatorSet(**json.loads(store.get(TICKER)["indicators_json"]))
    assert stored == ind


def test_collect_ticker_carries_source_flags_from_the_header(store):
    collector.collect_ticker(TICKER, "삼성전자", store=store)

    row = store.get(TICKER)
    assert (row["source"], row["mock"], row["stale"]) == ("mock", 1, 0)


def test_collect_ticker_stamps_collection_time_separately_from_quote_time(store):
    collector.collect_ticker(TICKER, "삼성전자", store=store)

    row = store.get(TICKER)
    assert row["quote_as_of"] == deps.stock_header(TICKER)["as_of"]
    assert row["as_of"] != row["quote_as_of"]  # 수집 시각은 지금, 시세 시각은 KIS 것


def test_collect_ticker_keeps_the_name_from_the_universe(store):
    collector.collect_ticker(TICKER, "삼성전자", store=store)

    assert store.get(TICKER)["name"] == "삼성전자"


# ── 사이클 ──────────────────────────────────────────────────
UNIVERSE = [
    {"ticker": "005930", "name": "삼성전자", "tier": 0},
    {"ticker": "000660", "name": "SK하이닉스", "tier": 0},
    {"ticker": "035720", "name": "카카오", "tier": 1},
]


def test_run_cycle_collects_every_ticker(store):
    result = collector.run_cycle(UNIVERSE, store=store)

    assert result["ok"] == 3
    assert result["failed"] == []
    assert len(store.get_all()) == 3


def test_run_cycle_preserves_tier_from_the_universe(store):
    collector.run_cycle(UNIVERSE, store=store)

    assert {r["ticker"]: r["tier"] for r in store.get_all()}["035720"] == 1


def test_run_cycle_continues_past_a_failing_ticker(store, monkeypatch):
    real = collector.load_indicators

    def flaky(ticker: str):
        if ticker == "000660":
            raise RuntimeError("KIS 분봉 응답 없음")
        return real(ticker)

    monkeypatch.setattr(collector, "load_indicators", flaky)

    result = collector.run_cycle(UNIVERSE, store=store)

    assert result["ok"] == 2
    assert [t for t, _ in result["failed"]] == ["000660"]
    assert {r["ticker"] for r in store.get_all()} == {"005930", "035720"}


def test_run_cycle_leaves_the_previous_snapshot_of_a_failing_ticker(store, monkeypatch):
    """stale-while-revalidate: 수집이 실패해도 마지막 성공 스냅샷을 지우지 않는다."""
    collector.collect_ticker("000660", "SK하이닉스", store=store)
    before = store.get("000660")

    def always_fails(ticker: str):
        raise RuntimeError("KIS 다운")

    monkeypatch.setattr(collector, "load_indicators", always_fails)
    collector.run_cycle([UNIVERSE[1]], store=store)

    assert store.get("000660") == before


def test_run_cycle_aborts_the_whole_cycle_on_auth_failure(store, monkeypatch):
    """키가 죽었으면 200종목 × 12콜을 헛되이 태우지 않는다."""
    def rejected(ticker: str):
        raise KISAuthError("KIS 인증 거부 (HTTP 403)")

    monkeypatch.setattr(collector, "load_indicators", rejected)

    with pytest.raises(KISAuthError):
        collector.run_cycle(UNIVERSE, store=store)


def test_run_cycle_defaults_to_the_static_universe(store, monkeypatch):
    seen: list[str] = []
    monkeypatch.setattr(collector, "collect_ticker",
                        lambda t, n, store=None, tier=0: seen.append(t))

    collector.run_cycle(store=store)

    assert len(seen) == 200


def test_run_cycle_skips_outside_market_hours(monkeypatch):
    """장 밖이면 KIS 를 한 번도 부르지 않고 즉시 리턴한다."""
    from backend.core import collector

    called = []

    def _boom(*args, **kwargs):
        called.append(args)
        raise AssertionError("장 밖인데 수집을 시도했다")

    monkeypatch.setattr(collector, "collect_ticker", _boom)
    monkeypatch.setattr(collector, "should_collect", lambda: False)

    result = collector.run_cycle(universe=[{"ticker": "005930", "name": "삼성전자"}])

    assert result["skipped"] is True
    assert result["ok"] == 0
    assert called == []


def test_run_cycle_runs_inside_market_hours(monkeypatch):
    """장중이면 평소대로 돈다."""
    from backend.core import collector

    monkeypatch.setattr(collector, "collect_ticker",
                        lambda ticker, name, store=None, tier=0: {"ticker": ticker})
    monkeypatch.setattr(collector, "should_collect", lambda: True)

    result = collector.run_cycle(universe=[{"ticker": "005930", "name": "삼성전자"}])

    assert result["skipped"] is False
    assert result["ok"] == 1
