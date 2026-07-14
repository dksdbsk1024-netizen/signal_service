# 주가데이터 자동갱신 설계

작성일: 2026-07-14

## 배경

백엔드는 이미 무인 갱신 중이다. `backend/api/main.py`의 lifespan에서 APScheduler가 부팅 1초 후 첫 실행, 이후 `COLLECT_INTERVAL_SEC`(기본 300초) 주기로 `run_cycle()`을 돌린다. 한 사이클은 유니버스 200종목을 24개 워커로 병렬 수집해 SQLite 스냅샷(`backend/data/snapshots.db`)에 종목당 upsert 하며, 실측 약 381초가 걸린다. `/api/signal`과 `/api/screener`는 이 스냅샷을 읽는다(`/api/technical`·`/api/flow`는 아니다 — 매 요청 KIS 를 직접 부른다).

빠진 것은 두 가지다.

1. 수집이 장 마감 후에도 계속 돌아 KIS API를 헛되이 두드린다. 반대로 장중 주기는 300초라 느슨하다.
2. 프론트엔드에 폴링이 없다. 각 탭은 마운트 시점 또는 ticker 변경 시에만 fetch 한다. 새 스냅샷이 DB에 계속 쌓여도 열어둔 화면은 처음 읽은 값을 그대로 붙들고 있다.

## 목표

- 장중에는 180초마다 수집하고, 장외에는 수집을 멈춘다.
- 열어둔 화면이 60초마다 스스로 최신 스냅샷을 다시 읽는다.
- 사용자가 지금 보는 값이 언제 것인지 화면에서 알 수 있다.

## 비목표

- 실시간 푸시(SSE/WebSocket). 60초 폴링으로 충분하며 운영 복잡도를 감당할 이유가 없다.
- 공휴일 달력 연동. 현재 장 상태 판정은 요일과 시각만 본다. 공휴일에는 사이클이 헛돌지만 시세가 변하지 않으므로 upsert는 무해하다. 별건으로 다룬다.

## 설계

### 1. 장 상태 판정을 core 로 이동

현재 `market_status()`는 `backend/api/deps.py:93`에 있고 `stock_header()`에서만 쓴다. 수집기가 이걸 쓰려면 `core/collector.py`가 `api/`를 import 해야 하는데, 이는 의존 방향이 뒤집힌 것이다.

`backend/core/market_hours.py`를 신설해 판정 로직을 옮긴다. `deps.market_status()`는 이를 호출하는 얇은 래퍼로 남긴다. 라우트가 내보내는 값과 형태는 바뀌지 않는다.

노출 인터페이스:

- `market_status(now: datetime) -> Literal["open", "after", "closed"]` — 기존 판정을 그대로 옮긴 것. KRX 기준 평일 09:00~15:30 = open, 15:30~18:00 = after, 그 외/주말 = closed.
- `should_collect(now: datetime) -> bool` — 수집기 전용 게이트.

`should_collect`는 `market_status`와 별개의 창을 쓴다. 평일 09:00~15:40 이면 True. 마감(15:30) 뒤 10분의 유예를 두는 이유는, 마지막 사이클이 종가를 담기 전에 게이트가 닫혀 그날 마지막 스냅샷이 장중 값으로 남는 일을 막기 위함이다. 유예창 밖과 주말은 False.

### 2. 수집 주기와 게이트

- `collector.py`의 `COLLECT_INTERVAL_SEC` 기본값을 300 → 180 으로 낮춘다. **여유는 없다**: 유니버스 200종목 1사이클은 실측 381초(GET 2,574회, 6.8 req/s)로, 180초든 300초든 어떤 주기보다도 길다. 즉 `max_instances=1` + `coalesce=True` 때문에 장중에는 사실상 사이클이 끝나는 즉시 다음 사이클이 시작되는 연속 수집이 되고, 주기 값은 상한이 아니라 하한으로만 작동한다. 주기를 "튜닝"해 신선도를 올릴 수 있다고 생각하지 말 것 — 바닥은 KIS 응답 지연이다. 신선도를 정말 올리려면 유니버스를 줄이거나 종목당 GET 18회를 줄여야 한다.
- `run_cycle()` 진입부에서 `should_collect(now)`가 False면 즉시 리턴한다. 한 줄 로그만 남기고 KIS 를 호출하지 않는다.

