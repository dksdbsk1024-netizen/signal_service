# signal_service — 종목 매매신호 대시보드

종목을 검색하면 여러 지표를 종합해 매수/매도 방향성을 알려주는 국내 주식 데이트레이딩 보조 도구.
블랙박스가 아니라 **각 지표의 기여도를 전부 공개**하고 사용자가 **가중치를 직접 조절**한다.
경제지표(매크로) 맥락과 매매 계획(리스크)까지 한 흐름으로 연결한다.

- 상세 설계·스코어링 로직: [DESIGN.md](DESIGN.md)
- UI 정보 구조·디자인 제약: [DESIGN_BRIEF.md](DESIGN_BRIEF.md)

이 문서는 "빠르게 이해하고 띄우는 법"만 다룬다.

## 아키텍처 개요

```
[KIS: 종목]  [FRED·ECOS: 경제지표]  [yfinance: 시세]
     │              │                    │
     ▼              ▼                    ▼
┌──────────────────────────────────────────┐
│  providers (backend/core/providers.py)    │
│  StockProvider / MacroProvider (추상)      │
│  KISProvider · MacroDataProvider · Mock   │
└──────────────────────────────────────────┘
                   │
                   ▼
        FastAPI (backend/api)  ◀── HTTP ──  React/Vite (frontend)
```

- **백엔드**: Python 3.12 · FastAPI · pandas/numpy. 지표(`core/indicators.py`)·스코어링(`core/scoring.py`)은
  프레임워크 독립 순수 함수 — 외부 TA 라이브러리 미사용.
- **프론트**: React · Vite.
- **provider 추상화**: 라우트는 `StockProvider`/`MacroProvider` 인터페이스만 알고, 구체 구현(KIS 실데이터 vs Mock)은
  `backend/api/deps.py`가 환경변수·키 유무를 보고 조립한다. 데이터 소스를 바꿔도 스코어링 로직은 그대로.
- **Mock 폴백**: 키가 없으면 해당 소스가 자동으로 Mock으로 내려간다. `StockProvider`의 일곱 메서드는
  전부 KIS 실연동이다. 단, **KIS 키가 있는데 인증에 실패하면 Mock으로 폴백하지 않고 에러**를
  낸다 — 실데이터인 줄 알고 Mock을 보는 사고를 막기 위함.

## 필요한 API 키

