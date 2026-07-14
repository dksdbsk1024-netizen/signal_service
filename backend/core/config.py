"""파라미터·기본값 단일 소스.

가중치·라벨 임계값·지표 파라미터를 여기서만 정의한다. 스코어링 로직(scoring.py)과
지표 계산(indicators.py)은 모두 이 모듈의 상수를 참조하므로, 튜닝은 이 파일만 고치면 된다.
사용자 커스터마이징(설정 패널)은 요청마다 가중치를 실어 보내는 형태다 — 전역 상태를
덮어쓰지 않는다(서버는 스테이트리스, 사용자별 가중치가 서로를 오염시키지 않는다).
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
# 카테고리별 가중치(%). 합계 100 기준. 수집기가 스냅샷을 구울 때 쓰는 기준선이고,
# 사용자가 설정 패널에서 조절하면 signal 라우트가 ?weights= 로 받아 재채점한다.
# 프리셋은 프론트(SettingsPanel)가 갖는다 — 사용자 가중치는 항상 명시적으로
# 전송되므로 백엔드가 프리셋 이름을 알 이유가 없다.
DEFAULT_WEIGHTS: dict[str, float] = {
    "flow": 30,
    "trend": 20,
    "momentum": 20,
    "volume": 15,
    "volatility": 15,
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

# 분봉 interval — KIS는 1분봉만 주고 그 위는 resample. 일봉(1d)은 별도 TR이라 미지원.
SUPPORTED_INTERVALS: tuple[str, ...] = ("1m", "5m")
INTERVAL_PATTERN = "^(1m|5m)$"

# ── 수급 정규화 ────────────────────────────────────────────────
# 순매수를 절대 금액(억원)으로 쓰면 대형주는 항상 상한에 붙는다(삼성전자 외국인 +2,700억).
# 당일 거래대금 대비 비율로 정규화해 종목 크기를 소거한다.
FLOW_HALF_RATIO = 0.05  # 거래대금의 5% 순매수 → |점수| 50
FLOW_PROGRAM_WEIGHT = 0.5  # 프로그램 순매수는 스마트머니의 절반 가중

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
