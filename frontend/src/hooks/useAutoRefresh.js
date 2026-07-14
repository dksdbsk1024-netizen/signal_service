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
 * enabled=false 는 "주기 갱신을 멈춘다"이지 "fetch 를 막는다"가 아니다. 라이브 KIS 를 때리는
 * 라우트를 장 밖에서 무한 폴링하지 않게 하는 스위치인데, 사용자가 직접 요청한 fetch 까지
 * 막으면 화면이 빈 채로 굳는다. 그래서 deps 변경 fetch(종목 전환)와 수동 refresh() 는 항상 산다.
 * 멈추는 것은 인터벌 틱과 탭 복귀 갱신 — 사람이 부르지 않은 호출 두 가지뿐이다.
 *
 * @param {(signal: AbortSignal) => Promise<any>} fetcher AbortSignal 을 fetch 에 넘길 것
 * @param {any[]} deps 바뀌면 즉시 재호출 + 타이머 재시작
 * @param {{intervalMs?: number, debounceMs?: number, enabled?: boolean}} options
 */
export default function useAutoRefresh(fetcher, deps, options = {}) {
  const { intervalMs = 60000, debounceMs = 0, enabled = true } = options;

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);

  // fetcher 는 매 렌더 새 함수다. effect 의존성에 넣으면 무한 루프가 되므로 ref 로 고정한다.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // 진행 중인 요청. 새 요청이 뜨면 이전 것을 끊는다(늦게 온 응답이 최신을 덮지 않게).
  const ctrlRef = useRef(null);
  // 폴링 타이머와 그 재무장 함수. 폴링 effect 가 armRef 를 채운다(비활성이면 no-op 인 채로 둔다).
  const pollRef = useRef(null);
  const armRef = useRef(() => {});
  // deps 는 원시값이나 평범한 JSON 객체만 넣을 것 — 순환 참조·BigInt 는 렌더 중에 던진다.
  const depsKey = JSON.stringify(deps);

  const run = useCallback(async () => {
    // 갱신했으면 다음 틱은 지금부터 60초다. 재무장하지 않으면 t=59 초에 누른 수동 ↻ 가
    // 1초 뒤 인터벌 틱을 또 부른다 — 한 번 눌러 두 번 쏘는 꼴.
    armRef.current();

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
      // 끊긴 요청의 실패는 말하지 않는다. AbortError 만 걸러선 모자라다 — fetcher 가
      // `if (!res.ok) throw new Error(...)` 로 던지면 이름이 AbortError 가 아니라서,
      // 종목을 바꾼 뒤 늦게 실패한 이전 종목의 에러가 새 종목 화면에 배너로 뜬다.
      if (ctrl.signal.aborted) return;
      if (e.name === "AbortError") return;
      setError(e.message || "요청 실패");
    } finally {
      if (!ctrl.signal.aborted) setIsRefreshing(false);
    }
  }, []);

  // deps 변경 fetch. enabled 를 보지 않는다 — 종목을 바꿨는데 안 읽으면 빈 화면이다.
  // 폴링 effect 와 나눠 놓은 이유: 합쳐 두면 enabled 가 뒤집힐 때(장 개장) setData(null) 이
  // 같이 돌아 멀쩡히 보고 있던 차트가 로딩으로 깜빡인다.
  useEffect(() => {
    setData(null);        // deps 가 바뀌었다 — 이전 종목의 데이터를 보여주면 거짓말이다
    setError(null);
    setFetchedAt(null);

    const timer = debounceMs ? setTimeout(run, debounceMs) : null;
    if (!timer) run();

    return () => {
      if (timer) clearTimeout(timer);
      ctrlRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, debounceMs, run]);

  // 주기 폴링 + 탭 복귀 갱신. 사람이 부르지 않은 호출이라 enabled=false 면 아예 달지 않는다.
  useEffect(() => {
    if (!enabled) return undefined;

    const arm = () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        if (document.hidden) return;  // 백그라운드 탭은 헛돌지 않는다
        run();
      }, intervalMs);
    };
    armRef.current = arm;
    arm();

    // 숨어 있던 동안 못 한 갱신을 돌아오는 즉시 따라잡는다
    const onVisible = () => { if (!document.hidden) run(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      armRef.current = () => {};
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, enabled, intervalMs, run]);

  return {
    data,
    error,
    loading: data === null && error === null,
    isRefreshing,
    fetchedAt,
    refresh: run,
  };
}
