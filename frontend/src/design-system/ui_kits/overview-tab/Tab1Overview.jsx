const { DirectionGauge, ContributionBar, StockHeader, CandleChart, TabNavigation, StockSearchBar } = window.Ds_a0b250;

const TABS = [
  { id: "overview", label: "종합 신호" },
  { id: "technical", label: "기술적 분석" },
  { id: "flow", label: "수급" },
  { id: "macro", label: "매크로/시장" },
  { id: "screener", label: "관심종목" },
];

const ATR_MULTS = [
  { id: "1", label: "1×", value: 1 },
  { id: "1.5", label: "1.5×", value: 1.5 },
  { id: "2", label: "2×", value: 2 },
];

const R_MULTS = [
  { id: "1", label: "1R", value: 1 },
  { id: "2", label: "2R", value: 2 },
  { id: "3", label: "3R", value: 3 },
];

function fmtWon(v) {
  const sign = v < 0 ? "-" : "";
  return sign + Math.abs(Math.round(v)).toLocaleString("ko-KR");
}

function SignalHistoryTimeline({ events }) {
  const colorFor = (s) => {
    if (s === "적극매수") return "var(--signal-buy-strong)";
    if (s === "매수") return "var(--signal-buy)";
    if (s === "적극매도") return "var(--signal-sell-strong)";
    if (s === "매도") return "var(--signal-sell)";
    return "var(--signal-neutral)";
  };
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%", padding: "var(--space-4) 0" }}>
      {events.map((ev, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div style={{ flex: 1, height: 2, background: "var(--border-default)" }} />}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 64 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: colorFor(ev.signal), boxShadow: `0 0 0 3px ${colorFor(ev.signal)}22` }} />
            <div style={{ fontSize: "var(--text-2xs)", fontWeight: 700, color: colorFor(ev.signal) }}>{ev.signal}</div>
            <div className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{ev.time}</div>
          </div>
        </React.Fragment>
      ))}
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

// 섹션 A(종합 신호) / 섹션 B(매매 계획) 경계를 확실히 구분하기 위한 앵커형 구획 헤딩.
function SectionEyebrow({ index, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
      <span
        style={{
          fontSize: "var(--text-2xs)",
          fontWeight: 800,
          color: "var(--accent)",
          letterSpacing: "var(--tracking-wide)",
          border: "1px solid var(--accent)",
          borderRadius: "var(--radius-pill)",
          padding: "2px 9px",
          flexShrink: 0,
        }}
      >
        {index}
      </span>
      <span style={{ fontSize: "var(--text-md)", fontWeight: 800, color: "var(--text-primary)", flexShrink: 0 }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: "var(--border-default)" }} />
    </div>
  );
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

function PlanCard({ children, style }) {
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

function FieldLabel({ children, hint }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-1)" }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: "var(--weight-medium)" }}>{children}</span>
      {hint && <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{hint}</span>}
    </div>
  );
}

function NumberField({ value, onChange, suffix }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-1)",
        background: "var(--bg-inset)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        padding: "var(--space-2) var(--space-3)",
      }}
    >
      <input
        className="ds-numeric"
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9.-]/g, "");
          onChange(raw === "" ? 0 : Number(raw));
        }}
        style={{
          flex: 1,
          width: "100%",
          minWidth: 0,
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize: "var(--text-md)",
          fontWeight: "var(--weight-semibold)",
          color: "var(--text-primary)",
        }}
      />
      {suffix && <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", flexShrink: 0 }}>{suffix}</span>}
    </div>
  );
}

function RiskSlider({ value, onChange, min = 0.5, max = 5, step = 0.5 }) {
  return (
    <div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: "100%",
          accentColor: "var(--accent)",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
        <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{min}%</span>
        <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{max}%</span>
      </div>
    </div>
  );
}

