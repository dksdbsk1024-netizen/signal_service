// 대시보드 한 줄 헤더 — 종목코드·종목명·현재가·등락·거래량·장상태 + 갱신 시각 + 새로고침.
//
// Ds.StockHeader 를 쓰지 않는 이유: 종목코드를 받지도 그리지도 않고(이름만 크게 쓴다),
// 갱신 시각·새로고침 버튼 자리도 없다. DS 컴포넌트는 _ds_bundle.js 에서 렌더되므로
// 소스 .jsx 를 고쳐도 화면이 바뀌지 않는다 — 그래서 대시보드는 제 헤더를 따로 든다.
import React from "react";
import { fmtVolume } from "../ui.jsx";

/** 서버 as_of 가 있으면 그게 진짜 데이터 시각이다(스냅샷은 최대 3분 늙었다).
 *  없으면 fetch 시각이 곧 데이터 시각이다(라이브 라우트). */
function ageText(asOf, fetchedAt) {
  const t = asOf ? new Date(asOf) : fetchedAt;
  if (!t || Number.isNaN(t.getTime())) return "—";
  const sec = Math.max(0, Math.round((Date.now() - t.getTime()) / 1000));
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  return `${Math.floor(min / 60)}시간 전`;
}

// 백엔드 market_hours.market_status() 가 주는 세 값이 전부다.
const MARKET_LABEL = { open: "장중", after: "시간외", closed: "장마감" };

function MarketBadge({ status }) {
  const live = status === "open";
  const color = live ? "var(--status-live)" : "var(--status-closed)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "var(--text-2xs)", fontWeight: 700, color, border: `1px solid ${color}`, borderRadius: "var(--radius-pill)", padding: "2px 8px" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
      {MARKET_LABEL[status] || status || "—"}
    </span>
  );
}

export default function DashboardHeader({
  ticker, name, header, asOf, fetchedAt, isRefreshing, error, onRefresh,
}) {
  // 시각 문자열은 시간이 흘러야 바뀐다 — 데이터가 그대로여도 30초마다 다시 그린다.
  const [, tick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const age = ageText(asOf, fetchedAt);
  const up = (header?.change_pct ?? 0) >= 0;
  const moveColor = up ? "var(--signal-buy)" : "var(--signal-sell)";

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: "var(--space-4)",
      background: "var(--bg-surface)", border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-xs)",
      padding: "var(--space-3) var(--space-5)", marginBottom: "var(--space-4)",
    }}>
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "var(--space-3)" }}>
        <span className="ds-numeric" style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-tertiary)" }}>{ticker}</span>
        <span style={{ fontSize: "var(--text-lg)", fontWeight: 800, color: "var(--text-primary)" }}>{name}</span>

        {header ? (
          <React.Fragment>
            <span className="ds-numeric" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-primary)", marginLeft: "var(--space-2)" }}>
              {header.price.toLocaleString("ko-KR")}
            </span>
            <span className="ds-numeric" style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: moveColor }}>
              {up ? "+" : ""}{Math.round(header.change).toLocaleString("ko-KR")} ({up ? "+" : ""}{header.change_pct.toFixed(2)}%)
            </span>
            <span className="ds-numeric" style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
              거래량 {fmtVolume(header.volume)}
            </span>
            <MarketBadge status={header.market_status} />
          </React.Fragment>
        ) : (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>시세 불러오는 중…</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        {/* 갱신이 실패해도 화면의 데이터는 남아 있다 — 언제 것인지 여기서 말해 준다. */}
        <span style={{ fontSize: "var(--text-xs)", color: error ? "var(--signal-sell)" : "var(--text-tertiary)" }}>
          {error ? `갱신 실패 · 마지막 데이터 ${age}` : `갱신 ${age}`}
        </span>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          style={{
            appearance: "none", cursor: isRefreshing ? "default" : "pointer",
            border: "1px solid var(--border-default)", borderRadius: "var(--radius-sm)",
            background: "var(--bg-inset)", color: "var(--text-secondary)",
            padding: "var(--space-1) var(--space-3)", fontSize: "var(--text-xs)", fontWeight: 600,
            opacity: isRefreshing ? 0.6 : 1, whiteSpace: "nowrap",
          }}
        >
          {isRefreshing ? "갱신 중…" : "↻ 새로고침"}
        </button>
      </div>
    </div>
  );
}
