# 탭2 지표 4종 추가 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 탭2에 OBV 다이버전스·ATR밴드(스코어링)와 이치모쿠·피보나치(차트 오버레이)를 추가한다.

**Architecture:** 백엔드는 순수 지표 함수(`indicators.py`) → 정규화·가중(`scoring.py`, 카테고리 내부 세부지표 가중치를 `config.INDICATOR_WEIGHTS`로 재정규화) → 라우트(`technical.py`)가 candles/overlays/table 조립. 프론트 `TechnicalTab.jsx`의 `OverlayLayer`가 오버레이를 SVG로 그린다.

**Tech Stack:** Python 3 / pandas / numpy / FastAPI / pytest, React(JSX)/Vite.

## Global Constraints

- 부호 규약: 양수 = 매수 우호, 음수 = 매도 우호. clamp 범위 −100~+100.
- 지표 함수는 외부 TA 라이브러리 금지 — pandas/numpy 직접 구현(로직 투명성).
- 카테고리 가중치 `DEFAULT_WEIGHTS` 합 = 100 불변. 카테고리 내부 세부지표는 `INDICATOR_WEIGHTS`로 합=1 재정규화.
- `INDICATOR_WEIGHTS` 값 전부 1.0 = 기존 단순평균과 동일 → 미변경 카테고리(trend/momentum/volume) 회귀 없음.
- OHLCV = open/high/low/close/volume 컬럼, 시간 오름차순 DataFrame.
- 테스트 실행 위치: 리포 루트. `python -m pytest ...`.

---

### Task 1: OBV 지표 + 다이버전스 (indicators.py)

**Files:**
- Modify: `backend/core/indicators.py` (거래량 섹션 `volume_surge` 아래에 추가)
- Test: `backend/tests/test_indicators.py`

**Interfaces:**
- Produces: `obv(close: pd.Series, volume: pd.Series) -> pd.Series`, `obv_divergence(close: pd.Series, volume: pd.Series, lookback: int = config.OBV_LOOKBACK) -> float` (−2~+2 근사, 상승 다이버전스 = 양수)
- Consumes: `config.OBV_LOOKBACK` (Task 5에서 정의. Task 1~4는 Task 5보다 먼저 커밋되므로 이 태스크의 테스트는 lookback 인자를 명시 전달해 config 의존을 피한다.)

- [ ] **Step 1: 실패 테스트 작성** — `backend/tests/test_indicators.py` 끝에 추가

```python
def test_obv_monotonic_up_on_rising_close():
    close = pd.Series([10, 11, 12, 13, 14], dtype=float)
    volume = pd.Series([100, 100, 100, 100, 100], dtype=float)
    o = ind.obv(close, volume)
    # 첫 봉(diff NaN→0)=0, 이후 매봉 +100 누적
    assert o.iloc[-1] == 400.0


def test_obv_divergence_bullish_when_price_down_obv_up():
    # 가격은 하락 마감(92<100)이나 상승봉 거래량이 압도 → OBV 상승 = 상승 다이버전스(+)
    close = pd.Series([100, 90, 95, 85, 92], dtype=float)
    volume = pd.Series([100, 100, 1000, 100, 1000], dtype=float)
    div = ind.obv_divergence(close, volume, lookback=4)
    assert div > 0


def test_obv_divergence_zero_when_flat():
    close = pd.Series([100, 100, 100, 100, 100], dtype=float)
    volume = pd.Series([100, 100, 100, 100, 100], dtype=float)
    assert ind.obv_divergence(close, volume, lookback=4) == 0.0
```

- [ ] **Step 2: 실패 확인**

Run: `python -m pytest backend/tests/test_indicators.py::test_obv_monotonic_up_on_rising_close -v`
Expected: FAIL — `AttributeError: module ... has no attribute 'obv'`

- [ ] **Step 3: 구현** — `indicators.py` 거래량 섹션(`volume_surge` 함수 아래)에 추가

