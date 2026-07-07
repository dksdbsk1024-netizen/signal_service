"""경제지표 정리 (FRED + ECOS 실데이터) — DESIGN.md §7 매크로 레이어.

미국 지표는 FRED, 한국 지표(CPI·PPI·기준금리)는 ECOS(한국은행)에서 받아 카드용
dict로 정리한다. 두 소스는 정규화된 관측치 리스트(newest-first `{date,value}`)로
통일한 뒤 동일한 index/rate 계산기를 공유한다.
- index 계열(CPI·PPI): 지수 레벨에서 전년(YoY)·전월(MoM) 변화율 산출. actual = YoY%.
- rate 계열(기준금리·국채금리): 레벨(%) 자체가 값. actual = 최신 %, 이전치 대비 bp.

FRED에 없는 값은 placeholder로 채우되 스키마(actual/forecast/previous/surprise +
as_of/mock/stale/source)는 유지:
- forecast(예상치)·다음 발표일: 경제캘린더 별도 소스 필요 → placeholder.

로직은 프레임워크 독립. requests 로 HTTP만 사용한다.
"""

from __future__ import annotations

import datetime
import time

import requests

FRED_BASE = "https://api.stlouisfed.org/fred/series/observations"
ECOS_BASE = "https://ecos.bok.or.kr/api/StatisticSearch"

# 지표 레지스트리. name → 소스별 스펙.
#   source: "fred" | "ecos"  ·  kind: "index"(YoY/MoM) | "rate"(레벨 %)
#   FRED: series(시리즈ID)  ·  ECOS: stat(통계표코드) · item(항목코드) · cycle(주기)
#   distinct_prev: rate 에서 '이전치'를 직전 관측이 아니라 마지막으로 값이 달랐던
#     레벨로 잡는다(정책금리는 여러 달 동일 → 직전=현재라 변화가 안 보이므로).
INDICATORS: dict[str, dict] = {
    "미국 CPI":      {"source": "fred", "kind": "index", "region": "US", "series": "CPIAUCSL"},
    "미국 근원 CPI": {"source": "fred", "kind": "index", "region": "US", "series": "CPILFESL"},
    # PPI 는 최종수요(Final Demand) 헤드라인 = 언론 '발표치'(PPIACO 는 변동 과도).
    "미국 PPI":      {"source": "fred", "kind": "index", "region": "US", "series": "PPIFIS"},
    "미국 기준금리": {"source": "fred", "kind": "rate",  "region": "US", "series": "FEDFUNDS"},
    "미국채 10년":   {"source": "fred", "kind": "rate",  "region": "US", "series": "DGS10"},
    # 한국 = ECOS(한국은행) 실데이터. 통계표/항목 코드는 ECOS StatisticSearch 기준.
    "한국 CPI":      {"source": "ecos", "kind": "index", "region": "KR",
                      "stat": "901Y009", "item": "0", "cycle": "M"},        # 소비자물가지수 총지수
    "한국 PPI":      {"source": "ecos", "kind": "index", "region": "KR",
                      "stat": "404Y014", "item": "*AA", "cycle": "M"},      # 생산자물가지수 총지수
    "한국 기준금리": {"source": "ecos", "kind": "rate",  "region": "KR",
                      "stat": "722Y001", "item": "0101000", "cycle": "M",   # 한국은행 기준금리
                      "distinct_prev": True},
}

# 카드 표시 순서 (미국 → 한국). 레지스트리 정의 순서를 그대로 사용.
INDICATOR_ORDER = list(INDICATORS)

# ── 안정성: 캐시 · 재시도 · stale 폴백 ─────────────────────────
# 지표마다 개별 요청하다 한 건이라도 실패하면 그 지표만 Mock 으로 떨어져, 실데이터가
# 있는데도 간헐적으로 가짜 값이 뜨는 문제가 있었다. FRED·ECOS 공통으로:
#  (a) 응답을 장중 짧게 캐시해 매 요청마다 소스를 때리지 않는다.
#  (b) fetch 실패 시 몇 차례 재시도한다.
#  (c) 재시도도 실패하면 Mock 이 아니라 '직전 캐시값 + stale 표시'를 쓴다.
CACHE_TTL_SEC = 20 * 60      # 장중 20분: 이 안에서는 재요청 없이 캐시 반환
_FETCH_RETRIES = 2           # 최초 1회 + 재시도 2회 = 총 3회 시도
_RETRY_BACKOFF_SEC = 0.5     # 재시도 간 대기(선형 백오프 * 시도횟수)

# name → {"data": indicator_dict, "ts": epoch_seconds}. 프로세스 수명 동안 유지.
_CACHE: dict[str, dict] = {}

# Mock 폴백 값(actual, previous). 키 없음/최초 fetch 실패 시 스키마 유지용.
_MOCK_VALUES: dict[str, tuple[float, float]] = {
    "미국 CPI": (3.0, 3.1), "미국 근원 CPI": (3.3, 3.4), "미국 PPI": (2.2, 2.1),
    "미국 기준금리": (4.50, 4.75), "미국채 10년": (4.20, 4.15),
    "한국 CPI": (3.1, 3.0), "한국 PPI": (2.0, 1.9), "한국 기준금리": (2.50, 2.75),
}


