"""매크로 (탭4).

경제지표(섹션 A)는 core.macro 를 통해 FRED 실데이터(키 있을 때)로 제공한다.
시세(섹션 B, 지수·환율·VIX)와 발표 캘린더는 아직 Mock. 지표별 fetch 실패는
core.macro 가 Mock 으로 폴백하므로 응답 스키마는 항상 동일하다.
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

    # 섹션 B · 시세 (Mock 유지)
    quotes = {
        "indices": [provider.get_index(n) for n in ("코스피", "코스닥", "S&P500", "나스닥")],
        "fx": provider.get_fx("USD/KRW"),
        "volatility": provider.get_volatility(),
    }

    return {
        "source": MACRO_SOURCE,  # "fred" | "mock"
        "indicators": indicators,
        "calendar": provider.get_release_calendar(),
        "quotes": quotes,
    }