```python
def obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    """On-Balance Volume. 상승봉 +거래량, 하락봉 −거래량 누적."""
    direction = np.sign(close.diff().fillna(0.0))
    return (direction * volume).cumsum()


def obv_divergence(
    close: pd.Series, volume: pd.Series, lookback: int = config.OBV_LOOKBACK
) -> float:
    """창(lookback) 내 OBV 상대강도 − 가격 상대강도. 상승 다이버전스=+, 하락=−, 동행≈0.

    각 변화량을 창 내 범위로 정규화(−1~+1)해 스케일 차이를 제거한다.
    """
    if len(close) < lookback + 1:
        return 0.0
    ob = obv(close, volume)
    c = close.iloc[-(lookback + 1):]
    o = ob.iloc[-(lookback + 1):]
    c_rng = c.max() - c.min()
    o_rng = o.max() - o.min()
    if c_rng == 0 or o_rng == 0:
        return 0.0
    price_norm = (c.iloc[-1] - c.iloc[0]) / c_rng
    obv_norm = (o.iloc[-1] - o.iloc[0]) / o_rng
    return float(obv_norm - price_norm)
```

- [ ] **Step 4: 통과 확인**

Run: `python -m pytest backend/tests/test_indicators.py -k obv -v`
Expected: PASS (3개)

- [ ] **Step 5: 커밋**

```bash
git add backend/core/indicators.py backend/tests/test_indicators.py
git commit -m "feat(indicators): add OBV and OBV divergence"
```

---

### Task 2: ATR 밴드 + 위치 (indicators.py)

**Files:**
- Modify: `backend/core/indicators.py` (변동성 섹션 `atr` 함수 아래)
- Test: `backend/tests/test_indicators.py`

**Interfaces:**
- Produces: `atr_band(high, low, close, period=config.BB_PERIOD, mult=config.ATR_BAND_MULT) -> tuple[pd.Series, pd.Series, pd.Series]` (upper, mid, lower), `atr_band_position(high, low, close, period=config.BB_PERIOD, mult=config.ATR_BAND_MULT) -> float` (0=하단, 1=상단)
- Consumes: `config.BB_PERIOD`(기존), `config.ATR_BAND_MULT`(Task 5). 이 태스크 테스트는 `mult`를 명시 전달.

- [ ] **Step 1: 실패 테스트 작성**

```python
def test_atr_band_position_mid_is_half():
    # 갭 없이 등락 폭 일정 → 종가가 SMA(중심) 근처면 위치 ≈ 0.5
    n = 40
    close = pd.Series(np.full(n, 100.0))
    high = close + 5
    low = close - 5
    pos = ind.atr_band_position(high, low, close, period=20, mult=2.0)
    assert abs(pos - 0.5) < 0.05


def test_atr_band_upper_above_lower():
    n = 40
    rng = np.random.default_rng(3)
    close = pd.Series(100 + np.cumsum(rng.normal(0, 1, n)))
    high = close + 2
    low = close - 2
    upper, mid, lower = ind.atr_band(high, low, close, period=20, mult=2.0)
    assert upper.iloc[-1] > mid.iloc[-1] > lower.iloc[-1]
```

- [ ] **Step 2: 실패 확인**

Run: `python -m pytest backend/tests/test_indicators.py -k atr_band -v`
Expected: FAIL — `has no attribute 'atr_band'`

- [ ] **Step 3: 구현** — `indicators.py` 변동성 섹션 `atr()` 아래에 추가

```python
def atr_band(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = config.BB_PERIOD,
    mult: float = config.ATR_BAND_MULT,
) -> tuple[pd.Series, pd.Series, pd.Series]:
    """ATR 밴드 → (upper, mid, lower). 중심=SMA(close,period), 폭=mult×ATR(14)."""
    mid = close.rolling(window=period, min_periods=period).mean()
    a = atr(high, low, close)
    upper = mid + mult * a
    lower = mid - mult * a
    return upper, mid, lower


def atr_band_position(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    period: int = config.BB_PERIOD,
    mult: float = config.ATR_BAND_MULT,
) -> float:
    """현재가의 ATR밴드 내 위치. 0=하단, 0.5=중심, 1=상단."""
    upper, _mid, lower = atr_band(high, low, close, period, mult)
    u, l, c = upper.iloc[-1], lower.iloc[-1], close.iloc[-1]
    width = u - l
    if pd.isna(width) or width == 0:
        return 0.5
    return float((c - l) / width)
```

- [ ] **Step 4: 통과 확인**

Run: `python -m pytest backend/tests/test_indicators.py -k atr_band -v`
Expected: PASS (2개)

