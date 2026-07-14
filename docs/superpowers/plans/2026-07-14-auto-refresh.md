# 주가데이터 자동갱신 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 장중에만 180초 주기로 수집하고, 열어둔 화면이 60초마다 스스로 최신 데이터를 다시 읽게 한다.

**Architecture:** 수집 게이트를 `backend/core/market_hours.py`로 새로 뽑아 `run_cycle()` 진입부에서 검사한다(스케줄러가 아니라 사이클 안에 두어 수동 실행에도 같은 규칙이 걸린다). 프론트는 공용 훅 `useAutoRefresh`로 각 탭의 기존 `useEffect` fetch 를 감싸 60초 폴링 + 탭 가시성 연동 + 실패 시 직전 데이터 유지를 한 곳에서 처리한다.

**Tech Stack:** Python 3 / FastAPI / APScheduler / pytest — React 18 / Vite (테스트 러너 없음)

## Global Constraints

- 수집 주기 기본값: `COLLECT_INTERVAL_SEC=180` (환경변수로 덮어쓰기 가능)
- 수집 게이트 창: 평일(월~금) KST 09:00~15:40. 그 외 수집 안 함
- 배지용 `market_status()`의 반환값 `"open" | "after" | "closed"`와 경계(09:00/15:30/18:00)는 **바뀌지 않는다**. 게이트 창(15:40)과 배지 경계(15:30)가 다른 것은 의도된 것 — 마지막 사이클이 종가를 담고 끝나게 하기 위함
- 프론트 폴링 주기: 60초. 매크로 탭만 300초
- 프론트엔드에는 테스트 러너가 없다(`package.json` devDeps: `vite`, `@vitejs/plugin-react`뿐). 이번 범위에서 인프라를 새로 세우지 않는다. 프론트 태스크의 검증은 앱을 띄워 눈으로 확인한다
- 백엔드 테스트는 `pytest backend/tests/...` 로 리포 루트에서 실행한다. `conftest.py`가 `STOCK_PROVIDER=mock`, `COLLECT_ENABLED=0`, `SNAPSHOT_DB_PATH=:memory:` 를 강제한다

## 스펙에서 달라진 점

스펙 §3(라우트에 `as_of` 노출)은 **삭제한다.** 코드 확인 결과:

- `signal.py`, `screener.py` — 이미 스냅샷 `as_of` 를 응답에 싣는다
- `technical.py:36`, `flow.py:20` — 스냅샷을 읽지 않는다. `get_provider()` 로 KIS 를 직접 친다. 즉 라이브 라우트라 "응답 받은 시각 ≈ 데이터 시각" 이고, 서버가 `as_of` 를 따로 줄 이유가 없다

따라서 프론트는 **서버 `as_of` 가 있으면 그걸, 없으면 클라이언트 fetch 시각**을 표시한다. 백엔드 라우트는 손대지 않는다.

부수 효과 하나를 기록해 둔다: technical·flow 탭 폴링은 진짜 KIS 호출이다(technical 분봉+수급, flow 6개 호출). 사용자 한 명 기준 분당 약 18 GET ≈ 0.3 req/s 로, 수집기가 이미 쓰는 6.8 req/s 옆에서는 작다. 사용자가 여럿이 되면 이 두 라우트도 스냅샷으로 옮겨야 한다.

---

### Task 1: 장 시간 판정을 core 로 분리하고 수집 게이트를 만든다

**Files:**
- Create: `backend/core/market_hours.py`
- Modify: `backend/api/deps.py:90-107` (`_KST`, `market_status`)
- Test: `backend/tests/test_market_hours.py` (신규)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `backend.core.market_hours.KST: datetime.timezone`
  - `backend.core.market_hours.market_status(now: datetime.datetime | None = None) -> str` — `"open" | "after" | "closed"`. `now` 가 None 이면 `datetime.datetime.now(KST)`
  - `backend.core.market_hours.should_collect(now: datetime.datetime | None = None) -> bool` — 수집기 게이트
  - `backend.api.deps.market_status` 는 이 함수를 재노출한 것 (기존 import 경로 유지)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Create `backend/tests/test_market_hours.py`:

