const { TabNavigation, StockSearchBar } = window.Ds_a0b250;

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

function fmtPct(pct) {
  return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function phaseZoneFor(score) {
  if (score >= 60) return { label: "강한 리스크온", color: "var(--signal-buy-strong)" };
  if (score >= 20) return { label: "리스크온", color: "var(--signal-buy)" };
  if (score > -20) return { label: "중립", color: "var(--signal-neutral)" };
  if (score > -60) return { label: "리스크오프", color: "var(--signal-sell)" };
  return { label: "강한 리스크오프", color: "var(--signal-sell-strong)" };
}

function angleForScore(score) {
  const clamped = Math.max(-100, Math.min(100, score));
  return 180 - ((clamped + 100) / 200) * 180;
}

function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(cx, cy, r, angleStart, angleEnd) {
  const p1 = polar(cx, cy, r, angleStart);
  const p2 = polar(cx, cy, r, angleEnd);
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;
}

const ZONE_BOUNDARIES = [180, 144, 108, 72, 36, 0];
const ZONE_COLORS = [
  "var(--signal-sell-strong)",
  "var(--signal-sell)",
  "var(--signal-neutral)",
  "var(--signal-buy)",
  "var(--signal-buy-strong)",
];

// market-phase gauge — same visual grammar as the ticker DirectionGauge, but
// labeled 리스크온/오프 since this reads the whole market, not one stock.
function MarketPhaseGauge({ score }) {
  const w = 320;
  const h = 190;
  const r = 130;
  const stroke = 22;
  const cx = w / 2;
  const cy = h - 6;
  const zone = phaseZoneFor(score);
  const needleAngle = angleForScore(score);
  const tip = polar(cx, cy, 108, needleAngle);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: w }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {ZONE_BOUNDARIES.slice(0, -1).map((start, i) => (
          <path key={i} d={arcPath(cx, cy, r, start, ZONE_BOUNDARIES[i + 1])} fill="none" stroke={ZONE_COLORS[i]} strokeWidth={stroke} opacity="0.9" />
        ))}
        <line x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5" fill="var(--text-primary)" />
      </svg>
      <div className="ds-numeric" style={{ fontSize: "var(--text-4xl)", fontWeight: "var(--weight-bold)", color: zone.color, marginTop: "var(--space-2)", lineHeight: 1 }}>
        {score > 0 ? "+" : ""}
        {score}
      </div>
      <div style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-semibold)", color: zone.color, marginTop: "var(--space-1)" }}>
        {zone.label}
      </div>
    </div>
  );
}

function Sparkline({ points, color, width = 72, height = 26 }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${height - ((p - min) / range) * height}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

function AsOfBadge({ children, live }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: "var(--text-2xs)",
        color: live ? "var(--status-live)" : "var(--text-tertiary)",
        fontWeight: 600,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: live ? "var(--status-live)" : "var(--text-tertiary)" }} />
      {children}
    </span>
  );
}

// 섹션 A(경제지표) / 섹션 B(시세) 경계를 확실히 구분하는 앵커형 구획 헤딩.
function MacroSectionHeading({ index, title, subtitle, right }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
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
        {right}
      </div>
      {subtitle && <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{subtitle}</div>}
    </div>
  );
}