- [ ] **Step 5: 커밋**

```bash
git add backend/core/indicators.py backend/tests/test_indicators.py
git commit -m "feat(indicators): add ATR band and band position"
```

---

### Task 3: 이치모쿠 (indicators.py)

**Files:**
- Modify: `backend/core/indicators.py` (추세 섹션 아래 또는 새 "오버레이 전용" 섹션)
- Test: `backend/tests/test_indicators.py`

**Interfaces:**
- Produces: `ichimoku(high, low, close, conv=9, base=26, span_b=52, disp=26) -> tuple[pd.Series, pd.Series, pd.Series, pd.Series, pd.Series]` (tenkan, kijun, senkou_a, senkou_b, chikou). senkou는 +disp 전위, chikou는 −disp 전위. 배열 길이 = 입력 길이(미래 구름 드롭).

- [ ] **Step 1: 실패 테스트 작성**

```python
def test_ichimoku_tenkan_above_kijun_on_uptrend():
    close = pd.Series(np.linspace(100, 300, 120))
    high = close + 1
    low = close - 1
    tenkan, kijun, senkou_a, senkou_b, chikou = ind.ichimoku(high, low, close)
    # 상승장: 단기(전환선) > 중기(기준선)
    assert tenkan.iloc[-1] > kijun.iloc[-1]
    # 선행스팬은 +26 전위 → 마지막 26개는 과거 값에서 투영, 앞쪽 26개는 NaN
    assert senkou_a.iloc[:26].isna().all()
    # 후행스팬은 −26 전위 → 마지막 26개 NaN
    assert chikou.iloc[-26:].isna().all()
    assert len(tenkan) == len(close)
```

- [ ] **Step 2: 실패 확인**

Run: `python -m pytest backend/tests/test_indicators.py -k ichimoku -v`
Expected: FAIL — `has no attribute 'ichimoku'`

- [ ] **Step 3: 구현** — `indicators.py`에 추가

```python
# ── 차트 오버레이 전용 (스코어 무관) ───────────────────────────
def ichimoku(
    high: pd.Series,
    low: pd.Series,
    close: pd.Series,
    conv: int = 9,
    base: int = 26,
    span_b: int = 52,
    disp: int = 26,
) -> tuple[pd.Series, pd.Series, pd.Series, pd.Series, pd.Series]:
    """일목균형표 → (전환선, 기준선, 선행스팬A, 선행스팬B, 후행스팬).

    선행스팬은 +disp 미래 전위, 후행스팬은 −disp 과거 전위. 배열 길이는 입력과
    같게 유지 — 마지막 캔들 너머 미래 구름은 드롭(분봉 스캘핑엔 최근 구름이 핵심).
    """
    def mid(period: int) -> pd.Series:
        hh = high.rolling(window=period, min_periods=period).max()
        ll = low.rolling(window=period, min_periods=period).min()
        return (hh + ll) / 2

    tenkan = mid(conv)
    kijun = mid(base)
    senkou_a = ((tenkan + kijun) / 2).shift(disp)
    senkou_b = mid(span_b).shift(disp)
    chikou = close.shift(-disp)
    return tenkan, kijun, senkou_a, senkou_b, chikou
```

- [ ] **Step 4: 통과 확인**

Run: `python -m pytest backend/tests/test_indicators.py -k ichimoku -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/core/indicators.py backend/tests/test_indicators.py
git commit -m "feat(indicators): add ichimoku (chart overlay)"
```

---

### Task 4: 피보나치 되돌림 (indicators.py)

**Files:**
- Modify: `backend/core/indicators.py` (오버레이 전용 섹션, ichimoku 아래)
- Test: `backend/tests/test_indicators.py`

**Interfaces:**
- Produces: `fibonacci_levels(high: pd.Series, low: pd.Series, ratios=(0.0, 0.236, 0.382, 0.5, 0.618, 1.0)) -> dict` — `{"swing_high": float, "swing_low": float, "direction": "up"|"down", "levels": [{"ratio": float, "price": float}, ...]}`. 상승(up)이면 0%=고점·100%=저점, 하락(down)이면 0%=저점·100%=고점.

- [ ] **Step 1: 실패 테스트 작성**

