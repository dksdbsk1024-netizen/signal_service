# 종합신호 통합 대시보드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 종합신호 탭 하나에서 신호·매매계획·차트·지표·호가·수급을 전폭 3열로 보여주고, 화면이 60초마다 스스로 갱신되게 한다.

**Architecture:** 기존 세 탭(Overview/Technical/Flow)의 렌더 코드를 `frontend/src/sections/` 의 순수 표시 컴포넌트로 추출한 뒤, `OverviewTab` 이 그것들을 3열 그리드에 조립한다. fetch 는 공용 훅 `useAutoRefresh` 가 맡는다(엔드포인트 3개를 각각 폴링 — 인터벌 토글이 신호·수급까지 다시 받게 만들지 않기 위함).

**Tech Stack:** React 18 / Vite. 프론트엔드 테스트 러너 없음.

## Global Constraints

- 탭은 셋으로 준다: `종목 목록` / `종합 신호` / `매크로·시장`. `기술적 분석`·`수급` 탭은 없앤다
- 폴링 주기: 60초. 매크로 탭만 300초
- 3열 브레이크포인트: `≥1600px` 3열 / `1100~1599px` 2열 / `<1100px` 1열
- 미디어쿼리는 앱 소유의 `frontend/src/layout.css` 에 쓴다. `frontend/src/design-system/` 아래는 **절대 건드리지 않는다** — DS 컴포넌트는 `_ds_bundle.js` 에서 렌더되므로 소스 `.jsx` 만 고쳐도 무효다
- 백엔드는 이 계획에서 손대지 않는다. `/api/signal`, `/api/technical`, `/api/flow`, `/api/screener`, `/api/macro/*` 를 지금 모양 그대로 쓴다
- 검증: `cd frontend && npm run build` 통과. 백엔드 회귀는 `pytest backend/tests -q`
- 렌더 동작은 보존한다 — 추출은 리팩터이지 재설계가 아니다. 섹션이 그리는 결과가 지금과 달라지면 그건 버그다

---

### Task 1: `useAutoRefresh` 훅

**Files:**
- Create: `frontend/src/hooks/useAutoRefresh.js`

**Interfaces:**
- Consumes: 없음
- Produces:

```js
useAutoRefresh(fetcher, deps, options) => {
  data,          // 마지막으로 성공한 데이터. 갱신 실패해도 유지된다. 초기 null
  error,         // 마지막 실패 메시지 | null. 성공하면 null 로 지워진다
  loading,       // 첫 로드 중일 때만 true (data 도 error 도 아직 없을 때)
  isRefreshing,  // 배경 갱신 중 true (data 는 그대로 보인다)
  fetchedAt,     // 마지막 성공 시각 (Date) | null
  refresh,       // () => void — 즉시 1회 갱신
}
```

- `fetcher: (signal: AbortSignal) => Promise<any>` — AbortSignal 을 fetch 에 넘겨야 한다
- `deps: any[]` — 바뀌면 즉시 재호출하고 타이머를 재시작한다
- `options: { intervalMs = 60000, debounceMs = 0 }`

- [ ] **Step 1: 훅을 만든다**

Create `frontend/src/hooks/useAutoRefresh.js`:

