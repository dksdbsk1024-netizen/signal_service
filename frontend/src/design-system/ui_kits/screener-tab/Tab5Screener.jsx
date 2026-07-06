const { DirectionGauge, ContributionBar, StockHeader, CandleChart, TabNavigation, StockSearchBar } = window.Ds_a0b250;

const TABS = [
  { id: "overview", label: "종합 신호" },
  { id: "technical", label: "기술적 분석" },
  { id: "flow", label: "수급" },
  { id: "macro", label: "매크로/시장" },
  { id: "screener", label: "관심종목" },
];

function changeColor(pct) {
  if (pct > 0) return "var(--signal-buy)";
  if (pct < 0) return "var(--signal-sell)";
  return "var(--signal-neutral)";
}

function scoreColor(score) {
  if (score >= 60) return "var(--signal-buy-strong)";
  if (score >= 20) return "var(--signal-buy)";
  if (score > -20) return "var(--signal-neutral)";
  if (score > -60) return "var(--signal-sell)";
  return "var(--signal-sell-strong)";
}

function scoreLabel(score) {
  if (score >= 60) return "적극매수";
  if (score >= 20) return "매수";
  if (score > -20) return "중립";
  if (score > -60) return "매도";
  return "적극매도";
}

// tiny inline sparkline, no external deps
function Sparkline({ points, color, width = 64, height = 24 }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${height - ((p - min) / range) * height}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function MarketStrip({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: "var(--space-3)" }}>
      {items.map((m, i) => (
        <div
          key={i}
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3) var(--space-4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
          }}
        >
          <div>
            <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{m.label}</div>
            <div className="ds-numeric" style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
              {m.value}
            </div>
            <div className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: changeColor(m.changePct), marginTop: 2 }}>
              {m.changePct > 0 ? "+" : ""}
              {m.changePct.toFixed(2)}%
            </div>
          </div>
          <Sparkline points={m.series} color={changeColor(m.changePct)} />
        </div>
      ))}
    </div>
  );
}

function RatioBar({ buyPct }) {
  const sellPct = 100 - buyPct;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, width: 130 }}>
      <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--signal-sell)", width: 26, textAlign: "right" }}>
        {sellPct}
      </span>
      <div style={{ flex: 1, height: 6, borderRadius: "var(--radius-pill)", overflow: "hidden", display: "flex" }}>
        <div style={{ width: `${sellPct}%`, background: "var(--signal-sell)" }} />
        <div style={{ width: `${buyPct}%`, background: "var(--signal-buy)" }} />
      </div>
      <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--signal-buy)", width: 26 }}>
        {buyPct}
      </span>
    </div>
  );
}

function WatchlistChips({ items, activeTicker, onPick }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
      {items.map((it) => {
        const active = it.ticker === activeTicker;
        return (
          <button
            key={it.ticker}
            onClick={() => onPick(it.ticker)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: "var(--radius-pill)",
              border: `1px solid ${active ? "var(--accent)" : "var(--border-default)"}`,
              background: active ? "var(--accent-bg)" : "var(--bg-inset)",
              color: "var(--text-body)",
              fontSize: "var(--text-xs)",
              cursor: "pointer",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: scoreColor(it.score) }} />
            {it.name}
          </button>
        );
      })}
    </div>
  );
}

function ConditionBuilder({ conditions }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
      {conditions.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", fontWeight: 700 }}>AND</span>}
          <span
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--text-body)",
              background: "var(--bg-inset)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              padding: "5px 10px",
            }}
          >
            {c}
          </span>
        </React.Fragment>
      ))}
      <button
        style={{
          fontSize: "var(--text-xs)",
          color: "var(--accent)",
          background: "none",
          border: "1px dashed var(--border-strong)",
          borderRadius: "var(--radius-sm)",
          padding: "5px 10px",
          cursor: "pointer",
        }}
      >
        + 조건 추가
      </button>
    </div>
  );
}

