# 기술적 분석 탭(탭2) 지표 4종 추가 — 설계

날짜: 2026-07-07
범위: 백엔드 `indicators.py`·`scoring.py`·`config.py`·`api/routes/technical.py`, 프론트 `TechnicalTab.jsx`

## 목적

탭2에 지표 4개를 두 그룹으로 추가한다.

- **그룹 A (스코어링 반영)**: OBV 다이버전스 → 수급(flow), ATR밴드 위치 → 변동성(volatility).
- **그룹 B (차트 오버레이 전용)**: 이치모쿠(일목균형표), 피보나치 되돌림.

지표 온/오프 세밀 UI는 다음 단계. 신규 2개 오버레이용 ToggleChip만 추가한다.

## 아키텍처 배경 (현행)

- `indicators.py` — 순수 함수 per 지표 + `compute_indicators()` → `IndicatorSet`(카테고리: flow/trend/momentum/volume/volatility + last_close/last_atr).
- `scoring.py` — per-지표 정규화 함수 → `_category_scores()`(카테고리 = 세부지표 점수의 **단순평균** `avg`) → `score_stock()`이 **카테고리** 단위 가중합, `ContributionEntry`(+`detail` dict) 생성.
- `config.py` — `CATEGORIES`, `DEFAULT_WEIGHTS`(카테고리별, 합 100), 지표 파라미터.
- `technical.py` — candles + `overlays` dict + `indicators_table`.
- `TechnicalTab.jsx` — `OverlayLayer`가 `buildScale`(CandleChart와 1:1 스케일 재현)로 라인 그림. `ToggleChip` per 오버레이.

핵심: 가중치는 **카테고리 단위**다. OBV→flow, ATR밴드→volatility 추가는 카테고리 개수를 바꾸지 않고 카테고리 **내부 구성**만 바꾼다. 따라서 카테고리 가중치(flow30/volat15 등)는 불변, 전체 합 100 유지.

## 그룹 A — 스코어링

### config.py 추가

```python
OBV_LOOKBACK = 20          # OBV 다이버전스 판정 창
ATR_BAND_MULT = 2.0        # ATR밴드 폭 배수

# 카테고리 내부 세부지표 비중. 사용 시 각 카테고리 값 합=1로 재정규화.
# 전부 1.0 = 기존 단순평균과 동일 → 미변경 카테고리(trend/momentum/volume) 결과 불변.
INDICATOR_WEIGHTS: dict[str, dict[str, float]] = {
    "trend": {"ma_alignment": 1.0, "price_vs_vwap": 1.0},
    "momentum": {"rsi": 1.0, "macd_hist": 1.0, "stoch": 1.0},
    "volume": {"surge": 1.0},
    "volatility": {"pct_b": 1.0, "atr_band": 1.0},
    "flow": {"smart_money": 1.0, "obv": 1.0},
}
```

`DEFAULT_WEIGHTS`(카테고리 합 100)는 변경 없음. "재정규화"는 카테고리 **내부** 세부지표 비중을 합=1로 맞추는 것을 뜻한다.

### indicators.py 추가

```python
def obv(close, volume) -> pd.Series:
    """On-Balance Volume. 종가 상승봉 +거래량, 하락봉 -거래량 누적."""
    direction = np.sign(close.diff().fillna(0.0))
    return (direction * volume).cumsum()

def obv_divergence(close, volume, lookback=config.OBV_LOOKBACK) -> float:
    """창 내 OBV 상대강도 − 가격 상대강도. −1~+1 근사.
    가격↓·OBV↑ = 상승 다이버전스(+), 가격↑·OBV↓ = 하락(−), 동행 = ~0."""
    # 각 변화량을 창 내 범위로 정규화 후 차이.

def atr_band(high, low, close, period=config.BB_PERIOD, mult=config.ATR_BAND_MULT):
    """→ (upper, mid, lower). mid=SMA(close,period), 폭=mult×ATR(14)."""

def atr_band_position(high, low, close, ...) -> float:
    """(close − lower)/(upper − lower). 0=하단, 1=상단."""
```

