"""snapshot_store — 수집기가 쓰고 API 가 읽는 SQLite 스냅샷 저장소.

모든 테스트는 인메모리 DB(":memory:")를 쓴다. 파일을 건드리지 않으므로
개발자의 실제 snapshots.db 나 CI 워크스페이스를 오염시키지 않는다.
"""

from __future__ import annotations

import json
import threading

import pytest

from backend.core.snapshot_store import SnapshotStore


def _row(ticker: str = "005930", **over) -> dict:
    """수집기가 만들어 넣는 스냅샷 한 행. 필드는 collector.collect_ticker 와 같은 모양."""
    base = {
        "ticker": ticker,
        "name": "삼성전자",
        "price": 71_000.0,
        "change": 1_200.0,
        "change_pct": 1.72,
        "volume": 12_345_678,
        "day_open": 70_000.0,
        "day_high": 71_500.0,
        "day_low": 69_800.0,
        "final_score": 42.5,
        "label": "매수",
        "contributions_json": json.dumps(
            [{"category": "trend", "name": "추세", "contribution": 12.0}],
            ensure_ascii=False,
        ),
        "last_close": 71_000.0,
        "last_atr": 850.0,
        "market_status": "open",
        "source": "kis",
        "mock": 0,
        "stale": 0,
        "quote_as_of": "2026-07-10 14:03:11 KST",
        "as_of": "2026-07-10T14:03:12+09:00",
        "tier": 0,
    }
    base.update(over)
    return base


@pytest.fixture()
def store():
    s = SnapshotStore(":memory:")
    yield s
    s.close()


def test_get_returns_none_when_absent(store):
    assert store.get("005930") is None


def test_get_all_empty_on_fresh_db(store):
    assert store.get_all() == []


def test_upsert_then_get_roundtrip(store):
    store.upsert(_row())

    got = store.get("005930")
    assert got is not None
    assert got["ticker"] == "005930"
    assert got["name"] == "삼성전자"
    assert got["final_score"] == 42.5
    assert got["label"] == "매수"
    assert got["last_atr"] == 850.0
    assert got["quote_as_of"] == "2026-07-10 14:03:11 KST"
    assert got["as_of"] == "2026-07-10T14:03:12+09:00"


def test_roundtrip_preserves_every_column(store):
    written = _row()
    store.upsert(written)
    assert store.get("005930") == written


def test_mock_and_stale_roundtrip_as_ints(store):
    store.upsert(_row(mock=1, stale=1, source="mock"))

    got = store.get("005930")
    assert (got["source"], got["mock"], got["stale"]) == ("mock", 1, 1)


def test_contributions_json_survives_korean_text(store):
    payload = json.dumps([{"name": "수급", "contribution": -8.3}], ensure_ascii=False)
    store.upsert(_row(contributions_json=payload))

    assert json.loads(store.get("005930")["contributions_json"])[0]["name"] == "수급"


def test_upsert_same_ticker_twice_updates_in_place(store):
    store.upsert(_row(final_score=10.0))
    store.upsert(_row(final_score=-30.0, label="매도"))

    rows = store.get_all()
    assert len(rows) == 1
    assert rows[0]["final_score"] == -30.0
    assert rows[0]["label"] == "매도"


def test_get_all_sorted_by_final_score_desc(store):
    store.upsert(_row("000660", final_score=10.0))
    store.upsert(_row("005930", final_score=90.0))
    store.upsert(_row("035720", final_score=-50.0))

    assert [r["ticker"] for r in store.get_all()] == ["005930", "000660", "035720"]


def test_partial_row_rejected_rather_than_written_silently(store):
    with pytest.raises(KeyError):
        store.upsert({"ticker": "005930", "name": "삼성전자"})

    assert store.get("005930") is None


def test_concurrent_writes_do_not_corrupt(store):
    """스케줄러가 여러 워커 스레드로 upsert 한다 — sqlite3 연결 하나를 공유해도 안전해야."""
    tickers = [f"{i:06d}" for i in range(50)]

    def write(t: str) -> None:
        store.upsert(_row(t, final_score=float(int(t))))

    threads = [threading.Thread(target=write, args=(t,)) for t in tickers]
    for th in threads:
        th.start()
    for th in threads:
        th.join()

    assert len(store.get_all()) == 50