```python
def test_fibonacci_uptrend_levels():
    # 저점(인덱스0) 이후 고점(인덱스 끝) → 상승 스윙
    low = pd.Series([100, 105, 110, 120, 130], dtype=float)
    high = pd.Series([102, 107, 112, 122, 132], dtype=float)
    fib = ind.fibonacci_levels(high, low)
    assert fib["direction"] == "up"
    assert fib["swing_high"] == 132.0
    assert fib["swing_low"] == 100.0
    by_ratio = {lv["ratio"]: lv["price"] for lv in fib["levels"]}
    assert by_ratio[0.0] == 132.0    # 0% = 고점
    assert by_ratio[1.0] == 100.0    # 100% = 저점
    assert by_ratio[0.5] == 116.0    # 중간


def test_fibonacci_downtrend_direction():
    # 고점(인덱스0) 이후 저점(인덱스 끝) → 하락 스윙
    high = pd.Series([132, 128, 120, 110, 102], dtype=float)
    low = pd.Series([130, 126, 118, 108, 100], dtype=float)
    fib = ind.fibonacci_levels(high, low)
    assert fib["direction"] == "down"
    by_ratio = {lv["ratio"]: lv["price"] for lv in fib["levels"]}
    assert by_ratio[0.0] == 100.0    # 하락: 0% = 저점
    assert by_ratio[1.0] == 132.0    # 100% = 고점
```

- [ ] **Step 2: 실패 확인**

Run: `python -m pytest backend/tests/test_indicators.py -k fibonacci -v`
Expected: FAIL — `has no attribute 'fibonacci_levels'`

- [ ] **Step 3: 구현** — `indicators.py` 오버레이 섹션에 추가

```python
def fibonacci_levels(
    high: pd.Series,
    low: pd.Series,
    ratios: tuple[float, ...] = (0.0, 0.236, 0.382, 0.5, 0.618, 1.0),
) -> dict:
    """최근 스윙 고/저 기준 피보나치 되돌림.

    고점·저점의 발생 순서로 스윙 방향 판정. 상승(저점→고점)이면 0%=고점에서
    저점으로 내려가는 되돌림, 하락이면 0%=저점에서 고점으로 올라가는 되돌림.
    """
    hi = float(high.max())
    lo = float(low.min())
    hi_idx = int(np.asarray(high).argmax())
    lo_idx = int(np.asarray(low).argmin())
    direction = "up" if lo_idx <= hi_idx else "down"
    diff = hi - lo
    levels = []
    for r in ratios:
        price = hi - diff * r if direction == "up" else lo + diff * r
        levels.append({"ratio": r, "price": round(price, 2)})
    return {
        "swing_high": round(hi, 2),
        "swing_low": round(lo, 2),
        "direction": direction,
        "levels": levels,
    }
```

- [ ] **Step 4: 통과 확인**

Run: `python -m pytest backend/tests/test_indicators.py -k fibonacci -v`
Expected: PASS (2개)

- [ ] **Step 5: 커밋**

```bash
git add backend/core/indicators.py backend/tests/test_indicators.py
git commit -m "feat(indicators): add fibonacci retracement levels"
```

---

### Task 5: config 파라미터 + 세부지표 가중치

**Files:**
- Modify: `backend/core/config.py`
- Test: `backend/tests/test_scoring.py`

**Interfaces:**
- Produces: `config.OBV_LOOKBACK: int`, `config.ATR_BAND_MULT: float`, `config.INDICATOR_WEIGHTS: dict[str, dict[str, float]]`.

- [ ] **Step 1: 실패 테스트 작성** — `backend/tests/test_scoring.py` 끝에 추가

```python
def test_category_weights_sum_100():
    assert sum(config.DEFAULT_WEIGHTS.values()) == 100


def test_indicator_weights_cover_all_categories():
    assert set(config.INDICATOR_WEIGHTS) == set(config.CATEGORIES)
    # 신규 세부지표가 등록됐는지
    assert "obv" in config.INDICATOR_WEIGHTS["flow"]
    assert "atr_band" in config.INDICATOR_WEIGHTS["volatility"]
```

- [ ] **Step 2: 실패 확인**

Run: `python -m pytest backend/tests/test_scoring.py -k "indicator_weights or category_weights_sum" -v`
Expected: FAIL — `has no attribute 'INDICATOR_WEIGHTS'`