`compute_indicators()`:
- flow dict = `{**flow_metrics(...), "obv": obv_divergence(close, volume)}`
- volatility dict = `{"pct_b": ..., "atr_band": atr_band_position(high, low, close)}`

### scoring.py 추가/변경

```python
def score_obv(divergence: float) -> float:
    """OBV 다이버전스 −1~+1 → 정규화. 상승 다이버전스 = +."""
    return clamp(divergence * 100)  # K는 튜닝

def score_atr_band(pos: float) -> float:
    """ATR밴드 위치 0~1. 상단=+100, 하단=−100, 중앙=0. score_pct_b 동형."""
    return clamp((pos - 0.5) * 200)
```

`_category_scores()`:
- `flow_detail`에 `"obv": score_obv(ind.flow["obv"])` 추가.
- `volatility_detail`에 `"atr_band": score_atr_band(ind.volatility["atr_band"])` 추가.
- `avg(d)` → 카테고리별 `INDICATOR_WEIGHTS` 가중평균. 카테고리 내 가중 합으로 나눠 재정규화(합=1). 전부 1.0인 카테고리는 기존 단순평균과 동일.

ContributionEntry.detail이 flow/volatility 카테고리에서 새 지표를 그대로 노출 → ContributionBar·indicators_table 반영.

### technical.py

`indicators_table`에 2행 추가: "OBV 다이버전스"(`score_obv`), "ATR밴드 위치"(`score_atr_band`).

## 그룹 B — 차트 오버레이 (스코어 무관)

### indicators.py

```python
def ichimoku(high, low, close, conv=9, base=26, span_b=52, disp=26):
    """→ (tenkan, kijun, senkou_a, senkou_b, chikou).
    선행스팬 shift(+disp), 후행스팬 shift(−disp). 캔들길이 배열 유지,
    마지막 캔들 너머 미래 구름은 드롭(분봉 스캘핑엔 최근 구름이 핵심)."""

def fibonacci_levels(high, low) -> dict:
    """bars 범위 스윙 고/저 자동. 저점·고점 인덱스로 상승/하락 방향 판정.
    ratios 0/0.236/0.382/0.5/0.618/1.0 → {swing_high, swing_low, direction, levels:[{ratio, price}]}."""
```

### technical.py

`overlays`에 추가:
- `ichimoku`: `{tenkan, kijun, senkou_a, senkou_b, chikou}` (각 `_clean` 배열).
- `fibonacci`: `fibonacci_levels(...)` 결과.

### TechnicalTab.jsx

- `show` state에 `ichimoku`, `fib` 추가. ToggleChip 2개 추가.
- `OverlayLayer`:
  - 이치모쿠: 전환·기준·선행A·선행B·후행 라인. 선행A/B 사이 **반투명 폴리곤**(구름). 색: 초기 단일 반투명(A≥B 초록 계열), 2색 분할은 후속.
  - 피보나치: 각 레벨 수평선(dashed) + 비율 라벨.
- 범례에 이치모쿠·피보 항목 추가.

## 검증

**pytest**
- 신규 지표 수치 테스트: `obv`(상승장 단조증가), `obv_divergence`(다이버전스 부호), `atr_band`/`atr_band_position`(경계), `ichimoku`(전환>기준 상승장), `fibonacci_levels`(0%=고점,100%=저점, 방향).
- 스코어링: flow.detail에 `obv`, volatility.detail에 `atr_band` 존재. 기여도 합 ≈ 최종. `sum(DEFAULT_WEIGHTS.values()) == 100`. 각 카테고리 `INDICATOR_WEIGHTS` 재정규화 검증(전부 1.0 카테고리는 기존값 불변 — 기존 scoring 테스트 통과로 회귀 확인).

**브라우저**
- 탭2 로드 → 이치모쿠 토글 → 구름·라인 렌더. 피보나치 토글 → 수평선 렌더. 스크린샷.

## 범위 밖

- 지표 온/오프 세밀 설정 패널.
- 이치모쿠 미래 구름 x축 확장 렌더.
- 구름 2색(강세/약세) 분할 — 후속 개선.