# ── 재시도 래퍼 (FRED·ECOS 공통) ───────────────────────────────
def _retry(fetch_once):
    """`fetch_once()` 를 최대 `_FETCH_RETRIES` 회 재시도. 모두 실패하면 마지막 예외.

    호출측(build_indicator)이 캐시/Mock 폴백을 결정하게 예외는 그대로 올린다.
    """
    last_err: Exception | None = None
    for attempt in range(_FETCH_RETRIES + 1):
        try:
            return fetch_once()
        except Exception as e:  # noqa: BLE001 — 네트워크/HTTP/JSON 모두 재시도 대상
            last_err = e
            if attempt < _FETCH_RETRIES:
                time.sleep(_RETRY_BACKOFF_SEC * (attempt + 1))
    raise last_err  # type: ignore[misc]


# ── 소스별 fetch → 정규화 관측치(newest-first `{date,value}`) ──
def _fetch_fred(series_id: str, api_key: str, limit: int = 15) -> list[dict]:
    """FRED 관측치 최신순. 값이 '.'(결측)인 항목 제외."""
    def once():
        resp = requests.get(
            FRED_BASE,
            params={
                "series_id": series_id, "api_key": api_key, "file_type": "json",
                "sort_order": "desc", "limit": limit,
            },
            timeout=10,
        )
        resp.raise_for_status()
        obs = resp.json().get("observations", [])
        return [
            {"date": o["date"], "value": o["value"]}
            for o in obs if o.get("value") not in (".", None, "")
        ]
    return _retry(once)


def _fmt_ecos_date(t: str) -> str:
    """ECOS TIME → 표시용. 202605→2026-05, 20250501→2025-05-01."""
    if len(t) == 6:
        return f"{t[:4]}-{t[4:6]}"
    if len(t) == 8:
        return f"{t[:4]}-{t[4:6]}-{t[6:]}"
    return t


def _ecos_range(cycle: str, points: int) -> tuple[str, str]:
    """오늘 기준 조회 시작/종료 문자열. 최신 발표분까지 넉넉히 포함."""
    today = datetime.date.today()
    if cycle == "M":
        y, m = today.year, today.month - points
        while m <= 0:
            m += 12
            y -= 1
        return f"{y}{m:02d}", today.strftime("%Y%m")
    # 일별
    start = today - datetime.timedelta(days=points * 31)
    return start.strftime("%Y%m%d"), today.strftime("%Y%m%d")


def _fetch_ecos(stat: str, item: str, cycle: str, api_key: str, points: int = 30) -> list[dict]:
    """ECOS StatisticSearch → 최신순 정규화 관측치. 결측(-)·에러 응답 처리."""
    start, end = _ecos_range(cycle, points)
    url = f"{ECOS_BASE}/{api_key}/json/kr/1/100/{stat}/{cycle}/{start}/{end}/{item}"

    def once():
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        payload = resp.json()
        node = payload.get("StatisticSearch")
        if not node:  # 키 오류/데이터 없음 → {"RESULT": {"CODE","MESSAGE"}}
            raise ValueError(f"ECOS {stat}: {payload}")
        rows = node.get("row", [])
        obs = [
            {"date": _fmt_ecos_date(r["TIME"]), "value": r["DATA_VALUE"]}
            for r in rows if r.get("DATA_VALUE") not in (".", None, "", "-")
        ]
        obs.reverse()  # ECOS 는 오름차순(과거→현재) → 최신순으로 뒤집는다
        return obs
    return _retry(once)


def _fetch(meta: dict, keys: dict) -> list[dict]:
    if meta["source"] == "fred":
        limit = 15 if meta["kind"] == "index" else 10
        return _fetch_fred(meta["series"], keys["fred"], limit)
    return _fetch_ecos(meta["stat"], meta["item"], meta["cycle"], keys["ecos"])


def _ref(meta: dict) -> str:
    """참고용 소스 코드(FRED 시리즈ID 또는 ECOS 통계표코드)."""
    return meta.get("series") or meta.get("stat")


# ── 지표 빌더 (정규화 관측치 → 카드 dict). FRED·ECOS 공용 ──────
def _placeholder_forecast(actual: float) -> dict:
    """예상치는 소스에 없음 → placeholder(직전 추세 근사). 스키마 유지용."""
    forecast = round(actual - 0.1, 2)  # 임시 컨센서스 근사값(placeholder)
    return {
        "forecast": forecast,
        "surprise": round(actual - forecast, 2),
        "forecast_placeholder": True,  # UI에서 '예상(추정)'으로 표시하게 하는 플래그
        "next_release": None,          # 경제캘린더 소스 연동 시 채움
    }


