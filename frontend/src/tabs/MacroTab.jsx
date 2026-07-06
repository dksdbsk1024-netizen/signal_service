// 탭4 — 매크로. /api/macro 연결 (경제지표 = FRED 실데이터, 시세 = Mock).
// 섹션 A 경제지표 카드(실제/예상/이전 + 서프라이즈, 한/미 구분) · 섹션 B 시세. (macro-tab UI 킷 패턴)
import React, { useEffect, useMemo, useState } from "react";
import { API, SectionEyebrow, Card, SectionLabel, SegmentedControl, Banner } from "../ui.jsx";

const REGION_FILTERS = [
  { id: "all", label: "전체" },
  { id: "US", label: "미국" },
  { id: "KR", label: "한국" },
];

function CountryTag({ code }) {
  return (
    <span style={{ fontSize: "var(--text-2xs)", fontWeight: 700, color: "var(--text-tertiary)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-xs)", padding: "1px 5px" }}>
      {code === "US" ? "🇺🇸 미국" : "🇰🇷 한국"}
    </span>
  );
}

function AsOfBadge({ children, mock }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "var(--text-2xs)", color: mock ? "var(--accent-strong)" : "var(--text-tertiary)", fontWeight: 600 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: mock ? "var(--accent-strong)" : "var(--status-closed)" }} />
      {children}
    </span>
  );
}

// 서프라이즈: 매수/매도(빨강/파랑)와 겹치지 않게 상회=골드·부합=회색·하회=secondary.
function SurpriseChip({ surprise, unit }) {
  const tol = 0.05;
  if (surprise == null) return null;
  if (Math.abs(surprise) <= tol) return <span style={{ fontSize: "var(--text-2xs)", fontWeight: 600, color: "var(--text-tertiary)" }}>예상 부합</span>;
  const beat = surprise > 0;
  return (
    <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", fontWeight: 700, color: beat ? "var(--accent-strong)" : "var(--text-secondary)" }}>
      {beat ? "▲" : "▼"} 예상대비 {surprise > 0 ? "+" : ""}{surprise.toFixed(2)}{unit}
    </span>
  );
}

function EconCard({ ind }) {
  const unit = ind.unit || "%";
  const fmt = (v) => (v == null ? "—" : `${Number(v).toFixed(2)}${unit}`);
  // 부제: index 계열은 MoM·지수, rate 계열은 이전 대비 bp.
  const sub = ind.kind === "index"
    ? `MoM ${ind.mom > 0 ? "+" : ""}${ind.mom}% · 지수 ${ind.level}`
    : (ind.change_bp != null ? `이전 대비 ${ind.change_bp > 0 ? "+" : ""}${ind.change_bp}bp` : "");
  const period = ind.kind === "index" ? "전년동월비 (YoY)" : "레벨";
  return (
    <Card style={{ position: "relative", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ position: "absolute", top: "var(--space-3)", right: "var(--space-3)" }}><CountryTag code={ind.region} /></div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>{ind.name}</span>
      </div>
      <div>
        <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{period}</div>
        <div className="ds-numeric" style={{ fontSize: "var(--text-2xl)", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1, marginTop: 2 }}>{fmt(ind.actual)}</div>
        <div style={{ marginTop: "var(--space-1)" }}><SurpriseChip surprise={ind.surprise} unit={unit} /></div>
      </div>
      {sub && <div className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{sub}</div>}
      <div style={{ display: "flex", gap: "var(--space-4)", paddingTop: "var(--space-2)", borderTop: "1px solid var(--border-default)" }}>
        <div>
          <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>예상치{ind.forecast_placeholder ? " (추정)" : ""}</div>
          <div className="ds-numeric" style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)" }}>{fmt(ind.forecast)}</div>
        </div>
        <div>
          <div style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>이전치</div>
          <div className="ds-numeric" style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)" }}>{fmt(ind.previous)}</div>
        </div>
      </div>
      <AsOfBadge mock={ind.mock}>{ind.mock ? "Mock" : `기준 ${ind.as_of}`}</AsOfBadge>
    </Card>
  );
}

function QuoteCard({ q }) {
  const color = q.change_pct > 0 ? "var(--signal-buy)" : q.change_pct < 0 ? "var(--signal-sell)" : "var(--signal-neutral)";
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{q.name}</span>
      <span className="ds-numeric" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-primary)" }}>{q.value.toLocaleString("ko-KR")}</span>
      <span className="ds-numeric" style={{ fontSize: "var(--text-xs)", fontWeight: 600, color }}>{q.change_pct > 0 ? "+" : ""}{q.change_pct}%</span>
    </Card>
  );
}

export default function MacroTab() {
  const [region, setRegion] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`${API}/api/macro`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) { if (e.name !== "AbortError") setError(e.message || "요청 실패"); }
      finally { setLoading(false); }
    })();
    return () => ctrl.abort();
  }, []);

  const indicators = useMemo(
    () => (data?.indicators || []).filter((i) => region === "all" || i.region === region),
    [data, region]
  );

  if (error) return <Banner tone="error">API 오류: {error} — 백엔드(8000) 확인.</Banner>;
  if (!data) return <Banner>{loading ? "매크로 불러오는 중…" : "데이터 없음"}</Banner>;

  const sourceBadge = data.source === "fred"
    ? <span style={{ fontSize: "var(--text-2xs)", fontWeight: 700, color: "var(--status-live)", border: "1px solid var(--status-live)", borderRadius: "var(--radius-pill)", padding: "2px 10px" }}>FRED 실데이터</span>
    : <span style={{ fontSize: "var(--text-2xs)", fontWeight: 700, color: "var(--accent-strong)", border: "1px solid var(--accent-strong)", borderRadius: "var(--radius-pill)", padding: "2px 10px" }}>Mock (FRED 키 없음)</span>;

  const q = data.quotes;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      {/* 섹션 A · 경제지표 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <SectionEyebrow index="A" title="경제지표 — 시장의 숲" />
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {sourceBadge}
          <SegmentedControl items={REGION_FILTERS} activeId={region} onChange={setRegion} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "var(--space-4)" }}>
        {indicators.map((ind) => <EconCard key={`${ind.region}-${ind.name}`} ind={ind} />)}
      </div>

      {/* 발표 캘린더 */}
      <Card style={{ padding: "var(--space-4) var(--space-5)" }}>
        <SectionLabel>발표 캘린더 (placeholder — 경제캘린더 소스 연동 예정)</SectionLabel>
        <div style={{ display: "flex", gap: "var(--space-5)", flexWrap: "wrap" }}>
          {data.calendar.map((c) => (
            <div key={c.name} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>{c.name}</span>
              <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--accent-strong)" }}>D-{c.d_day} · {c.date}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 섹션 B · 시세 (보조, Mock) */}
      <SectionEyebrow index="B" title="시세 — 보조 지표 (Mock)" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "var(--space-3)" }}>
        {q.indices.map((idx) => <QuoteCard key={idx.name} q={idx} />)}
        <QuoteCard q={{ name: q.fx.pair, value: q.fx.value, change_pct: q.fx.change_pct }} />
        <QuoteCard q={q.volatility} />
      </div>
    </div>
  );
}
