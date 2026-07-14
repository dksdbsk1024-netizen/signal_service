// 탭3 — 수급. /api/flow/{ticker} 연결.
// 좌: 호가창(Level2)+체결강도. 우: 순매수 추이·프로그램매매·거래원.
// 렌더는 sections/OrderBookSection·InvestorFlowSection 으로 나갔다.
import React, { useEffect, useState } from "react";
import { API, Ds, NAME_BY_TICKER, Card, Banner } from "../ui.jsx";
import OrderBookSection from "../sections/OrderBookSection.jsx";
import InvestorFlowSection from "../sections/InvestorFlowSection.jsx";

const { StockHeader } = Ds;

export default function FlowTab({ ticker }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`${API}/api/flow/${ticker}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) { if (e.name !== "AbortError") setError(e.message || "요청 실패"); }
      finally { setLoading(false); }
    })();
    return () => ctrl.abort();
  }, [ticker]);

  if (error) return <Banner tone="error">API 오류: {error} — 백엔드(8000) 확인.</Banner>;
  if (!data) return <Banner>{loading ? "수급 불러오는 중…" : "종목을 선택하세요."}</Banner>;

  const { header, orderbook, series, trade_strength, brokers } = data;
  const name = NAME_BY_TICKER[ticker] || ticker;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <Card style={{ padding: "var(--space-3) var(--space-5)" }}>
        {StockHeader && <StockHeader name={name} ticker={header.ticker} price={header.price} changePct={header.change_pct} changeAmt={header.change} volume={`${(header.volume / 1e4).toFixed(1)}만주`} marketStatus={header.market_status} />}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "var(--space-3)", alignItems: "start" }}>
        {/* 좌: 호가창 고정. sticky 는 섹션 바깥에 둔다 — 섹션은 위치를 모르는 순수 표시 컴포넌트다. */}
        <div style={{ position: "sticky", top: "var(--space-4)" }}>
          <OrderBookSection
            orderbook={orderbook}
            tradeStrength={trade_strength}
            price={header.price}
            changePct={header.change_pct}
          />
        </div>

        {/* 우: 순매수 추이 · 프로그램 · 거래원 */}
        <InvestorFlowSection series={series} brokers={brokers} />
      </div>
    </div>
  );
}
