# 종합신호 탭 통합 대시보드 설계

작성일: 2026-07-14

## 배경

지금 종합신호·기술적분석·수급이 세 탭으로 갈라져 있다. 한 종목을 판단하려면 탭을 세 번 옮겨 다녀야 하고, 각 탭은 `maxWidth: 1100` 가운데 정렬이라 넓은 모니터에서 좌우가 비어 있다. 화면은 헐겁고 정보는 흩어져 있다.

동시에 [자동갱신 설계](2026-07-14-auto-refresh-design.md)의 프론트 작업(60초 폴링)이 아직 남아 있다. 그 작업은 탭별 fetch 를 훅으로 감싸는 일이라, 탭 구조를 바꾸는 이 작업과 같은 파일을 건드린다. 둘을 한 번에 한다.

## 목표

- 종합신호 한 화면에서 신호·매매계획·차트·지표·호가·수급을 다 본다. 기술적분석 탭과 수급 탭은 없앤다.
- 전폭 3열 대시보드. 좌우 여백을 없애고 세로 스크롤을 줄인다.
- 헤더에 종목코드와 종목명을 같이 보여준다.
- 화면이 60초마다 스스로 갱신되고, 데이터가 언제 것인지 표시된다.

## 비목표

- 탭별로 다른 종목을 보는 기능. 종목은 지금처럼 상단 검색바 하나가 정한다.
- 사용자가 패널을 끌어 옮기거나 크기를 바꾸는 커스터마이즈. YAGNI.
- 백엔드 라우트 변경. `/api/signal`, `/api/technical`, `/api/flow` 를 그대로 쓴다.

## 설계

### 1. 탭 구조

`TABS` 가 다섯에서 셋으로 준다.

| 전 | 후 |
|---|---|
| 종목 목록 / 종합 신호 / 기술적 분석 / 수급 / 매크로·시장 | 종목 목록 / 종합 신호 / 매크로·시장 |

`TechnicalTab.jsx` 와 `FlowTab.jsx` 는 사라진다. 그 안에 있던 렌더 코드는 버리지 않고 섹션 컴포넌트로 쪼개 옮긴다.

### 2. 파일 구조

지금 세 탭 파일은 각각 수백 줄이고, 그 안에 차트·호가창·수급 차트 같은 덩어리가 로컬 컴포넌트로 박혀 있다. 셋을 한 파일에 합치면 천 줄짜리 파일이 된다 — 읽기도 고치기도 어렵다.

`frontend/src/sections/` 를 새로 만들어 화면 조각을 하나씩 담는다. 각 섹션은 props 로 데이터를 받는 순수 표시 컴포넌트다. fetch 는 하지 않는다.

| 파일 | 책임 | 출처 |
|---|---|---|
| `sections/SignalSection.jsx` | 게이지 + 라벨 + 기여도 막대 + 신뢰도 배너 | OverviewTab |
| `sections/TradePlanSection.jsx` | 진입가·계좌·리스크 입력 + 손절/목표/포지션사이징 | OverviewTab |
| `sections/ChartSection.jsx` | 인터벌 토글 + 오버레이 칩 + 캔들차트 | TechnicalTab |
| `sections/IndicatorSection.jsx` | 지표 테이블 | TechnicalTab |
| `sections/OrderBookSection.jsx` | 호가창 + 체결강도 | FlowTab |
| `sections/InvestorFlowSection.jsx` | 투자자 순매수 추이 + 프로그램 매매 + 거래원 | FlowTab |

`OverviewTab.jsx` 는 데이터를 받아 이 섹션들을 3열에 배치하는 역할만 남는다.

### 3. 레이아웃

| 열 | 내용 |
|---|---|
| 좌 | SignalSection, TradePlanSection |
| 중 | ChartSection, IndicatorSection |
| 우 | OrderBookSection, InvestorFlowSection |

`App.jsx` 의 `maxWidth: 1100, margin: "0 auto"` 를 없애고 좌우 패딩만 남긴다.

**반응형**: 인라인 스타일로는 미디어쿼리를 쓸 수 없다. 앱 소유의 `frontend/src/layout.css` 를 새로 만들어 `main.jsx` 에서 import 한다. 디자인시스템의 `styles.css` 는 DS 소유이므로 건드리지 않는다.

- `≥1600px` — 3열 (`minmax(320px, 380px) 1fr minmax(320px, 380px)`)
- `1100~1599px` — 2열. 우열(호가·수급)이 중앙 아래로 내려간다
- `<1100px` — 1열

### 4. 헤더