```python
"""장 시간 판정 — 배지용 market_status 와 수집 게이트 should_collect."""

import datetime

import pytest

from backend.core.market_hours import KST, market_status, should_collect


def at(year, month, day, hour, minute):
    return datetime.datetime(year, month, day, hour, minute, tzinfo=KST)


# 2026-07-14 는 화요일, 2026-07-18 은 토요일, 2026-07-19 는 일요일.
@pytest.mark.parametrize("now, expected", [
    (at(2026, 7, 14, 8, 59), "closed"),   # 개장 직전
    (at(2026, 7, 14, 9, 0), "open"),      # 개장 경계 포함
    (at(2026, 7, 14, 15, 29), "open"),    # 마감 직전
    (at(2026, 7, 14, 15, 30), "after"),   # 마감 경계 → 시간외
    (at(2026, 7, 14, 17, 59), "after"),
    (at(2026, 7, 14, 18, 0), "closed"),   # 시간외 종료 경계
    (at(2026, 7, 18, 11, 0), "closed"),   # 토요일
    (at(2026, 7, 19, 11, 0), "closed"),   # 일요일
])
def test_market_status(now, expected):
    assert market_status(now) == expected


@pytest.mark.parametrize("now, expected", [
    (at(2026, 7, 14, 8, 59), False),   # 개장 전
    (at(2026, 7, 14, 9, 0), True),     # 개장
    (at(2026, 7, 14, 12, 0), True),    # 장중
    (at(2026, 7, 14, 15, 30), True),   # 마감 직후 — 유예창 안 (종가 스냅샷용)
    (at(2026, 7, 14, 15, 39), True),   # 유예창 끝 직전
    (at(2026, 7, 14, 15, 40), False),  # 유예창 끝 경계
    (at(2026, 7, 14, 20, 0), False),   # 야간
    (at(2026, 7, 18, 11, 0), False),   # 토요일
    (at(2026, 7, 19, 11, 0), False),   # 일요일
])
def test_should_collect(now, expected):
    assert should_collect(now) is expected


def test_defaults_to_now_when_no_arg():
    """인자 없이 부르면 현재 KST 로 판정한다 — 예외 없이 유효한 값이 나오면 된다."""
    assert market_status() in {"open", "after", "closed"}
    assert isinstance(should_collect(), bool)


def test_deps_reexports_same_function():
    """기존 import 경로(api.deps.market_status)가 살아 있어야 한다 — 라우트가 쓴다."""
    from backend.api import deps

    assert deps.market_status is market_status
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `pytest backend/tests/test_market_hours.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'backend.core.market_hours'`

- [ ] **Step 3: `backend/core/market_hours.py` 를 만든다**

```python
"""장 시간 판정 — 배지 표시용과 수집 게이트용.

두 창이 다르다. market_status 는 KRX 정규장(09:00~15:30)을 그대로 말하고,
should_collect 는 마감 뒤 10분을 더 연다. 마감 시각에 게이트를 닫으면 마지막
사이클(약 160초)이 종가를 담기 전에 잘려, 그날 마지막 스냅샷이 장중 값으로 남는다.

KRX 휴장일은 모른다(요일과 시각만 본다). 휴장일엔 사이클이 헛돌지만 시세가 변하지
않아 upsert 가 무해하다 — 공휴일 달력은 별건이다.
"""

from __future__ import annotations

import datetime

KST = datetime.timezone(datetime.timedelta(hours=9))

# 수집 게이트 창 (평일). 마감 15:30 + 유예 10분.
_COLLECT_OPEN_HHMM = 900
_COLLECT_CLOSE_HHMM = 1540


def _hhmm(now: datetime.datetime) -> int:
    return now.hour * 100 + now.minute


def market_status(now: datetime.datetime | None = None) -> str:
    """StockHeader 배지용: open(정규장) | after(시간외) | closed.

    KRX 휴장일은 모른다 — 휴장일이면 KIS 가 빈 응답을 주고 provider 가 Mock 으로
    폴백하므로, 배지보다 header["mock"] 이 더 정확한 신선도 신호다.
    """
    now = now or datetime.datetime.now(KST)
    if now.weekday() >= 5:  # 토·일
        return "closed"
    hhmm = _hhmm(now)
    if 900 <= hhmm < 1530:
        return "open"
    if 1530 <= hhmm < 1800:
        return "after"
    return "closed"