// 한국/미국 구분 토글 — 경제지표 섹션 전용, 매수/매도 색과 무관한 중립 세그먼트.
function CountryFilter({ activeId, onChange }) {
  const items = [
    { id: "all", label: "전체" },
    { id: "KR", label: "한국" },
    { id: "US", label: "미국" },
  ];
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
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

// 예상치 대비 서프라이즈 표시 — 매수/매도(빨강/파랑) 팔레트와 겹치지 않도록
// 상회=accent(금색)·부합=중립회색·하회=text-secondary 로만 구분한다.
function SurpriseChip({ actual, forecast, unit, decimals = 1 }) {
  const diff = actual - forecast;
  const tolerance = Math.max(0.05, Math.abs(forecast) * 0.01);
  if (Math.abs(diff) <= tolerance) {
    return (
      <span style={{ fontSize: "var(--text-2xs)", fontWeight: 600, color: "var(--text-tertiary)" }}>예상 부합</span>
    );
  }
  const beat = diff > 0;
  return (
    <span
      className="ds-numeric"
      style={{
        fontSize: "var(--text-2xs)",
        fontWeight: 700,
        color: beat ? "var(--accent-strong)" : "var(--text-secondary)",
      }}
    >
      {beat ? "▲" : "▼"} 예상대비 {diff > 0 ? "+" : ""}
      {diff.toFixed(decimals)}
      {unit}
    </span>
  );
}

// 경제지표 카드 — 실제치/예상치/이전치 + 서프라이즈 강조 + 최근 추세 미니차트.
// 발표 주기가 실시간과 다르므로 as_of 라벨(발표 시점)을 항상 병기한다.
function EconomicIndicatorCard({ indicator }) {
  const { name, period, actual, forecast, prior, unit, decimals = 1, asOf, trend } = indicator;
  const fmt = (v) => `${v.toFixed(decimals)}${unit}`;
  return (
    <CardShell title={name} asOf={asOf}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <div>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{period}</div>
          <div className="ds-numeric" style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "var(--text-primary)", marginTop: 2, lineHeight: 1 }}>
            {fmt(actual)}
          </div>
          <div style={{ marginTop: "var(--space-2)" }}>
            <SurpriseChip actual={actual} forecast={forecast} unit={unit} decimals={decimals} />
          </div>
        </div>
        {trend && <Sparkline points={trend} color="var(--text-tertiary)" />}
      </div>
      <div style={{ display: "flex", gap: "var(--space-4)", paddingTop: "var(--space-2)", borderTop: "1px solid var(--border-default)" }}>
        <div>
          <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>예상치</div>
          <div className="ds-numeric" style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)" }}>{fmt(forecast)}</div>
        </div>
        <div>
          <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>이전치</div>
          <div className="ds-numeric" style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)" }}>{fmt(prior)}</div>
        </div>
      </div>
    </CardShell>
  );
}

function EconomicIndicatorGrid({ indicators, filter }) {
  const filtered = filter === "all" ? indicators : indicators.filter((i) => i.country === filter);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
      {filtered.map((ind) => (
        <div key={`${ind.country}-${ind.name}`} style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: "var(--space-3)", right: "var(--space-3)", zIndex: 1 }}>
            <CountryTag code={ind.country} />
          </div>
          <EconomicIndicatorCard indicator={ind} />
        </div>
      ))}
    </div>
  );
}

function CardShell({ title, asOf, live, children, style }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-xs)",
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "var(--tracking-wide)", whiteSpace: "nowrap" }}>{title}</span>
        {asOf && <AsOfBadge live={live}>{asOf}</AsOfBadge>}
      </div>
      {children}
    </div>
  );
}

// compact fact chip used in the top phase banner — surfaces the concrete numbers
// behind the risk-on/off call, in keeping with the product's "근거 공개" principle.
// mode="pct": changeVal is a percent, rendered via fmtPct.
// mode="amount": changeVal is a raw signed amount (already formatted into `delta`), colored by sign only.
function FactChip({ label, value, mode = "pct", changeVal, colorSign, delta }) {
  const valueColor = mode === "amount" ? changeColor(delta >= 0 ? 1 : delta < 0 ? -1 : 0) : "var(--text-primary)";
  const pctColor = changeColor(colorSign ?? changeVal);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 6,
        padding: "var(--space-2) var(--space-3)",
        background: "var(--bg-inset)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-pill)",
      }}
    >
      <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{label}</span>
      <span className="ds-numeric" style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: valueColor }}>{value}</span>
      {mode === "pct" && (
        <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", fontWeight: 600, color: pctColor }}>
          {fmtPct(changeVal)}
        </span>
      )}
    </div>
  );
}

function StatRow({ label, value, changePct, series }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
      <div>
        <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{label}</div>
        <div className="ds-numeric" style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--text-primary)", marginTop: 2 }}>
          {value}
        </div>
        <div className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: changeColor(changePct), marginTop: 2, fontWeight: 600 }}>
          {fmtPct(changePct)}
        </div>
      </div>
      {series && <Sparkline points={series} color={changeColor(changePct)} />}
    </div>
  );
}