- [ ] **Step 3: 구현** — `config.py` 지표 파라미터 섹션에 추가

```python
OBV_LOOKBACK = 20          # OBV 다이버전스 판정 창
ATR_BAND_MULT = 2.0        # ATR밴드 폭 배수 (중심 SMA ± mult×ATR)

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
```

- [ ] **Step 4: 통과 확인**

Run: `python -m pytest backend/tests/test_scoring.py -k "indicator_weights or category_weights_sum" -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/core/config.py backend/tests/test_scoring.py
git commit -m "feat(config): add OBV/ATR-band params and INDICATOR_WEIGHTS"
```

---

### Task 6: compute_indicators가 OBV·ATR밴드 채우기 (indicators.py)

**Files:**
- Modify: `backend/core/indicators.py` (`compute_indicators` 함수)
- Test: `backend/tests/test_indicators.py` (`test_compute_indicators_shape` 확장)

**Interfaces:**
- Consumes: Task 1 `obv_divergence`, Task 2 `atr_band_position`.
- Produces: `IndicatorSet.flow`에 `"obv"` 키(raw divergence), `IndicatorSet.volatility`에 `"atr_band"` 키(raw position 0~1).

- [ ] **Step 1: 실패 테스트 작성** — 기존 `test_compute_indicators_shape` 끝에 assert 추가

```python
    # 신규: OBV 다이버전스는 flow, ATR밴드 위치는 volatility에 원시값으로
    assert "obv" in result.flow
    assert "atr_band" in result.volatility
    assert 0.0 <= result.volatility["atr_band"] <= 1.0
```

- [ ] **Step 2: 실패 확인**

Run: `python -m pytest backend/tests/test_indicators.py::test_compute_indicators_shape -v`
Expected: FAIL — `KeyError: 'obv'` (assert)

- [ ] **Step 3: 구현** — `compute_indicators` 내부 반환 수정

`atr_series = atr(high, low, close)` 아래에 계산 추가:

```python
    obv_div = obv_divergence(close, volume)
    atr_pos = atr_band_position(high, low, close)
```

반환문의 `volatility`·`flow`를 교체:

```python
        volatility={"pct_b": last(pct_b), "atr_band": atr_pos},
        flow={**flow_metrics(investor_flow or {}), "obv": obv_div},
```

- [ ] **Step 4: 통과 확인**

Run: `python -m pytest backend/tests/test_indicators.py -v`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add backend/core/indicators.py backend/tests/test_indicators.py
git commit -m "feat(indicators): wire OBV divergence and ATR-band position into IndicatorSet"
```

---

### Task 7: 스코어링 — score_obv·score_atr_band + 세부지표 가중평균

**Files:**
- Modify: `backend/core/scoring.py` (정규화 함수 + `_category_scores`)
- Test: `backend/tests/test_scoring.py` (신규 테스트 + 강세/약세 픽스처 확장)

**Interfaces:**
- Consumes: `config.INDICATOR_WEIGHTS`, `IndicatorSet.flow["obv"]`, `IndicatorSet.volatility["atr_band"]`.
- Produces: `score_obv(divergence: float) -> float`, `score_atr_band(pos: float) -> float`. flow.detail에 `"obv"`, volatility.detail에 `"atr_band"` 노출.

- [ ] **Step 1: 실패 테스트 작성** — `test_scoring.py`

강세 픽스처 `_bullish_indicators()`의 `trend=...` 이하를 신규 키 포함으로 교체:

```python
    return IndicatorSet(
        trend={"ma_alignment": 1.0, "price_vs_vwap": 5.0},
        momentum={"rsi": 75, "macd_hist": 10.0, "stoch_k": 90, "stoch_d": 85},
        volume={"surge": 3.0},
        volatility={"pct_b": 1.0, "atr_band": 1.0},
        flow={"smart_money": 100.0, "program": 50.0, "obv": 1.0},
        last_close=10000.0,
        last_atr=150.0,
    )
```

`test_bearish_symmetry`의 IndicatorSet도 신규 키 추가: `volatility={"pct_b": 0.0, "atr_band": 0.0}`, `flow={"smart_money": -100.0, "program": -50.0, "obv": -1.0}`.

신규 테스트 추가:

```python
def test_score_obv_sign():
    assert scoring.score_obv(1.0) > 0
    assert scoring.score_obv(-1.0) < 0
    assert scoring.score_obv(0.0) == 0.0