def should_collect(now: datetime.datetime | None = None) -> bool:
    """수집기 게이트 — 평일 09:00~15:40 에만 True.

    market_status() == "open" 을 쓰지 않는 이유는 위 모듈 독스트링의 유예 10분 때문이다.
    """
    now = now or datetime.datetime.now(KST)
    if now.weekday() >= 5:
        return False
    return _COLLECT_OPEN_HHMM <= _hhmm(now) < _COLLECT_CLOSE_HHMM
```

- [ ] **Step 4: `deps.py` 를 core 재노출로 바꾼다**

`backend/api/deps.py` 에서 `_KST` 정의와 `market_status` 함수 본문(90~107행)을 지우고, 상단 import 블록에 다음을 더한다:

```python
from ..core.market_hours import KST as _KST, market_status  # noqa: F401 — 라우트가 deps 에서 import 한다
```

(기존 `from ..core.indicators import ...` 줄 아래에 둔다.)

`deps.py` 안에서 `_KST` 를 쓰는 다른 코드가 없으면 `KST as _KST` 별칭도 지운다. 확인:

Run: `grep -n "_KST" backend/api/deps.py`

`stock_header()` 의 `"market_status": market_status()` 호출은 그대로 둔다 — 이제 재노출된 함수를 부른다.

- [ ] **Step 5: 테스트 통과를 확인한다**

Run: `pytest backend/tests/test_market_hours.py -q`
Expected: PASS (17 passed)

- [ ] **Step 6: 회귀 — 기존 테스트가 다 도는지 본다**

Run: `pytest backend/tests -q`
Expected: PASS. 특히 `test_readonly_routes.py`, `test_api.py` 가 `market_status` 를 타므로 여기서 깨지면 재노출이 잘못된 것이다.

- [ ] **Step 7: 커밋**

```bash
git add backend/core/market_hours.py backend/api/deps.py backend/tests/test_market_hours.py
git commit -m "refactor(core): 장 시간 판정을 core 로 옮기고 수집 게이트를 추가

market_status 는 그대로 두고, 수집 전용 should_collect(평일 09:00~15:40)를 새로 만든다.
마감 뒤 10분의 유예는 마지막 사이클이 종가를 담고 끝나게 하기 위함.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 수집기를 장중 180초로 바꾸고 게이트를 건다

**Files:**
- Modify: `backend/core/collector.py:32` (import), `:41-45` (`COLLECT_INTERVAL_SEC`), `:105-141` (`run_cycle`)
- Test: `backend/tests/test_collector.py` (기존 파일에 추가)

**Interfaces:**
- Consumes: `backend.core.market_hours.should_collect` (Task 1)
- Produces: `run_cycle()` 의 반환 dict 에 키 `"skipped": bool` 이 추가된다. 장 밖이면 `{"ok": 0, "failed": [], "elapsed_sec": 0.0, "skipped": True}`. 장중이면 기존 세 키 + `"skipped": False`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`backend/tests/test_collector.py` 끝에 붙인다 (파일 상단 import 에 `import datetime` 이 없으면 더한다):