게이트를 스케줄러가 아니라 `run_cycle()` 안에 두는 이유는, 수집기를 수동 스크립트로 호출하든 스케줄러가 호출하든 같은 규칙이 걸리게 하기 위함이다.

### 3. 스냅샷 시각 노출

스냅샷 테이블에는 이미 두 개의 시각이 있다 (`snapshot_store.py:84-85`).

- `quote_as_of` — KIS 가 준 시세 시각
- `as_of` — 스냅샷을 만든 시각 (KST)

라우트 응답에 `as_of`가 실려 있는지 확인하고, 없으면 싣는다. 프론트는 이 값으로 "몇 분 전 데이터"를 표시한다.

### 4. 프론트엔드 자동 갱신

`frontend/src/hooks/useAutoRefresh.js` 를 신설한다. fetch 함수와 의존성 배열을 받아 60초 주기로 재호출한다.

동작:

- 의존성이 바뀌면 즉시 1회 호출하고 타이머를 재시작한다 (기존 `useEffect` 동작 유지).
- `document.hidden` 이면 타이머 틱을 건너뛴다. 백그라운드 탭이 밤새 헛돌지 않게 한다.
- 탭이 다시 보이면(`visibilitychange`) 즉시 1회 갱신한다. 숨어 있던 동안 쌓인 갱신을 한 번에 따라잡는다.
- 언마운트 시 타이머와 리스너를 정리한다.

각 탭(Overview / Technical / Flow / Screener / Macro)의 기존 `useEffect` fetch 를 이 훅으로 감싼다. 기존 의존성(ticker, interval, account, riskPct, entry, weights 등)은 그대로 유지한다. OverviewTab 의 300ms 디바운스도 유지한다.

### 5. 갱신 실패 처리

폴링 중 fetch 가 실패해도 화면을 비우지 않는다. 지금처럼 로딩 상태로 되돌리면 60초마다 화면이 깜빡인다.

- 첫 로드 실패 → 기존대로 에러 표시.
- 폴링 실패 → 직전 데이터를 그대로 유지하고, 헤더에 "갱신 실패 · 마지막 데이터 N분 전"을 표시한다.

즉 훅은 `{ data, error, isRefreshing, lastUpdated }`를 내놓고, `data`는 갱신에 실패해도 마지막 성공 값을 붙들고 있는다.

### 6. 헤더 표시

헤더에 두 가지를 더한다.

- `as_of` 기반 상대 시각 — "갱신 3분 전"
- 수동 새로고침 버튼 — 폴링을 기다리지 않고 즉시 다시 읽는다

## 테스트

**백엔드 (pytest)**

`should_collect` 단위 테스트를 시각별로 고정한다.

- 평일 10:00 → True
- 평일 15:35 (유예창 안) → True
- 평일 15:45 (유예창 밖) → False
- 평일 08:00 → False
- 토요일 10:00 → False

`market_status()`의 기존 동작이 `core` 이동 후에도 같은지 회귀 테스트로 확인한다.

**프론트엔드**

훅 테스트 인프라(vitest + testing-library) 유무를 먼저 확인한다. 있으면 `useAutoRefresh`의 타이머/가시성 동작을 fake timer 로 테스트한다. 없으면 이번 범위에서 인프라를 새로 세우지 않고, 앱을 띄워 수동 확인한다(`/verify`).

## 파일

| 파일 | 변경 |
|---|---|
| `backend/core/market_hours.py` | 신규 — `market_status`, `should_collect` |
| `backend/api/deps.py` | `market_status()` 를 core 래퍼로 축소 |
| `backend/core/collector.py` | `COLLECT_INTERVAL_SEC` 180, `run_cycle()` 게이트 |
| `backend/api/routes/*.py` | 응답에 `as_of` 없으면 추가 |
| `frontend/src/hooks/useAutoRefresh.js` | 신규 |
| `frontend/src/tabs/*.jsx` | fetch 를 훅으로 감쌈 |
| 헤더 컴포넌트 | 갱신 시각 + 새로고침 버튼 |
| `backend/tests/` | `should_collect` / `market_status` 테스트 |