def _build_index(name: str, obs: list[dict], meta: dict) -> dict:
    """CPI·PPI 등 지수 → YoY/MoM. actual = YoY%(헤드라인)."""
    if len(obs) < 13:
        raise ValueError(f"{name}: 관측치 부족")
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
        "region": meta["region"],
        "kind": "index",
        "unit": "%",
        "actual": actual,            # 전년동월비(%)
        "previous": round(prev_yoy, 2),
        "yoy": actual,
        "mom": round(mom, 2),
        "level": round(latest, 3),   # 지수 원값(참고)
        "as_of": dates[0],           # 최신 관측 기준월
        "series_id": _ref(meta),
        "source": meta["source"],    # "fred" | "ecos"
        "mock": False,
        "stale": False,              # 캐시 폴백 시 True (UI '갱신 지연' 표시)
        **_placeholder_forecast(actual),
    }


def _build_rate(name: str, obs: list[dict], meta: dict) -> dict:
    """기준금리·국채금리 등 → 레벨(%) + 이전 대비 bp."""
    if len(obs) < 2:
        raise ValueError(f"{name}: 관측치 부족")
    latest = float(obs[0]["value"])
    if meta.get("distinct_prev"):
        # 정책금리: 직전 관측이 아니라 마지막으로 값이 달랐던 레벨을 '이전치'로.
        prev = next((float(o["value"]) for o in obs[1:] if float(o["value"]) != latest), latest)
    else:
        prev = float(obs[1]["value"])
    actual = round(latest, 2)
    return {
        "name": name,
        "region": meta["region"],
        "kind": "rate",
        "unit": "%",
        "actual": actual,
        "previous": round(prev, 2),
        "change_bp": round((latest - prev) * 100, 1),  # bp
        "as_of": obs[0]["date"],
        "series_id": _ref(meta),
        "source": meta["source"],    # "fred" | "ecos"
        "mock": False,
        "stale": False,              # 캐시 폴백 시 True (UI '갱신 지연' 표시)
        **_placeholder_forecast(actual),
    }


def _mock_indicator(name: str) -> dict:
    """실패/미지원/키없음 폴백. 스키마 동일 유지(index/rate 필드 포함)."""
    meta = INDICATORS.get(name, {"region": "US", "kind": "rate", "source": "fred"})
    actual, previous = _MOCK_VALUES.get(name, (3.0, 3.1))
    data = {
        "name": name,
        "region": meta["region"],
        "kind": meta["kind"],
        "unit": "%",
        "actual": actual,
        "previous": previous,
        "as_of": "Mock",
        "series_id": None,
        "source": "mock",            # UI 배지: 실데이터가 아님
        "mock": True,
        "stale": False,
        **_placeholder_forecast(actual),
    }
    if meta["kind"] == "index":
        data.update({"yoy": actual, "mom": round(actual - previous, 2), "level": 100.0})
    else:
        data.update({"change_bp": round((actual - previous) * 100, 1)})
    return data


def build_indicator(name: str, fred_key: str | None = None, ecos_key: str | None = None) -> dict:
    """지표 하나 정리. 캐시 → 소스(재시도) → stale 캐시 → Mock 순 폴백.

    - 미지원 지표/해당 소스 키 없음: 즉시 Mock.
    - 신선한 캐시(TTL 내): 재요청 없이 그대로.
    - fetch 성공: 캐시 갱신 후 반환.
    - fetch 실패(재시도까지): 직전 실데이터 캐시가 있으면 stale 로, 없으면 Mock.
    """
    meta = INDICATORS.get(name)
    keys = {"fred": fred_key, "ecos": ecos_key}
    if meta is None or not keys.get(meta["source"]):
        return _mock_indicator(name)

    now = time.time()
    cached = _CACHE.get(name)
    # (a) 신선한 캐시 → 소스 안 때리고 반환. 매 새로고침 값 안정 + 폴백 튐 방지.
    if cached and now - cached["ts"] < CACHE_TTL_SEC:
        return dict(cached["data"])

    try:
        # (b) fetch 는 내부에서 재시도. 성공하면 캐시 갱신.
        obs = _fetch(meta, keys)
        data = _build_index(name, obs, meta) if meta["kind"] == "index" else _build_rate(name, obs, meta)
        _CACHE[name] = {"data": data, "ts": now}
        return dict(data)
    except Exception:
        # (c) 재시도까지 실패. 직전 실데이터가 있으면 Mock 대신 '오래된 캐시'.
        if cached:
            stale = dict(cached["data"])
            stale["stale"] = True  # UI '갱신 지연(캐시)' 표시
            return stale
        # 캐시가 아예 없던 최초 실패만 부득이 Mock 폴백.
        return _mock_indicator(name)


def get_macro_indicators(fred_key: str | None = None, ecos_key: str | None = None) -> list[dict]:
    """탭4 경제지표 섹션용 카드 리스트."""
    return [build_indicator(name, fred_key, ecos_key) for name in INDICATOR_ORDER]