```python
def test_run_cycle_skips_outside_market_hours(monkeypatch):
    """장 밖이면 KIS 를 한 번도 부르지 않고 즉시 리턴한다."""
    from backend.core import collector

    called = []

    def _boom(*args, **kwargs):
        called.append(args)
        raise AssertionError("장 밖인데 수집을 시도했다")

    monkeypatch.setattr(collector, "collect_ticker", _boom)
    monkeypatch.setattr(collector, "should_collect", lambda: False)

    result = collector.run_cycle(universe=[{"ticker": "005930", "name": "삼성전자"}])

    assert result["skipped"] is True
    assert result["ok"] == 0
    assert called == []


def test_run_cycle_runs_inside_market_hours(monkeypatch):
    """장중이면 평소대로 돈다."""
    from backend.core import collector

    monkeypatch.setattr(collector, "collect_ticker",
                        lambda ticker, name, store=None, tier=0: {"ticker": ticker})
    monkeypatch.setattr(collector, "should_collect", lambda: True)

    result = collector.run_cycle(universe=[{"ticker": "005930", "name": "삼성전자"}])

    assert result["skipped"] is False
    assert result["ok"] == 1
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `pytest backend/tests/test_collector.py -q -k market_hours`
Expected: FAIL — `AttributeError: <module 'backend.core.collector'> has no attribute 'should_collect'`

- [ ] **Step 3: `collector.py` 를 고친다**

import 줄(32~35행)을 이렇게 바꾼다 — `market_status` 는 collector 안에서 안 쓰이므로(헤더 값은 `header["market_status"]` 로 온다) 임포트에서 뺀다:

```python
from ..api.deps import load_indicators, stock_header
from . import scoring
from .kis import COLLECT_WORKERS, KISAuthError
from .market_hours import should_collect
from .snapshot_store import SnapshotStore, get_store
```

`COLLECT_INTERVAL_SEC` (45행) 기본값을 180 으로 낮추고, 위 주석의 근거를 갱신한다:

```python
# 종목당 GET 최대 18회(분봉 최대 12페이지 + 수급 4 + 현재가 2). 실측(2026-07-10, 워커 24):
# 200종목 1사이클 381초, GET 2,574회, 6.8 req/s. 유량 상한(12/s)이 아니라 KIS 응답 지연이 바닥이다.
# 사이클이 주기보다 길면 max_instances=1 이 그냥 건너뛴다 — 호출량이 두 배가 되진 않고,
# 사실상 '끝나는 대로 다시' 가 된다. 그래서 주기를 낮추는 건 상한이 아니라 하한을 당기는 셈이다.
COLLECT_INTERVAL_SEC = int(os.getenv("COLLECT_INTERVAL_SEC", "180"))
```

`run_cycle()` 의 독스트링과 진입부(111~114행 근처)에 게이트를 더한다:

```python
def run_cycle(universe: list[dict] | None = None,
              store: SnapshotStore | None = None) -> dict:
    """유니버스 한 바퀴. 종목 실패는 넘어가고, 인증 실패는 사이클을 중단한다.

    장 밖(should_collect() False)이면 아무것도 하지 않는다. 게이트를 스케줄러가 아니라
    여기 두는 이유는, 수동 실행(python -m backend.core.collector)에도 같은 규칙을 걸기
    위함이다. 시세가 안 변하는 밤·주말에 KIS 를 두드릴 이유가 없다.

    실패한 종목의 이전 스냅샷은 건드리지 않는다(stale-while-revalidate).
    인증이 거부되면 남은 종목도 전부 같은 이유로 실패할 테니 헛돌지 않고 즉시 올린다.
    """
    if not should_collect():
        log.info("장 밖 — 수집 사이클 건너뜀")
        return {"ok": 0, "failed": [], "elapsed_sec": 0.0, "skipped": True}

    universe = universe if universe is not None else load_universe()
    store = store or get_store()
    ...
```

마지막 return (141행)에 `"skipped": False` 를 더한다:

```python
    log.info("사이클 완료: %d종목 성공, %d종목 실패, %.1f초", ok, len(failed), elapsed)
    return {"ok": ok, "failed": failed, "elapsed_sec": round(elapsed, 1), "skipped": False}
```

- [ ] **Step 4: 테스트 통과를 확인한다**

Run: `pytest backend/tests/test_collector.py -q`
Expected: PASS

- [ ] **Step 5: 수동 실행 경로(`_main`)가 스킵을 알아듣는지 본다**

`_main()` 의 출력(159행)은 스킵일 때 "0종목 성공 / 0종목 실패 / 0.0초" 라고 찍혀 오해를 부른다. 한 줄 고친다:

```python
    while True:
        result = run_cycle(universe)
        if result["skipped"]:
            print("장 밖 — 수집 건너뜀")
        else:
            print(f"{result['ok']}종목 성공 / {len(result['failed'])}종목 실패 "
                  f"/ {result['elapsed_sec']}초")
            for ticker, err in result["failed"]:
                print(f"  실패 {ticker}: {err}")
        if not args.loop:
            return 0 if not result["failed"] else 1
        time.sleep(args.interval)
