"""수집기 — 유니버스를 돌며 비싼 계산을 미리 해서 스냅샷 저장소에 넣는다.

라우트가 요청마다 KIS 를 긁던 걸 여기로 옮긴 것뿐이다. 지표·스코어 계산 자체는
기존 함수를 그대로 쓴다(load_indicators / stock_header / score_stock) — 신호 결과는
전환 전후가 같아야 한다.

무엇을 저장하지 않는가: trade_plan 과 position_size. 저장된 last_close·last_atr 과
사용자 입력(계좌·리스크)만으로 즉시 나오는 순수 함수라 캐싱할 이유가 없다.

유량: 종목 하나가 kis.py 안에서 GET 12번을 낸다(분봉 8 + 수급 4). 초당 상한은
kis._RATE 토큰버킷이 잡는다. 여기 워커 수는 '동시에 몇 종목을 물고 있을까'일 뿐,
유량 제한이 아니다.

단독 실행:
    python -m backend.core.collector                 # 1사이클
    python -m backend.core.collector --limit 10      # 앞 10종목만
    python -m backend.core.collector --loop          # COLLECT_INTERVAL_SEC 마다 반복
"""

from __future__ import annotations

import argparse
import datetime
import json
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import asdict
from pathlib import Path

from ..api.deps import load_indicators, market_status, stock_header
from . import scoring
from .kis import COLLECT_WORKERS, KISAuthError
from .snapshot_store import SnapshotStore, get_store

log = logging.getLogger(__name__)

UNIVERSE_FILE = Path(__file__).resolve().parents[1] / "data" / "universe_top200.json"

# 종목당 GET 최대 18회(분봉 최대 12페이지 + 수급 4 + 현재가 2). 실측(2026-07-10, 워커 24):
# 200종목 1사이클 381초, GET 2,574회, 6.8 req/s. 유량 상한(12/s)이 아니라 KIS 응답 지연이 바닥이다.
# 사이클이 주기보다 길면 max_instances=1 이 그냥 건너뛴다 — 호출량이 두 배가 되진 않고,
# 사실상 '끝나는 대로 다시' 가 된다.
COLLECT_INTERVAL_SEC = int(os.getenv("COLLECT_INTERVAL_SEC", "300"))

_KST = datetime.timezone(datetime.timedelta(hours=9))


def load_universe(path: Path | None = None) -> list[dict]:
    """[{"ticker", "name", "tier"}, ...]. KIS 에 시총 랭킹 API 가 없어 정적 파일로 둔다."""
    with open(path or UNIVERSE_FILE, encoding="utf-8") as f:
        return json.load(f)


def collect_ticker(ticker: str, name: str, store: SnapshotStore | None = None,
                   tier: int = 0) -> dict:
    """한 종목의 스냅샷을 만들어 저장하고 그 행을 돌려준다.

    예외는 삼키지 않는다 — 부분 실패 판단은 run_cycle 이 한다.
    """
    store = store or get_store()

    _ohlcv, _flow, ind = load_indicators(ticker)
    header = stock_header(ticker)
    result = scoring.score_stock(ind)

    row = {
        "ticker": ticker,
        "name": name,
        "price": header["price"],
        "change": header["change"],
        "change_pct": header["change_pct"],
        "volume": header["volume"],
        "day_open": header["day_open"],
        "day_high": header["day_high"],
        "day_low": header["day_low"],
        "final_score": result.final_score,
        "label": result.label,
        # signal 라우트가 응답에 그대로 싣던 모양 그대로 — 프론트가 이 키들을 읽는다.
        "contributions_json": json.dumps(
            [asdict(c) for c in result.contributions], ensure_ascii=False
        ),
        # 채점 전 원지표. 위 final_score 는 DEFAULT_WEIGHTS 로 구운 값이라
        # 사용자 가중치로 재채점하려면 이게 필요하다(signal 라우트).
        "indicators_json": json.dumps(asdict(ind), ensure_ascii=False),
        "last_close": ind.last_close,
        # 장 시작 직후엔 봉이 14개가 안 돼 ATR 이 없다(None). 0.0 으로 채우면
        # risk_plan 이 "손절가 = 진입가" 라는 치명적 거짓말을 만든다.
        "last_atr": ind.last_atr,
        "bars": ind.bars,
        "coverage": result.coverage,
        "market_status": header["market_status"],
        "source": header["source"],
        "mock": int(header["mock"]),
        "stale": int(header["stale"]),
        "quote_as_of": header["as_of"],
        "as_of": datetime.datetime.now(_KST).isoformat(timespec="seconds"),
        "tier": tier,
    }
    store.upsert(row)
    return row


def run_cycle(universe: list[dict] | None = None,
              store: SnapshotStore | None = None) -> dict:
    """유니버스 한 바퀴. 종목 실패는 넘어가고, 인증 실패는 사이클을 중단한다.

    실패한 종목의 이전 스냅샷은 건드리지 않는다(stale-while-revalidate).
    인증이 거부되면 남은 종목도 전부 같은 이유로 실패할 테니 헛돌지 않고 즉시 올린다.
    """
    universe = universe if universe is not None else load_universe()
    store = store or get_store()

    started = time.monotonic()
    ok = 0
    failed: list[tuple[str, str]] = []

    with ThreadPoolExecutor(max_workers=COLLECT_WORKERS) as pool:
        futures = {
            pool.submit(collect_ticker, u["ticker"], u["name"],
                        store=store, tier=u.get("tier", 0)): u["ticker"]
            for u in universe
        }
        for future in as_completed(futures):
            ticker = futures[future]
            try:
                future.result()
            except KISAuthError:
                for pending in futures:
                    pending.cancel()
                raise
            except Exception as e:  # noqa: BLE001 — 종목 하나가 사이클을 죽이면 안 된다
                log.warning("수집 실패 %s: %s", ticker, e)
                failed.append((ticker, str(e)))
            else:
                ok += 1

    elapsed = time.monotonic() - started
    log.info("사이클 완료: %d종목 성공, %d종목 실패, %.1f초", ok, len(failed), elapsed)
    return {"ok": ok, "failed": failed, "elapsed_sec": round(elapsed, 1)}


def _main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="스냅샷 수집기 (수동 실행)")
    parser.add_argument("--loop", action="store_true", help="주기 반복")
    parser.add_argument("--interval", type=int, default=COLLECT_INTERVAL_SEC,
                        help=f"반복 주기(초). 기본 {COLLECT_INTERVAL_SEC}")
    parser.add_argument("--limit", type=int, default=None, help="앞 N종목만")
    args = parser.parse_args()

    universe = load_universe()
    if args.limit:
        universe = universe[: args.limit]

    while True:
        result = run_cycle(universe)
        print(f"{result['ok']}종목 성공 / {len(result['failed'])}종목 실패 "
              f"/ {result['elapsed_sec']}초")
        for ticker, err in result["failed"]:
            print(f"  실패 {ticker}: {err}")
        if not args.loop:
            return 0 if not result["failed"] else 1
        time.sleep(args.interval)


if __name__ == "__main__":
    raise SystemExit(_main())
