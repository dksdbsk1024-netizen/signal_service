// 호가창(Level 2) + 체결강도 섹션. fetch 하지 않는다 — /api/flow 응답 조각만 받는다.
// changePct 는 브리프 시그니처엔 없지만 호가창 중앙의 현재가 줄(색·등락률)이 쓰던 값이다.
import React from "react";
import { Card, SectionLabel } from "../ui.jsx";

// ── 호가창 Level 2 (매도=파랑 위, 매수=빨강 아래) ──
function OrderBookRow({ price, qty, maxQty, side }) {
  const pct = Math.max(2, (qty / maxQty) * 100);
  const barColor = side === "ask" ? "var(--signal-sell)" : "var(--signal-buy)";
  return (
    <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 72px", alignItems: "center", height: 22, borderBottom: "1px solid var(--border-default)" }}>
      <div style={{ position: "absolute", inset: 0 }}><div style={{ width: `${pct}%`, height: "100%", background: barColor, opacity: 0.16 }} /></div>
      <span className="ds-numeric" style={{ position: "relative", fontSize: "var(--text-xs)", fontWeight: 500, color: barColor, paddingLeft: "var(--space-2)" }}>{price.toLocaleString("ko-KR")}</span>
      <span className="ds-numeric" style={{ position: "relative", fontSize: "var(--text-xs)", color: "var(--text-secondary)", textAlign: "right", paddingRight: "var(--space-2)" }}>{qty.toLocaleString("ko-KR")}</span>
    </div>
  );
}

function OrderBook({ book, currentPrice, changePct }) {
  const maxQty = Math.max(...book.asks.map((r) => r.qty), ...book.bids.map((r) => r.qty));
  const priceColor = changePct >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 72px", padding: "0 0 var(--space-1)", borderBottom: "1px solid var(--border-strong)" }}>
        <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", paddingLeft: "var(--space-2)" }}>호가</span>
        <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", textAlign: "right", paddingRight: "var(--space-2)" }}>잔량</span>
      </div>
      {book.asks.slice().sort((a, b) => b.price - a.price).map((r) => <OrderBookRow key={"a" + r.price} price={r.price} qty={r.qty} maxQty={maxQty} side="ask" />)}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "var(--space-2) 0", background: "var(--bg-inset)", border: "1px solid var(--border-strong)" }}>
        <span className="ds-numeric" style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: priceColor }}>{currentPrice.toLocaleString("ko-KR")}</span>
        <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: priceColor }}>{changePct > 0 ? "+" : ""}{changePct.toFixed(2)}%</span>
      </div>
      {book.bids.slice().sort((a, b) => b.price - a.price).map((r) => <OrderBookRow key={"b" + r.price} price={r.price} qty={r.qty} maxQty={maxQty} side="bid" />)}
    </div>
  );
}

function ExecutionStrengthMeter({ value }) {
  const clamped = Math.max(20, Math.min(200, value));
  const buyPct = Math.min(100, (clamped / 200) * 100);
  const dominant = value >= 100;
  const color = dominant ? "var(--signal-buy)" : "var(--signal-sell)";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
        <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>체결강도</span>
        <span className="ds-numeric" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color }}>
          {value.toFixed(1)}<span style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--text-tertiary)", marginLeft: 6 }}>{dominant ? "매수 우위" : "매도 우위"}</span>
        </span>
      </div>
      <div style={{ position: "relative", height: 10, borderRadius: "var(--radius-pill)", background: "var(--bg-inset)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--border-strong)", zIndex: 1 }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: dominant ? "50%" : `${buyPct}%`, right: dominant ? `${100 - buyPct}%` : "50%", background: color, opacity: 0.85 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>0</span>
        <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>100</span>
        <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>200</span>
      </div>
    </div>
  );
}

export default function OrderBookSection({ orderbook, tradeStrength, price, changePct }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <Card style={{ padding: "var(--space-3)" }}>
        <SectionLabel>호가창 (Level 2)</SectionLabel>
        <OrderBook book={orderbook} currentPrice={price} changePct={changePct} />
      </Card>
      {tradeStrength && (
        <Card><ExecutionStrengthMeter value={tradeStrength.strength} /></Card>
      )}
    </div>
  );
}
