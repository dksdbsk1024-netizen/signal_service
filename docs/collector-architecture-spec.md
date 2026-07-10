# 구현 지시서 — 수집기 → 스냅샷 → 읽기 전용 서빙 전환

> 이 문서는 Claude Code(리포에서 실행·테스트·git·배포하는 에이전트)에게 그대로 넘기기 위한 작업 지시서다.
> 목표는 "사용자 요청마다 KIS를 실시간으로 긁는" 현재 구조를, "백그라운드 수집기가 미리 계산해 저장소에 넣고 API는 읽기만 하는" 구조로 바꿔 **전 종목을 안정적으로** 서비스할 수 있게 만드는 것이다.

---

## 0. 배경 — 왜 바꾸나

현재 `/api/screener`, `/api/signal/{ticker}` 는 **요청 시점에** KIS에서 분봉·수급·현재가를 콜드하게 받아 지표·신호를 계산한다. 그래서:

- 첫 로딩이 느리다. 종목당 분봉이 최대 12페이지 순차 호출(`kis.py: _MINUTE_MAX_PAGES = 12`)이라, 16종목만 해도 첫 페인트에 100회 이상의 외부 왕복이 몰린다.
- 확장 불가. 외부 호출량이 **사용자 수 × 종목 수** 로 늘어난다.
- KIS 제한에 직접 노출된다.

### 검증된 제약 (설계를 지배하는 사실)

- KIS REST 호출 유량: **초당 약 20건**(슬라이딩 윈도우, 실무상 15건이 안전).
- KIS 웹소켓 실시간: **한 세션당 약 41종목**(체결+호가는 합쳐서 20개). 전 종목 실시간은 연결/계좌 다중화가 필요.

출처:
- https://hky035.github.io/web/kis-api-throttling/
- https://hky035.github.io/web/refact-kis-websocket/
- https://tgparkk.github.io/robotrader/2025/10/09/robotrader-1-70stocks-problem.html
- https://apiportal.koreainvestment.com/intro

결론: 전 종목을 안정적으로 서비스하려면 **데이터 수집과 사용자 서빙을 반드시 분리**해야 한다.

---

## 1. 현재 구조 (시작점 — 이 심볼들을 재사용/재배선한다)

```
backend/
  api/
    main.py                      # FastAPI 앱
    deps.py                      # PROVIDER 싱글턴, load_indicators, stock_header, run_parallel, market_status
    routes/
      signal.py                  # GET /api/signal/{ticker}  → header + signal + trade_plan
      screener.py                # GET /api/screener          → WATCHLIST 종목별 score row
      technical.py, flow.py, macro.py
  core/
    providers.py                 # StockProvider(ABC), KISProvider, MockProvider, MacroDataProvider
    kis.py                       # 엔드포인트별 인메모리 TTL 캐시 + 토큰 캐시(.kis_token.json) + 재시도
    indicators.py                # compute_indicators(ohlcv, flow) -> IndicatorSet(last_close, last_atr, ...)
    scoring.py                   # score_stock(ind), risk_plan(entry, atr, dir), position_size(...)
frontend/src/tabs/
    ScreenerTab.jsx              # /api/screener 소비 (종목 목록)
    OverviewTab.jsx              # /api/signal/{ticker} 소비 (종합 신호 상세)
```

핵심 재사용 지점:

- `deps.load_indicators(ticker)` → `(ohlcv, flow, IndicatorSet)`
- `deps.stock_header(ticker)` → 현재가/등락률/거래량 dict
- `scoring.score_stock(ind)` → `result.final_score`, `result.label`, `result.contributions[]`
- `scoring.risk_plan(...)`, `scoring.position_size(...)` — **사용자 입력(계좌·리스크)에 의존하는 순수 함수. 외부 호출 없음.**

> 중요한 설계 힌트: **비싼 부분(지표·스코어)만 미리 저장**하고, **trade_plan/position_size 는 요청 때 계산**한다. 이 둘은 저장된 `last_close`·`last_atr` 와 사용자 입력만으로 즉시 계산되므로 캐싱 대상이 아니다.

---

## 2. 목표 아키텍처