function DomesticIndexCard({ indices }) {
  return (
    <CardShell title="국내 지수" asOf="09:31 실시간" live>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {indices.map((idx) => {
          const total = idx.advancers + idx.decliners;
          const upPct = (idx.advancers / total) * 100;
          return (
            <div key={idx.label} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              <StatRow label={idx.label} value={idx.value} changePct={idx.changePct} series={idx.series} />
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ flex: 1, height: 6, borderRadius: "var(--radius-pill)", overflow: "hidden", display: "flex" }}>
                  <div style={{ width: `${upPct}%`, background: "var(--signal-buy)" }} />
                  <div style={{ width: `${100 - upPct}%`, background: "var(--signal-sell)" }} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--signal-buy)" }}>상승 {idx.advancers}</span>
                <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--signal-sell)" }}>하락 {idx.decliners}</span>
              </div>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

function OverseasCard({ overseas }) {
  return (
    <CardShell title="해외 증시" asOf={overseas.asOf}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {overseas.items.map((it, i) => (
          <div
            key={it.label}
            style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "var(--space-2) 0", borderTop: i > 0 ? "1px solid var(--border-default)" : "none" }}
          >
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{it.label}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="ds-numeric" style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>{it.value}</span>
              <span className="ds-numeric" style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: changeColor(it.changePct) }}>{fmtPct(it.changePct)}</span>
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function FxRatesCard({ fxRates }) {
  return (
    <CardShell title="환율 · 금리" asOf={fxRates.asOf} live>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {fxRates.items.map((it, i) => (
          <div
            key={it.label}
            style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", padding: "var(--space-2) 0", borderTop: i > 0 ? "1px solid var(--border-default)" : "none" }}
          >
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{it.label}</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="ds-numeric" style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>{it.value}</span>
              <span className="ds-numeric" style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: changeColor(it.changePct) }}>
                {it.changeLabel}
              </span>
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function fmtEok(v) {
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return sign + Math.abs(Math.round(v)).toLocaleString("ko-KR") + "억";
}

function MarketFlowCard({ flow }) {
  return (
    <CardShell title="시장 수급 (전체)" asOf={flow.asOf} live>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>외국인 순매수</span>
          <span className="ds-numeric" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: flow.foreignNet >= 0 ? "var(--signal-buy)" : "var(--signal-sell)" }}>
            {fmtEok(flow.foreignNet)}
          </span>
        </div>
        <div style={{ height: 1, background: "var(--border-default)" }} />
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>기관 순매수</span>
          <span className="ds-numeric" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: flow.instNet >= 0 ? "var(--signal-buy)" : "var(--signal-sell)" }}>
            {fmtEok(flow.instNet)}
          </span>
        </div>
      </div>
    </CardShell>
  );
}

// horizontal fear/greed strip — risk-off(fear)=blue, risk-on(greed)=red, matching the product's color convention
function FearGreedBar({ value }) {
  const pct = Math.max(0, Math.min(100, value));
  const label = pct >= 75 ? "극단적 탐욕" : pct >= 55 ? "탐욕" : pct >= 45 ? "중립" : pct >= 25 ? "공포" : "극단적 공포";
  const color = pct >= 55 ? "var(--signal-buy)" : pct <= 45 ? "var(--signal-sell)" : "var(--signal-neutral)";
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-2)" }}>
        <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>공포·탐욕 지수</span>
        <span className="ds-numeric" style={{ fontSize: "var(--text-md)", fontWeight: 700, color }}>
          {pct} <span style={{ fontSize: "var(--text-xs)", fontWeight: 500, color: "var(--text-tertiary)" }}>{label}</span>
        </span>
      </div>
      <div
        style={{
          position: "relative",
          height: 10,
          borderRadius: "var(--radius-pill)",
          background: "linear-gradient(90deg, var(--signal-sell) 0%, var(--signal-neutral) 50%, var(--signal-buy) 100%)",
          opacity: 0.9,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -3,
            left: `calc(${pct}% - 3px)`,
            width: 8,
            height: 16,
            borderRadius: 2,
            background: "var(--text-primary)",
            boxShadow: "var(--shadow-xs)",
          }}
        />
      </div>
    </div>
  );
}

