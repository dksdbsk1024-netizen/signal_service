// 탭3 — 수급. /api/flow/{ticker} 연결.
// 좌: 호가창(Level2). 우: 순매수 추이(일별/누적)·프로그램매매·체결강도·거래원. (flow-tab UI 킷 패턴)
import React, { useEffect, useState } from "react";
import { API, Ds, NAME_BY_TICKER, Card, SectionLabel, SegmentedControl, Banner } from "../ui.jsx";

const { StockHeader } = Ds;

const NETBUY_MODES = [
  { id: "daily", label: "일별" },
  { id: "cum", label: "누적" },
];

function fmtSigned(v) {
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return sign + Math.abs(Math.round(v)).toLocaleString("ko-KR");
}
function fmtEok(v) {
  return fmtSigned(v) + "억";
}

// ── 외국인·기관 순매수 추이 (일별 그룹 막대 / 누적 라인) ──
function NetBuyTrendChart({ data, mode, height = 200, vbWidth = 760 }) {
  const padTop = 14, padBottom = 22, plotLeft = 8, plotRight = 8;
  const plotW = vbWidth - plotLeft - plotRight;
  const plotH = height - padTop - padBottom;
  const n = data.dates.length;
  const xAt = (i) => plotLeft + (i + 0.5) * (plotW / n);

  if (mode === "daily") {
    const maxAbs = Math.max(...data.foreign.map(Math.abs), ...data.institution.map(Math.abs), 1);
    const yAt = (v) => padTop + (1 - (v + maxAbs) / (maxAbs * 2)) * plotH;
    const zeroY = yAt(0);
    const groupW = plotW / n;
    const barW = groupW * 0.32;
    return (
      <svg viewBox={`0 0 ${vbWidth} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <line x1={plotLeft} y1={zeroY} x2={vbWidth - plotRight} y2={zeroY} stroke="var(--border-strong)" strokeWidth="1" />
        {data.dates.map((d, i) => {
          const fx = xAt(i) - barW * 0.65, ix = xAt(i) + barW * 0.65;
          const fv = data.foreign[i], iv = data.institution[i];
          return (
            <g key={i}>
              <rect x={fx - barW / 2} y={Math.min(zeroY, yAt(fv))} width={barW} height={Math.max(1, Math.abs(yAt(fv) - zeroY))} fill={fv >= 0 ? "var(--signal-buy)" : "var(--signal-sell)"} opacity="0.95" />
              <rect x={ix - barW / 2} y={Math.min(zeroY, yAt(iv))} width={barW} height={Math.max(1, Math.abs(yAt(iv) - zeroY))} fill={iv >= 0 ? "var(--signal-buy)" : "var(--signal-sell)"} opacity="0.5" />
            </g>
          );
        })}
        {data.dates.map((d, i) => i % Math.ceil(n / 8) === 0 ? (
          <text key={"t" + i} x={xAt(i)} y={height - 6} fontSize="12" textAnchor="middle" fill="var(--text-tertiary)" fontFamily="var(--font-body)">{d}</text>
        ) : null)}
      </svg>
    );
  }
  // 누적
  const cumF = [], cumI = [];
  data.foreign.reduce((s, v) => (cumF.push(s + v), s + v), 0);
  data.institution.reduce((s, v) => (cumI.push(s + v), s + v), 0);
  const all = [...cumF, ...cumI, 0];
  const maxV = Math.max(...all), minV = Math.min(...all), range = maxV - minV || 1;
  const yAt = (v) => padTop + (1 - (v - minV) / range) * plotH;
  const zeroY = yAt(0);
  const pathFor = (s) => s.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${vbWidth} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <line x1={plotLeft} y1={zeroY} x2={vbWidth - plotRight} y2={zeroY} stroke="var(--border-strong)" strokeWidth="1" />
      <path d={pathFor(cumI)} fill="none" stroke={cumI[cumI.length - 1] >= 0 ? "var(--signal-buy)" : "var(--signal-sell)"} strokeWidth="2" strokeDasharray="5 4" opacity="0.75" />
      <path d={pathFor(cumF)} fill="none" stroke={cumF[cumF.length - 1] >= 0 ? "var(--signal-buy)" : "var(--signal-sell)"} strokeWidth="2.5" />
      {data.dates.map((d, i) => i % Math.ceil(n / 8) === 0 ? (
        <text key={"t" + i} x={xAt(i)} y={height - 6} fontSize="12" textAnchor="middle" fill="var(--text-tertiary)" fontFamily="var(--font-body)">{d}</text>
      ) : null)}
    </svg>
  );
}

function LegendSwatch({ color, opacity, dashed, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 12, height: dashed ? 2 : 8, borderRadius: dashed ? 0 : 2, background: dashed ? "none" : color, borderTop: dashed ? `2px dashed ${color}` : "none", opacity: opacity != null ? opacity : 1, display: "inline-block" }} />
      <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{label}</span>
    </div>
  );
}

function ProgramTradingStrip({ net }) {
  const last = net[net.length - 1];
  const total = net.reduce((s, v) => s + v, 0);
  const color = total >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";
  const maxAbs = Math.max(...net.map(Math.abs), 1);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
      <div>
        <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>프로그램 순매수 (누적)</div>
        <div className="ds-numeric" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color, marginTop: 2 }}>{fmtEok(total)}</div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 3, height: 40 }}>
        {net.map((v, i) => (
          <div key={i} style={{ flex: 1, height: Math.max(2, (Math.abs(v) / maxAbs) * 36), background: v >= 0 ? "var(--signal-buy)" : "var(--signal-sell)", opacity: 0.75, borderRadius: 1 }} />
        ))}
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>직전</div>
        <div className="ds-numeric" style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: last >= 0 ? "var(--signal-buy)" : "var(--signal-sell)" }}>{fmtEok(last)}</div>
      </div>
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

function BrokerTable({ brokers }) {
  const [sortKey, setSortKey] = useState("net");
  const cols = [
    { key: "rank", label: "순위" }, { key: "name", label: "창구" },
    { key: "buy", label: "매수" }, { key: "sell", label: "매도" }, { key: "net", label: "순매수" },
  ];
  const sorted = brokers.slice().sort((a, b) => sortKey === "buy" ? b.buy - a.buy : sortKey === "sell" ? b.sell - a.sell : Math.abs(b.net) - Math.abs(a.net));
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-xs)" }}>
      <thead><tr>{cols.map((c) => (
        <th key={c.key} onClick={() => c.key !== "rank" && c.key !== "name" && setSortKey(c.key)}
          style={{ textAlign: c.key === "buy" || c.key === "sell" || c.key === "net" ? "right" : "left", fontSize: "var(--text-2xs)", color: sortKey === c.key ? "var(--accent-strong)" : "var(--text-tertiary)", fontWeight: 600, padding: "var(--space-2)", borderBottom: "1px solid var(--border-default)", whiteSpace: "nowrap", cursor: c.key === "rank" || c.key === "name" ? "default" : "pointer" }}>{c.label}</th>
      ))}</tr></thead>
      <tbody>{sorted.map((b, i) => (
        <tr key={b.name}>
          <td style={{ padding: "var(--space-2)", color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-default)" }}>{i + 1}</td>
          <td style={{ padding: "var(--space-2)", color: "var(--text-primary)", fontWeight: 500, borderBottom: "1px solid var(--border-default)", whiteSpace: "nowrap" }}>{b.name}</td>
          <td className="ds-numeric" style={{ padding: "var(--space-2)", textAlign: "right", color: "var(--signal-buy)", borderBottom: "1px solid var(--border-default)" }}>{b.buy.toLocaleString("ko-KR")}</td>
          <td className="ds-numeric" style={{ padding: "var(--space-2)", textAlign: "right", color: "var(--signal-sell)", borderBottom: "1px solid var(--border-default)" }}>{b.sell.toLocaleString("ko-KR")}</td>
          <td className="ds-numeric" style={{ padding: "var(--space-2)", textAlign: "right", fontWeight: 700, color: b.net >= 0 ? "var(--signal-buy)" : "var(--signal-sell)", borderBottom: "1px solid var(--border-default)" }}>{fmtSigned(b.net)}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

export default function FlowTab({ ticker }) {
  const [mode, setMode] = useState("daily");
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
        {/* 좌: 호가창 고정 */}
        <Card style={{ position: "sticky", top: "var(--space-4)", padding: "var(--space-3)" }}>
          <SectionLabel>호가창 (Level 2)</SectionLabel>
          <OrderBook book={orderbook} currentPrice={header.price} changePct={header.change_pct} />
        </Card>

        {/* 우: 순매수 추이 · 프로그램 · 체결강도 · 거래원 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <Card>
            <SectionLabel right={
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <LegendSwatch color="var(--text-primary)" label="외국인" />
                <LegendSwatch color="var(--text-primary)" opacity={0.5} dashed={mode === "cum"} label="기관" />
                <SegmentedControl items={NETBUY_MODES} activeId={mode} onChange={setMode} />
              </div>
            }>외국인·기관 순매수 추이</SectionLabel>
            <NetBuyTrendChart data={series} mode={mode} height={200} />
          </Card>

          <Card>
            <SectionLabel>프로그램 매매 동향</SectionLabel>
            <ProgramTradingStrip net={series.program} />
          </Card>

          <Card><ExecutionStrengthMeter value={trade_strength.strength} /></Card>

          <Card>
            <SectionLabel>거래원 상위</SectionLabel>
            <BrokerTable brokers={brokers} />
          </Card>
        </div>
      </div>
    </div>
  );
}
