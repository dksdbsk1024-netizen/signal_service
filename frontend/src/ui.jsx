// 탭 공용 토큰 스타일 소품 + 포맷 헬퍼 + 상수.
import React from "react";

export const API = "http://localhost:8000";

// window.Ds_a0b250 = _ds_bundle.js 가 붙인 디자인 시스템 컴포넌트 네임스페이스.
export const Ds = window.Ds_a0b250 || {};

// 종목 universe — 검색 자동완성 + 코드→종목명 (API는 종목명 미제공).
// 시가총액 상위(코스피 대형주). 백엔드 screener.WATCHLIST 와 동일하게 유지한다.
export const WATCHLIST = [
  { ticker: "005930", name: "삼성전자" },
  { ticker: "000660", name: "SK하이닉스" },
  { ticker: "373220", name: "LG에너지솔루션" },
  { ticker: "207940", name: "삼성바이오로직스" },
  { ticker: "005380", name: "현대차" },
  { ticker: "000270", name: "기아" },
  { ticker: "068270", name: "셀트리온" },
  { ticker: "035420", name: "NAVER" },
  { ticker: "105560", name: "KB금융" },
  { ticker: "005490", name: "POSCO홀딩스" },
  { ticker: "012330", name: "현대모비스" },
  { ticker: "035720", name: "카카오" },
  { ticker: "028260", name: "삼성물산" },
  { ticker: "055550", name: "신한지주" },
  { ticker: "006400", name: "삼성SDI" },
  { ticker: "051910", name: "LG화학" },
];
export const NAME_BY_TICKER = Object.fromEntries(WATCHLIST.map((s) => [s.ticker, s.name]));

// 5개 탭 (설정은 탭 아님 — 우측 톱니). DESIGN.md §9 최신 구성.
// 목록(시총상위)을 첫 진입으로 두고, 행을 누르면 종합 신호(탭)로 이동한다.
export const TABS = [
  { id: "screener", label: "종목 목록" },
  { id: "overview", label: "종합 신호" },
  { id: "technical", label: "기술적 분석" },
  { id: "flow", label: "수급" },
  { id: "macro", label: "매크로/시장" },
];

export function fmtWon(v) {
  const sign = v < 0 ? "-" : "";
  return sign + Math.abs(Math.round(v)).toLocaleString("ko-KR");
}
export function fmtVolume(v) {
  if (v >= 1e8) return (v / 1e8).toFixed(1) + "억주";
  if (v >= 1e4) return (v / 1e4).toFixed(1) + "만주";
  return v.toLocaleString("ko-KR") + "주";
}

