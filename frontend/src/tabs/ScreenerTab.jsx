// 탭 — 종목 목록(시총상위). /api/screener 연결. 행 클릭 → 티커 변경 + 종합신호(탭1) 이동.
import React, { useEffect, useState } from "react";
import { API, Card, SectionLabel, Banner, LabelBadge, fmtWon, fmtVolume } from "../ui.jsx";

function scoreColor(s) {
  if (s >= 60) return "var(--signal-buy-strong)";
  if (s >= 20) return "var(--signal-buy)";
  if (s > -20) return "var(--signal-neutral)";
  if (s > -60) return "var(--signal-sell)";
  return "var(--signal-sell-strong)";
}

// 국내 관습: 상승 = 빨강(signal-buy), 하락 = 파랑(signal-sell), 보합 = 회색.
function changeColor(pct) {
  if (pct > 0) return "var(--signal-buy)";
  if (pct < 0) return "var(--signal-sell)";
  return "var(--text-tertiary)";
}

// 중앙(0) 기준 좌우로 뻗는 스코어 막대 (-100~+100).
function ScoreBar({ score }) {
  // 장 초반엔 가용 지표가 0개라 스코어가 없을 수 있다. 0점 막대를 그리면
  // "중립"이라는 없는 관측을 만들어낸다 — 막대 대신 사유를 쓴다.
  if (score == null) {
    return (
      <div style={{ height: 16, display: "flex", alignItems: "center", fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>
        봉 부족
      </div>
    );
  }
  const half = Math.min(50, (Math.abs(score) / 100) * 50);
  const color = scoreColor(score);
  return (
    <div style={{ position: "relative", height: 16, background: "var(--bg-inset)", borderRadius: "var(--radius-xs)", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--border-strong)", zIndex: 1 }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, background: color, opacity: 0.85,
        left: score >= 0 ? "50%" : `${50 - half}%`, width: `${half}%` }} />
      <span className="ds-numeric" style={{ position: "absolute", right: 6, top: 0, bottom: 0, display: "flex", alignItems: "center", fontSize: "var(--text-2xs)", fontWeight: 700, color: "var(--text-primary)" }}>
        {score > 0 ? "+" : ""}{score.toFixed(1)}
      </span>
    </div>
  );
}

export default function ScreenerTab({ onPick }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`${API}/api/screener`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) { if (e.name !== "AbortError") setError(e.message || "요청 실패"); }
      finally { setLoading(false); }
    })();
    return () => ctrl.abort();
  }, []);

  if (error) return <Banner tone="error">API 오류: {error} — 백엔드(8000) 확인.</Banner>;
  if (!data) return <Banner>{loading ? "스크리너 불러오는 중…" : "데이터 없음"}</Banner>;

  const th = { fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", fontWeight: 600, padding: "var(--space-2) var(--space-3)", borderBottom: "1px solid var(--border-default)", textAlign: "left", whiteSpace: "nowrap" };
  const td = { padding: "var(--space-2) var(--space-3)", borderBottom: "1px solid var(--border-default)", verticalAlign: "middle" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card style={{ padding: "var(--space-4) var(--space-5)" }}>
        <SectionLabel right={<span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>시총상위 {data.count}종목 · 종합신호 스코어 내림차순</span>}>
          종목 목록 — 시세 + 종합신호 (행 클릭 → 종합 신호로 이동)
        </SectionLabel>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr>
            <th style={th}>순위</th>
            <th style={th}>종목</th>
            <th style={{ ...th, textAlign: "right" }}>현재가</th>
            <th style={{ ...th, textAlign: "right" }}>등락률</th>
            <th style={{ ...th, textAlign: "right" }}>거래량</th>
            <th style={{ ...th, width: 180 }}>스코어</th>
            <th style={th}>신호</th>
            <th style={{ ...th, textAlign: "right" }}>주요 기여</th>
          </tr></thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={r.ticker}
                onClick={() => onPick(r.ticker)}
                style={{ cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-raised)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                <td style={{ ...td, color: "var(--text-tertiary)", fontWeight: 700 }} className="ds-numeric">{i + 1}</td>
                <td style={td}>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{r.name}</div>
                  <div className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{r.ticker}</div>
                </td>
                <td style={{ ...td, textAlign: "right" }} className="ds-numeric">
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text-primary)" }}>{fmtWon(r.price)}</span>
                </td>
                <td style={{ ...td, textAlign: "right" }} className="ds-numeric">
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: changeColor(r.change_pct) }}>
                    {r.change_pct > 0 ? "+" : ""}{r.change_pct.toFixed(2)}%
                  </span>
                </td>
                <td style={{ ...td, textAlign: "right" }} className="ds-numeric">
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{fmtVolume(r.volume)}</span>
                </td>
                <td style={td}><ScoreBar score={r.final_score} /></td>
                <td style={td}><LabelBadge label={r.label} /></td>
                <td style={{ ...td, textAlign: "right" }}>
                  {r.top_contributor ? (
                    <React.Fragment>
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{r.top_contributor.name} </span>
                      <span className="ds-numeric" style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: r.top_contributor.contribution >= 0 ? "var(--signal-buy)" : "var(--signal-sell)" }}>
                        {r.top_contributor.contribution > 0 ? "+" : ""}{r.top_contributor.contribution}
                      </span>
                    </React.Fragment>
                  ) : (
                    <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