// ---- 손절가 / 목표가 카드 ----
function StopTargetCard({ entry, stopPrice, targetPrice, atr, atrMult }) {
  const stopPct = ((stopPrice - entry) / entry) * 100;
  const targetPct = ((targetPrice - entry) / entry) * 100;
  return (
    <PlanCard>
      <SectionLabel
        right={
          <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>
            ATR(14) <span className="ds-numeric" style={{ color: "var(--text-secondary)" }}>{fmtWon(atr)}</span> × {atrMult}
          </span>
        }
      >
        손절가 · 목표가 제안
      </SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
        <div
          style={{
            background: "var(--signal-sell-bg)",
            border: "1px solid var(--signal-sell-border)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-3)",
          }}
        >
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--signal-sell)", fontWeight: 700 }}>손절가</div>
          <div className="ds-numeric" style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--signal-sell)", marginTop: 4 }}>
            {fmtWon(stopPrice)}
          </div>
          <div className="ds-numeric" style={{ fontSize: "var(--text-xs)", color: "var(--signal-sell)", marginTop: 2, opacity: 0.85 }}>
            {stopPct.toFixed(2)}%
          </div>
        </div>
        <div
          style={{
            background: "var(--signal-buy-bg)",
            border: "1px solid var(--signal-buy-border)",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-3)",
          }}
        >
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--signal-buy)", fontWeight: 700 }}>목표가</div>
          <div className="ds-numeric" style={{ fontSize: "var(--text-xl)", fontWeight: 700, color: "var(--signal-buy)", marginTop: 4 }}>
            {fmtWon(targetPrice)}
          </div>
          <div className="ds-numeric" style={{ fontSize: "var(--text-xs)", color: "var(--signal-buy)", marginTop: 2, opacity: 0.85 }}>
            +{targetPct.toFixed(2)}%
          </div>
        </div>
      </div>
    </PlanCard>
  );
}

// ---- 손익비(R:R) 수직 바 시각화 ----
function RiskRewardBar({ entry, stopPrice, targetPrice, rr }) {
  const height = 220;
  const padTop = 16;
  const padBottom = 16;
  const plotH = height - padTop - padBottom;
  const maxP = targetPrice;
  const minP = stopPrice;
  const range = maxP - minP || 1;
  const yAt = (p) => padTop + (1 - (p - minP) / range) * plotH;

  const entryY = yAt(entry);
  const stopY = yAt(stopPrice);
  const targetY = yAt(targetPrice);
  const barX = 130;
  const barW = 28;

  return (
    <PlanCard>
      <SectionLabel
        right={
          <span
            className="ds-numeric"
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: 700,
              color: rr >= 2 ? "var(--signal-buy)" : rr >= 1 ? "var(--accent-strong)" : "var(--signal-sell)",
            }}
          >
            R:R 1 : {rr.toFixed(2)}
          </span>
        }
      >
        손익비 시각화
      </SectionLabel>
      <div style={{ display: "flex", gap: "var(--space-5)" }}>
        <svg width={barX + barW + 90} height={height} viewBox={`0 0 ${barX + barW + 90} ${height}`}>
          <rect x={barX} y={targetY} width={barW} height={Math.max(1, entryY - targetY)} fill="var(--signal-buy)" opacity="0.35" />
          <rect x={barX} y={entryY} width={barW} height={Math.max(1, stopY - entryY)} fill="var(--signal-sell)" opacity="0.35" />
          <rect x={barX} y={Math.min(targetY, stopY)} width={barW} height={Math.max(1, Math.abs(stopY - targetY))} fill="none" stroke="var(--border-strong)" strokeWidth="1" />

          <line x1={barX - 12} y1={targetY} x2={barX + barW + 12} y2={targetY} stroke="var(--signal-buy)" strokeWidth="2" />
          <text x={barX + barW + 18} y={targetY + 4} fontSize="13" fill="var(--signal-buy)" fontWeight="700" fontFamily="var(--font-numeric)">
            목표 {fmtWon(targetPrice)}
          </text>

          <line x1={barX - 12} y1={entryY} x2={barX + barW + 12} y2={entryY} stroke="var(--text-primary)" strokeWidth="2" />
          <text x={barX + barW + 18} y={entryY + 4} fontSize="13" fill="var(--text-primary)" fontWeight="700" fontFamily="var(--font-numeric)">
            진입 {fmtWon(entry)}
          </text>

          <line x1={barX - 12} y1={stopY} x2={barX + barW + 12} y2={stopY} stroke="var(--signal-sell)" strokeWidth="2" />
          <text x={barX + barW + 18} y={stopY + 4} fontSize="13" fill="var(--signal-sell)" fontWeight="700" fontFamily="var(--font-numeric)">
            손절 {fmtWon(stopPrice)}
          </text>
        </svg>
      </div>
    </PlanCard>
  );
}