**단일 프로세스 구조** — 수집기를 FastAPI 앱과 같은 프로세스 안에서 백그라운드 스케줄러(APScheduler)로 돌린다. 별도 워커/서비스 없음. 저장소는 로컬 SQLite 파일.

```
        ┌────────────────────────────────────────────────┐
        │  FastAPI 프로세스 (단일)                         │
        │                                                │
        │  ┌──────────────────────────────┐              │
        │  │ Collector (APScheduler, 백그라운드)          │
        │  │  - 주기 실행(예: 1분)          │              │
        │  │  - 유니버스를 rate-limit 지켜 순회            │
        │  │  - load_indicators + score_stock 계산        │
        │  │  - 스냅샷 upsert ─────────┐   │              │
        │  └───────────────────────────┼──┘              │
        │                              ▼                 │
        │                    ┌───────────────────┐       │
        │                    │  SQLite (파일)      │       │
        │                    │  종목 → 최신 스냅샷 │       │
        │                    └─────────┬─────────┘       │
        │                              │ read only       │
        │  ┌───────────────────────────▼──────────────┐  │
        │  │ Routes                                    │  │
        │  │  /api/screener  → 저장소에서 전 종목 읽기   │  │
        │  │  /api/signal/{t}→ 스냅샷 + trade_plan 계산  │  │
        │  └───────────────────────────────────────────┘  │
        └────────────────────────────────────────────────┘
```

원칙:

1. **사용자당 외부(KIS) 호출 0회.** API는 저장소만 읽는다.
2. **외부 호출량은 사용자 수와 무관.** 수집기 주기에만 비례.
3. **Rate limit은 수집기 한 곳에서 중앙 관리.**
4. **Stale-while-revalidate.** 수집 실패해도 마지막 스냅샷을 그대로 서빙. 스냅샷에 `as_of` 타임스탬프를 실어 프론트가 신선도를 표시.

---

## 3. 결정 사항 (확정)

| 항목 | 결정 | 비고 |
|------|------|------|
| 구조 | **단일 프로세스 — 확정** | 수집기를 API와 같은 프로세스 안 백그라운드 스케줄러(APScheduler)로 실행. 별도 워커/서비스·새 인프라 없음. |
| 저장소 | **SQLite (로컬 파일) — 확정** | 같은 프로세스에서 쓰고 읽으므로 파일 공유 문제 없음. 저장소 접근을 추상화 계층으로 감싸 나중에 Postgres 등으로 교체 가능. |
| 유니버스 1차 규모 | **시총상위 200종목 — 확정** | 검증 후 코스피+코스닥 전 종목으로 확장(Phase 4) |
| 수집 주기 | 1차 200종목 전체 1분 주기 | 확장(Phase 4) 시 핫셋 1분 / 롱테일 5분 티어링 |
| 현재가 실시간 | 1차 REST 폴링, 이후 인기종목만 웹소켓(≤41/세션) | Phase 5 |

> 1차 200종목은 초당 15건 기준 한 사이클이 넉넉히 1분 안에 들어온다(200 × 2~3호출 ≈ 30~40초). 전 종목(~2,000개)으로 확장하는 Phase 4부터는 종목당 2호출만 잡아도 4분 이상 걸리므로 **티어링**(핫셋 빠르게, 롱테일 느리게/EOD)이 필요하다.

---

## 4. 데이터 모델 (스냅샷)

종목당 1행. 비싼 계산 결과만 저장한다.

```
stock_snapshot
---------------------------------------------------
ticker            TEXT PK          # "005930"
name              TEXT             # "삼성전자"
price             REAL             # 현재가
change            REAL             # 전일대비
change_pct        REAL             # 등락률(%)
volume            INTEGER          # 거래량
final_score       REAL             # 종합신호 스코어 (-100~+100)
label             TEXT             # "적극매수"|"매수"|"중립"|"매도"|"적극매도"
contributions_json TEXT            # scoring 기여도 배열 직렬화
last_close        REAL             # trade_plan 계산용
last_atr          REAL             # trade_plan 계산용
market_status     TEXT            # open|after|closed
source            TEXT             # kis|mock
mock              INTEGER          # 0|1
as_of             TEXT             # 스냅샷 생성 시각(ISO, KST)
tier              INTEGER          # 0=핫셋,1=롱테일 (선택)
```

