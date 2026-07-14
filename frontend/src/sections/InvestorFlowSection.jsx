// 수급 섹션 — 외국인·기관 순매수 추이 + 프로그램 매매 + 거래원 상위.
// 일별/누적 모드는 fetch 의존성이 아니라 표시 스위치라 섹션 내부 상태로 둔다.
import React, { useState } from "react";
import { Card, SectionLabel, SegmentedControl } from "../ui.jsx";

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
// 거래원 수량은 주 단위로 오지만 백만 단위라 그대로 쓰면 표가 숫자로 뒤덮인다.
function fmtMan(qty) {
  return (qty / 1e4).toFixed(1) + "만";
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

// 창구 상위는 매도·매수가 서로 다른 집합이라 한 창구의 순매수를 낼 수 없다(KIS 가 각각 상위 5만 준다).
// 그래서 HTS 관습대로 두 리스트를 나란히 놓는다. 창구 수는 종목마다 5개 미만일 수 있다.
function BrokerSide({ title, rows, color }) {
  const cell = { padding: "var(--space-2) var(--space-1)", borderBottom: "1px solid var(--border-default)" };
  const th = { ...cell, fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", fontWeight: 600, whiteSpace: "nowrap" };
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-xs)" }}>
      <thead><tr>
        <th style={{ ...th, textAlign: "left" }} colSpan={2}>{title}</th>
        <th style={{ ...th, textAlign: "right" }}>수량</th>
        <th style={{ ...th, textAlign: "right" }}>비중</th>
      </tr></thead>
      <tbody>{rows.map((b) => (
        <tr key={b.name}>
          <td style={{ ...cell, color: "var(--text-tertiary)", width: "1.5em" }}>{b.rank}</td>
          <td style={{ ...cell, color: "var(--text-primary)", fontWeight: 500, whiteSpace: "nowrap" }}>
            {b.name}{b.foreign && <span title="외국계" style={{ marginLeft: 4, color: "var(--text-tertiary)" }}>🌐</span>}
          </td>
          <td className="ds-numeric" style={{ ...cell, textAlign: "right", color }}>{fmtMan(b.qty)}</td>
          <td className="ds-numeric" style={{ ...cell, textAlign: "right", color: "var(--text-tertiary)" }}>{b.pct.toFixed(1)}%</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

function BrokerTable({ brokers }) {
  const { sellers, buyers, foreign } = brokers;
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
        <BrokerSide title="매도 상위" rows={sellers} color="var(--signal-sell)" />
        <BrokerSide title="매수 상위" rows={buyers} color="var(--signal-buy)" />
      </div>
      {/* 외국계 집계는 상위 5 밖 창구까지 합산한 값 — 위 표의 🌐 합계보다 크다. */}
      <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>
        외국계 순매수{" "}
        <span className="ds-numeric" style={{ fontWeight: 700, color: foreign.net_qty >= 0 ? "var(--signal-buy)" : "var(--signal-sell)" }}>
          {fmtSigned(foreign.net_qty / 1e4)}만주
        </span>
        {" "}(매도 {fmtMan(foreign.sell_qty)} {foreign.sell_pct.toFixed(1)}% / 매수 {fmtMan(foreign.buy_qty)} {foreign.buy_pct.toFixed(1)}%)
      </div>
    </div>
  );
}

// series/brokers 만 받는다. 응답 전체를 통째로 넘기던 investorFlow 경로는 지웠다 —
// 아무도 넘기지 않았고 /api/flow 도 그런 필드를 주지 않는다(죽은 폴백이었다).
export default function InvestorFlowSection({ series, brokers }) {
  const [mode, setMode] = useState("daily");

  return (
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

      <Card>
        <SectionLabel>거래원 상위</SectionLabel>
        <BrokerTable brokers={brokers} />
      </Card>
    </div>
  );
}
