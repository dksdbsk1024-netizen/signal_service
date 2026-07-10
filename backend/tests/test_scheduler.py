"""수집 스케줄러 배선 — 앱 안에서 백그라운드로 돈다.

별도 워커 프로세스 없이 FastAPI lifespan 이 APScheduler 를 띄운다.
테스트에서는 COLLECT_ENABLED=0 (conftest 기본)이라 실제로 돌지 않아야 한다.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.api import main


def test_scheduler_stays_off_when_collect_disabled(monkeypatch):
    """테스트·CI 는 수집기를 켜지 않는다. 켜지면 매 테스트가 KIS 를 긁는다."""
    monkeypatch.setenv("COLLECT_ENABLED", "0")
    started: list[str] = []
    monkeypatch.setattr(main, "_start_scheduler", lambda: started.append("on"))

    with TestClient(main.app):
        pass

    assert started == []


def test_lifespan_starts_and_stops_the_scheduler_when_enabled(monkeypatch):
    monkeypatch.setenv("COLLECT_ENABLED", "1")
    events: list[str] = []

    class FakeScheduler:
        def start(self) -> None:
            events.append("start")

        def shutdown(self, wait: bool = True) -> None:
            events.append("shutdown")

        def add_job(self, *a, **kw) -> None:
            events.append(f"job:{kw.get('id', '?')}")

    monkeypatch.setattr(main, "BackgroundScheduler", lambda **kw: FakeScheduler())

    with TestClient(main.app):
        pass

    assert events[0] == "start" or "start" in events
    assert "shutdown" in events


def test_two_jobs_registered_periodic_and_immediate(monkeypatch):
    """부팅 직후 1회 즉시 수집 + 이후 주기 반복. 첫 사용자가 빈 화면을 보지 않게."""
    monkeypatch.setenv("COLLECT_ENABLED", "1")
    jobs: list[dict] = []

    class FakeScheduler:
        def start(self) -> None: ...
        def shutdown(self, wait: bool = True) -> None: ...

        def add_job(self, func, trigger=None, **kw) -> None:
            jobs.append({"trigger": trigger, **kw})

    monkeypatch.setattr(main, "BackgroundScheduler", lambda **kw: FakeScheduler())

    with TestClient(main.app):
        pass

    triggers = [j["trigger"] for j in jobs]
    assert "interval" in triggers   # 주기 수집
    assert "date" in triggers       # 부팅 즉시 1회


def test_periodic_job_never_overlaps_itself(monkeypatch):
    """사이클이 주기를 넘겨도 두 번째 사이클이 겹쳐 돌면 KIS 호출이 두 배가 된다."""
    monkeypatch.setenv("COLLECT_ENABLED", "1")
    jobs: list[dict] = []

    class FakeScheduler:
        def start(self) -> None: ...
        def shutdown(self, wait: bool = True) -> None: ...

        def add_job(self, func, trigger=None, **kw) -> None:
            jobs.append({"trigger": trigger, **kw})

    monkeypatch.setattr(main, "BackgroundScheduler", lambda **kw: FakeScheduler())

    with TestClient(main.app):
        pass

    periodic = next(j for j in jobs if j["trigger"] == "interval")
    assert periodic["max_instances"] == 1
    assert periodic["coalesce"] is True


def test_macro_warmup_still_runs_on_startup(monkeypatch):
    """lifespan 이관 과정에서 기존 매크로 예열을 잃지 않았는지."""
    monkeypatch.setenv("COLLECT_ENABLED", "0")
    warmed: list[str] = []
    monkeypatch.setattr(main, "_warm_macro_cache", lambda: warmed.append("warm"))

    with TestClient(main.app):
        pass

    assert warmed == ["warm"]


@pytest.mark.parametrize("value,expected", [("0", False), ("", False),
                                            ("1", True), ("true", True)])
def test_collect_enabled_env_parsing(monkeypatch, value, expected):
    monkeypatch.setenv("COLLECT_ENABLED", value)
    assert main._collect_enabled() is expected