---

## 5. 구현 단계 (Phase별 — 각 단계 끝에 실행 가능한 상태 유지)

### Phase 1 — 저장소 + 스냅샷 스키마
- `backend/core/snapshot_store.py` 신설: `upsert_snapshot(row)`, `get_snapshot(ticker)`, `get_all_snapshots()`, `list_universe()`.
- **SQLite(로컬 파일)** 사용. `stock_snapshot` 테이블 생성(§4). 표준 라이브러리 `sqlite3`면 충분(새 의존성 0). DB 경로는 `SNAPSHOT_DB_PATH`(기본 `backend/data/snapshots.db`, gitignore).
- 동시성: FastAPI가 스레드로 읽고 스케줄러가 쓰므로 `check_same_thread=False` + WAL 모드(`PRAGMA journal_mode=WAL`)로 읽기/쓰기 경합 완화.
- 저장소 접근을 얇은 추상화 계층으로 감싼다(구현 교체 대비). 테스트는 인메모리 SQLite(`:memory:`)로.
- **수용 기준**: 단위 테스트로 upsert→read 라운드트립 통과(`:memory:`).

### Phase 2 — 수집기 (인프로세스 스케줄러)
- `backend/core/collector.py` 신설: `collect_ticker(ticker, name)` = 기존 `load_indicators` + `stock_header` + `score_stock` 를 그대로 호출해 스냅샷 row 생성 후 `upsert_snapshot`.
- `run_cycle(universe)` = 유니버스를 rate-limit(초당 ≤15, 토큰버킷/세마포어) 지키며 순회. 실패 종목은 로그만 남기고 계속(부분 실패 허용).
- **FastAPI 앱 기동 시 스케줄러 등록**: `main.py`의 lifespan(startup)에서 APScheduler `BackgroundScheduler`로 `run_cycle`을 `COLLECT_INTERVAL_SEC`(기본 60초) 간격 등록, shutdown에서 정리. 별도 프로세스 없음.
- 수동 실행 엔트리도 제공: `python -m backend.core.collector`(1사이클) / `--loop --interval 60`. 개발·초기 적재용.
- 앱 부팅 즉시 1회 즉시 수집(첫 사용자가 빈 화면을 안 보도록) 후 주기 반복.
- 유니버스 1차 = **시총상위 200종목**. 종목 코드 목록은 정적 파일(`backend/data/universe_top200.py` 또는 `.json`)로 관리, 이후 갱신 가능하게.
- **수용 기준**: 시총상위 10종목으로 1사이클 실행 → 저장소에 10행 생성, 초당 호출이 15건을 넘지 않음(로그로 확인). 이어 200종목 1사이클이 rate limit 위반 없이 완주. 앱 기동 시 스케줄러가 자동 등록됨을 확인.

### Phase 3 — API 읽기 전용 전환
- `screener.py`: `_score_row`에서 KIS 호출 제거 → `snapshot_store.get_all_snapshots()` 읽어 정렬·반환. 응답 스키마는 **현행 유지**(프론트 무수정). 필드 추가 시에만 프론트 반영.
- `signal.py`: `get_signal`에서 `load_indicators` 제거 → `get_snapshot(ticker)`로 `final_score/label/contributions/last_close/last_atr` 읽고, `trade_plan`/`position_size`는 **그대로 요청 시 계산**. 스냅샷 없으면 404 또는 온디맨드 1회 계산 폴백(택1, 사용자 확인).
- 스냅샷에 `as_of`를 실어 응답에 포함 → 프론트에서 "N초 전 갱신" 표시.
- **수용 기준**: 저장소만 채워진 상태에서 KIS 키를 빼도(=수집기만 접근) `/api/screener`·`/api/signal`이 즉시 응답. 기존 `backend/tests` 통과.