function VolatilityCard({ vol }) {
  return (
    <CardShell title="변동성 · 심리" asOf={vol.asOf}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>VIX</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="ds-numeric" style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--text-primary)" }}>{vol.vix.toFixed(1)}</span>
          <span className="ds-numeric" style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: changeColor(-vol.vixChangePct) }}>{fmtPct(vol.vixChangePct)}</span>
        </div>
      </div>
      <FearGreedBar value={vol.fearGreed} />
    </CardShell>
  );
}

function SectorHeatmap({ sectors }) {
  const maxAbs = Math.max(...sectors.map((s) => Math.abs(s.changePct)), 1);
  return (
    <CardShell title="업종 히트맵" asOf="09:31 실시간" live>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "var(--space-2)" }}>
        {sectors.map((s) => {
          const intensity = 0.18 + (Math.abs(s.changePct) / maxAbs) * 0.72;
          const color = s.changePct >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";
          return (
            <div
              key={s.name}
              style={{
                background: color,
                opacity: intensity,
                borderRadius: "var(--radius-sm)",
                padding: "var(--space-3) var(--space-2)",
                display: "flex",
                flexDirection: "column",
                gap: 4,
                minHeight: 64,
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "var(--text-2xs)", fontWeight: 700, color: "var(--text-on-signal)" }}>{s.name}</span>
              <span className="ds-numeric" style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-on-signal)" }}>{fmtPct(s.changePct)}</span>
            </div>
          );
        })}
      </div>
    </CardShell>
  );
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function CountryTag({ code }) {
  const bg = code === "US" ? "rgba(77,141,255,0.16)" : code === "KR" ? "rgba(255,92,92,0.16)" : "var(--bg-inset)";
  const color = code === "US" ? "var(--signal-sell)" : code === "KR" ? "var(--signal-buy)" : "var(--text-tertiary)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 22,
        height: 16,
        padding: "0 4px",
        borderRadius: 3,
        background: bg,
        color,
        fontSize: "9px",
        fontWeight: 800,
        letterSpacing: "0.2px",
      }}
    >
      {code}
    </span>
  );
}