// ---- 포지션 사이징 계산기 ----
function PositionSizingCard({ accountSize, riskPct, entry, stopPrice }) {
  const riskAmount = accountSize * (riskPct / 100);
  const riskPerShare = Math.max(1, entry - stopPrice);
  const qty = Math.max(0, Math.floor(riskAmount / riskPerShare));
  const notional = qty * entry;
  const weightPct = accountSize > 0 ? (notional / accountSize) * 100 : 0;

  const rows = [
    { label: "리스크 금액", value: fmtWon(riskAmount) + "원" },
    { label: "주당 리스크", value: fmtWon(riskPerShare) + "원" },
    { label: "매수 수량", value: qty.toLocaleString("ko-KR") + "주" },
    { label: "투입 금액", value: fmtWon(notional) + "원" },
    { label: "계좌 비중", value: weightPct.toFixed(1) + "%" },
  ];

  return (
    <PlanCard>
      <SectionLabel>포지션 사이징</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {rows.map((r, i) => (
          <div
            key={r.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              padding: "var(--space-2) 0",
              borderBottom: i < rows.length - 1 ? "1px solid var(--border-default)" : "none",
            }}
          >
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{r.label}</span>
            <span
              className="ds-numeric"
              style={{
                fontSize: i === 2 || i === 3 ? "var(--text-lg)" : "var(--text-sm)",
                fontWeight: i === 2 || i === 3 ? 700 : 600,
                color: "var(--text-primary)",
              }}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </PlanCard>
  );
}

function EntryFormCard({ entry, setEntry, currentPrice, atrMultId, setAtrMultId, rMultId, setRMultId, accountSize, setAccountSize, riskPct, setRiskPct }) {
  return (
    <PlanCard style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <SectionLabel>진입가 입력</SectionLabel>

      <div>
        <FieldLabel hint={`현재가 ${currentPrice.toLocaleString("ko-KR")}`}>진입가</FieldLabel>
        <NumberField value={entry} onChange={setEntry} suffix="원" />
      </div>

      <div>
        <FieldLabel>손절 ATR 배수</FieldLabel>
        <SegmentedControl items={ATR_MULTS} activeId={atrMultId} onChange={setAtrMultId} />
      </div>

      <div>
        <FieldLabel>목표 R 배수</FieldLabel>
        <SegmentedControl items={R_MULTS} activeId={rMultId} onChange={setRMultId} />
      </div>

      <div style={{ height: 1, background: "var(--border-default)" }} />

      <div>
        <FieldLabel>계좌 규모</FieldLabel>
        <NumberField value={accountSize} onChange={setAccountSize} suffix="원" />
      </div>

      <div>
        <FieldLabel hint={`${riskPct}%`}>감당 리스크</FieldLabel>
        <RiskSlider value={riskPct} onChange={setRiskPct} />
      </div>
    </PlanCard>
  );
}

function SidebarCard({ title, timestamp, children }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-tertiary)" }}>{title}</span>
        {timestamp && (
          <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{timestamp}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function ReasonCard({ reason }) {
  if (!reason) return null;
  return (
    <SidebarCard title="왜 신호가 바뀌었나" timestamp={reason.timestamp}>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
        {reason.headline}
      </div>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: "var(--leading-relaxed)" }}>
        {reason.body}
      </div>
    </SidebarCard>
  );
}

function NewsCard({ news }) {
  if (!news || news.length === 0) return null;
  return (
    <SidebarCard title="한 줄 요약">
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {news.map((n, i) => (
          <div key={i} style={{ display: "flex", gap: "var(--space-2)" }}>
            <span
              style={{
                flexShrink: 0,
                fontSize: "var(--text-2xs)",
                fontWeight: 700,
                color: "var(--text-secondary)",
                background: "var(--bg-inset)",
                borderRadius: "var(--radius-xs)",
                padding: "2px 6px",
                height: "fit-content",
              }}
            >
              {n.tag}
            </span>
            <div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-body)", lineHeight: "var(--leading-normal)" }}>{n.headline}</div>
              <div className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", marginTop: 2 }}>{n.timestamp}</div>
            </div>
          </div>
        ))}
      </div>
    </SidebarCard>
  );
}

function AlertLogCard({ alerts }) {
  if (!alerts || alerts.length === 0) return null;
  const colorFor = (kind) => {
    if (kind === "buy") return "var(--signal-buy)";
    if (kind === "sell") return "var(--signal-sell)";
    return "var(--signal-neutral)";
  };
  return (
    <SidebarCard title="최근 알림">
      <div style={{ display: "flex", flexDirection: "column" }}>
        {alerts.map((a, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "var(--space-2)",
              padding: "var(--space-2) 0",
              borderTop: i > 0 ? "1px solid var(--border-default)" : "none",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: colorFor(a.kind), marginTop: 6, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--text-body)" }}>{a.text}</div>
              <div className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", marginTop: 2 }}>{a.timestamp}</div>
            </div>
          </div>
        ))}
      </div>
    </SidebarCard>
  );
}