```js
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 주기 폴링 + 탭 가시성 연동 fetch 훅.
 *
 * 왜 훅으로 뽑는가: 탭들이 같은 fetch/abort/에러 처리를 각자 복사해 갖고 있었다.
 * 폴링을 여러 번 복붙하면 여러 번 다르게 틀린다.
 *
 * 갱신 실패는 화면을 비우지 않는다 — 직전 data 를 그대로 붙들고 error 만 세운다.
 * 60초마다 로딩 스피너로 되돌리면 화면이 깜빡인다.
 *
 * @param {(signal: AbortSignal) => Promise<any>} fetcher AbortSignal 을 fetch 에 넘길 것
 * @param {any[]} deps 바뀌면 즉시 재호출 + 타이머 재시작
 * @param {{intervalMs?: number, debounceMs?: number}} options
 */
export default function useAutoRefresh(fetcher, deps, options = {}) {
  const { intervalMs = 60000, debounceMs = 0 } = options;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);

  // fetcher 는 매 렌더 새 함수다. effect 의존성에 넣으면 무한 루프가 되므로 ref 로 고정한다.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // 진행 중인 요청. 새 요청이 뜨면 이전 것을 끊는다(늦게 온 응답이 최신을 덮지 않게).
  const ctrlRef = useRef(null);
  const depsKey = JSON.stringify(deps);

  const run = useCallback(async () => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    setIsRefreshing(true);
    try {
      const next = await fetcherRef.current(ctrl.signal);
      if (ctrl.signal.aborted) return;
      setData(next);
      setError(null);
      setFetchedAt(new Date());
    } catch (e) {
      if (e.name === "AbortError") return;
      setError(e.message || "요청 실패");
    } finally {
      if (!ctrl.signal.aborted) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setData(null);        // deps 가 바뀌었다 — 이전 종목의 데이터를 보여주면 거짓말이다
    setError(null);
    setFetchedAt(null);

    const timer = debounceMs ? setTimeout(run, debounceMs) : null;
    if (!timer) run();

    const poll = setInterval(() => {
      if (document.hidden) return;  // 백그라운드 탭은 헛돌지 않는다
      run();
    }, intervalMs);

    // 숨어 있던 동안 못 한 갱신을 돌아오는 즉시 따라잡는다
    const onVisible = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      ctrlRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, intervalMs, debounceMs, run]);

  return {
    data,
    error,
    loading: data === null && error === null,
    isRefreshing,
    fetchedAt,
    refresh: run,
  };
}
```

- [ ] **Step 2: 빌드로 구문을 확인한다**

Run: `cd frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/hooks/useAutoRefresh.js
git commit -m "feat(frontend): 주기 폴링 훅 useAutoRefresh

60초 폴링 + 탭 숨김 시 정지 + 복귀 즉시 갱신. 갱신 실패는 직전 데이터를 유지한다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 세 탭의 렌더 코드를 `sections/` 로 추출한다 (순수 리팩터)

**이 태스크는 동작을 바꾸지 않는다.** 탭 구조도, fetch 도, 화면에 보이는 것도 지금과 똑같아야 한다. 오직 코드를 옮긴다. 다음 태스크가 이 섹션들을 3열로 재조립한다.

**Files:**
- Create: `frontend/src/sections/SignalSection.jsx`
- Create: `frontend/src/sections/TradePlanSection.jsx`
- Create: `frontend/src/sections/ChartSection.jsx`
- Create: `frontend/src/sections/IndicatorSection.jsx`
- Create: `frontend/src/sections/OrderBookSection.jsx`
- Create: `frontend/src/sections/InvestorFlowSection.jsx`
- Modify: `frontend/src/tabs/OverviewTab.jsx` (추출한 섹션을 쓰도록)
- Modify: `frontend/src/tabs/TechnicalTab.jsx` (추출한 섹션을 쓰도록)
- Modify: `frontend/src/tabs/FlowTab.jsx` (추출한 섹션을 쓰도록)

**Interfaces:**
- Consumes: 없음
- Produces — 각 섹션은 **fetch 하지 않는** 순수 표시 컴포넌트다. 데이터는 전부 props 로 받는다:
  - `SignalSection({ signal, coverage })` — DirectionGauge + LabelBadge + ContributionBar + 신뢰도 배너. `signal` 은 `/api/signal` 응답의 `signal` 객체
  - `TradePlanSection({ tradePlan, tradePlanUnavailable, entry, onEntryChange, account, onAccountChange, riskPct, onRiskPctChange })` — 입력 필드 + 손절/목표/포지션사이징. 입력 상태는 부모가 들고 있고 섹션은 값과 콜백만 받는다(이 값들이 signal fetch 의 의존성이기 때문)
  - `ChartSection({ candles, overlays, interval, onIntervalChange })` — 오버레이 토글 칩은 섹션 내부 상태로 둔다(fetch 의존성이 아니다). `interval` 은 API 파라미터라 부모가 든다
  - `IndicatorSection({ table })` — 지표 테이블
  - `OrderBookSection({ orderbook, tradeStrength, price })` — 호가창 + 체결강도 메터
  - `InvestorFlowSection({ investorFlow, series, brokers })` — 순매수 추이 + 프로그램 매매 + 거래원

- [ ] **Step 1: 섹션 파일 6개를 만든다**

기존 탭 파일에서 해당 렌더 코드와 그 코드만 쓰는 로컬 헬퍼 컴포넌트(예: FlowTab 의 `OrderBook`, `NetBuyTrendChart`, `ProgramTradingStrip`, `ExecutionStrengthMeter`, `BrokerTable`)를 **그대로** 옮긴다. JSX 와 스타일을 다시 쓰지 말 것 — 옮기는 것이지 고쳐 쓰는 게 아니다.

각 섹션은 위 Interfaces 의 props 시그니처를 갖는다. 섹션 안에서 `useState`/`useEffect` 로 fetch 하지 않는다.

`ui.jsx` 에서 쓰던 것들(`Card`, `SectionLabel`, `SectionEyebrow`, `LabelBadge`, `Banner`, `SegmentedControl`, `ToggleChip`, `NumberField`, `FieldLabel`, `fmtWon`, `fmtVolume`, `Ds`, `toSignalEnum`)은 섹션에서도 `../ui.jsx` 로 import 한다.

- [ ] **Step 2: 세 탭이 섹션을 쓰도록 고친다**

각 탭은 fetch(기존 `useEffect` 그대로) + 로딩/에러 분기 + 섹션 조립만 남는다. `StockHeader` 렌더는 이 태스크에서 건드리지 않는다.

- [ ] **Step 3: 빌드**

Run: `cd frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 4: 눈으로 회귀 확인**

