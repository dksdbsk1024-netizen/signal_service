"""파라미터·기본값 단일 소스.

가중치·라벨 임계값·지표 파라미터를 여기서만 정의한다. 스코어링 로직(scoring.py)과
지표 계산(indicators.py)은 모두 이 모듈의 상수를 참조하므로, 튜닝은 이 파일만 고치면 된다.
사용자 커스터마이징(설정 패널)은 DEFAULT_WEIGHTS를 런타임에 덮어쓰는 형태로 이뤄진다.
"""

from __future__ import annotations

# ── 지표 카테고리 ──────────────────────────────────────────────
# 스코어는 카테고리 단위로 가중합된다. 순서는 UI 기여도 막대 기본 정렬에도 쓰인다.
CATEGORIES: list[str] = ["flow", "trend", "momentum", "volume", "volatility"]

# 한글 라벨 (UI 표기용). 영문 키 ↔ 한글 표시 매핑.
CATEGORY_LABELS: dict[str, str] = {
    "flow": "수급",
    "trend": "추세",
    "momentum": "모멘텀",
    "volume": "거래량",
    "volatility": "변동성",
}

# ── 가중치 ─────────────────────────────────────────────────────
# 카테고리별 가중치(%). 합계 100 기준. 사용자가 설정에서 조절.
DEFAULT_WEIGHTS: dict[str, float] = {
    "flow": 30,
    "trend": 20,
    "momentum": 20,
    "volume": 15,
    "volatility": 15,
}

# 프리셋 — 설정 패널의 "수급 중시 / 모멘텀 중시 / 균형". 각 합계 100.
PRESETS: dict[str, dict[str, float]] = {
    "수급중시": {"flow": 45, "trend": 15, "momentum": 15, "volume": 15, "volatility": 10},
    "모멘텀중시": {"flow": 20, "trend": 20, "momentum": 35, "volume": 15, "volatility": 10},
    "균형": {"flow": 20, "trend": 20, "momentum": 20, "volume": 20, "volatility": 20},
}

# ── 라벨 밴드 (DESIGN.md §8) ────────────────────────────────────
# (low, high, label). 최종 스코어(-100~+100)를 5단계로 매핑.
# 경계는 [low, high) 반열림, 최상단 밴드만 100 포함. 양수 = 매수 우호(국내 관습: 빨강).
LABEL_BANDS: list[tuple[float, float, str]] = [
    (60, 100, "적극매수"),
    (20, 60, "매수"),
    (-20, 20, "중립"),
    (-60, -20, "매도"),
    (-100, -60, "적극매도"),
]

# ── 지표 파라미터 ──────────────────────────────────────────────
RSI_PERIOD = 14
MACD_FAST, MACD_SLOW, MACD_SIGNAL = 12, 26, 9
STOCH_K, STOCH_D, STOCH_SMOOTH = 14, 3, 3
BB_PERIOD, BB_STD = 20, 2.0
ATR_PERIOD = 14
MA_PERIODS: list[int] = [5, 20, 60]
VOL_LOOKBACK = 20  # 거래량 급증 판정 기준 이동평균 기간
OBV_LOOKBACK = 20  # OBV 다이버전스 판정 창
ATR_BAND_MULT = 2.0  # ATR밴드 폭 배수 (중심 SMA ± mult×ATR)

# ── 카테고리 내부 세부지표 가중치 ──────────────────────────────
# 각 카테고리 점수 = 세부지표 점수의 가중평균(사용 시 카테고리 내 합=1로 재정규화).
# 전부 1.0 = 단순평균과 동일 → 미변경 카테고리(trend/momentum/volume) 결과 불변.
# 카테고리 총가중(DEFAULT_WEIGHTS)은 그대로이므로 전체 합 100 유지.
INDICATOR_WEIGHTS: dict[str, dict[str, float]] = {
    "trend": {"ma_alignment": 1.0, "price_vs_vwap": 1.0},
    "momentum": {"rsi": 1.0, "macd_hist": 1.0, "stoch": 1.0},
    "volume": {"surge": 1.0},
    "volatility": {"pct_b": 1.0, "atr_band": 1.0},
    "flow": {"smart_money": 1.0, "obv": 1.0},
}

# ── 리스크 계산 (탭1 매매계획) ──────────────────────────────────
# ATR 배수 — 손절/목표 후보. 손절은 1×ATR, 목표는 1.5×/2× 등으로 조합해 R:R 산출.
ATR_MULTIPLES: list[float] = [1.0, 1.5, 2.0]