// compact month grid — highlights today and marks days that carry a scheduled event
function MiniCalendar({ year, month, today, eventDays }) {
  const first = new Date(year, month - 1, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ day: daysInPrevMonth - startWeekday + 1 + i, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: cells.length - startWeekday - daysInMonth + 1, inMonth: false });
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 800, color: "var(--text-primary)" }}>
          {year}년 {month}월
        </span>
        <div style={{ display: "flex", gap: "var(--space-1)" }}>
          <button
            style={{ width: 22, height: 22, border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", background: "var(--bg-inset)", color: "var(--text-tertiary)", cursor: "pointer", fontSize: "11px" }}
          >
            ‹
          </button>
          <button
            style={{ width: 22, height: 22, border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", background: "var(--bg-inset)", color: "var(--text-tertiary)", cursor: "pointer", fontSize: "11px" }}
          >
            ›
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} style={{ textAlign: "center", fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", padding: "2px 0" }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((c, i) => {
          const isToday = c.inMonth && c.day === today;
          const hasEvent = c.inMonth && eventDays.has(c.day);
          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                padding: "4px 0",
                borderRadius: "var(--radius-sm)",
                background: isToday ? "var(--accent)" : "transparent",
                opacity: c.inMonth ? 1 : 0.3,
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-2xs)",
                  fontWeight: isToday ? 800 : 500,
                  color: isToday ? "var(--text-on-signal)" : "var(--text-secondary)",
                }}
              >
                {c.day}
              </span>
              <span style={{ width: 3, height: 3, borderRadius: "50%", background: hasEvent && !isToday ? "var(--accent)" : "transparent" }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EconomicCalendarCard({ calendar }) {
  const eventDays = new Set(calendar.events.map((e) => e.day));
  const groups = [];
  calendar.events.forEach((e) => {
    let g = groups.find((g) => g.week === e.week);
    if (!g) {
      g = { week: e.week, items: [] };
      groups.push(g);
    }
    g.items.push(e);
  });

  return (
    <CardShell title="경제지표 일정" style={{ padding: "var(--space-4)" }}>
      <MiniCalendar year={calendar.year} month={calendar.month} today={calendar.today} eventDays={eventDays} />
      <div style={{ height: 1, background: "var(--border-default)", margin: "var(--space-1) 0" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxHeight: 420, overflowY: "auto" }}>
        {groups.map((g) => (
          <div key={g.week} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ fontSize: "var(--text-2xs)", fontWeight: 700, color: "var(--text-tertiary)" }}>{g.week}</div>
            {g.items.map((ev, i) => (
              <div key={i} style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 26, flexShrink: 0, paddingTop: 1 }}>
                  <span className="ds-numeric" style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-primary)" }}>{ev.day}</span>
                  <span style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>{ev.weekday}</span>
                </div>
                <CountryTag code={ev.country} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--text-xs)", color: "var(--text-body)", lineHeight: 1.35 }}>{ev.title}</div>
                  <div style={{ fontSize: "9px", color: "var(--text-tertiary)", marginTop: 2 }}>{ev.time}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </CardShell>
  );
}

// full-width hero banner: the market regime call, made big per the brief, with the
// concrete numbers behind it surfaced as chips (transparency principle applied to
// the macro judgement, not just per-ticker scoring).
function PhaseBanner({ macro }) {
  const kospi = macro.domesticIndices[0];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "var(--space-6)",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-sm)",
        padding: "var(--space-6) var(--space-8)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
        <MarketPhaseGauge score={macro.phase.score} />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", maxWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "var(--tracking-wide)" }}>
              시장 국면 종합 판정
            </span>
            <AsOfBadge live>{macro.phase.asOf}</AsOfBadge>
          </div>
          <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            코스피·코스닥 등락, 외국인·기관 수급, VIX 등을 종합해 산출한 시장 전체 국면입니다. 개별 종목 신호는 이 국면 위에서 판단하세요.
          </p>
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", justifyContent: "flex-end" }}>
        <FactChip label="코스피" value={kospi.value} mode="pct" changeVal={kospi.changePct} />
        <FactChip label="외국인 순매수" value={fmtEok(macro.flow.foreignNet)} mode="amount" delta={macro.flow.foreignNet} />
        <FactChip label="VIX" value={macro.volatility.vix.toFixed(1)} mode="pct" changeVal={macro.volatility.vixChangePct} colorSign={-macro.volatility.vixChangePct} />
      </div>
    </div>
  );
}

function Tab6Macro({ macro, onSelectStock, suggestions, activeTab: activeTabProp, onTabChange }) {
  const [internalTab, setInternalTab] = React.useState("macro");
  const activeTab = activeTabProp ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [showSettings, setShowSettings] = React.useState(false);
  const [countryFilter, setCountryFilter] = React.useState("all");

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

      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "var(--space-8) var(--space-6) var(--space-16)", display: "flex", flexDirection: "column", gap: "var(--space-10)" }}>
        {/* 상단: 시장 국면 종합 판정 (풀폭 히어로, 두 섹션의 근거를 요약) */}
        <PhaseBanner macro={macro} />

        {/* ================= 섹션 A · 경제지표 (메인) ================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <MacroSectionHeading
            index="A"
            title="경제지표"
            subtitle="발표 주기 데이터 — 실제치는 발표 시점 기준이며 시세와 신선도가 다릅니다."
            right={<CountryFilter activeId={countryFilter} onChange={setCountryFilter} />}
          />
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "var(--space-6)", alignItems: "start" }}>
            <div style={{ position: "sticky", top: "var(--space-6)" }}>
              <EconomicCalendarCard calendar={macro.calendar} />
            </div>
            <EconomicIndicatorGrid indicators={macro.economicIndicators} filter={countryFilter} />
          </div>
        </div>

        {/* ================= 섹션 B · 시세 (보조) ================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <MacroSectionHeading index="B" title="시세" subtitle="국내외 지수·환율·금리·수급·변동성 — 실시간~전일 기준 혼재." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(240px, 1fr))", gap: "var(--space-4)" }}>
            <DomesticIndexCard indices={macro.domesticIndices} />
            <OverseasCard overseas={macro.overseas} />
            <FxRatesCard fxRates={macro.fxRates} />
            <MarketFlowCard flow={macro.flow} />
            <VolatilityCard vol={macro.volatility} />
          </div>
          <SectorHeatmap sectors={macro.sectors} />
        </div>
      </div>
    </div>
  );
}

window.Tab6Macro = Tab6Macro;