```

- [ ] **Step 6: 회귀 — 스케줄러 테스트 포함 전체를 돌린다**

Run: `pytest backend/tests -q`
Expected: PASS. `test_scheduler.py` 가 `COLLECT_INTERVAL_SEC` 값을 단언하고 있으면 180 으로 갱신한다.

- [ ] **Step 7: 커밋**

```bash
git add backend/core/collector.py backend/tests/test_collector.py
git commit -m "feat(collector): 장중 180초 주기, 장 밖에는 수집 정지

run_cycle 진입부에서 should_collect 로 막는다 — 스케줄러가 아니라 사이클 안에 둬
수동 실행에도 같은 규칙이 걸린다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `useAutoRefresh` 훅

**Files:**
- Create: `frontend/src/hooks/useAutoRefresh.js`

**Interfaces:**
- Consumes: 없음
- Produces:

```js
useAutoRefresh(fetcher, deps, options) => {
  data,          // 마지막으로 성공한 데이터. 갱신 실패해도 유지된다. 초기 null
  error,         // 마지막 실패 메시지 | null. 성공하면 null 로 지워진다
  loading,       // 첫 로드 중(= data 가 아직 null)일 때만 true
  isRefreshing,  // 배경 갱신 중 true (data 는 그대로 보인다)
  fetchedAt,     // 마지막 성공 시각 (Date) | null
  refresh,       // () => void — 즉시 1회 갱신 (수동 새로고침 버튼용)
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
 * 왜 훅으로 뽑는가: 다섯 탭이 같은 fetch/abort/에러 처리를 각자 복사해 갖고 있었다.
 * 폴링을 다섯 번 복붙하면 다섯 번 다르게 틀린다.
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

  // fetcher 는 매 렌더 새 함수다. deps 에 넣으면 무한 루프가 되므로 ref 로 고정한다.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // 진행 중인 요청. 새 요청이 뜨면 이전 것을 끊는다(늦게 온 응답이 최신을 덮지 않게).
  const ctrlRef = useRef(null);
  // deps 가 바뀌면 이전 데이터는 다른 종목/구간의 것이다 — 버리고 첫 로드로 되돌린다.
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

    // 숨어 있던 동안 못 한 갱신을 돌아오는 즉시 한 번에 따라잡는다
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

- [ ] **Step 2: 구문 오류가 없는지 빌드로 확인한다**

Run: `cd frontend && npm run build`
Expected: 빌드 성공 (훅이 아직 아무 데서도 안 쓰이므로 트리셰이킹돼도 파싱은 된다)

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/hooks/useAutoRefresh.js
git commit -m "feat(frontend): 주기 폴링 훅 useAutoRefresh

60초 폴링 + 탭 숨김 시 정지 + 복귀 즉시 갱신. 갱신 실패는 직전 데이터를 유지한다.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 갱신 시각 + 수동 새로고침 바

**Files:**
- Modify: `frontend/src/ui.jsx` (`Banner` 옆에 `RefreshBar` 추가 후 export)

**Interfaces:**
- Consumes: 없음
- Produces: `import { RefreshBar } from "../ui.jsx"` — props:
  - `asOf: string | null` — 서버가 준 스냅샷 시각(ISO). signal·screener 만 준다
  - `fetchedAt: Date | null` — 클라이언트 fetch 성공 시각. `asOf` 가 없을 때 쓴다
  - `isRefreshing: bool`
  - `error: string | null` — 있으면 "갱신 실패" 를 덧붙인다
  - `onRefresh: () => void`

- [ ] **Step 1: `ui.jsx` 에 `RefreshBar` 를 더한다**

기존 `Banner` 정의 아래에 붙인다:

```jsx
/** 두 시각 중 실제 데이터의 나이를 말해주는 쪽을 고른다.
 *  signal·screener 는 스냅샷을 읽으므로 서버 as_of 가 진짜 데이터 시각이다(최대 3분 늙었다).
 *  technical·flow 는 KIS 를 직접 치는 라이브 라우트라 fetch 시각이 곧 데이터 시각이다. */
