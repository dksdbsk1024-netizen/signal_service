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
