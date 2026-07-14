// 탭2 — 기술적 분석. /api/technical/{ticker} 연결.
// 차트/지표 렌더는 sections/ 로 나갔다. 여기 남는 것은 fetch + 인터벌 상태(=API 파라미터)뿐이다.
import React, { useEffect, useState } from "react";
import { API, NAME_BY_TICKER, SectionEyebrow, Banner } from "../ui.jsx";
import ChartSection from "../sections/ChartSection.jsx";
import IndicatorSection from "../sections/IndicatorSection.jsx";

export default function TechnicalTab({ ticker }) {
  const [interval, setIntervalId] = useState("1m");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`${API}/api/technical/${ticker}?interval=${interval}&bars=120`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message || "요청 실패");
      } finally { setLoading(false); }
    })();
    return () => ctrl.abort();
  }, [ticker, interval]);

  const name = NAME_BY_TICKER[ticker] || ticker;

  if (error) return <Banner tone="error">API 오류: {error} — 백엔드(8000) 확인.</Banner>;
  if (!data) return <Banner>{loading ? "차트 불러오는 중…" : "종목을 선택하세요."}</Banner>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <SectionEyebrow index="2" title={`기술적 분석 — ${name}`} />

      <ChartSection
        candles={data.candles}
        overlays={data.overlays}
        interval={interval}
        onIntervalChange={setIntervalId}
        mock={data.mock}
        stale={data.stale}
        source={data.source}
      />

      <IndicatorSection table={data.indicators_table} interval={interval} />
    </div>
  );
}
