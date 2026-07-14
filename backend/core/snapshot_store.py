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
    # 원지표(IndicatorSet). 채점 전 단계라 사용자 가중치로 재채점할 수 있다.
    # final_score·contributions_json 은 DEFAULT_WEIGHTS 로 구운 기준선이다.
    "indicators_json",
    "last_close",
    "last_atr",
    "bars",       # 지표 계산에 쓰인 봉 개수. "봉 10/14 — 계산 불가" 안내의 근거.
    "coverage",   # 스코어에 실제로 반영된 가중치 비율(0~1). 워밍업 중 1 미만.
    "market_status",
    "source",
    "mock",
    "stale",
    "quote_as_of",   # KIS 가 준 시세 시각. header["as_of"] 로 되돌려 준다.
    "as_of",         # 이 스냅샷을 만든 시각. 신선도 표시는 이 값 기준.
    "tier",
)

# 정당하게 비어 있을 수 있는 컬럼 — 장 시작 직후 봉이 모자란 구간.
# ATR(14) 은 봉 14개가 필요하고, 그게 없으면 매매계획(손절·목표)을 못 만든다.
# 스코어는 가용 지표만으로 재정규화하지만, 가용 지표가 아예 0개면 스코어도 없다.
# 이 컬럼들의 NULL 은 "모른다"는 정직한 표시다. 나머지 컬럼의 NULL 은 버그다.
NULLABLE: frozenset[str] = frozenset({"last_atr", "final_score", "label", "coverage"})

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
    indicators_json    TEXT,
    last_close         REAL,
    last_atr           REAL,
    bars               INTEGER,
    coverage           REAL,
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
        self._migrate()
        self._conn.commit()

    def _migrate(self) -> None:
        """_SCHEMA 에는 있는데 실제 테이블에 없는 컬럼을 붙인다.

        CREATE TABLE IF NOT EXISTS 는 기존 파일에 컬럼을 추가해 주지 않는다 —
        그대로 두면 다음 upsert 가 "no column named ..." 로 터진다.

        붙인 컬럼이 NULL 인 옛 행은 지운다. NULL 을 읽는 쪽에서 분기 처리하면
        그 분기가 영원히 남는다. 스냅샷은 매 수집 사이클에 전부 덮어써지므로
        비용은 한 사이클치 공백이고, 라우트는 _snapshot_or_collect 로 메꾼다.
        """
        have = {r["name"] for r in self._conn.execute("PRAGMA table_info(stock_snapshot)")}
        missing = [c for c in COLUMNS if c not in have]
        if not missing:
            return

        for col in missing:
            self._conn.execute(f"ALTER TABLE stock_snapshot ADD COLUMN {col}")
        self._conn.execute("DELETE FROM stock_snapshot")

    def upsert(self, row: dict) -> None:
        """한 종목의 스냅샷을 덮어쓴다. 키가 빠지면 KeyError, 값이 부당하게 None 이면 ValueError.

        조용히 NULL 을 넣지 않는 이유: 스냅샷의 결손 필드는 프론트에서
        '0원 / 스코어 0' 처럼 그럴듯한 거짓말로 보인다. 수집 단계에서 터뜨린다.

        예외는 NULLABLE 뿐이다. 장 시작 직후엔 봉이 모자라 ATR·스코어가 정말로
        없다 — 그건 결손이 아니라 관측 가능한 사실이고, 라우트가 "봉 10/14" 로
        설명한다. 나머지 컬럼의 None 은 여전히 버그다.
        """
        missing_required = [
            c for c in COLUMNS if c not in NULLABLE and row[c] is None
        ]
        if missing_required:
            raise ValueError(
                f"스냅샷 필수 컬럼이 None 이다: {missing_required} — "
                f"수집 단계 버그다(NULLABLE 이 아닌 컬럼은 값이 있어야 한다)"
            )

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