def test_score_atr_band_bounds():
    assert scoring.score_atr_band(1.0) == 100.0
    assert scoring.score_atr_band(0.0) == -100.0
    assert scoring.score_atr_band(0.5) == 0.0


def test_new_indicators_in_contribution_detail():
    result = scoring.score_stock(_bullish_indicators())
    by_cat = {c.category: c for c in result.contributions}
    assert "obv" in by_cat["flow"].detail
    assert "atr_band" in by_cat["volatility"].detail
```

- [ ] **Step 2: 실패 확인**

Run: `python -m pytest backend/tests/test_scoring.py -k "score_obv or score_atr_band or new_indicators" -v`
Expected: FAIL — `has no attribute 'score_obv'`

- [ ] **Step 3: 구현**

(a) `scoring.py` 정규화 섹션(`score_flow` 아래)에 추가:

```python
def score_obv(divergence: float) -> float:
    """OBV 다이버전스(−1~+1 근사) → 점수. 상승 다이버전스=+, 하락=−."""
    return clamp(divergence * 100)


def score_atr_band(pos: float) -> float:
    """ATR밴드 위치 0~1. 상단(1)=+100, 하단(0)=−100, 중앙(0.5)=0. score_pct_b 동형."""
    return clamp((pos - 0.5) * 200)
```

(b) `_category_scores`의 `volatility_detail`·`flow_detail`에 세부지표 추가:

```python
    volatility_detail = {
        "pct_b": score_pct_b(ind.volatility.get("pct_b", 0.5)),
        "atr_band": score_atr_band(ind.volatility.get("atr_band", 0.5)),
    }
    flow_detail = {
        "smart_money": score_flow(
            ind.flow.get("smart_money", 0.0), ind.flow.get("program", 0.0)
        ),
        "obv": score_obv(ind.flow.get("obv", 0.0)),
    }
```

(c) 카테고리 집계를 단순평균 `avg` → 세부지표 가중평균으로 교체. `def avg(d)` 를 아래로 교체:

```python
    def weighted(detail: dict, cat: str) -> float:
        w = config.INDICATOR_WEIGHTS.get(cat, {})
        total_w = sum(w.get(k, 1.0) for k in detail) or 1.0
        return clamp(sum(detail[k] * w.get(k, 1.0) for k in detail) / total_w)

    return {
        "trend": (weighted(trend_detail, "trend"), trend_detail),
        "momentum": (weighted(momentum_detail, "momentum"), momentum_detail),
        "volume": (weighted(volume_detail, "volume"), volume_detail),
        "volatility": (weighted(volatility_detail, "volatility"), volatility_detail),
        "flow": (weighted(flow_detail, "flow"), flow_detail),
    }
```

- [ ] **Step 4: 통과 확인**

Run: `python -m pytest backend/tests/test_scoring.py -v`
Expected: PASS (전체 — 기존 라벨/합/정렬 테스트 포함)

- [ ] **Step 5: 커밋**

```bash
git add backend/core/scoring.py backend/tests/test_scoring.py
git commit -m "feat(scoring): score OBV divergence and ATR-band, weighted sub-indicators"
```

---

### Task 8: 라우트 — 테이블 2행 + 오버레이(이치모쿠·피보) (technical.py)

**Files:**
- Modify: `backend/api/routes/technical.py`
- Test: `backend/tests/test_api.py` (`test_technical_schema` 확장)

**Interfaces:**
- Consumes: Task 3 `ichimoku`, Task 4 `fibonacci_levels`, Task 7 `score_obv`/`score_atr_band`, `IndicatorSet.flow["obv"]`/`volatility["atr_band"]`.
- Produces: `overlays["ichimoku"]` = `{tenkan, kijun, senkou_a, senkou_b, chikou}`(각 배열), `overlays["fibonacci"]` = `fibonacci_levels` dict. `indicators_table`에 "OBV 다이버전스"·"ATR밴드 위치" 행.

- [ ] **Step 1: 실패 테스트 작성** — `test_technical_schema` 끝에 추가

```python
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
```

- [ ] **Step 2: 실패 확인**

Run: `python -m pytest backend/tests/test_api.py::test_technical_schema -v`
Expected: FAIL — `assert {'ichimoku','fibonacci'} <= ...`

- [ ] **Step 3: 구현** — `technical.py`

(a) `overlays` dict 정의 아래(닫는 `}` 뒤)에 이치모쿠·피보 추가:

```python
    high, low = ohlcv["high"], ohlcv["low"]
    tenkan, kijun, senkou_a, senkou_b, chikou = ind_mod.ichimoku(high, low, close)
    overlays["ichimoku"] = {
        "tenkan": _clean(tenkan),
        "kijun": _clean(kijun),
        "senkou_a": _clean(senkou_a),
        "senkou_b": _clean(senkou_b),
        "chikou": _clean(chikou),
    }
    overlays["fibonacci"] = ind_mod.fibonacci_levels(high, low)
