// 탭4 — 매크로. /api/macro 연결 (경제지표 = FRED/ECOS 실데이터, 시세 = yfinance 실데이터).
// 섹션 A 경제지표 카드(실제/예상/이전 + 서프라이즈, 한/미 구분) · 섹션 B 시세(지수·환율·VIX). (macro-tab UI 킷 패턴)
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

// 실데이터 출처 태그 — 경제지표 FRED/ECOS, 시세 yfinance. mock 은 태그 없음(Mock 배지로 표시).
const SOURCE_LABEL = { fred: "FRED", ecos: "ECOS", yfinance: "yfinance" };
function SourceTag({ source }) {
  const label = SOURCE_LABEL[source];
  if (!label) return null;
  return (
    <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.02em", color: "var(--status-live)", border: "1px solid var(--status-live)", borderRadius: "var(--radius-xs)", padding: "0 4px" }}>
      {label}
    </span>
  );
}

// mock=가짜값 · stale=실데이터지만 갱신 지연(직전 캐시). 둘 다 주의색(골드)으로 구분.
function AsOfBadge({ children, mock, stale }) {
  const warn = mock || stale;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "var(--text-2xs)", color: warn ? "var(--accent-strong)" : "var(--text-tertiary)", fontWeight: 600 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: warn ? "var(--accent-strong)" : "var(--status-closed)" }} />
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <AsOfBadge mock={ind.mock} stale={ind.stale}>
          {ind.mock ? "Mock" : `기준 ${ind.as_of}${ind.stale ? " · 갱신 지연(캐시)" : ""}`}
        </AsOfBadge>
        <SourceTag source={ind.source} />
      </div>
    </Card>
  );
}

// 시세 카드 — 등락은 국내 관습(상승 빨강/하락 파랑). source(yfinance) 태그 + as_of·mock/stale 배지.
function QuoteCard({ q }) {
  const color = q.change_pct > 0 ? "var(--signal-buy)" : q.change_pct < 0 ? "var(--signal-sell)" : "var(--signal-neutral)";
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 4 }}>
        <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{q.name}</span>
        <SourceTag source={q.source} />
      </div>
      <span className="ds-numeric" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-primary)" }}>{q.value.toLocaleString("ko-KR")}</span>
      <span className="ds-numeric" style={{ fontSize: "var(--text-xs)", fontWeight: 600, color }}>{q.change_pct > 0 ? "+" : ""}{q.change_pct}%</span>
      <AsOfBadge mock={q.mock} stale={q.stale}>
        {q.mock ? "Mock" : `기준 ${q.as_of}${q.stale ? " · 갱신 지연(캐시)" : ""}`}
      </AsOfBadge>
    </Card>
  );
}

// ── 발표 캘린더 ──────────────────────────────────────────────
// D-day 표기: 오늘=D-DAY, 미래=D-n, 지난 이벤트=D+n.
const ddayText = (d) => (d === 0 ? "D-DAY" : d > 0 ? `D-${d}` : `D+${-d}`);
// 카테고리 색: 통화정책=골드 · 지표=라이브그린 · 파생=중립(매수/매도색과 충돌 회피).
const CAT_META = {
  통화정책: { color: "var(--accent-strong)", short: "통화정책" },
  경제지표: { color: "var(--status-live)", short: "지표" },
  파생: { color: "var(--text-secondary)", short: "파생" },
};
const flagOf = (c) => (c === "US" ? "🇺🇸" : c === "KR" ? "🇰🇷" : "🌐");

// 중요도 점: high=채운 골드, medium=채운 회색, low=빈 원.
function ImportanceDot({ level }) {
  const map = { high: "var(--accent-strong)", medium: "var(--text-tertiary)", low: "transparent" };
  const c = map[level] ?? "transparent";
  return <span title={`중요도 ${level}`} style={{ width: 7, height: 7, borderRadius: "50%", background: c, border: `1.5px solid ${level === "low" ? "var(--border-strong)" : c}` }} />;
}

