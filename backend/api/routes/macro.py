"""매크로 (탭4).

경제지표(섹션 A)는 core.macro 를 통해 FRED/ECOS 실데이터(키 있을 때)로 제공한다.
시세(섹션 B, 지수·환율·VIX)는 core.quotes 를 통해 yfinance 실데이터(키 불필요)로
제공한다. 발표 캘린더(calendar)는 core.calendar 의 확정 상수 + 규칙 추정으로 오늘
기준 D-day 를 실시간 계산한다. 개별 fetch 실패는 지표/시세 단위로 Mock·stale 폴백하므로
응답 스키마는 항상 동일하다.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from ...core import macro as macro_core
from ..deps import MACRO_SOURCE, get_macro_provider

router = APIRouter(prefix="/api", tags=["macro"])


@router.get("/macro")
def get_macro(provider=Depends(get_macro_provider)):
    # 섹션 A · 경제지표 (미국 FRED 실데이터 + 한국 일부 + Mock 폴백)
    indicators = [provider.get_economic_indicator(n) for n in macro_core.INDICATOR_ORDER]

    # 섹션 B · 시세 (yfinance 실데이터, 실시간 시세)
    indices = [provider.get_index(n) for n in ("코스피", "코스닥", "S&P500", "나스닥")]
    fx = provider.get_fx("USD/KRW")
    volatility = provider.get_volatility()
    # 섹션 헤더용 종합 source/as_of. 실데이터가 하나라도 있으면 yfinance.
    all_q = [*indices, fx, volatility]
    section_source = "yfinance" if any(not q["mock"] for q in all_q) else "mock"
    section_as_of = next((q["as_of"] for q in all_q if not q["mock"]), "Mock")
    quotes = {
        "indices": indices,
        "fx": fx,
        "volatility": volatility,
        "source": section_source,  # "yfinance" | "mock"
        "as_of": section_as_of,    # 최신 종가 기준일
    }

    return {
        "source": MACRO_SOURCE,  # "fred" | "mock"
        "indicators": indicators,
        "calendar": provider.get_release_calendar(),
        "quotes": quotes,
    }
