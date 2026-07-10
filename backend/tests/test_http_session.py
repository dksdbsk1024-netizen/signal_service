"""KIS HTTP 커넥션 재사용.

requests.get() 은 호출마다 새 Session 을 만든다 — TCP + TLS 핸드셰이크가 매번이다.
수집기가 종목당 18번, 200종목이면 3,600번 GET 하므로 핸드셰이크 비용이 사이클을 지배한다.
실측(20 in-flight): 모듈 함수 requests.get 은 GET 당 중앙값 7.64초,
공유 Session 은 0.67초. 10종목 사이클 102초 → 40초.
"""

from __future__ import annotations

import pytest
import requests

from backend.core import kis


class _Resp:
    status_code = 200
    text = ""

    @staticmethod
    def json() -> dict:
        return {
            "rt_cd": "0",
            "output": {"stck_prpr": "71000"},
            "output1": {"askp1": "71100", "bidp1": "70900"},
            "output2": [],
        }


def test_module_holds_one_shared_session():
    assert isinstance(kis._SESSION, requests.Session)


def test_session_pool_is_wide_enough_for_the_collector_workers():
    """풀보다 동시 요청이 많으면 requests 가 커넥션을 버리고 매번 새로 맺는다."""
    adapter = kis._SESSION.get_adapter("https://openapi.koreainvestment.com:9443")

    assert adapter._pool_maxsize >= 32


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
def test_every_kis_get_uses_the_shared_session(fetch, monkeypatch):
    """호출 지점을 하나라도 놓치면 그 엔드포인트만 조용히 느려진다."""
    used: list[str] = []
    monkeypatch.setattr(kis._SESSION, "get",
                        lambda *a, **kw: (used.append("session"), _Resp())[1])
    monkeypatch.setattr(kis.requests, "get",
                        lambda *a, **kw: pytest.fail("모듈 함수 requests.get 을 썼다"))

    fetch()

    assert used == ["session"]