`StockHeader` 는 디자인시스템 컴포넌트이고 `ticker` prop 을 이미 받는다(`design-system/components/core/StockHeader.jsx`). 지금 OverviewTab 이 `name` 과 `ticker` 를 둘 다 넘기고 있으므로, 종목코드가 화면에 안 보인다면 DS 컴포넌트가 그걸 렌더하지 않는 것이다.

DS 컴포넌트를 고치는 대신(번들 재빌드가 필요하고 DS 소유다), 대시보드 상단에 자체 헤더 스트립을 둔다. 여기에 종목코드·종목명·현재가·등락·거래량·장상태와 갱신 시각·새로고침 버튼을 한 줄로 싣는다. `sections/DashboardHeader.jsx`.

### 5. 데이터

세 엔드포인트를 각각 `useAutoRefresh` 로 받는다. 하나로 합치지 않는 이유는 의존성이 다르기 때문이다 — 인터벌 토글(1분/5분)은 차트만 바꾸는데, 합쳐 두면 그때마다 신호와 수급까지 다시 받는다.

| 훅 | 엔드포인트 | 의존성 | 주기 |
|---|---|---|---|
| signal | `/api/signal/{ticker}` | ticker, account, riskPct, entry, weights | 60초 (입력은 300ms 디바운스) |
| technical | `/api/technical/{ticker}?interval=` | ticker, interval | 60초 |
| flow | `/api/flow/{ticker}` | ticker | 60초 |

헤더의 갱신 시각은 signal 응답의 스냅샷 `as_of` 를 쓴다. 새로고침 버튼은 세 훅을 모두 다시 부른다.

**로딩 정책**: 세 개를 다 기다렸다가 한꺼번에 그리지 않는다. 먼저 온 섹션부터 그리고, 아직 안 온 섹션은 자리를 지키며 로딩 상태로 둔다. 하나가 실패해도 나머지는 보인다 — 수급 API 가 죽었다고 신호까지 안 보일 이유가 없다.

### 6. 자동갱신 훅

[자동갱신 설계](2026-07-14-auto-refresh-design.md) §4~5 를 그대로 따른다. `frontend/src/hooks/useAutoRefresh.js`:

- 의존성이 바뀌면 즉시 재호출
- `document.hidden` 이면 폴링 스킵, 탭 복귀 시 즉시 갱신
- 갱신 실패 시 직전 데이터 유지 (화면을 비우지 않는다)
- `{ data, error, loading, isRefreshing, fetchedAt, refresh }` 반환

스크리너 탭과 매크로 탭도 이 훅을 쓴다(각각 60초, 300초).

## 테스트

프론트엔드에 테스트 러너가 없다(`package.json` devDeps: `vite`, `@vitejs/plugin-react`). 이번 범위에서 인프라를 새로 세우지 않는다. 검증은:

- `npm run build` 통과
- `/verify` 로 앱을 띄워 눈으로 확인 — 3열 배치, 폴링(Network 탭), 갱신 시각, 새로고침 버튼, 창 크기를 줄였을 때 2열/1열 전환, 한 API 만 죽였을 때 나머지 섹션이 살아 있는지

백엔드는 손대지 않으므로 `pytest backend/tests -q` 가 그대로 통과해야 한다(회귀 확인용).

## 파일

| 파일 | 변경 |
|---|---|
| `frontend/src/hooks/useAutoRefresh.js` | 신규 |
| `frontend/src/layout.css` | 신규 — 3열 그리드 + 미디어쿼리 |
| `frontend/src/sections/DashboardHeader.jsx` | 신규 |
| `frontend/src/sections/SignalSection.jsx` | 신규 (OverviewTab 에서 추출) |
| `frontend/src/sections/TradePlanSection.jsx` | 신규 (OverviewTab 에서 추출) |
| `frontend/src/sections/ChartSection.jsx` | 신규 (TechnicalTab 에서 추출) |
| `frontend/src/sections/IndicatorSection.jsx` | 신규 (TechnicalTab 에서 추출) |
| `frontend/src/sections/OrderBookSection.jsx` | 신규 (FlowTab 에서 추출) |
| `frontend/src/sections/InvestorFlowSection.jsx` | 신규 (FlowTab 에서 추출) |
| `frontend/src/tabs/OverviewTab.jsx` | 3열 조립 + 세 훅 |
| `frontend/src/tabs/TechnicalTab.jsx` | 삭제 |
| `frontend/src/tabs/FlowTab.jsx` | 삭제 |
| `frontend/src/tabs/ScreenerTab.jsx` | 훅 전환 (60초) |
| `frontend/src/tabs/MacroTab.jsx` | 훅 전환 (300초) |
| `frontend/src/App.jsx` | maxWidth 해제, 탭 3개 |
| `frontend/src/ui.jsx` | `TABS` 축소 |
| `frontend/src/main.jsx` | `layout.css` import |
