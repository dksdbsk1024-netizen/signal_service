"""라우트는 스냅샷 저장소만 읽는다 — 사용자당 KIS 호출 0회.

핵심 단언: provider 를 '부르면 터지는' 스텁으로 바꿔도 응답이 나온다.
스냅샷이 없을 때만 온디맨드로 1회 수집한다.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.api import deps
from backend.api.main import app
from backend.core import collector
from backend.core.snapshot_store import close_store, get_store

client = TestClient(app)
TICKER = "005930"


class ExplodingProvider:
    """스냅샷을 읽는 경로가 provider 를 건드리면 즉시 드러난다."""

    def __getattr__(self, name):
        def boom(*a, **kw):
            raise AssertionError(f"라우트가 KIS provider 를 호출했다: {name}")
        return boom


@pytest.fixture(autouse=True)
def fresh_store():
    """저장소 싱글턴은 인메모리라도 프로세스 수명을 산다 — 테스트마다 비운다."""
    close_store()
    yield
    close_store()


@pytest.fixture()
def seeded():
    """저장소에 스냅샷을 채우고, 그 뒤 provider 를 막는다."""
    store = get_store()
    for ticker, name in [("005930", "삼성전자"), ("000660", "SK하이닉스")]:
        collector.collect_ticker(ticker, name, store=store)
    yield store


@pytest.fixture()
def no_provider(monkeypatch):
    monkeypatch.setattr(deps, "PROVIDER", ExplodingProvider())


# ── 스크리너 ────────────────────────────────────────────────
def test_screener_serves_from_the_store_without_touching_kis(seeded, no_provider):
    body = client.get("/api/screener").json()

    assert body["count"] == 2
    assert {r["ticker"] for r in body["rows"]} == {"005930", "000660"}


def test_screener_row_schema_is_unchanged(seeded, no_provider):
    row = client.get("/api/screener").json()["rows"][0]

    assert set(row) == {
        "ticker", "name", "final_score", "label", "top_contributor",
        "price", "change", "change_pct", "volume", "market_status", "mock",
    }
    assert set(row["top_contributor"]) == {"name", "contribution"}


def test_screener_rows_sorted_by_score_descending(seeded, no_provider):
    rows = client.get("/api/screener").json()["rows"]

    assert rows == sorted(rows, key=lambda r: r["final_score"], reverse=True)


def test_screener_exposes_collection_freshness(seeded, no_provider):
    body = client.get("/api/screener").json()

    assert body["as_of"]  # 프론트가 "N초 전 갱신" 배지에 쓸 수 있게


def test_screener_top_contributor_comes_from_the_serialized_contributions(seeded, no_provider):
    """score_stock 이 기여 절대값 내림차순으로 정렬해 두므로 0번이 곧 1위다."""
    import json

    row = next(r for r in client.get("/api/screener").json()["rows"]
               if r["ticker"] == TICKER)
    stored = json.loads(get_store().get(TICKER)["contributions_json"])

    assert row["top_contributor"] == {
        "name": stored[0]["name"], "contribution": stored[0]["contribution"],
    }


def test_screener_cold_store_collects_a_bounded_head(monkeypatch):
    """부팅 직후 저장소가 비었을 때 200종목을 요청 스레드에서 태우면 안 된다."""
    collected: list[str] = []
    monkeypatch.setattr(collector, "collect_ticker",
                        lambda t, n, store=None, tier=0: collected.append(t))
    monkeypatch.setenv("SCREENER_COLD_LIMIT", "3")

    client.get("/api/screener")

    assert len(collected) == 3


# ── 종합 신호 ───────────────────────────────────────────────
def test_signal_serves_from_the_store_without_touching_kis(seeded, no_provider):
    body = client.get(f"/api/signal/{TICKER}").json()

    assert body["ticker"] == TICKER
    assert body["signal"]["label"]


def test_signal_header_schema_is_unchanged(seeded, no_provider):
    header = client.get(f"/api/signal/{TICKER}").json()["header"]

    assert set(header) == {
        "ticker", "price", "change", "change_pct", "volume",
        "day_open", "day_high", "day_low", "as_of",
        "market_status", "source", "mock", "stale",
    }
    assert (header["source"], header["mock"], header["stale"]) == ("mock", True, False)


def test_signal_contributions_keep_their_keys(seeded, no_provider):
    contributions = client.get(f"/api/signal/{TICKER}").json()["signal"]["contributions"]

    assert set(contributions[0]) == {
        "category", "name", "score", "weight", "contribution", "detail",
    }


def test_signal_trade_plan_is_computed_per_request_not_stored(seeded, no_provider):
    """계좌·리스크·진입가는 사용자 입력이다 — 스냅샷의 last_close/last_atr 로 즉석 계산."""
    base = client.get(f"/api/signal/{TICKER}").json()["trade_plan"]
    overridden = client.get(f"/api/signal/{TICKER}?entry=99999").json()["trade_plan"]

    assert overridden["entry"] == 99999
    assert overridden["entry"] != base["entry"]
    assert overridden["stop"] != base["stop"]


def test_signal_position_size_follows_the_account_query_param(seeded, no_provider):
    small = client.get(f"/api/signal/{TICKER}?account=1000000").json()["trade_plan"]
    large = client.get(f"/api/signal/{TICKER}?account=100000000").json()["trade_plan"]

    assert large["position"]["qty"] > small["position"]["qty"]


def test_signal_exposes_collection_freshness(seeded, no_provider):
    body = client.get(f"/api/signal/{TICKER}").json()

    assert body["as_of"]
    assert body["stale"] is False


def test_signal_falls_back_to_on_demand_collection_when_snapshot_missing(monkeypatch):
    """유니버스 밖 종목도 조회된다 — 첫 호출만 느리고, 그 뒤론 스냅샷."""
    calls: list[str] = []
    real = collector.collect_ticker

    def counting(ticker, name, store=None, tier=0):
        calls.append(ticker)
        return real(ticker, name, store=store, tier=tier)

    monkeypatch.setattr(collector, "collect_ticker", counting)

    body = client.get("/api/signal/035720").json()

    assert calls == ["035720"]
    assert body["signal"]["label"]
    assert get_store().get("035720") is not None


def test_signal_404_when_collection_also_fails(monkeypatch):
    def broken(ticker, name, store=None, tier=0):
        raise RuntimeError("KIS 응답 없음")

    monkeypatch.setattr(collector, "collect_ticker", broken)

    assert client.get("/api/signal/999999").status_code == 404
