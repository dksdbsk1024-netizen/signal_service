---
name: verify
description: signal_service 를 실제로 띄워 변경이 동작하는지 눈으로 확인한다. 백엔드(FastAPI) + 프론트(Vite) 구동, Playwright 로 UI 구동.
---

# signal_service 실행 검증

## 절대 실 DB·실 KIS 를 검증에 쓰지 말 것

- `SNAPSHOT_DB_PATH` 를 스크래치 경로로 덮어쓴다. 안 그러면 `backend/data/snapshots.db` 를 오염시킨다.
- `COLLECT_ENABLED=0` 으로 백그라운드 수집기를 끈다. 켜면 200종목 × 18 GET 이 KIS 로 날아간다.
- 스냅샷이 없는 종목은 `/api/signal` 이 온디맨드로 1건만 수집한다 — 그걸로 충분하다.

## 백엔드 띄우기

```bash
export STOCK_PROVIDER=mock          # 실 KIS 없이 결정론적 데이터
export COLLECT_ENABLED=0
export SNAPSHOT_DB_PATH=/tmp/verify.db
rm -f "$SNAPSHOT_DB_PATH"
python -m uvicorn backend.api.main:app --port 8000
```

`STOCK_PROVIDER=mock` 을 기본으로 써라. 실 KIS(`auto`)는 **장 시작 직후 ~14분간 `/api/signal` 이 500** 난다
(1분봉이 14개 미만 → ATR NaN → `risk_plan` 이 `ValueError: atr must be positive`). 기능 검증이
시장 시각에 인질로 잡힌다.

## 프론트 띄우기

```bash
cd frontend && npm run dev          # 5173
```

**프론트는 `ui.jsx:4` 에서 `API = "http://localhost:8000"` 을 하드코딩한다.** 백엔드를 다른 포트에
띄우면 프론트가 못 붙는다. vite 프록시 설정이 있지만 절대 URL 이라 안 탄다.

## UI 구동 (Playwright)

Chrome 확장(claude-in-chrome)이 안 붙을 때 대안. 스크래치 디렉터리에 설치해 프로젝트를 오염시키지 않는다.

```bash
npx playwright install chromium
cd "$SCRATCH" && npm i playwright
node drive.mjs                      # chromium.launch() → localhost:5173
```

주의: `npx playwright` 만으로는 `import { chromium } from "playwright"` 가 안 된다(임시 캐시).
스크립트를 두는 디렉터리에 `npm i playwright` 를 따로 해야 한다.

## 구동할 흐름

- 앱 기본 탭은 **스크리너**다. 탭1(종합 신호)로 먼저 이동해야 `/api/signal` 이 호출된다.
- 설정 패널: 우상단 톱니(`aria-label="설정"`) → 슬라이더 `input[type=range]` (가중치 5개 + 알림 1개).
- 가중치는 **라이브 적용**이다(저장 버튼 없음). 슬라이더 변경 → 300ms 디바운스 → `/api/signal?weights=...` 재요청.
- 영속은 `localStorage["signal_service.weights.v1"]`. 저장값은 슬라이더 **raw**(합 100 아님), 전송값은 **정규화**(합 100).

## 알려진 함정

- `_ds_bundle.js` 안의 컴포넌트는 소스 `.jsx` 를 고쳐도 반영 안 된다. **예외: SettingsPanel** —
  `main.jsx:10` 이 번들 뒤에 소스를 다시 import 해 `window.SettingsPanel` 을 덮어쓴다.
- 콘솔에 한글이 깨져 보이는 건 Windows 터미널 인코딩 문제지 데이터 문제가 아니다.