export function SectionEyebrow({ index, title }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
      <span style={{ fontSize: "var(--text-2xs)", fontWeight: 800, color: "var(--accent)", letterSpacing: "var(--tracking-wide)", border: "1px solid var(--accent)", borderRadius: "var(--radius-pill)", padding: "2px 9px", flexShrink: 0 }}>{index}</span>
      <span style={{ fontSize: "var(--text-md)", fontWeight: 800, color: "var(--text-primary)", flexShrink: 0 }}>{title}</span>
      <div style={{ flex: 1, height: 1, background: "var(--border-default)" }} />
    </div>
  );
}
export function Card({ children, style }) {
  return <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-xs)", padding: "var(--space-4)", ...style }}>{children}</div>;
}
export function SectionLabel({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "var(--tracking-wide)" }}>{children}</div>
      {right}
    </div>
  );
}
export function FieldLabel({ children, hint }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-1)" }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: "var(--weight-medium)" }}>{children}</span>
      {hint && <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{hint}</span>}
    </div>
  );
}
export function NumberField({ value, onChange, suffix }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", background: "var(--bg-inset)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", padding: "var(--space-2) var(--space-3)" }}>
      <input className="ds-numeric" type="text" inputMode="numeric" value={value}
        onChange={(e) => { const raw = e.target.value.replace(/[^0-9.-]/g, ""); onChange(raw === "" ? 0 : Number(raw)); }}
        style={{ flex: 1, width: "100%", minWidth: 0, background: "transparent", border: "none", outline: "none", fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }} />
      {suffix && <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", flexShrink: 0 }}>{suffix}</span>}
    </div>
  );
}
// 세그먼트 토글 (타임프레임/오버레이 등).
export function SegmentedControl({ items, activeId, onChange }) {
  return (
    <div style={{ display: "inline-flex", background: "var(--bg-inset)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)", padding: 2, gap: 2 }}>
      {items.map((it) => {
        const active = it.id === activeId;
        return (
          <button key={it.id} onClick={() => onChange(it.id)}
            style={{ appearance: "none", cursor: "pointer", border: "none", borderRadius: "var(--radius-xs)", padding: "var(--space-1) var(--space-3)", fontSize: "var(--text-xs)", fontWeight: active ? "var(--weight-semibold)" : "var(--weight-regular)", color: active ? "var(--text-primary)" : "var(--text-tertiary)", background: active ? "var(--bg-surface-raised)" : "transparent", boxShadow: active ? "var(--shadow-xs)" : "none", whiteSpace: "nowrap", transition: "color var(--duration-fast) var(--ease-standard)" }}>
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
// 토글 칩 (오버레이 on/off).
export function ToggleChip({ label, active, color, onClick }) {
  return (
    <button onClick={onClick} style={{ appearance: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${active ? (color || "var(--accent)") : "var(--border-default)"}`, borderRadius: "var(--radius-pill)", padding: "3px 10px", background: active ? "var(--bg-surface-raised)" : "transparent", fontSize: "var(--text-2xs)", fontWeight: 700, color: active ? "var(--text-primary)" : "var(--text-tertiary)" }}>
      <span style={{ width: 10, height: 2, background: active ? (color || "var(--accent)") : "var(--border-strong)", display: "inline-block" }} />
      {label}
    </button>
  );
}
export function Banner({ tone, children }) {
  const color = tone === "error" ? "var(--signal-sell)" : "var(--text-secondary)";
  return <div style={{ padding: "var(--space-4)", textAlign: "center", fontSize: "var(--text-sm)", color, border: "1px dashed var(--border-default)", borderRadius: "var(--radius-md)" }}>{children}</div>;
}
export function LabelBadge({ label }) {
  const color =
    label === "적극매수" ? "var(--signal-buy-strong)" :
    label === "매수" ? "var(--signal-buy)" :
    label === "적극매도" ? "var(--signal-sell-strong)" :
    label === "매도" ? "var(--signal-sell)" : "var(--signal-neutral)";
  const bg =
    label?.includes("매수") ? "var(--signal-buy-bg)" :
    label?.includes("매도") ? "var(--signal-sell-bg)" : "var(--signal-neutral-bg)";
  return <span style={{ fontSize: "var(--text-md)", fontWeight: 800, color, background: bg, border: `1px solid ${color}`, borderRadius: "var(--radius-pill)", padding: "4px 16px" }}>{label}</span>;
}

// 실데이터 출처 태그 — 종목 KIS, 경제지표 FRED/ECOS, 시세 yfinance. mock 은 태그 없음(Mock 배지로 표시).
const SOURCE_LABEL = { kis: "KIS", fred: "FRED", ecos: "ECOS", yfinance: "yfinance" };
export function SourceTag({ source }) {
  const label = SOURCE_LABEL[source];
  if (!label) return null;
  return (
    <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.02em", color: "var(--status-live)", border: "1px solid var(--status-live)", borderRadius: "var(--radius-xs)", padding: "0 4px" }}>
      {label}
    </span>
  );
}

// mock=가짜값 · stale=실데이터지만 갱신 지연(직전 캐시). 둘 다 주의색(골드)으로 구분.
export function AsOfBadge({ children, mock, stale }) {
  const warn = mock || stale;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "var(--text-2xs)", color: warn ? "var(--accent-strong)" : "var(--text-tertiary)", fontWeight: 600 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: warn ? "var(--accent-strong)" : "var(--status-closed)" }} />
      {children}
    </span>
  );
}

// API 신호 라벨(한글) → IndicatorTable signal enum.
export function toSignalEnum(korean) {
  if (korean === "매수") return "buy";
  if (korean === "매도") return "sell";
  return "neutral";
}