function CommunityCard({ ticker, posts }) {
  if (!posts || posts.length === 0) return null;
  return (
    <SidebarCard title="종목토론방">
      <div style={{ display: "flex", flexDirection: "column" }}>
        {posts.map((p, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "var(--space-3) 0",
              borderTop: i > 0 ? "1px solid var(--border-default)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: "var(--text-2xs)",
                  fontWeight: 700,
                  color: p.role === "주주" ? "var(--signal-buy)" : "var(--text-tertiary)",
                  border: `1px solid ${p.role === "주주" ? "var(--signal-buy-border)" : "var(--border-strong)"}`,
                  borderRadius: "var(--radius-xs)",
                  padding: "1px 5px",
                }}
              >
                {p.role}
              </span>
              <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-primary)" }}>{p.author}</span>
              <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", marginLeft: "auto" }}>{p.timestamp}</span>
            </div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-body)", lineHeight: "var(--leading-normal)", whiteSpace: "pre-line" }}>
              {p.text}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", marginTop: "var(--space-2)", textAlign: "center" }}>
        {ticker} 토론방 전체보기
      </div>
    </SidebarCard>
  );
}

function Tab1Overview({ stock, onSelectStock, suggestions, activeTab: activeTabProp, onTabChange }) {
  const [internalTab, setInternalTab] = React.useState("overview");
  const activeTab = activeTabProp ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [showSettings, setShowSettings] = React.useState(false);

  // ---- 섹션 B · 매매 계획 상태 ----
  const [entry, setEntry] = React.useState(stock.header.price);
  const [atrMultId, setAtrMultId] = React.useState("1.5");
  const [rMultId, setRMultId] = React.useState("2");
  const [accountSize, setAccountSize] = React.useState(10000000);
  const [riskPct, setRiskPct] = React.useState(1);

  React.useEffect(() => {
    setEntry(stock.header.price);
  }, [stock.header.price]);

  const atrMult = (ATR_MULTS.find((m) => m.id === atrMultId) || ATR_MULTS[1]).value;
  const rMult = (R_MULTS.find((m) => m.id === rMultId) || R_MULTS[1]).value;
  const stopDistance = stock.risk.atr * atrMult;
  const stopPrice = Math.max(1, entry - stopDistance);
  const targetPrice = entry + stopDistance * rMult;
  const rr = stopDistance > 0 ? (targetPrice - entry) / (entry - stopPrice) : 0;

  return (
    <div style={{ minHeight: "100%", background: "var(--bg-base)", fontFamily: "var(--font-body)" }} data-theme="dark">
      {/* fixed top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3) var(--space-6)", borderBottom: "1px solid var(--border-default)", background: "var(--bg-surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
          <div style={{ fontSize: "var(--text-md)", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "var(--tracking-tight)" }}>단기매매 신호</div>
          <StockSearchBar suggestions={suggestions} onSelect={onSelectStock} />
        </div>
        <window.SettingsGearButton onClick={() => setShowSettings(true)} />
      </div>
      <TabNavigation tabs={TABS} activeId={activeTab} onChange={setActiveTab} />
      <window.SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />

      {/* content */}
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "var(--space-8) var(--space-6) var(--space-16)", display: "flex", flexDirection: "column", gap: "var(--space-10)" }}>
        <SectionEyebrow index="A" title="종합 신호 — 3초 결론" />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "var(--space-6)", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-xs)", padding: "var(--space-5) var(--space-6)" }}>
              <StockHeader {...stock.header} />
            </div>

            {/* HERO: direction gauge */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", padding: "var(--space-8) var(--space-6)" }}>
              <DirectionGauge score={stock.score} size="lg" subtitle={`${stock.updatedAt} 갱신`} />
            </div>

            {/* evidence: contribution */}
            <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-5) var(--space-6)" }}>
              <SectionLabel>근거 — 지표 기여도 상위 {stock.contributions.length}개</SectionLabel>
              <ContributionBar items={stock.contributions} />
            </div>

            {/* reference: mini chart + history side by side */}
            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "var(--space-5)" }}>
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
                <SectionLabel>참고 — 미니 차트 (VWAP)</SectionLabel>
                <CandleChart candles={stock.candles} mini height={140} />
              </div>
              <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
                <SectionLabel>참고 — 당일 신호 히스토리</SectionLabel>
                <SignalHistoryTimeline events={stock.history} />
              </div>
            </div>
          </div>

          {/* right rail — real-time context, fills the side whitespace */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", position: "sticky", top: "var(--space-6)" }}>
            <ReasonCard reason={stock.reason} />
            <NewsCard news={stock.news} />
            <AlertLogCard alerts={stock.alerts} />
            <CommunityCard ticker={stock.header.name} posts={stock.community} />
          </div>
        </div>

        {/* ================= 섹션 B · 매매 계획 ================= */}
        <SectionEyebrow index="B" title="매매 계획 — 신호를 실행으로" />

        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: "var(--space-4)", alignItems: "start" }}>
          <EntryFormCard
            entry={entry}
            setEntry={setEntry}
            currentPrice={stock.header.price}
            atrMultId={atrMultId}
            setAtrMultId={setAtrMultId}
            rMultId={rMultId}
            setRMultId={setRMultId}
            accountSize={accountSize}
            setAccountSize={setAccountSize}
            riskPct={riskPct}
            setRiskPct={setRiskPct}
          />

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <StopTargetCard entry={entry} stopPrice={stopPrice} targetPrice={targetPrice} atr={stock.risk.atr} atrMult={atrMultId + "×"} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "var(--space-4)", alignItems: "start" }}>
              <RiskRewardBar entry={entry} stopPrice={stopPrice} targetPrice={targetPrice} rr={rr} />
              <PositionSizingCard accountSize={accountSize} riskPct={riskPct} entry={entry} stopPrice={stopPrice} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Tab1Overview = Tab1Overview;