전부 **선택**. 없으면 Mock으로 돌아간다([키 없이 돌리면](#키-없이-돌리면) 참조). 조회는 모두 무료.

| 키 | 용도 | 발급처 |
|----|------|--------|
| `FRED_API_KEY` | 미국 경제지표 (CPI·금리 등) | https://fred.stlouisfed.org/docs/api/api_key.html |
| `ECOS_API_KEY` | 한국 경제지표 (한국은행) | https://ecos.bok.or.kr/api/#/AuthKeyApply |
| `KIS_APP_KEY` / `KIS_APP_SECRET` | 국내 종목 분봉·수급·호가 (한국투자증권) | https://apiportal.koreainvestment.com |

설정은 `backend/.env`에 넣는다. **실제 키 값은 이 문서나 코드에 절대 커밋하지 말 것** —
템플릿과 각 키의 주의사항은 [`backend/.env.example`](backend/.env.example)에 있다.

```bash
cp backend/.env.example backend/.env   # 그 뒤 필요한 키만 채우기
```

`KIS_ACCOUNT_NO`는 현재가 조회엔 불필요하다(주문·잔고 단계에서 사용).

## 세팅

```bash
git clone https://github.com/dksdbsk1024-netizen/signal_service.git
cd signal_service

# 백엔드
python -m venv .venv
.venv/Scripts/activate        # Windows(PowerShell/Git Bash)
# source .venv/bin/activate   # macOS/Linux
pip install -r backend/requirements.txt

# 프론트
cd frontend && npm install
```

## 실행

터미널 2개. **백엔드를 먼저 띄운다** — 프론트가 기동 직후 API를 호출한다.

```bash
# 1) 백엔드 (리포 루트에서)
uvicorn backend.api.main:app --reload --port 8000

# 2) 프론트 (frontend/ 에서)
npm run dev
```

- 프론트: **http://localhost:5173** ← 여기로 접속. (포트 사용 중이면 Vite가 5174 등으로 자동 이동)
- 백엔드 API: http://localhost:8000 (프론트 `src/ui.jsx`의 `API` 상수가 이 주소를 가리킨다)

> **백엔드는 기동 즉시 수집기를 켠다.** 시총상위 200종목(`backend/data/universe_top200.json`)을
> 백그라운드로 돌며 지표·스코어를 계산해 `backend/data/snapshots.db`에 넣는다. 라우트는 그 스냅샷만
> 읽으므로 `/api/screener`가 200종목이어도 100ms 안에 응답한다.
> KIS 실키가 있으면 **실 API 호출이 시작된다** — 원치 않으면 `COLLECT_ENABLED=0` 또는 `STOCK_PROVIDER=mock`.
> `--reload` 중에 백엔드 파일을 저장하면 리로드와 함께 수집이 다시 시작된다.

## 환경 노브

`backend/.env`에서 데이터 소스를 강제로 고정하는 스위치. 키가 있어도 네트워크를 안 타게 만들 때 쓴다.

| 변수 | 기본값 | 의미 | 언제 쓰나 |
|------|--------|------|-----------|
| `STOCK_PROVIDER` | `auto` | `auto` = KIS 키 있으면 실데이터, 없으면 Mock. `mock` = 키가 있어도 강제 Mock. | 오프라인 개발, KIS 호출 한도 아끼기 |
| `MACRO_LIVE_QUOTES` | `1` | 매크로 시세(yfinance) 네트워크 호출. `0` = Mock. | 오프라인 개발. yfinance는 키가 없어도 네트워크를 타므로 별도 노브가 필요 |
| `COLLECT_ENABLED` | `1` | 앱 기동 시 백그라운드 수집 스케줄러. `0` = 끔. | 검증 스크립트를 돌릴 때(같은 앱키로 유량이 합산돼 `EGW00201`) |
| `COLLECT_INTERVAL_SEC` | `180` | 수집 주기. 사이클이 더 길면 `max_instances=1`이 그냥 건너뛴다. 장 밖(평일 09:00~15:40 밖)에는 사이클이 즉시 스킵된다. | 신선도 vs 호출량 |
| `COLLECT_WORKERS` | `24` | 동시에 수집하는 종목 수. 유량 상한이 아니라 KIS 왕복 지연을 흡수하는 손잡이. | 사이클이 느릴 때 |
| `KIS_MAX_RPS` | `12` | KIS 호출 유량 상한(토큰버킷, 버스트 없음). 문서상 한도는 20이지만 15에서도 거부당했다. | `EGW00201`이 뜰 때 낮춘다 |
| `SNAPSHOT_DB_PATH` | `backend/data/snapshots.db` | 스냅샷 SQLite 경로. 배포 시 **영구 볼륨**으로. | 컨테이너 재시작 시 스냅샷 보존 |

경제지표(FRED·ECOS)는 노브 없이 **키 유무만으로** 실데이터/Mock이 갈린다.

## 테스트

```bash
python -m pytest backend/tests -q
```

**246개 통과.** `conftest.py`가 `STOCK_PROVIDER=mock`·`COLLECT_ENABLED=0`·`SNAPSHOT_DB_PATH=:memory:`를
강제해 오프라인으로 격리된다 — 실 API 키가 있어도 테스트는 네트워크를 타지 않고, 개발자의 실제
`snapshots.db`도 건드리지 않는다.

수집기 단독 실행(개발·초기 적재용):

```bash
python -m backend.core.collector --limit 10     # 앞 10종목 1사이클
python -m backend.scripts.check_universe        # 200종목 코드 유효성 (앱을 내리고 돌릴 것)
```

## 키 없이 돌리면

`.env` 없이 그대로 실행해도 앱은 정상 구동된다. 각 데이터가 이렇게 폴백된다:

- **종목**(분봉·수급·호가) → `MockProvider` (티커 시드 기반 결정론적 더미)
- **경제지표**(FRED·ECOS) → Mock
- **매크로 시세**(yfinance) → 키가 없어도 실호출됨. 끄려면 `MACRO_LIVE_QUOTES=0`

UI·스코어링·차트를 그대로 확인할 수 있으니, 키 발급 전에 먼저 띄워보고 구조를 파악하면 된다.

## 프로젝트 구조

```
backend/
  core/         지표(indicators)·스코어링(scoring)·설정(config)·매크로(macro)·provider 정의
  api/deps.py   provider 조립 (환경변수·키 유무 → 실데이터 or Mock)
  api/routes/   FastAPI 엔드포인트 (signal·technical·flow·macro·screener)
  scripts/      KIS 실 API 수동 점검 스크립트 (앱을 거치지 않고 KISProvider 직접 호출)
  tests/        pytest
frontend/
  src/tabs/            탭별 화면 (앱 소스 — Vite가 직접 번들)
  src/design-system/   디자인 시스템. 컴포넌트는 프리빌드 _ds_bundle.js 로 로드
```

> 참고: `frontend/src/design-system/` 의 컴포넌트(CandleChart 등)는 소스 `.jsx` 가 아니라
> 사전 빌드된 `_ds_bundle.js`(git 추적됨)에서 렌더된다. 컴포넌트 동작을 바꾸려면 소스와
> 번들을 함께 수정해야 한다.