```

(b) `table` 리스트에 2행 추가(ATR(14) 행 앞 또는 뒤):

```python
        {"name": "OBV 다이버전스", "value": round(ind.flow["obv"], 2),
         "signal": _signal_label(scoring.score_obv(ind.flow["obv"]))},
        {"name": "ATR밴드 위치", "value": round(ind.volatility["atr_band"], 2),
         "signal": _signal_label(scoring.score_atr_band(ind.volatility["atr_band"]))},
```

- [ ] **Step 4: 통과 확인**

Run: `python -m pytest backend/tests/test_api.py::test_technical_schema -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/api/routes/technical.py backend/tests/test_api.py
git commit -m "feat(api): technical overlays ichimoku+fibonacci and OBV/ATR table rows"
```

---

### Task 9: 프론트 오버레이 — 이치모쿠 구름·피보 선 + 토글 (TechnicalTab.jsx)

**Files:**
- Modify: `frontend/src/tabs/TechnicalTab.jsx`

**Interfaces:**
- Consumes: `data.overlays.ichimoku` (5 배열), `data.overlays.fibonacci` (`{levels:[{ratio,price}], ...}`). 스케일: 기존 `buildScale(candles)` (`xAt`, `yAt`).
- Produces: 없음(UI). 브라우저 검증.

- [ ] **Step 1: 유틸 — 구름 폴리곤 path 생성 함수 추가** (`linePath` 아래)

```javascript
// 선행스팬 A/B 사이 구름 폴리곤. 둘 다 non-null인 인덱스 구간만 채운다.
function cloudPath(aVals, bVals, xAt, yAt) {
  const idx = [];
  aVals.forEach((v, i) => { if (v != null && bVals[i] != null) idx.push(i); });
  if (idx.length < 2) return "";
  const top = idx.map((i) => `${xAt(i).toFixed(1)} ${yAt(aVals[i]).toFixed(1)}`);
  const bot = idx.slice().reverse().map((i) => `${xAt(i).toFixed(1)} ${yAt(bVals[i]).toFixed(1)}`);
  return `M ${top.join(" L ")} L ${bot.join(" L ")} Z`;
}
```

- [ ] **Step 2: `OverlayLayer` 확장** — 이치모쿠 라인·구름·피보 수평선 렌더

`OverlayLayer`의 `lines` 배열 아래, `return` 직전에 추가:

```javascript
  const ichi = overlays.ichimoku;
  const ichiLines = ichi ? [
    { key: "tenkan", color: "#e0a458", val: ichi.tenkan },   // 전환선
    { key: "kijun", color: "#5a8fd9", val: ichi.kijun },     // 기준선
    { key: "chikou", color: "#9aa4b0", val: ichi.chikou, dash: "2 3" }, // 후행스팬
  ] : [];
  const fib = overlays.fibonacci;
