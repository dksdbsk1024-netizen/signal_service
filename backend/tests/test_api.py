"""FastAPI 엔드포인트 — TestClient 스모크 + 스키마 키 검증."""

from fastapi.testclient import TestClient

from backend.api.main import app
from backend.api.deps import get_macro_provider
from backend.core.providers import MacroDataProvider

# /macro 테스트는 네트워크(FRED) 대신 키 없는 MacroDataProvider 로 강제 →
# core.macro 가 전부 Mock(region 포함) 폴백 → CI 안정, 스키마 동일.
app.dependency_overrides[get_macro_provider] = lambda: MacroDataProvider(None)

client = TestClient(app)
TICKER = "005930"


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
    assert {"price", "change_pct", "volume"} <= set(body["header"])


def test_signal_entry_override_changes_plan():
    base = client.get(f"/api/signal/{TICKER}").json()["trade_plan"]
    override = client.get(f"/api/signal/{TICKER}?entry=99999").json()["trade_plan"]
    assert override["entry"] == 99999
    assert override["stop"] != base["stop"]


def test_technical_schema():
    r = client.get(f"/api/technical/{TICKER}?bars=100")
    assert r.status_code == 200
    body = r.json()
    assert len(body["candles"]) == 100
    assert {"t", "o", "h", "l", "c", "v"} <= set(body["candles"][0])
    assert {"ma5", "ma20", "ma60", "vwap", "bb_upper", "bb_mid", "bb_lower"} <= set(body["overlays"])
    assert len(body["indicators_table"]) >= 5
    assert {"name", "value", "signal"} <= set(body["indicators_table"][0])


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
    # 거래원
    assert len(body["brokers"]) == 8
    assert {"name", "buy", "sell", "net"} <= set(body["brokers"][0])
    assert body["header"]["price"] > 0


def test_macro_schema():
    r = client.get("/api/macro")
    assert r.status_code == 200
    body = r.json()
    assert body["source"] in {"fred", "mock"}
    names = {c["name"] for c in body["indicators"]}
    assert {"미국 CPI", "미국 PPI", "미국 기준금리", "미국채 10년", "한국 CPI"} <= names
    for c in body["indicators"]:
        # 스키마 유지: 실데이터/Mock 무관 동일 키
        assert {"actual", "forecast", "previous", "surprise", "as_of", "region"} <= set(c)
        assert c["region"] in {"US", "KR"}
    assert body["quotes"]["volatility"]["name"] == "VIX"
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