Run: `cd frontend && npm run dev` (백엔드가 떠 있어야 한다: `python -m uvicorn backend.api.main:app --port 8000`)

세 탭을 열어 추출 전과 화면이 같은지 본다. 차트 오버레이 토글, 인터벌 전환, 매매계획 입력이 전부 그대로 동작해야 한다.

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/sections/ frontend/src/tabs/
git commit -m "refactor(frontend): 탭 렌더 코드를 sections/ 순수 컴포넌트로 추출

동작 변경 없음. 다음 커밋에서 종합신호 탭이 이 섹션들을 3열로 재조립한다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 종합신호 탭을 전폭 3열 대시보드로 통합한다

**Files:**
- Create: `frontend/src/layout.css`
- Create: `frontend/src/sections/DashboardHeader.jsx`
- Modify: `frontend/src/tabs/OverviewTab.jsx` (전면 개편)
- Modify: `frontend/src/main.jsx` (layout.css import)
- Modify: `frontend/src/App.jsx` (maxWidth 해제, 탭 3개)
- Modify: `frontend/src/ui.jsx` (`TABS` 축소)
- Delete: `frontend/src/tabs/TechnicalTab.jsx`
- Delete: `frontend/src/tabs/FlowTab.jsx`

**Interfaces:**
- Consumes: `useAutoRefresh` (Task 1), `sections/*` (Task 2)
- Produces: `DashboardHeader({ ticker, name, header, asOf, isRefreshing, error, onRefresh })` — 종목코드·종목명·현재가·등락·거래량·장상태 + 갱신 시각 + 새로고침 버튼을 한 줄로

- [ ] **Step 1: `frontend/src/layout.css` 를 만든다**

```css
/* 종합신호 대시보드 그리드.
   인라인 스타일로는 미디어쿼리를 쓸 수 없어 앱 소유 CSS 로 둔다.
   design-system/styles.css 는 DS 소유라 건드리지 않는다. */
.dash-grid {
  display: grid;
  gap: var(--space-4);
  grid-template-columns: 1fr;           /* < 1100px — 1열 */
  align-items: start;
}

@media (min-width: 1100px) {
  .dash-grid {
    /* 신호+매매계획 | 차트+지표. 호가·수급은 아래로 내려간다 */
    grid-template-columns: minmax(320px, 380px) 1fr;
  }
  .dash-col-right { grid-column: 1 / -1; }
}

@media (min-width: 1600px) {
  .dash-grid {
    grid-template-columns: minmax(320px, 380px) 1fr minmax(320px, 380px);
  }
  .dash-col-right { grid-column: auto; }
}

.dash-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;   /* 그리드 자식이 내용물 때문에 열을 밀어내지 않게 */
}
```

`frontend/src/main.jsx` 의 `import "./design-system/styles.css";` **아래**에 `import "./layout.css";` 를 더한다 (뒤에 와야 DS 토큰을 쓸 수 있고 우리 규칙이 이긴다).

- [ ] **Step 2: `DashboardHeader` 를 만든다**

`frontend/src/sections/DashboardHeader.jsx`. 한 줄 스트립:

- 왼쪽: 종목코드(`ticker`, 고정폭 숫자 `ds-numeric`) + 종목명(`name`) + 현재가 + 등락(부호·색) + 거래량 + 장상태 배지
- 오른쪽: `갱신 N분 전` + `↻` 버튼 (`isRefreshing` 이면 "갱신 중…" 으로 바뀌고 disabled). `error` 가 있으면 `갱신 실패 · 마지막 데이터 N분 전`