### Phase 4 — 유니버스 확장 + 티어링
- 유니버스 소스: 코스피/코스닥 전 종목 코드 목록(KRX 종목마스터 또는 KIS 종목정보). 정적 파일 or 일 1회 갱신.
- 티어: 핵심 종목(시총상위/조회상위) tier0 = 1분, 나머지 tier1 = 5분/EOD.
- **수용 기준**: 전 종목 수집이 rate limit 위반 없이 한 사이클 완주. 로딩 체감 변화 없음(항상 웜 캐시).

### Phase 5 (선택) — 현재가 실시간
- 인기 종목만 KIS 웹소켓 구독(세션당 ≤41, 체결+호가 합 20). 수신 시 스냅샷의 `price/change_pct/volume`만 갱신.

---

## 6. Rate limit 처리 (수집기)
- 토큰버킷 or `threading.Semaphore` + 최소 간격으로 **초당 15건 상한** 강제. 경계 몰림 방지 위해 여유를 20→15로 둔다.
- 기존 `kis.py`의 인메모리 TTL 캐시는 유지(수집기 내부에서도 중복 호출 흡수).
- 토큰 발급은 앱키당 1분 1회 제한 — 기존 `.kis_token.json` 캐시/락 로직 재사용.

## 7. 실패·신선도 처리
- 수집 실패 종목: 마지막 스냅샷 유지(덮어쓰지 않음). `as_of`가 오래되면 프론트가 "지연" 배지.
- 저장소는 항상 마지막 성공 스냅샷을 서빙(stale-while-revalidate).

## 8. 배포
- **단일 서비스.** 수집기가 API 프로세스 안에서 돌므로 앱 하나만 배포하면 된다(별도 워커·DB 서비스 불필요).
- **SQLite 파일은 영구 볼륨에 둔다.** 컨테이너 파일시스템은 재시작 시 초기화될 수 있으므로, `SNAPSHOT_DB_PATH`를 영구 볼륨 경로로. 볼륨을 못 쓰는 환경이면 부팅 시 즉시 1회 수집으로 스냅샷을 다시 채운다(§Phase 2).
- **주의(단일 프로세스 한계)**: API 인스턴스를 2개 이상으로 스케일아웃하면 각 인스턴스가 자체 SQLite와 자체 스케줄러를 갖게 되어 KIS 호출이 인스턴스 수만큼 중복된다. 스케일아웃이 필요해지면 그때 관리형 Postgres + 수집기 단일화(분리 구조)로 이전한다.
- 환경변수: 기존 `KIS_APP_KEY/SECRET`, 신규 `SNAPSHOT_DB_PATH`, `COLLECT_INTERVAL_SEC`, `UNIVERSE_SIZE` 등.

## 9. 테스트 & 검증
- 단위: snapshot_store 라운드트립, collector가 rate limit 준수(모킹), API가 저장소만 읽는지(=KIS provider 호출 0회, 모킹으로 단언).
- 통합: 수집기 1사이클 후 API 응답 스키마가 기존과 동일한지 스냅샷 테스트.
- 회귀: 기존 `backend/tests/test_api.py`, `test_scoring.py` 등 전부 통과.
- 프론트: `npm run build` 통과, 스크리너/종합신호 화면 수동 확인.

## 10. Out of scope / 주의
- 스코어링 로직(`scoring.py`) 자체는 변경하지 않는다 — 신호 결과는 현행과 동일해야 한다.
- 프론트 응답 스키마는 되도록 유지. `as_of` 등 필드 추가 시에만 최소 반영.
- 실데이터 키가 없으면 기존처럼 Mock 폴백 — 수집기/스토어도 Mock에서 동작해야 개발 가능.

---

## 착수 순서 요약
1. §3 결정 확정됨 — **단일 프로세스 + SQLite, 유니버스 1차 = 시총상위 200종목.** 새 계정·인프라 준비물 없음(추가 의존성은 APScheduler 정도).
2. Phase 1 → 2 → 3 순으로, 각 Phase 끝에서 실행+테스트 통과 확인 후 다음으로.
3. Phase 3까지가 "체감 로딩 개선"의 핵심. Phase 4에서 전 종목 확장, 필요 시 그때 관리형 Postgres로 이전.
