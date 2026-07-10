"""KIS 유량 제한 — 토큰버킷.

왜 kis.py 안인가: 종목 하나를 수집하면 kis.py 내부에서 GET 이 18번 나간다
(분봉 최대 12페이지 + 수급 4 + 현재가 2). 수집기 레벨 세마포어는 '종목'을 셀 뿐
GET 을 못 센다. 그래서 버킷은 HTTP 호출 바로 앞에 있어야 한다.
"""

from __future__ import annotations

import threading

import pytest

from backend.core import kis


class FakeClock:
    """sleep 이 시간을 앞으로 감는 가짜 시계. 테스트가 실제로 기다리지 않는다."""

    def __init__(self) -> None:
        self.now = 1000.0
        self.slept = 0.0

    def monotonic(self) -> float:
        return self.now

    def sleep(self, sec: float) -> None:
        assert sec >= 0
        self.now += sec
        self.slept += sec


def _bucket(rate: float, capacity: float, clock: FakeClock) -> kis._TokenBucket:
    return kis._TokenBucket(rate=rate, capacity=capacity,
                            monotonic=clock.monotonic, sleep=clock.sleep)


def test_first_call_is_immediate():
    clock = FakeClock()
    bucket = _bucket(rate=15, capacity=1, clock=clock)

    bucket.acquire()

    assert clock.slept == 0.0


def test_no_burst_is_allowed_beyond_the_capacity():
    """KIS 는 1초 슬라이딩 윈도로 센다. 버스트 15개를 순식간에 흘리면
    그 1초 창에 15 + 이어지는 15/s 가 겹쳐 한도를 넘고 EGW00201 을 맞는다."""
    clock = FakeClock()
    bucket = _bucket(rate=15, capacity=1, clock=clock)

    for _ in range(15):
        bucket.acquire()

    assert clock.slept == pytest.approx(14 / 15, rel=1e-6)


def test_sustained_calls_settle_at_the_configured_rate():
    """200종목 × 12 GET = 2,400콜이 몇 초 걸리는지가 수집 주기를 정한다."""
    clock = FakeClock()
    bucket = _bucket(rate=15, capacity=1, clock=clock)

    for _ in range(2400):
        bucket.acquire()

    assert clock.slept == pytest.approx(2399 / 15, rel=1e-6)


def test_an_idle_gap_does_not_bank_more_than_capacity():
    """한 시간을 놀아도 다음 순간에 몰아서 쏘지 않는다."""
    clock = FakeClock()
    bucket = _bucket(rate=15, capacity=1, clock=clock)

    bucket.acquire()
    clock.now += 3600.0

    bucket.acquire()   # 쌓인 토큰 1개 → 즉시
    bucket.acquire()   # 그 다음은 다시 기다린다

    assert clock.slept == pytest.approx(1 / 15, rel=1e-6)


def test_concurrent_callers_share_one_budget():
    """워커 8개가 동시에 때려도 총 발급 토큰 수는 정확히 요청 수와 같아야.

    sleep 을 지우고 실시계를 쓴다 — 검사 대상은 락 정확성이지 대기 시간이 아니다.
    """
    bucket = kis._TokenBucket(rate=10_000, capacity=1, sleep=lambda _s: None)
    counter = {"n": 0}
    lock = threading.Lock()

    def hammer() -> None:
        for _ in range(50):
            bucket.acquire()
            with lock:
                counter["n"] += 1

    threads = [threading.Thread(target=hammer) for _ in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert counter["n"] == 400


# ── 버킷이 실제 GET 앞에 걸려 있는가 ────────────────────────────
# 호출 지점을 하나라도 빠뜨리면 유량 제한이 조용히 새어나간다.

class _Resp:
    """네 fetch 가 모두 통과할 만큼만 채운 최소 응답. 검사 대상은 파싱이 아니라 버킷."""

    status_code = 200
    text = ""

    @staticmethod
    def json() -> dict:
        return {
            "rt_cd": "0",
            "output": {"stck_prpr": "71000"},                    # 현재가
            "output1": {"askp1": "71100", "bidp1": "70900"},     # 호가
            "output2": [],                                        # 분봉
        }


@pytest.fixture()
def counted_rate(monkeypatch):
    calls = {"n": 0}

    class Counting:
        def acquire(self) -> None:
            calls["n"] += 1

    monkeypatch.setattr(kis, "_RATE", Counting())
    return calls


@pytest.mark.parametrize(
    "fetch",
    [
        lambda: kis._fetch_price("005930", "tok", "k", "s"),
        lambda: kis._fetch_minute_page("005930", "153000", "tok", "k", "s"),
        lambda: kis._fetch_orderbook("005930", "tok", "k", "s"),
        lambda: kis._get_json("/p", "TR", {}, "tok", "k", "s", "무엇"),
    ],
    ids=["price", "minute_page", "orderbook", "get_json"],
)
def test_every_kis_get_passes_through_the_bucket(fetch, counted_rate, monkeypatch):
    monkeypatch.setattr(kis._SESSION, "get", lambda *a, **kw: _Resp())

    fetch()

    assert counted_rate["n"] == 1


def test_default_bucket_paces_without_bursting():
    """KIS 한도는 초당 20건이지만 15로도 EGW00201(초당 거래건수 초과)을 맞았다.
    capacity=1 이라 버스트가 없고, 호출 간격이 균등하게 벌어진다."""
    assert kis._RATE.rate == 12.0
    assert kis._RATE.capacity == 1.0
