"""경제지표 정리 (FRED 실데이터) — DESIGN.md §7 매크로 레이어.

FRED에서 미국(+FRED 제공 한국) 경제지표를 받아 카드용 dict로 정리한다.
- index 계열(CPI·PPI): 지수 레벨에서 전년(YoY)·전월(MoM) 변화율 산출. actual = YoY%(헤드라인 물가).
- rate 계열(기준금리·국채금리): 레벨(%) 자체가 값. actual = 최신 %, 이전치 대비 bp 변화.

FRED에 없는 값은 placeholder로 채우되 스키마(actual/forecast/previous/surprise + as_of)는 유지:
- forecast(예상치)·다음 발표일: 경제캘린더 별도 소스 필요 → placeholder. 나중에 그 소스만 붙이면 됨.
- 한국 기준금리: FRED 시리즈가 애매/불연속 → Mock 처리(mock=True 표시).

로직은 프레임워크 독립. requests 로 HTTP만 사용한다.
"""

from __future__ import annotations

import requests

FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"

# name → (series_id, kind, region). kind: "index"(YoY/MoM) | "rate"(레벨 %).
FRED_SERIES: dict[str, tuple[str, str, str]] = {
    "미국 CPI": ("CPIAUCSL", "index", "US"),
    "미국 근원 CPI": ("CPILFESL", "index", "US"),
    "미국 PPI": ("PPIACO", "index", "US"),
    "미국 기준금리": ("FEDFUNDS", "rate", "US"),
    "미국채 10년": ("DGS10", "rate", "US"),
    # OECD 기준 한국 CPI (지수 2015=100, 월간). FRED 제공.
    "한국 CPI": ("KORCPIALLMINMEI", "index", "KR"),
}

# FRED에 신뢰할 시리즈가 없어 Mock 으로 두는 지표 (주석 표시).
MOCK_ONLY = {
    "한국 기준금리": {"region": "KR", "unit": "%", "actual": 2.50, "previous": 2.75},
}

_UNIT = {"index": "%", "rate": "%"}


def fetch_fred_observations(series_id: str, api_key: str, limit: int = 15) -> list[dict]:
    """FRED 관측치 최신순. 값이 '.'(결측)인 항목은 제외."""
    resp = requests.get(
        FRED_BASE,
        params={
            "series_id": series_id,
            "api_key": api_key,
            "file_type": "json",
            "sort_order": "desc",
            "limit": limit,
        },
        timeout=10,
    )
    resp.raise_for_status()
    obs = resp.json().get("observations", [])
    return [o for o in obs if o.get("value") not in (".", None, "")]


def _placeholder_forecast(actual: float) -> dict:
    """예상치는 FRED에 없음 → placeholder(직전 추세 근사). 스키마 유지용."""
    forecast = round(actual - 0.1, 2)  # 임시 컨센서스 근사값(placeholder)
    return {
        "forecast": forecast,
        "surprise": round(actual - forecast, 2),
        "forecast_placeholder": True,  # UI에서 '예상(추정)'으로 표시하게 하는 플래그
        "next_release": None,  # 경제캘린더 소스 연동 시 채움
    }


def _build_index_indicator(name, series_id, region, api_key) -> dict:
    """CPI·PPI 등 지수 → YoY/MoM. actual = YoY%(헤드라인)."""
    obs = fetch_fred_observations(series_id, api_key, limit=15)
    if len(obs) < 13:
        raise ValueError(f"{series_id}: 관측치 부족")
    vals = [float(o["value"]) for o in obs]  # 최신순
    dates = [o["date"] for o in obs]
    latest, prev, year_ago = vals[0], vals[1], vals[12]
    prev_year_ago = vals[13] if len(vals) > 13 else vals[12]

    yoy = (latest / year_ago - 1) * 100
    prev_yoy = (prev / prev_year_ago - 1) * 100
    mom = (latest / prev - 1) * 100
    actual = round(yoy, 2)

    return {
        "name": name,
        "region": region,
        "kind": "index",
        "unit": "%",
        "actual": actual,            # 전년동월비(%)
        "previous": round(prev_yoy, 2),
        "yoy": actual,
        "mom": round(mom, 2),
        "level": round(latest, 3),   # 지수 원값(참고)
        "as_of": dates[0],           # 최신 관측 기준월
        "series_id": series_id,
        "mock": False,
        **_placeholder_forecast(actual),
    }


def _build_rate_indicator(name, series_id, region, api_key) -> dict:
    """기준금리·국채금리 등 → 레벨(%) + 이전 대비 bp."""
    obs = fetch_fred_observations(series_id, api_key, limit=10)
    if len(obs) < 2:
        raise ValueError(f"{series_id}: 관측치 부족")
    latest, prev = float(obs[0]["value"]), float(obs[1]["value"])
    actual = round(latest, 2)
    return {
        "name": name,
        "region": region,
        "kind": "rate",
        "unit": "%",
        "actual": actual,
        "previous": round(prev, 2),
        "change_bp": round((latest - prev) * 100, 1),  # bp
        "as_of": obs[0]["date"],
        "series_id": series_id,
        "mock": False,
        **_placeholder_forecast(actual),
    }


def _mock_indicator(name: str) -> dict:
    """FRED 실패/미지원 지표의 Mock 폴백. 스키마 동일 유지."""
    base = MOCK_ONLY.get(name, {"region": "US", "unit": "%", "actual": 3.0, "previous": 3.1})
    actual = base["actual"]
    return {
        "name": name,
        "region": base["region"],
        "kind": "rate",
        "unit": base.get("unit", "%"),
        "actual": actual,
        "previous": base["previous"],
        "as_of": "Mock",
        "series_id": None,
        "mock": True,  # UI에서 'Mock' 배지
        **_placeholder_forecast(actual),
    }


def build_indicator(name: str, api_key: str | None) -> dict:
    """지표 하나 정리. api_key 없거나 FRED 실패 시 Mock 폴백."""
    if name in MOCK_ONLY or not api_key:
        return _mock_indicator(name)
    if name not in FRED_SERIES:
        return _mock_indicator(name)
    series_id, kind, region = FRED_SERIES[name]
    try:
        if kind == "index":
            return _build_index_indicator(name, series_id, region, api_key)
        return _build_rate_indicator(name, series_id, region, api_key)
    except Exception:
        # 네트워크·키·스키마 문제 → 해당 지표만 Mock 폴백 (앱이 안 죽게)
        return _mock_indicator(name)


# 카드 표시 순서 (미국 → 한국).
INDICATOR_ORDER = [
    "미국 CPI", "미국 근원 CPI", "미국 PPI", "미국 기준금리", "미국채 10년",
    "한국 CPI", "한국 기준금리",
]


def get_macro_indicators(api_key: str | None) -> list[dict]:
    """탭4 경제지표 섹션용 카드 리스트."""
    return [build_indicator(name, api_key) for name in INDICATOR_ORDER]
