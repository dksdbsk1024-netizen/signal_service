"""FastAPI 엔드포인트 — TestClient 스모크 + 스키마 키 검증."""

import pytest
from fastapi.testclient import TestClient

from backend.api.main import app

# /macro 의 오프라인 강제는 conftest 의 환경변수(FRED/ECOS 빈 키 + MACRO_LIVE_QUOTES=0)가
# 한다 — 여기서 dependency_overrides 로 막으면 그 가드가 뚫려도 아무 테스트가 못 잡는다.
client = TestClient(app)
TICKER = "005930"


def test_stock_provider_is_mock_under_pytest():
    """conftest 의 STOCK_PROVIDER=mock 가 먹혔는지. 실패하면 테스트가 실 KIS 를 때린다."""
    from backend.api import deps

    assert deps.STOCK_SOURCE == "mock"


def test_macro_provider_is_offline_under_pytest():
    """conftest 의 매크로 오프라인 강제. 실패하면 테스트가 실 FRED/ECOS/yfinance 를 때린다.

    셋 다 봐야 한다 — 키를 비워도 yfinance 시세는 네트워크를 탄다.
    """
    from backend.api import deps

    assert not deps.MACRO_PROVIDER.fred_key
    assert not deps.MACRO_PROVIDER.ecos_key
    assert deps.MACRO_PROVIDER.live_quotes is False
    assert deps.MACRO_SOURCE == "mock"


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_signal_schema():
    r = client.get(f"/api/signal/{TICKER}")
    assert r.status_code == 200
    body = r.json()
    assert body["ticker"] == TICKER
    # 게이지
    sig = body["signal"]
    assert -100 <= sig["final_score"] <= 100
    assert sig["label"] in {"적극매수", "매수", "중립", "매도", "적극매도"}
    # ContributionBar — 5개 카테고리, 필수 키
    assert len(sig["contributions"]) == 5
    c0 = sig["contributions"][0]
    assert {"category", "name", "score", "weight", "contribution", "detail"} <= set(c0)
    # 매매계획
    plan = body["trade_plan"]
    assert "stop" in plan and "targets" in plan
    assert plan["position"]["qty"] >= 0
    # 헤더
    assert {"price", "change_pct", "volume", "source", "mock"} <= set(body["header"])
    assert body["header"]["market_status"] in {"open", "after", "closed"}


def test_signal_entry_override_changes_plan():
    base = client.get(f"/api/signal/{TICKER}").json()["trade_plan"]
    override = client.get(f"/api/signal/{TICKER}?entry=99999").json()["trade_plan"]
    assert override["entry"] == 99999
    assert override["stop"] != base["stop"]


@pytest.mark.parametrize("interval", ["1m", "5m"])
def test_technical_accepts_supported_intervals(interval):
    assert client.get(f"/api/technical/{TICKER}?interval={interval}").status_code == 200


@pytest.mark.parametrize("interval", ["1d", "1h", "abc", "", "1m; drop"])
def test_technical_rejects_bad_interval_with_422(interval):
    """검증 없이 넘기면 KIS 경로에서 ValueError → 500. 422로 막는다."""
    assert client.get(f"/api/technical/{TICKER}?interval={interval}").status_code == 422


def test_technical_schema():
    r = client.get(f"/api/technical/{TICKER}?bars=100")
    assert r.status_code == 200
    body = r.json()
    assert len(body["candles"]) == 100
    assert {"t", "o", "h", "l", "c", "v"} <= set(body["candles"][0])
    assert {"ma5", "ma20", "ma60", "vwap", "bb_upper", "bb_mid", "bb_lower"} <= set(body["overlays"])
    assert len(body["indicators_table"]) >= 5
    assert {"name", "value", "signal"} <= set(body["indicators_table"][0])
    # 신규 오버레이
    assert {"ichimoku", "fibonacci"} <= set(body["overlays"])
    ichi = body["overlays"]["ichimoku"]
    assert {"tenkan", "kijun", "senkou_a", "senkou_b", "chikou"} <= set(ichi)
    assert len(ichi["tenkan"]) == 100
    fib = body["overlays"]["fibonacci"]
    assert {"swing_high", "swing_low", "direction", "levels"} <= set(fib)
    assert len(fib["levels"]) == 6
    # 테이블에 신규 지표 행
    names = {row["name"] for row in body["indicators_table"]}
    assert {"OBV 다이버전스", "ATR밴드 위치"} <= names


def test_flow_schema():
    r = client.get(f"/api/flow/{TICKER}")
    assert r.status_code == 200
    body = r.json()
    assert {"foreign", "institution", "program"} <= set(body["investor_flow"])
    assert len(body["orderbook"]["asks"]) == 10
    assert "strength" in body["trade_strength"]
    # 순매수 추이 시계열
    series = body["series"]
    assert {"dates", "foreign", "institution", "program"} <= set(series)
    assert len(series["dates"]) == len(series["foreign"]) == 20
    # 거래원 — 매도 상위 / 매수 상위는 창구 집합이 달라 분리해 낸다.
    brokers = body["brokers"]
    assert len(brokers["sellers"]) == len(brokers["buyers"]) == 5
    assert {"rank", "name", "qty", "pct", "foreign"} <= set(brokers["sellers"][0])
    assert {"sell_qty", "buy_qty", "net_qty"} <= set(brokers["foreign"])
    assert body["header"]["price"] > 0


def test_macro_schema():
    r = client.get("/api/macro")
    assert r.status_code == 200
    body = r.json()
    assert body["source"] in {"live", "mock"}
    names = {c["name"] for c in body["indicators"]}
    assert {"미국 CPI", "미국 PPI", "미국 기준금리", "미국채 10년", "한국 CPI", "한국 기준금리"} <= names
    for c in body["indicators"]:
        # 스키마 유지: 실데이터/Mock 무관 동일 키 (source 로 FRED/ECOS/Mock 구분)
        assert {"actual", "forecast", "previous", "surprise", "as_of", "region", "source"} <= set(c)
        assert c["region"] in {"US", "KR"}
        assert c["source"] in {"fred", "ecos", "mock"}
    # 시세(섹션 B): yfinance 실데이터/Mock 무관 동일 스키마 (source·as_of·mock·stale)
    quotes = body["quotes"]
    assert quotes["source"] in {"yfinance", "mock"}
    assert quotes["volatility"]["name"] == "VIX"
    assert len(quotes["indices"]) == 4
    for q in [*quotes["indices"], quotes["fx"], quotes["volatility"]]:
        assert {"name", "value", "change_pct", "as_of", "source", "mock", "stale"} <= set(q)
        assert q["source"] in {"yfinance", "mock"}
    assert quotes["fx"]["pair"] == "USD/KRW"
    assert len(body["calendar"]) >= 1


def test_screener_schema():
    r = client.get("/api/screener")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == len(body["rows"])
    scores = [row["final_score"] for row in body["rows"]]
    assert scores == sorted(scores, reverse=True)  # 내림차순
    assert {"ticker", "name", "final_score", "label", "top_contributor"} <= set(body["rows"][0])


def test_cors_header_present():
    r = client.get(f"/api/signal/{TICKER}", headers={"Origin": "http://localhost:5173"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"