function ageText(asOf, fetchedAt) {
  const t = asOf ? new Date(asOf) : fetchedAt;
  if (!t || Number.isNaN(t.getTime())) return "—";
  const sec = Math.max(0, Math.round((Date.now() - t.getTime()) / 1000));
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간 전`;
}

export function RefreshBar({ asOf, fetchedAt, isRefreshing, error, onRefresh }) {
  // 시각 문자열은 시간이 흘러야 바뀐다 — 30초마다 다시 그린다.
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end",
                  gap: "var(--space-2)", marginBottom: "var(--space-3)",
                  fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
      <span className="ds-numeric">
        {error ? `갱신 실패 · 마지막 데이터 ${ageText(asOf, fetchedAt)}` : `갱신 ${ageText(asOf, fetchedAt)}`}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        aria-label="새로고침"
        style={{ background: "none", border: "1px solid var(--border-default)",
                 borderRadius: "var(--radius-sm)", color: "var(--text-tertiary)",
                 cursor: isRefreshing ? "default" : "pointer", padding: "2px 8px",
                 opacity: isRefreshing ? 0.5 : 1 }}
      >
        {isRefreshing ? "갱신 중…" : "↻"}
      </button>
    </div>
  );
}
```

`ui.jsx` 상단에 `import React from "react";` 가 없으면 더한다 (`React.useState` 를 쓰므로).

- [ ] **Step 2: 빌드로 확인한다**

Run: `cd frontend && npm run build`
Expected: 빌드 성공

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/ui.jsx
git commit -m "feat(frontend): 갱신 시각·새로고침 버튼 RefreshBar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 다섯 탭을 훅으로 갈아끼운다

**Files:**
- Modify: `frontend/src/tabs/OverviewTab.jsx:69-91`
- Modify: `frontend/src/tabs/TechnicalTab.jsx:121-134`
- Modify: `frontend/src/tabs/FlowTab.jsx:222-234`
- Modify: `frontend/src/tabs/ScreenerTab.jsx:50-62`
- Modify: `frontend/src/tabs/MacroTab.jsx:161-177`

**Interfaces:**
- Consumes: `useAutoRefresh` (Task 3), `RefreshBar` (Task 4)
- Produces: 없음 (탭 내부 변경)

각 탭에서 기존 `useState(data/loading/error)` + `useEffect(fetch)` 블록을 지우고 훅 호출로 바꾼다. 렌더 부분에서 `loading`/`error`/`data` 를 읽는 코드는 이름이 같으므로 그대로 둔다. 단 **`error` 가 있어도 `data` 가 있으면 렌더한다** — 기존 코드가 `if (error) return <Banner .../>` 로 일찍 리턴한다면, `if (error && !data)` 로 바꾼다.

- [ ] **Step 1: OverviewTab**

기존 69~91행의 `useEffect` 와 그 위의 `const [data, setData] = useState(null)` / `loading` / `error` useState 들을 지우고:

```jsx
import useAutoRefresh from "../hooks/useAutoRefresh.js";
import { RefreshBar } from "../ui.jsx";   // 기존 ui.jsx import 에 합칠 것

const { data, error, loading, isRefreshing, fetchedAt, refresh } = useAutoRefresh(
  async (signal) => {
    const qs = new URLSearchParams({ account: String(account), risk_pct: String(riskPct) });
    if (entry != null) qs.set("entry", String(entry));
    if (weights) qs.set("weights", JSON.stringify(normalizeWeights(weights)));
    const res = await fetch(`${API}/api/signal/${ticker}?${qs}`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  [ticker, account, riskPct, entry, weights],
  { debounceMs: 300 },   // 슬라이더를 끌 때마다 쏘지 않는다 (기존 동작 유지)
);
```

렌더 최상단(로딩/에러 분기 뒤, 콘텐츠 앞)에 넣는다:

```jsx
<RefreshBar asOf={data.as_of} fetchedAt={fetchedAt} isRefreshing={isRefreshing}
            error={error} onRefresh={refresh} />
```

`data.as_of` 는 signal 라우트가 스냅샷 `as_of` 를 실어 준다.

- [ ] **Step 2: TechnicalTab**

```jsx
const { data, error, loading, isRefreshing, fetchedAt, refresh } = useAutoRefresh(
  async (signal) => {
    const res = await fetch(`${API}/api/technical/${ticker}?interval=${interval}&bars=120`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  [ticker, interval],
);
```

`RefreshBar` 는 `asOf={null}` 로 둔다 — technical 라우트는 라이브라 `fetchedAt` 이 곧 데이터 시각이다:

```jsx
<RefreshBar asOf={null} fetchedAt={fetchedAt} isRefreshing={isRefreshing}
            error={error} onRefresh={refresh} />
```

- [ ] **Step 3: FlowTab**

```jsx
const { data, error, loading, isRefreshing, fetchedAt, refresh } = useAutoRefresh(
  async (signal) => {
    const res = await fetch(`${API}/api/flow/${ticker}`, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  [ticker],
);
```

```jsx
<RefreshBar asOf={null} fetchedAt={fetchedAt} isRefreshing={isRefreshing}
            error={error} onRefresh={refresh} />
```

- [ ] **Step 4: ScreenerTab**

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

screener 는 응답에 `as_of`(전 종목 스냅샷 중 가장 오래된 것)를 준다:

```jsx
<RefreshBar asOf={data.as_of} fetchedAt={fetchedAt} isRefreshing={isRefreshing}
            error={error} onRefresh={refresh} />
```

- [ ] **Step 5: MacroTab**

매크로는 세 엔드포인트를 병렬로 받고, 지표가 분 단위로 안 변하므로 300초 주기로 둔다. 세 개를 하나의 fetcher 로 합친다:

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
  { intervalMs: 300000 },   // 매크로 지표는 분 단위로 안 변한다
);
```

기존에 `base` / `indData` / `quotesData` 세 개의 state 를 각각 읽던 렌더 코드는 `data.base` / `data.indicators` / `data.quotes` 로 바꾼다.

`asOf` 는 `data.quotes?.quotes?.as_of` 를 쓴다 (`/api/macro/quotes` 응답이 `{quotes: {..., as_of}}` 모양이다):

```jsx
<RefreshBar asOf={data.quotes?.quotes?.as_of} fetchedAt={fetchedAt} isRefreshing={isRefreshing}
            error={error} onRefresh={refresh} />
