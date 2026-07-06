const { StockHeader, TabNavigation, StockSearchBar } = window.Ds_a0b250;

const TABS = [
  { id: "overview", label: "종합 신호" },
  { id: "technical", label: "기술적 분석" },
  { id: "flow", label: "수급" },
  { id: "macro", label: "매크로/시장" },
  { id: "screener", label: "관심종목" },
];

const NETBUY_MODES = [
  { id: "daily", label: "일별" },
  { id: "cum", label: "누적" },
];

function fmtWon(v) {
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  const abs = Math.abs(Math.round(v));
  return sign + abs.toLocaleString("ko-KR");
}

function fmtEok(v) {
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return sign + Math.abs(Math.round(v)).toLocaleString("ko-KR") + "억";
}

function SegmentedControl({ items, activeId, onChange }) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "var(--bg-inset)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        padding: 2,
        gap: 2,
      }}
    >
      {items.map((it) => {
        const active = it.id === activeId;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            style={{
              appearance: "none",
              cursor: "pointer",
              border: "none",
              borderRadius: "var(--radius-xs)",
              padding: "var(--space-1) var(--space-3)",
              fontSize: "var(--text-xs)",
              fontWeight: active ? "var(--weight-semibold)" : "var(--weight-regular)",
              color: active ? "var(--text-primary)" : "var(--text-tertiary)",
              background: active ? "var(--bg-surface-raised)" : "transparent",
              boxShadow: active ? "var(--shadow-xs)" : "none",
              whiteSpace: "nowrap",
              transition: "color var(--duration-fast) var(--ease-standard)",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "var(--tracking-wide)" }}>
        {children}
      </div>
      {right}
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-xs)",
        padding: "var(--space-4)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ---- 외국인·기관 순매수 추이 (daily grouped bars / cumulative lines) ----
function NetBuyTrendChart({ data, mode, height = 200, vbWidth = 760 }) {
  const padTop = 14;
  const padBottom = 22;
  const plotLeft = 8;
  const plotRight = 8;
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
          const fx = xAt(i) - barW * 0.65;
          const ix = xAt(i) + barW * 0.65;
          const fv = data.foreign[i];
          const iv = data.institution[i];
          const fColor = fv >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";
          const iColor = iv >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";
          return (
            <g key={i}>
              <rect x={fx - barW / 2} y={Math.min(zeroY, yAt(fv))} width={barW} height={Math.max(1, Math.abs(yAt(fv) - zeroY))} fill={fColor} opacity="0.95" />
              <rect x={ix - barW / 2} y={Math.min(zeroY, yAt(iv))} width={barW} height={Math.max(1, Math.abs(yAt(iv) - zeroY))} fill={iColor} opacity="0.5" />
            </g>
          );
        })}
        {data.dates.map((d, i) =>
          i % Math.ceil(n / 8) === 0 ? (
            <text key={"t" + i} x={xAt(i)} y={height - 6} fontSize="12" textAnchor="middle" fill="var(--text-tertiary)" fontFamily="var(--font-body)">
              {d}
            </text>
          ) : null
        )}
      </svg>
    );
  }

  // cumulative
  const cumForeign = [];
  const cumInst = [];
  data.foreign.reduce((s, v, i) => (cumForeign.push(s + v), s + v), 0);
  data.institution.reduce((s, v, i) => (cumInst.push(s + v), s + v), 0);
  const all = [...cumForeign, ...cumInst, 0];
  const maxV = Math.max(...all);
  const minV = Math.min(...all);
  const range = maxV - minV || 1;
  const yAt = (v) => padTop + (1 - (v - minV) / range) * plotH;
  const zeroY = yAt(0);
  const pathFor = (series) => series.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
  const foreignColor = cumForeign[cumForeign.length - 1] >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";
  const instColor = cumInst[cumInst.length - 1] >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";

  return (
    <svg viewBox={`0 0 ${vbWidth} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <line x1={plotLeft} y1={zeroY} x2={vbWidth - plotRight} y2={zeroY} stroke="var(--border-strong)" strokeWidth="1" />
      <path d={pathFor(cumInst)} fill="none" stroke={instColor} strokeWidth="2" strokeDasharray="5 4" opacity="0.75" />
      <path d={pathFor(cumForeign)} fill="none" stroke={foreignColor} strokeWidth="2.5" />
      {data.dates.map((d, i) =>
        i % Math.ceil(n / 8) === 0 ? (
          <text key={"t" + i} x={xAt(i)} y={height - 6} fontSize="12" textAnchor="middle" fill="var(--text-tertiary)" fontFamily="var(--font-body)">
            {d}
          </text>
        ) : null
      )}
    </svg>
  );
}

function LegendSwatch({ color, opacity, dashed, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 12,
          height: dashed ? 2 : 8,
          borderRadius: dashed ? 0 : 2,
          background: dashed ? "none" : color,
          borderTop: dashed ? `2px dashed ${color}` : "none",
          opacity: opacity != null ? opacity : 1,
          display: "inline-block",
        }}
      />
      <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{label}</span>
    </div>
  );
}

// ---- 프로그램 매매 동향 ----
function ProgramTradingStrip({ program }) {
  const last = program.net[program.net.length - 1];
  const total = program.net.reduce((s, v) => s + v, 0);
  const color = total >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";
  const maxAbs = Math.max(...program.net.map(Math.abs), 1);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)" }}>
      <div>
        <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>프로그램 순매수 (당일 누적)</div>
        <div className="ds-numeric" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color, marginTop: 2 }}>
          {fmtEok(total)}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "flex-end", gap: 3, height: 40 }}>
        {program.net.map((v, i) => {
          const h = Math.max(2, (Math.abs(v) / maxAbs) * 36);
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: h,
                background: v >= 0 ? "var(--signal-buy)" : "var(--signal-sell)",
                opacity: 0.75,
                borderRadius: 1,
              }}
            />
          );
        })}
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>직전 체결</div>
        <div className="ds-numeric" style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: last >= 0 ? "var(--signal-buy)" : "var(--signal-sell)" }}>
          {fmtEok(last)}
        </div>
      </div>
    </div>
  );
}

// ---- 체결강도 미터 ----
function ExecutionStrengthMeter({ value }) {
  // value: 0~200, 100 = balanced. render as split bar around center.
  const clamped = Math.max(20, Math.min(200, value));
  const buyPct = Math.min(100, (clamped / 200) * 100);
  const dominant = value >= 100;
  const color = dominant ? "var(--signal-buy)" : "var(--signal-sell)";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
        <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>체결강도</span>
        <span className="ds-numeric" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color }}>
          {value.toFixed(1)}
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--text-tertiary)", marginLeft: 6 }}>
            {dominant ? "매수 우위" : "매도 우위"}
          </span>
        </span>
      </div>
      <div style={{ position: "relative", height: 10, borderRadius: "var(--radius-pill)", background: "var(--bg-inset)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--border-strong)", zIndex: 1 }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: dominant ? "50%" : `${buyPct}%`,
            right: dominant ? `${100 - buyPct}%` : "50%",
            background: color,
            opacity: 0.85,
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>0</span>
        <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>100</span>
        <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>200</span>
      </div>
    </div>
  );
}

// ---- 호가창 Level 2 ----
function OrderBookRow({ price, qty, maxQty, side, currentPrice }) {
  const pct = Math.max(2, (qty / maxQty) * 100);
  const isAsk = side === "ask";
  const barColor = isAsk ? "var(--signal-sell)" : "var(--signal-buy)";
  const isNearPrice = price === currentPrice;
  return (
    <div
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "1fr 72px",
        alignItems: "center",
        height: 22,
        borderBottom: "1px solid var(--border-default)",
      }}
    >
      <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: isAsk ? "flex-start" : "flex-start" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: barColor,
            opacity: 0.16,
          }}
        />
      </div>
      <span
        className="ds-numeric"
        style={{
          position: "relative",
          fontSize: "var(--text-xs)",
          fontWeight: isNearPrice ? 700 : 500,
          color: barColor,
          paddingLeft: "var(--space-2)",
        }}
      >
        {price.toLocaleString("ko-KR")}
      </span>
      <span
        className="ds-numeric"
        style={{
          position: "relative",
          fontSize: "var(--text-xs)",
          color: "var(--text-secondary)",
          textAlign: "right",
          paddingRight: "var(--space-2)",
        }}
      >
        {qty.toLocaleString("ko-KR")}
      </span>
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
      <div>
        {book.asks
          .slice()
          .sort((a, b) => b.price - a.price)
          .map((r) => (
            <OrderBookRow key={"a" + r.price} price={r.price} qty={r.qty} maxQty={maxQty} side="ask" currentPrice={currentPrice} />
          ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "var(--space-2) 0",
          background: "var(--bg-inset)",
          border: "1px solid var(--border-strong)",
        }}
      >
        <span className="ds-numeric" style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: priceColor }}>
          {currentPrice.toLocaleString("ko-KR")}
        </span>
        <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: priceColor }}>
          {changePct > 0 ? "+" : ""}
          {changePct.toFixed(2)}%
        </span>
      </div>
      <div>
        {book.bids
          .slice()
          .sort((a, b) => b.price - a.price)
          .map((r) => (
            <OrderBookRow key={"b" + r.price} price={r.price} qty={r.qty} maxQty={maxQty} side="bid" currentPrice={currentPrice} />
          ))}
      </div>
    </div>
  );
}

// ---- 거래원 상위 테이블 ----
function BrokerTable({ brokers }) {
  const [sortKey, setSortKey] = React.useState("net");
  const cols = [
    { key: "rank", label: "순위", align: "left" },
    { key: "name", label: "창구", align: "left" },
    { key: "buy", label: "매수", align: "right" },
    { key: "sell", label: "매도", align: "right" },
    { key: "net", label: "순매수", align: "right" },
  ];
  const sorted = brokers
    .slice()
    .sort((a, b) => (sortKey === "buy" ? b.buy - a.buy : sortKey === "sell" ? b.sell - a.sell : Math.abs(b.net) - Math.abs(a.net)));

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-xs)" }}>
      <thead>
        <tr>
          {cols.map((c) => (
            <th
              key={c.key}
              onClick={() => c.key !== "rank" && c.key !== "name" && setSortKey(c.key)}
              style={{
                textAlign: c.align,
                fontSize: "var(--text-2xs)",
                color: sortKey === c.key ? "var(--accent-strong)" : "var(--text-tertiary)",
                fontWeight: 600,
                padding: "var(--space-2)",
                borderBottom: "1px solid var(--border-default)",
                whiteSpace: "nowrap",
                cursor: c.key === "rank" || c.key === "name" ? "default" : "pointer",
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((b, i) => (
          <tr key={b.name}>
            <td style={{ padding: "var(--space-2)", color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-default)" }}>{i + 1}</td>
            <td style={{ padding: "var(--space-2)", color: "var(--text-primary)", fontWeight: 500, borderBottom: "1px solid var(--border-default)", whiteSpace: "nowrap" }}>
              {b.name}
            </td>
            <td className="ds-numeric" style={{ padding: "var(--space-2)", textAlign: "right", color: "var(--signal-buy)", borderBottom: "1px solid var(--border-default)" }}>
              {b.buy.toLocaleString("ko-KR")}
            </td>
            <td className="ds-numeric" style={{ padding: "var(--space-2)", textAlign: "right", color: "var(--signal-sell)", borderBottom: "1px solid var(--border-default)" }}>
              {b.sell.toLocaleString("ko-KR")}
            </td>
            <td
              className="ds-numeric"
              style={{
                padding: "var(--space-2)",
                textAlign: "right",
                fontWeight: 700,
                color: b.net >= 0 ? "var(--signal-buy)" : "var(--signal-sell)",
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              {fmtWon(b.net)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Tab3Flow({ stock, onSelectStock, suggestions, activeTab: activeTabProp, onTabChange }) {
  const [internalTab, setInternalTab] = React.useState("flow");
  const activeTab = activeTabProp ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [showSettings, setShowSettings] = React.useState(false);
  const [netBuyMode, setNetBuyMode] = React.useState("daily");

  const { header, flow } = stock;

  return (
    <div style={{ minHeight: "100%", background: "var(--bg-base)", fontFamily: "var(--font-body)" }} data-theme="dark">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3) var(--space-6)", borderBottom: "1px solid var(--border-default)", background: "var(--bg-surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
          <div style={{ fontSize: "var(--text-md)", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "var(--tracking-tight)" }}>단기매매 신호</div>
          <StockSearchBar suggestions={suggestions} onSelect={onSelectStock} />
        </div>
        <window.SettingsGearButton onClick={() => setShowSettings(true)} />
      </div>
      <TabNavigation tabs={TABS} activeId={activeTab} onChange={setActiveTab} />
      <window.SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "var(--space-4) var(--space-6) var(--space-12)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-xs)", padding: "var(--space-3) var(--space-5)" }}>
          <StockHeader {...header} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "var(--space-3)", alignItems: "start" }}>
          {/* left: order book, fixed narrow column */}
          <Card style={{ position: "sticky", top: "var(--space-4)", padding: "var(--space-3) var(--space-2) var(--space-3) var(--space-3)" }}>
            <div style={{ padding: "0 var(--space-2)" }}>
              <SectionLabel>호가창 (Level 2)</SectionLabel>
            </div>
            <OrderBook book={flow.orderBook} currentPrice={header.price} changePct={header.changePct} />
          </Card>

          {/* right: net-buy trend + program trading + strength + brokers */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            <Card>
              <SectionLabel
                right={
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                    <LegendSwatch color="var(--text-primary)" label="외국인" />
                    <LegendSwatch color="var(--text-primary)" opacity={0.5} dashed={netBuyMode === "cum"} label="기관" />
                    <SegmentedControl items={NETBUY_MODES} activeId={netBuyMode} onChange={setNetBuyMode} />
                  </div>
                }
              >
                외국인·기관 순매수 추이
              </SectionLabel>
              <NetBuyTrendChart data={flow.netBuy} mode={netBuyMode} height={200} />
            </Card>

            <Card>
              <SectionLabel>프로그램 매매 동향</SectionLabel>
              <ProgramTradingStrip program={flow.program} />
            </Card>

            <Card>
              <ExecutionStrengthMeter value={flow.strength} />
            </Card>

            <Card>
              <SectionLabel>거래원 상위</SectionLabel>
              <BrokerTable brokers={flow.brokers} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Tab3Flow = Tab3Flow;
