"""스냅샷 저장소 — 수집기가 쓰고 API 가 읽는 종목별 최신 계산 결과.

왜 있나: 예전엔 요청마다 KIS 를 콜드하게 긁었다. 종목당 12 GET(분봉 8 + 수급 4)이라
사용자 수 × 종목 수 만큼 외부 호출이 늘었다. 이제 백그라운드 수집기가 미리 계산해
여기에 넣고, 라우트는 여기만 읽는다. 사용자당 KIS 호출 0회.

구현은 표준 sqlite3 하나. 새 의존성 없음. 다만 나중에 인스턴스를 늘리려면
Postgres 로 갈아타야 하므로(파일 DB 는 프로세스마다 따로 생긴다) 접근을
SnapshotStore 클래스 뒤로 숨겨 둔다 — 라우트는 SQL 을 모른다.

동시성: FastAPI 워커 스레드가 읽고 APScheduler 워커 스레드가 쓴다.
- check_same_thread=False 로 연결 하나를 스레드 간 공유하고,
- WAL 로 리더가 라이터를 막지 않게 하고,
- 쓰기는 _lock 으로 직렬화한다. WAL 이 보장하는 건 다중 리더/단일 라이터뿐이다.
"""

from __future__ import annotations

import os
import sqlite3
import threading
from pathlib import Path

# 스냅샷 한 행의 컬럼. 순서가 곧 INSERT 파라미터 순서다.
# collector.collect_ticker 가 이 키를 전부 채워서 넘긴다.
COLUMNS: tuple[str, ...] = (
    "ticker",
    "name",
    "price",
    "change",
    "change_pct",
    "volume",
    "day_open",
    "day_high",
    "day_low",
    "final_score",
    "label",
    "contributions_json",
    "last_close",
    "last_atr",
    "market_status",
    "source",
    "mock",
    "stale",
    "quote_as_of",   # KIS 가 준 시세 시각. header["as_of"] 로 되돌려 준다.
    "as_of",         # 이 스냅샷을 만든 시각. 신선도 표시는 이 값 기준.
    "tier",
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS stock_snapshot (
    ticker             TEXT PRIMARY KEY,
    name               TEXT,
    price              REAL,
    change             REAL,
    change_pct         REAL,
    volume             INTEGER,
    day_open           REAL,
    day_high           REAL,
    day_low            REAL,
    final_score        REAL,
    label              TEXT,
    contributions_json TEXT,
    last_close         REAL,
    last_atr           REAL,
    market_status      TEXT,
    source             TEXT,
    mock               INTEGER,
    stale              INTEGER,
    quote_as_of        TEXT,
    as_of              TEXT,
    tier               INTEGER DEFAULT 0
)
"""

_UPSERT = (
    f"INSERT INTO stock_snapshot ({', '.join(COLUMNS)}) "
    f"VALUES ({', '.join('?' * len(COLUMNS))}) "
    f"ON CONFLICT(ticker) DO UPDATE SET "
    + ", ".join(f"{c}=excluded.{c}" for c in COLUMNS if c != "ticker")
)

DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "snapshots.db"


def _db_path() -> str:
    return os.getenv("SNAPSHOT_DB_PATH") or str(DEFAULT_DB_PATH)


class SnapshotStore:
    """종목 → 최신 스냅샷. 쓰기는 수집기만, 읽기는 라우트만."""

    def __init__(self, path: str | None = None) -> None:
        self.path = path or _db_path()
        if self.path != ":memory:":
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)

        self._lock = threading.Lock()
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        if self.path != ":memory:":
            # 인메모리 DB 는 WAL 을 지원하지 않는다(파일이 없으니 -wal 도 없다).
            self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute(_SCHEMA)
        self._conn.commit()

    def upsert(self, row: dict) -> None:
        """한 종목의 스냅샷을 덮어쓴다. 키가 하나라도 빠지면 KeyError.

        조용히 NULL 을 넣지 않는 이유: 스냅샷의 결손 필드는 프론트에서
        '0원 / 스코어 0' 처럼 그럴듯한 거짓말로 보인다. 수집 단계에서 터뜨린다.
        """
        values = tuple(row[c] for c in COLUMNS)
        with self._lock:
            self._conn.execute(_UPSERT, values)
            self._conn.commit()

    def get(self, ticker: str) -> dict | None:
        cur = self._conn.execute(
            "SELECT * FROM stock_snapshot WHERE ticker = ?", (ticker,)
        )
        found = cur.fetchone()
        return dict(found) if found is not None else None

    def get_all(self) -> list[dict]:
        """스코어 내림차순. 스크리너가 그대로 내보낸다."""
        cur = self._conn.execute(
            "SELECT * FROM stock_snapshot ORDER BY final_score DESC"
        )
        return [dict(r) for r in cur.fetchall()]

    def close(self) -> None:
        with self._lock:
            self._conn.close()


_STORE: SnapshotStore | None = None
_STORE_LOCK = threading.Lock()


def get_store() -> SnapshotStore:
    """프로세스 싱글턴. import 시점이 아니라 첫 사용 시점에 파일을 연다
    (테스트가 SNAPSHOT_DB_PATH 를 세팅할 틈을 준다)."""
    global _STORE
    if _STORE is None:
        with _STORE_LOCK:
            if _STORE is None:
                _STORE = SnapshotStore()
    return _STORE


def close_store() -> None:
    global _STORE
    with _STORE_LOCK:
        if _STORE is not None:
            _STORE.close()
            _STORE = None