// 카운트다운 카드 — 다음 FOMC/CPI/금통위. 임박(D-3 이내) 시 골드 강조.
function CountdownCard({ label, ev }) {
  const imminent = ev.d_day <= 3;
  const accent = imminent ? "var(--accent-strong)" : "var(--border-strong)";
  return (
    <div style={{ flex: "1 1 150px", minWidth: 150, border: `1px solid ${accent}`, borderRadius: "var(--radius-sm)", padding: "var(--space-3) var(--space-4)", display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", fontWeight: 600 }}>{label}</span>
      <span className="ds-numeric" style={{ fontSize: "var(--text-xl)", fontWeight: 800, lineHeight: 1, color: imminent ? "var(--accent-strong)" : "var(--text-primary)" }}>{ddayText(ev.d_day)}</span>
      <span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{ev.date}{ev.confirmed ? "" : " · 추정"}</span>
    </div>
  );
}

// 날짜순 리스트 한 줄 — 지난 이벤트는 흐리게, 임박(D-3)은 D-day 골드 강조.
function CalRow({ ev }) {
  const cat = CAT_META[ev.category] || { color: "var(--text-secondary)", short: ev.category };
  const imminent = !ev.past && ev.d_day <= 3;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-2) 0", borderBottom: "1px solid var(--border-default)", opacity: ev.past ? 0.4 : 1 }}>
      <span className="ds-numeric" style={{ width: 80, fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{ev.date}</span>
      <span className="ds-numeric" style={{ width: 50, fontSize: "var(--text-xs)", fontWeight: 700, color: ev.past ? "var(--text-tertiary)" : imminent ? "var(--accent-strong)" : "var(--text-secondary)" }}>{ddayText(ev.d_day)}</span>
      <span style={{ fontSize: "9px", fontWeight: 700, color: cat.color, border: `1px solid ${cat.color}`, borderRadius: "var(--radius-xs)", padding: "0 5px", whiteSpace: "nowrap" }}>{cat.short}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: "var(--text-sm)", fontWeight: ev.importance === "high" ? 700 : 500, color: "var(--text-primary)" }}>
        {ev.name}{!ev.confirmed && <span style={{ fontSize: "9px", color: "var(--text-tertiary)", fontWeight: 500 }}> · 추정</span>}
      </span>
      <span style={{ fontSize: "var(--text-2xs)" }}>{flagOf(ev.country)}</span>
      <ImportanceDot level={ev.importance} />
    </div>
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

  const sourceBadge = data.source === "live"
    ? <span style={{ fontSize: "var(--text-2xs)", fontWeight: 700, color: "var(--status-live)", border: "1px solid var(--status-live)", borderRadius: "var(--radius-pill)", padding: "2px 10px" }}>실데이터 · 미국 FRED / 한국 ECOS</span>
    : <span style={{ fontSize: "var(--text-2xs)", fontWeight: 700, color: "var(--accent-strong)", border: "1px solid var(--accent-strong)", borderRadius: "var(--radius-pill)", padding: "2px 10px" }}>Mock (API 키 없음)</span>;

  const q = data.quotes;

  // 발표 캘린더 — 카운트다운(다음 FOMC/CPI/금통위) + 날짜순 리스트(지난 7일~향후 45일).
  const cal = data.calendar || [];
  const nextBy = (name) => cal.find((e) => e.name === name && !e.past);
  const highlights = [
    { label: "다음 FOMC", ev: nextBy("미국 FOMC") },
    { label: "다음 미국 CPI", ev: nextBy("미국 CPI") },
    { label: "다음 한국 금통위", ev: nextBy("한국 금통위") },
  ].filter((h) => h.ev);
  const calList = cal
    .filter((e) => e.d_day >= -7 && e.d_day <= 45)
    .sort((a, b) => a.date.localeCompare(b.date));

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

      {/* 발표 캘린더 — 확정 상수 + 규칙 추정, 오늘 기준 D-day */}
      <Card style={{ padding: "var(--space-4) var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-2)" }}>
          <SectionLabel>발표 캘린더 — 다가오는 발표</SectionLabel>
          <span style={{ fontSize: "9px", color: "var(--text-tertiary)" }}>확정 FOMC/동시만기 · 그 외 추정(공식 일정 확인 권장)</span>
        </div>

        {/* 카운트다운 — 다음 FOMC · CPI · 금통위 */}
        {highlights.length > 0 && (
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            {highlights.map((h) => <CountdownCard key={h.label} label={h.label} ev={h.ev} />)}
          </div>
        )}

        {/* 날짜순 리스트 — 지난 이벤트 흐리게, 임박 강조 */}
        <div>
          {calList.length === 0
            ? <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>표시할 발표 없음</span>
            : calList.map((e) => <CalRow key={`${e.date}-${e.name}`} ev={e} />)}
        </div>
      </Card>

      {/* 섹션 B · 시세 (yfinance 실데이터, 실시간 시세) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <SectionEyebrow index="B" title="시세 — 보조 지표" />
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          {q.source === "yfinance"
            ? <span style={{ fontSize: "var(--text-2xs)", fontWeight: 700, color: "var(--status-live)", border: "1px solid var(--status-live)", borderRadius: "var(--radius-pill)", padding: "2px 10px" }}>실데이터 · yfinance</span>
            : <span style={{ fontSize: "var(--text-2xs)", fontWeight: 700, color: "var(--accent-strong)", border: "1px solid var(--accent-strong)", borderRadius: "var(--radius-pill)", padding: "2px 10px" }}>Mock</span>}
          {q.as_of && q.as_of !== "Mock" && <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>기준 {q.as_of}</span>}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "var(--space-3)" }}>
        {q.indices.map((idx) => <QuoteCard key={idx.name} q={idx} />)}
        <QuoteCard q={{ ...q.fx, name: q.fx.pair }} />
        <QuoteCard q={q.volatility} />
      </div>
    </div>
  );
}
