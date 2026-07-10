"""매크로 (탭4).

경제지표(섹션 A)는 core.macro 를 통해 FRED/ECOS 실데이터(키 있을 때)로 제공한다.
시세(섹션 B, 지수·환율·VIX)는 core.quotes 를 통해 yfinance 실데이터(키 불필요)로
제공한다. 발표 캘린더(calendar)는 core.calendar 의 확정 상수 + 규칙 추정으로 오늘
기준 D-day 를 실시간 계산한다. 개별 fetch 실패는 지표/시세 단위로 Mock·stale 폴백하므로
응답 스키마는 항상 동일하다.

성능: 지표(FRED)와 시세(yfinance)는 서로 독립적인 외부 호출이라 콜드 캐시에서 순차로
받으면 초 단위로 쌓인다(yfinance history 는 호출당 1~3초). 그래서 각 그룹 안의 개별
fetch 를 ThreadPoolExecutor 로 동시에 던진다 — 총 지연이 '합'이 아니라 '가장 느린 하나'로
수렴한다. build_indicator/build_quote 는 각자 자기 모듈 캐시에만 쓰므로 스레드 안전하다.
프론트가 섹션별로 나눠 받을 수 있게 /macro/base·/indicators·/quotes 도 함께 노출한다.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends

from ...core import macro as macro_core
from ..deps import MACRO_SOURCE, get_macro_provider

router = APIRouter(prefix="/api", tags=["macro"])

# 시세 지수 4종(표시명 순서 = 프론트 카드 순서).
_INDEX_NAMES = ("코스피", "코스닥", "S&P500", "나스닥")


def _fetch_indicators(provider) -> list[dict]:
    """경제지표 5종을 동시에 fetch. 순서는 INDICATOR_ORDER 유지."""
    with ThreadPoolExecutor(max_workers=len(macro_core.INDICATOR_ORDER) or 1) as ex:
        futs = [ex.submit(provider.get_economic_indicator, n) for n in macro_core.INDICATOR_ORDER]
        return [f.result() for f in futs]


def _fetch_quotes(provider) -> dict:
    """지수·환율·VIX 6종을 동시에 fetch 후 섹션 스키마로 조립."""
    with ThreadPoolExecutor(max_workers=len(_INDEX_NAMES) + 2) as ex:
        idx_futs = [ex.submit(provider.get_index, n) for n in _INDEX_NAMES]
        fx_fut = ex.submit(provider.get_fx, "USD/KRW")
        vol_fut = ex.submit(provider.get_volatility)
        indices = [f.result() for f in idx_futs]
        fx = fx_fut.result()
        volatility = vol_fut.result()

    # 섹션 헤더용 종합 source/as_of. 실데이터가 하나라도 있으면 yfinance.
    all_q = [*indices, fx, volatility]
    section_source = "yfinance" if any(not q["mock"] for q in all_q) else "mock"
    section_as_of = next((q["as_of"] for q in all_q if not q["mock"]), "Mock")
    return {
        "indices": indices,
        "fx": fx,
        "volatility": volatility,
        "source": section_source,  # "yfinance" | "mock"
        "as_of": section_as_of,    # 최신 종가 기준일
    }


@router.get("/macro")
def get_macro(provider=Depends(get_macro_provider)):
    """통합 엔드포인트(하위호환). 지표·시세 그룹은 각각 내부에서 병렬 fetch."""
    return {
        "source": MACRO_SOURCE,  # "live" | "mock"
        "indicators": _fetch_indicators(provider),
        "calendar": provider.get_release_calendar(),  # 네트워크 없음 — 즉시
        "quotes": _fetch_quotes(provider),
    }


@router.get("/macro/base")
def get_macro_base(provider=Depends(get_macro_provider)):
    """즉시 응답용 — 네트워크가 필요 없는 부분(소스 배지 + 발표 캘린더)만.
    프론트가 이걸 먼저 받아 화면 뼈대를 즉시 그리고, 지표/시세는 뒤이어 채운다."""
    return {"source": MACRO_SOURCE, "calendar": provider.get_release_calendar()}


@router.get("/macro/indicators")
def get_macro_indicators(provider=Depends(get_macro_provider)):
    """섹션 A · 경제지표만. 프론트 병렬 fetch 용."""
    return {"source": MACRO_SOURCE, "indicators": _fetch_indicators(provider)}


@router.get("/macro/quotes")
def get_macro_quotes(provider=Depends(get_macro_provider)):
    """섹션 B · 시세만. 프론트 병렬 fetch 용."""
    return {"quotes": _fetch_quotes(provider)}
