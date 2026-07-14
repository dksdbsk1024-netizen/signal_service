"""장 시간 판정 — 배지용 market_status 와 수집 게이트 should_collect."""

import datetime

import pytest

from backend.core.market_hours import KST, market_status, should_collect


def at(year, month, day, hour, minute):
    return datetime.datetime(year, month, day, hour, minute, tzinfo=KST)


# 2026-07-14 는 화요일, 2026-07-18 은 토요일, 2026-07-19 은 일요일.
@pytest.mark.parametrize("now, expected", [
    (at(2026, 7, 14, 8, 59), "closed"),   # 개장 직전
    (at(2026, 7, 14, 9, 0), "open"),      # 개장 경계 포함
    (at(2026, 7, 14, 15, 29), "open"),    # 마감 직전
    (at(2026, 7, 14, 15, 30), "after"),   # 마감 경계 → 시간외
    (at(2026, 7, 14, 17, 59), "after"),
    (at(2026, 7, 14, 18, 0), "closed"),   # 시간외 종료 경계
    (at(2026, 7, 18, 11, 0), "closed"),   # 토요일
    (at(2026, 7, 19, 11, 0), "closed"),   # 일요일
])
def test_market_status(now, expected):
    assert market_status(now) == expected


@pytest.mark.parametrize("now, expected", [
    (at(2026, 7, 14, 8, 59), False),   # 개장 전
    (at(2026, 7, 14, 9, 0), True),     # 개장
    (at(2026, 7, 14, 12, 0), True),    # 장중
    (at(2026, 7, 14, 15, 30), True),   # 마감 직후 — 유예창 안 (종가 스냅샷용)
    (at(2026, 7, 14, 15, 39), True),   # 유예창 끝 직전
    (at(2026, 7, 14, 15, 40), False),  # 유예창 끝 경계
    (at(2026, 7, 14, 20, 0), False),   # 야간
    (at(2026, 7, 18, 11, 0), False),   # 토요일
    (at(2026, 7, 19, 11, 0), False),   # 일요일
])
def test_should_collect(now, expected):
    assert should_collect(now) is expected


def test_defaults_to_now_when_no_arg():
    """인자 없이 부르면 현재 KST 로 판정한다 — 예외 없이 유효한 값이 나오면 된다."""
    assert market_status() in {"open", "after", "closed"}
    assert isinstance(should_collect(), bool)


def test_deps_reexports_same_function():
    """기존 import 경로(api.deps.market_status)가 살아 있어야 한다 — 라우트가 쓴다."""
    from backend.api import deps

    assert deps.market_status is market_status