```

`return`의 `<svg>` 안, 기존 `lines.filter(...)` 위에 구름을, 아래에 이치모쿠 라인·피보를 추가:

```jsx
      {show.ichimoku && ichi && (
        <path d={cloudPath(ichi.senkou_a, ichi.senkou_b, xAt, yAt)}
          fill="rgba(90,169,160,0.18)" stroke="none" />
      )}
      {lines.filter((l) => l.on && l.val).map((l) => (
        <path key={l.key} d={linePath(l.val, xAt, yAt)} fill="none" stroke={l.color} strokeWidth={1.5} strokeDasharray={l.dash} opacity={0.9} />
      ))}
      {show.ichimoku && ichiLines.map((l) => (
        <path key={l.key} d={linePath(l.val, xAt, yAt)} fill="none" stroke={l.color} strokeWidth={1.4} strokeDasharray={l.dash} opacity={0.85} />
      ))}
      {show.fib && fib && fib.levels.map((lv, i) => {
        const y = yAt(lv.price);
        return (
          <g key={i}>
            <line x1={PLOT_LEFT} y1={y} x2={VB_W - PLOT_RIGHT} y2={y}
              stroke="rgba(224,164,88,0.55)" strokeWidth={1} strokeDasharray="5 4" />
            <text x={VB_W - PLOT_RIGHT - 4} y={y - 2} fontSize="12" textAnchor="end" fill="rgba(224,164,88,0.9)">
              {(lv.ratio * 100).toFixed(1)}%
            </text>
          </g>
        );
      })}
```

기존 `lines.filter` 블록이 위 코드에 포함됐으므로 **원래의 단독 `lines.filter(...)` map은 삭제**(중복 방지).

- [ ] **Step 3: 렌더 게이트 + 토글 상태**

`show` 초기값에 추가: `useState({ ma: true, vwap: true, bb: false, ichimoku: false, fib: false })`.

`OverlayLayer` 렌더 조건 확장:

```jsx
          {show.ma || show.bb || show.ichimoku || show.fib ? <OverlayLayer candles={data.candles} overlays={data.overlays} show={show} /> : null}
```

- [ ] **Step 4: 토글 칩 추가** — 볼린저 칩 뒤에

```jsx
            <ToggleChip label="이치모쿠" active={show.ichimoku} color="#5a8fd9" onClick={() => setShow((s) => ({ ...s, ichimoku: !s.ichimoku }))} />
            <ToggleChip label="피보나치" active={show.fib} color="#e0a458" onClick={() => setShow((s) => ({ ...s, fib: !s.fib }))} />
```

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/tabs/TechnicalTab.jsx
git commit -m "feat(technical-tab): ichimoku cloud + fibonacci overlays with toggles"
```

---

### Task 10: 전체 검증 (pytest + 브라우저)

**Files:** 없음(검증만).

- [ ] **Step 1: 백엔드 전체 테스트**

Run: `python -m pytest backend/ -v`
Expected: PASS (전체). 특히 기존 `test_scoring.py`·`test_api.py` 회귀 없음 확인.

- [ ] **Step 2: 앱 구동**

Run(백엔드): `cd backend && python -m uvicorn api.main:app --port 8000` (백그라운드)
Run(프론트): `cd frontend && npm run dev`

- [ ] **Step 3: 브라우저 검증** — Claude-in-Chrome로 프론트 URL 열기 → 종목 선택 → 탭2

- 이치모쿠 토글 ON → 구름(반투명 영역)·전환/기준/후행 라인 렌더 확인, 스크린샷.
- 피보나치 토글 ON → 수평 되돌림 선 6개 + %라벨 렌더 확인, 스크린샷.
- 지표 테이블에 "OBV 다이버전스"·"ATR밴드 위치" 행 표시 확인.

- [ ] **Step 4: 완료 보고** — 스크린샷 + pytest 결과 요약.

---

## Self-Review

- **Spec coverage:** OBV(Task1,6,7)·ATR밴드(Task2,6,7)·이치모쿠(Task3,8,9)·피보나치(Task4,8,9)·가중치재정규화(Task5,7)·ContributionBar 노출(Task7 detail)·테이블(Task8)·차트(Task9)·pytest+브라우저 검증(Task10). 전 항목 매핑됨.
- **Placeholder scan:** 없음 — 모든 코드 스텝에 실제 코드.
- **Type consistency:** `obv_divergence`/`atr_band_position` 반환 float, `IndicatorSet.flow["obv"]`·`volatility["atr_band"]` 원시값 → `score_obv`/`score_atr_band` 입력 일치. `INDICATOR_WEIGHTS` 키 = detail 키(`smart_money`,`obv`,`pct_b`,`atr_band`,`stoch` 등) 일치. overlays `ichimoku`/`fibonacci` 프론트 소비 키 일치.