```

- [ ] **Step 6: 빌드**

Run: `cd frontend && npm run build`
Expected: 빌드 성공, 경고 없음

- [ ] **Step 7: 커밋**

```bash
git add frontend/src/tabs/
git commit -m "feat(frontend): 다섯 탭을 자동갱신 훅으로 전환

탭별 60초 폴링(매크로만 300초) + 갱신 시각·새로고침 바.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: 실제로 도는지 눈으로 확인한다

**Files:** 없음 (검증만)

- [ ] **Step 1: `/verify` 스킬로 앱을 띄운다**

백엔드(FastAPI) + 프론트(Vite) 를 올리고 Playwright 로 UI 를 연다.

- [ ] **Step 2: 폴링을 확인한다**

- 브라우저 DevTools Network 탭에서 각 탭이 60초마다 자기 엔드포인트를 다시 부르는지 본다 (매크로는 300초)
- 헤더의 "갱신 N분 전" 이 시간이 지나며 올라가는지 본다
- `↻` 버튼을 눌러 즉시 갱신되는지 본다
- 다른 브라우저 탭으로 갔다가 돌아오면 즉시 한 번 갱신되는지 본다

- [ ] **Step 3: 수집 게이트를 확인한다**

앱 로그에서 스케줄러 메시지를 본다. 장 밖(예: 밤·주말)이면 180초마다 `장 밖 — 수집 사이클 건너뜀` 이 찍히고 KIS 호출이 없어야 한다. 장중이면 `사이클 완료: N종목 성공...` 이 찍힌다.

지금이 장 밖이라 장중 경로를 못 보면, 게이트를 임시로 뚫어 한 사이클만 돌려 본다:

```bash
python -c "from unittest.mock import patch; import backend.core.collector as c; patch.object(c, 'should_collect', lambda: True).start(); print(c.run_cycle(c.load_universe()[:5]))"
```

Expected: 5종목 수집 성공, `skipped: False`

- [ ] **Step 4: 백엔드 전체 테스트**

Run: `pytest backend/tests -q`
Expected: PASS

- [ ] **Step 5: 커밋할 것이 남았으면 커밋**

없으면 넘어간다.