시각 계산:

```jsx
/** 서버 as_of 가 있으면 그게 진짜 데이터 시각이다(스냅샷은 최대 3분 늙었다).
 *  없으면 fetch 시각이 곧 데이터 시각이다(라이브 라우트). */
function ageText(asOf, fetchedAt) {
  const t = asOf ? new Date(asOf) : fetchedAt;
  if (!t || Number.isNaN(t.getTime())) return "—";
  const sec = Math.max(0, Math.round((Date.now() - t.getTime()) / 1000));
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간 전`;
}
```

시각 문자열은 시간이 흘러야 바뀐다 — 컴포넌트 안에서 30초마다 리렌더한다:

```jsx
const [, tick] = React.useState(0);
React.useEffect(() => {
  const id = setInterval(() => tick((n) => n + 1), 30000);
  return () => clearInterval(id);
}, []);
```

색·간격은 인라인 스타일 + CSS 변수(`var(--text-tertiary)`, `var(--space-3)` 등)로, 기존 탭들과 같은 규약을 쓴다.

- [ ] **Step 3: `OverviewTab` 을 3열로 재조립한다**

세 훅으로 데이터를 받는다:

```jsx
const sig = useAutoRefresh(
  async (signal) => {
    const qs = new URLSearchParams({ account: String(account), risk_pct: String(riskPct) });
    if (entry != null) qs.set("entry", String(entry));
    if (weights) qs.set("weights", JSON.stringify(normalizeWeights(weights)));
    const res = await fetch(`${API}/api/signal/${ticker}?${qs}`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  [ticker, account, riskPct, entry, weights],
  { debounceMs: 300 },   // 슬라이더를 끌 때마다 쏘지 않는다
);

const tech = useAutoRefresh(
  async (signal) => {
    const res = await fetch(`${API}/api/technical/${ticker}?interval=${interval}&bars=120`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  [ticker, interval],
);

const flow = useAutoRefresh(
  async (signal) => {
    const res = await fetch(`${API}/api/flow/${ticker}`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  [ticker],
);
```

`interval` 은 `OverviewTab` 의 `useState("1m")` 로 든다 (ChartSection 에 `interval`/`onIntervalChange` 로 넘긴다).

렌더:

```jsx
<>
  <DashboardHeader
    ticker={ticker}
    name={name}
    header={sig.data?.header}
    asOf={sig.data?.as_of}
    isRefreshing={sig.isRefreshing || tech.isRefreshing || flow.isRefreshing}
    error={sig.error || tech.error || flow.error}
    onRefresh={() => { sig.refresh(); tech.refresh(); flow.refresh(); }}
  />

  <div className="dash-grid">
    <div className="dash-col">
      {/* 신호 + 매매계획 — sig */}
    </div>
    <div className="dash-col">
      {/* 차트 + 지표 — tech */}
    </div>
    <div className="dash-col dash-col-right">
      {/* 호가창 + 수급 — flow */}
    </div>
  </div>
</>
```

**로딩·에러는 열마다 따로 처리한다.** 셋을 다 기다렸다 그리면 안 된다 — 수급 API 가 죽어도 신호는 보여야 한다. 각 열은:

- `x.loading` → 그 열만 로딩 표시
- `x.error && !x.data` → 그 열만 `<Banner tone="error">`
- `x.data` → 섹션 렌더 (`x.error` 가 있어도 데이터가 있으면 그린다 — 갱신 실패는 헤더가 알린다)

- [ ] **Step 4: 탭을 셋으로 줄이고 폭을 푼다**

`frontend/src/ui.jsx` 의 `TABS` 에서 `technical`·`flow` 항목을 지운다:

```js
export const TABS = [
  { id: "screener", label: "종목 목록" },
  { id: "overview", label: "종합 신호" },
  { id: "macro", label: "매크로/시장" },
];
```

`frontend/src/App.jsx`:
- `TechnicalTab`·`FlowTab` import 와 `renderTab()` 의 `case "technical"`·`case "flow"` 를 지운다
- 탭 콘텐츠 컨테이너(83행)의 `maxWidth: 1100, margin: "0 auto"` 를 없애고 패딩만 남긴다:

```jsx
<div style={{ padding: "var(--space-6) var(--space-6) var(--space-16)" }}>
```

`frontend/src/tabs/TechnicalTab.jsx` 와 `frontend/src/tabs/FlowTab.jsx` 를 `git rm` 한다.

- [ ] **Step 5: 빌드**

Run: `cd frontend && npm run build`
Expected: 빌드 성공. 지운 탭을 아직 참조하는 곳이 있으면 여기서 터진다.

- [ ] **Step 6: 커밋**

```bash
git add -A frontend/src
git commit -m "feat(frontend): 종합신호 탭을 전폭 3열 대시보드로 통합

신호·매매계획 | 차트·지표 | 호가·수급 3열. 기술적분석·수급 탭은 없앤다.
세 엔드포인트를 각각 60초 폴링하고, 한 곳이 죽어도 나머지 열은 살아 있다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 스크리너·매크로 탭을 훅으로 전환한다

**Files:**
- Modify: `frontend/src/tabs/ScreenerTab.jsx:50-62`
- Modify: `frontend/src/tabs/MacroTab.jsx:161-177`

**Interfaces:**
- Consumes: `useAutoRefresh` (Task 1)
- Produces: 없음

- [ ] **Step 1: ScreenerTab**

기존 `useState(data/loading/error)` + `useEffect(fetch)` 를 지우고:

```jsx
const { data, error, loading, isRefreshing, fetchedAt, refresh } = useAutoRefresh(
  async (signal) => {
    const res = await fetch(`${API}/api/screener`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  [],
);
```

`/api/screener` 응답은 `as_of`(전 종목 스냅샷 중 가장 오래된 것)를 준다. 표 위에 갱신 시각과 새로고침 버튼을 붙인다 — `DashboardHeader` 의 `ageText` 를 재사용할 수 있게 `sections/DashboardHeader.jsx` 에서 `export { ageText }` 한다.

- [ ] **Step 2: MacroTab**

세 엔드포인트를 하나의 fetcher 로 합치고 300초 주기로 둔다(매크로 지표는 분 단위로 안 변한다):

```jsx
const { data, error, loading, isRefreshing, fetchedAt, refresh } = useAutoRefresh(
  async (signal) => {
    const grab = async (path) => {
      const res = await fetch(`${API}/api/macro${path}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    };
    const [base, indicators, quotes] = await Promise.all([
      grab("/base"), grab("/indicators"), grab("/quotes"),
    ]);
    return { base, indicators, quotes };
  },
  [],
  { intervalMs: 300000 },
);
```

기존에 `base`/`indData`/`quotesData` 세 state 를 읽던 렌더 코드를 `data.base`/`data.indicators`/`data.quotes` 로 바꾼다.

- [ ] **Step 3: 빌드**

Run: `cd frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 4: 커밋**

```bash
git add frontend/src/tabs/
git commit -m "feat(frontend): 스크리너·매크로 탭 자동갱신 전환

스크리너 60초, 매크로 300초.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 실제로 도는지 눈으로 확인한다

**Files:** 없음 (검증만)

- [ ] **Step 1: 백엔드 회귀**

Run: `pytest backend/tests -q`
Expected: PASS (백엔드는 안 건드렸으므로 그대로여야 한다)

- [ ] **Step 2: `/verify` 로 앱을 띄운다**

백엔드(FastAPI 8000) + 프론트(Vite 5173) 를 올리고 Playwright 로 연다.

- [ ] **Step 3: 확인 항목**

- 탭이 셋인가 (종목 목록 / 종합 신호 / 매크로·시장)
- 종합신호가 3열로 뜨고 좌우 여백이 없는가
- 헤더에 종목코드와 종목명이 같이 뜨는가
- 창 폭을 1500px, 900px 로 줄였을 때 2열 → 1열로 접히는가
- DevTools Network 에서 `/api/signal`, `/api/technical`, `/api/flow` 가 각각 60초마다 다시 불리는가
- `↻` 버튼이 세 개를 다 다시 부르는가
- 다른 브라우저 탭에 갔다 오면 즉시 갱신되는가
- 차트 인터벌을 1분↔5분으로 바꿀 때 `/api/technical` 만 다시 불리고 `/api/signal`·`/api/flow` 는 안 불리는가
- 매매계획 입력(계좌·리스크)을 바꿀 때 `/api/signal` 만 다시 불리는가

- [ ] **Step 4: 스크린샷을 남긴다**

3열 화면 스크린샷을 찍어 첨부한다.