function ResultTable({ rows, activeTicker, onSelect }) {
  const cols = ["순위", "종목", "현재가", "등락률", "스코어", "체결강도(매도/매수)", "거래량"];
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)", tableLayout: "auto" }}>
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th
              key={i}
              style={{
                textAlign: i === 0 || i === 1 ? "left" : "right",
                fontSize: "var(--text-2xs)",
                color: "var(--text-tertiary)",
                fontWeight: 500,
                padding: "8px 10px",
                borderBottom: "1px solid var(--border-default)",
                whiteSpace: "nowrap",
              }}
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const active = r.ticker === activeTicker;
          return (
            <tr
              key={r.ticker}
              onClick={() => onSelect(r.ticker)}
              style={{ cursor: "pointer", background: active ? "var(--bg-surface-raised)" : "transparent" }}
            >
              <td style={{ padding: "10px", color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-default)" }}>{i + 1}</td>
              <td style={{ padding: "10px", borderBottom: "1px solid var(--border-default)", minWidth: 168 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                  <span
                    style={{
                      fontSize: "var(--text-2xs)",
                      fontWeight: 700,
                      color: "var(--text-on-signal)",
                      background: scoreColor(r.score),
                      borderRadius: "var(--radius-xs)",
                      padding: "2px 6px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {scoreLabel(r.score)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "var(--text-primary)", fontWeight: 600, whiteSpace: "nowrap" }}>{r.name}</div>
                    <div className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>{r.ticker}</div>
                  </div>
                </div>
              </td>
              <td className="ds-numeric" style={{ padding: "10px", textAlign: "right", color: "var(--text-body)", borderBottom: "1px solid var(--border-default)" }}>
                {r.price.toLocaleString("ko-KR")}
              </td>
              <td
                className="ds-numeric"
                style={{ padding: "10px", textAlign: "right", color: changeColor(r.changePct), fontWeight: 600, borderBottom: "1px solid var(--border-default)" }}
              >
                {r.changePct > 0 ? "+" : ""}
                {r.changePct.toFixed(2)}%
              </td>
              <td className="ds-numeric" style={{ padding: "10px", textAlign: "right", color: scoreColor(r.score), fontWeight: 700, borderBottom: "1px solid var(--border-default)" }}>
                {r.score > 0 ? "+" : ""}
                {r.score}
              </td>
              <td style={{ padding: "10px", textAlign: "right", borderBottom: "1px solid var(--border-default)" }}>
                <div style={{ marginLeft: "auto" }}>
                  <RatioBar buyPct={r.buyPct} />
                </div>
              </td>
              <td className="ds-numeric" style={{ padding: "10px", textAlign: "right", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-default)" }}>
                {r.volume}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function LiveRankingPanel({ rows, activeTicker, onSelect }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-default)", fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-tertiary)" }}>
        실시간 스코어 랭킹
      </div>
      <div>
        {rows.map((r, i) => {
          const active = r.ticker === activeTicker;
          return (
            <div
              key={r.ticker}
              onClick={() => onSelect(r.ticker)}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-2) var(--space-4)",
                cursor: "pointer",
                background: active ? "var(--bg-surface-raised)" : "transparent",
                borderBottom: i < rows.length - 1 ? "1px solid var(--border-default)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", width: 14 }}>{i + 1}</span>
                <span style={{ fontSize: "var(--text-sm)", color: "var(--text-primary)" }}>{r.name}</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="ds-numeric" style={{ fontSize: "var(--text-sm)", color: "var(--text-body)" }}>{r.price.toLocaleString("ko-KR")}</div>
                <div className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: changeColor(r.changePct) }}>
                  {r.changePct > 0 ? "+" : ""}
                  {r.changePct.toFixed(2)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailPanel({ stock }) {
  if (!stock) return null;
  const top = stock.contributions.slice().sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
  const reason = top
    ? `${top.name} 기여도 ${top.score > 0 ? "+" : ""}${top.score} — ${scoreLabel(stock.score)} 판단의 핵심 근거`
    : "";
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>{stock.name}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
          <span className="ds-numeric" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: changeColor(stock.changePct) }}>
            {stock.price.toLocaleString("ko-KR")}
          </span>
          <span className="ds-numeric" style={{ fontSize: "var(--text-xs)", color: changeColor(stock.changePct) }}>
            {stock.changePct > 0 ? "+" : ""}
            {stock.changePct.toFixed(2)}%
          </span>
        </div>
      </div>
      <CandleChart candles={stock.candles} mini height={110} />
      <div>
        <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", marginBottom: 6 }}>근거 요약</div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-body)", lineHeight: "var(--leading-relaxed)" }}>{reason}</div>
      </div>
    </div>
  );
}

function Tab5Screener({ market, watchlist, rows, stockDetails, activeTab: activeTabProp, onTabChange }) {
  const [internalTab, setInternalTab] = React.useState("screener");
  const activeTab = activeTabProp ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [showSettings, setShowSettings] = React.useState(false);
  const [activeTicker, setActiveTicker] = React.useState(rows[0].ticker);
  const detail = stockDetails[activeTicker];

  return (
    <div style={{ minHeight: "100%", background: "var(--bg-base)", fontFamily: "var(--font-body)" }} data-theme="dark">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3) var(--space-6)", borderBottom: "1px solid var(--border-default)", background: "var(--bg-surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
          <div style={{ fontSize: "var(--text-md)", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "var(--tracking-tight)" }}>단기매매 신호</div>
          <StockSearchBar suggestions={watchlist} />
        </div>
        <window.SettingsGearButton onClick={() => setShowSettings(true)} />
      </div>
      <TabNavigation tabs={TABS} activeId={activeTab} onChange={setActiveTab} />
      <window.SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />

      <div style={{ padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <MarketStrip items={market} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "var(--space-5)", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-tertiary)" }}>관심종목</div>
              <WatchlistChips items={rows} activeTicker={activeTicker} onPick={setActiveTicker} />
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-tertiary)", marginTop: "var(--space-2)" }}>스크리너 조건</div>
              <ConditionBuilder conditions={["VWAP 상향돌파", "거래량 급증", "RSI 다이버전스"]} />
            </div>

            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
              <div style={{ padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-default)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-tertiary)" }}>조건 충족 종목 · {rows.length}개</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <ResultTable rows={rows} activeTicker={activeTicker} onSelect={setActiveTicker} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <LiveRankingPanel rows={rows} activeTicker={activeTicker} onSelect={setActiveTicker} />
            <DetailPanel stock={detail} />
          </div>
        </div>
      </div>
    </div>
  );
}

window.Tab5Screener = Tab5Screener;
