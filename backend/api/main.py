"""FastAPI 진입점.

core 로직을 HTTP로 노출한다. 프론트 개발서버가 붙을 수 있게 CORS를 localhost로 연다.
실 데이터 연동은 deps.PROVIDER 교체만으로 이뤄진다.

수집기는 이 프로세스 안에서 백그라운드 스케줄러로 돈다(별도 워커·서비스 없음).
라우트는 스냅샷 저장소만 읽으므로, 사용자가 몇 명이든 KIS 호출량은 그대로다.
스케일아웃(인스턴스 2개 이상) 시점엔 인스턴스마다 스케줄러가 생겨 호출이 중복된다 —
그때는 수집기를 떼어내고 Postgres 로 옮겨야 한다.
"""

from __future__ import annotations

import contextlib
import datetime
import logging
import os
import threading

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ..core.collector import COLLECT_INTERVAL_SEC, run_cycle
from ..core.snapshot_store import close_store
from .routes import flow, macro, screener, signal, technical

log = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _collect_enabled() -> bool:
    """테스트·CI 는 COLLECT_ENABLED=0. 켜져 있으면 매 테스트가 KIS 를 긁는다."""
    return os.getenv("COLLECT_ENABLED", "1").strip().lower() not in {"", "0", "false", "no"}


def _warm_macro_cache() -> None:
    """서버 기동 직후 매크로 지표·시세를 백그라운드로 미리 받아 캐시를 예열한다.
    첫 사용자가 콜드 캐시(느린 yfinance 순차 대기)를 맞지 않게 하는 목적. 데몬 스레드라
    기동을 막지 않고, 오프라인(테스트·MACRO_LIVE_QUOTES=0)에선 건너뛴다."""
    from .deps import MACRO_PROVIDER

    if not getattr(MACRO_PROVIDER, "live_quotes", False):
        return  # 오프라인/테스트: 예열 불필요(네트워크 미사용)

    def _warm() -> None:
        try:
            macro._fetch_indicators(MACRO_PROVIDER)
            macro._fetch_quotes(MACRO_PROVIDER)
        except Exception:
            pass  # 예열 실패는 무시 — 실제 요청 때 정상 폴백 경로가 처리

    threading.Thread(target=_warm, name="macro-cache-warmup", daemon=True).start()


def _safe_cycle() -> None:
    """스케줄러 잡에서 예외가 새면 APScheduler 가 잡을 죽인다. 여기서 삼킨다."""
    try:
        run_cycle()
    except Exception as e:  # noqa: BLE001
        log.warning("수집 사이클 실패(다음 주기에 재시도): %s", e)


def _start_scheduler() -> None:
    global _scheduler
    _scheduler = BackgroundScheduler(daemon=True)
    # 부팅 즉시 1회. lifespan 안에서 동기로 돌리면 200종목 × ~160초 동안 앱이 안 뜬다.
    _scheduler.add_job(_safe_cycle, "date",
                       run_date=datetime.datetime.now() + datetime.timedelta(seconds=1),
                       id="collect-now")
    # 사이클이 주기를 넘겨도 겹쳐 돌지 않게(coalesce+max_instances=1). 겹치면 호출량이 두 배.
    _scheduler.add_job(_safe_cycle, "interval", seconds=COLLECT_INTERVAL_SEC,
                       id="collect-periodic", max_instances=1, coalesce=True)
    _scheduler.start()
    log.info("수집 스케줄러 시작 — %d초 주기", COLLECT_INTERVAL_SEC)


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI):
    _warm_macro_cache()
    if _collect_enabled():
        _start_scheduler()
    yield
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
    close_store()


app = FastAPI(title="signal-service API", version="0.1.0", lifespan=lifespan)

# 프론트 개발서버(Vite 5173 / CRA 3000 등) 허용.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_origin_regex=r"http://localhost(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(signal.router)
app.include_router(technical.router)
app.include_router(flow.router)
app.include_router(macro.router)
app.include_router(screener.router)


@app.get("/health")
def health():
    return {"status": "ok", "provider": "mock"}
