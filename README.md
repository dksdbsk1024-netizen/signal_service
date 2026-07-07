# signal_service — 종목 매매신호 대시보드

종목을 검색하면 여러 지표를 종합해 매수/매도 방향성을 알려주는 데이트레이딩 보조 도구.
블랙박스가 아니라 **각 지표의 기여도를 전부 공개**하고 사용자가 **가중치를 직접 조절**한다.
경제지표(매크로) 맥락과 매매 계획(리스크)까지 한 흐름으로 연결한다. 상세 설계는 [DESIGN.md](DESIGN.md).

## 스택

- **백엔드**: Python 3.12 · FastAPI · pandas/numpy (지표·스코어링 순수 함수, 외부 TA 라이브러리 미사용)
- **프론트**: React · Vite

## 새 PC 세팅

### 1. 클론
```bash
git clone https://github.com/dksdbsk1024-netizen/signal_service.git
cd signal_service
```

### 2. 백엔드
```bash
python -m venv .venv
# Windows(PowerShell/Git Bash):
.venv/Scripts/activate
# macOS/Linux:
# source .venv/bin/activate

pip install -r backend/requirements.txt
```

환경변수(선택): 실 경제지표를 쓸 때만 필요. 키가 없으면 Mock 데이터로 폴백해 앱은 그대로 구동된다.
```bash
cp backend/.env.example backend/.env   # 그 뒤 FRED_API_KEY / ECOS_API_KEY 채우기
```

### 3. 프론트
```bash
cd frontend
npm install
```

## 실행

터미널 2개.

```bash
# 백엔드 (리포 루트에서)
python -m uvicorn backend.api.main:app --port 8000

# 프론트 (frontend/ 에서)
npm run dev
```

- 프론트: http://localhost:5173 (포트 사용 중이면 Vite가 5174 등으로 자동 이동)
- 백엔드 API: http://localhost:8000 (프론트 `src/ui.jsx`의 `API` 상수가 여기를 가리킴)

## 테스트

```bash
python -m pytest backend/ -q
```

## 프로젝트 구조

```
backend/
  core/         지표(indicators)·스코어링(scoring)·설정(config)·매크로
  api/routes/   FastAPI 엔드포인트 (signal·technical·flow·macro·screener)
  tests/        pytest
frontend/
  src/tabs/            탭별 화면 (앱 소스 — Vite가 직접 번들)
  src/design-system/   디자인 시스템. 컴포넌트는 프리빌드 _ds_bundle.js 로 로드
```

> 참고: `frontend/src/design-system/` 의 컴포넌트(CandleChart 등)는 소스 `.jsx` 가 아니라
> 사전 빌드된 `_ds_bundle.js`(git 추적됨)에서 렌더된다. 컴포넌트 동작을 바꾸려면 소스와
> 번들을 함께 수정해야 한다.
