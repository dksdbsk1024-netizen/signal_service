// 탭2 — 기술적 분석. /api/technical/{ticker} 연결.
// CandleChart(candles+VWAP+거래량) + 이평/볼린저 오버레이 레이어 + IndicatorTable + 타임프레임 토글.
import React, { useEffect, useMemo, useState } from "react";
import {
  API, Ds, NAME_BY_TICKER, SectionEyebrow, Card, SectionLabel,
  SegmentedControl, ToggleChip, Banner, toSignalEnum, SourceTag, AsOfBadge,
} from "../ui.jsx";

const { CandleChart, IndicatorTable } = Ds;

const TIMEFRAMES = [
  { id: "1m", label: "1분" },
  { id: "5m", label: "5분" },
  { id: "1d", label: "일봉" },
];

const CHART_H = 360;

// CandleChart(components/core/CandleChart.jsx)의 스케일을 1:1로 재현해 오버레이를 정렬한다.
// 동일 viewBox 폭(1000, 기본값) + preserveAspectRatio="none" → 컨테이너 실측폭과 무관하게 일치.
const VB_W = 1000;
const PLOT_LEFT = 52;
const PLOT_RIGHT = 12;
const PAD_TOP = 12;
const VOL_H = 48; // showVolume && !mini
const VOL_GAP = 8;

function buildScale(candles) {
  const n = candles.length;
  const lows = candles.map((c) => c.l);
  const highs = candles.map((c) => c.h);
  const minP = Math.min(...lows);
  const maxP = Math.max(...highs);
  const range = maxP - minP || 1;
  const priceH = CHART_H - VOL_H - VOL_GAP;
  const plotW = VB_W - PLOT_LEFT - PLOT_RIGHT;
  const xAt = (i) => PLOT_LEFT + (i + 0.5) * (plotW / n);
  const yAt = (p) => PAD_TOP + (1 - (p - minP) / range) * priceH;
  return { xAt, yAt };
}

// null(워밍업) 구간을 건너뛰며 SVG path 문자열 생성.
function linePath(values, xAt, yAt) {
  let d = "";
  let pen = false;
  values.forEach((v, i) => {
    if (v == null) { pen = false; return; }
    d += `${pen ? "L" : "M"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)} `;
    pen = true;
  });
  return d.trim();
}

// 선행스팬 A/B 사이 구름 폴리곤. 둘 다 non-null인 인덱스 구간만 채운다.
function cloudPath(aVals, bVals, xAt, yAt) {
  if (!aVals || !bVals) return "";
  const idx = [];
  aVals.forEach((v, i) => { if (v != null && bVals[i] != null) idx.push(i); });
  if (idx.length < 2) return "";
  const top = idx.map((i) => `${xAt(i).toFixed(1)} ${yAt(aVals[i]).toFixed(1)}`);
  const bot = idx.slice().reverse().map((i) => `${xAt(i).toFixed(1)} ${yAt(bVals[i]).toFixed(1)}`);
  return `M ${top.join(" L ")} L ${bot.join(" L ")} Z`;
}

function OverlayLayer({ candles, overlays, show }) {
  const { xAt, yAt } = useMemo(() => buildScale(candles), [candles]);
  const lines = [
    { key: "ma5", on: show.ma, color: "#8fb0d9", val: overlays.ma5 },
    { key: "ma20", on: show.ma, color: "#b98cff", val: overlays.ma20 },
    { key: "ma60", on: show.ma, color: "#5aa9a0", val: overlays.ma60 },
    { key: "bb_upper", on: show.bb, color: "rgba(139,152,165,0.6)", val: overlays.bb_upper, dash: "4 3" },
    { key: "bb_lower", on: show.bb, color: "rgba(139,152,165,0.6)", val: overlays.bb_lower, dash: "4 3" },
  ];
  const ichi = overlays.ichimoku;
  const ichiLines = ichi ? [
    { key: "tenkan", color: "#e0a458", val: ichi.tenkan },              // 전환선
    { key: "kijun", color: "#5a8fd9", val: ichi.kijun },               // 기준선
    { key: "chikou", color: "#9aa4b0", val: ichi.chikou, dash: "2 3" }, // 후행스팬
  ] : [];
  const fib = overlays.fibonacci;
  return (
    <svg viewBox={`0 0 ${VB_W} ${CHART_H}`} width="100%" height={CHART_H} preserveAspectRatio="none"
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}>
      {show.ichimoku && ichi && (
        <path d={cloudPath(ichi.senkou_a, ichi.senkou_b, xAt, yAt)} fill="rgba(90,169,160,0.18)" stroke="none" />
      )}
      {lines.filter((l) => l.on && l.val).map((l) => (
        <path key={l.key} d={linePath(l.val, xAt, yAt)} fill="none" stroke={l.color} strokeWidth={1.5} strokeDasharray={l.dash} opacity={0.9} />
      ))}
      {show.ichimoku && ichiLines.filter((l) => l.val).map((l) => (
        <path key={l.key} d={linePath(l.val, xAt, yAt)} fill="none" stroke={l.color} strokeWidth={1.4} strokeDasharray={l.dash} opacity={0.85} />
      ))}
      {show.fib && fib && fib.levels.map((lv, i) => {
        const y = yAt(lv.price);
        return (
          <g key={i}>
            <line x1={PLOT_LEFT} y1={y} x2={VB_W - PLOT_RIGHT} y2={y} stroke="rgba(224,164,88,0.55)" strokeWidth={1} strokeDasharray="5 4" />
            <text x={VB_W - PLOT_RIGHT - 4} y={y - 2} fontSize="12" textAnchor="end" fill="rgba(224,164,88,0.9)">
              {(lv.ratio * 100).toFixed(1)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const MA_LEGEND = [
  { label: "이평 5", color: "#8fb0d9" },
  { label: "이평 20", color: "#b98cff" },
  { label: "이평 60", color: "#5aa9a0" },
];

export default function TechnicalTab({ ticker }) {
  const [interval, setIntervalId] = useState("1m");
  const [show, setShow] = useState({ ma: true, vwap: true, bb: false, ichimoku: false, fib: false });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`${API}/api/technical/${ticker}?interval=${interval}&bars=120`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message || "요청 실패");
      } finally { setLoading(false); }
    })();
    return () => ctrl.abort();
  }, [ticker, interval]);

  const name = NAME_BY_TICKER[ticker] || ticker;
  // 봉 부족 지표는 value=null 로 온다. String(null) 은 화면에 "null" 을 찍는다 —
  // 왜 없는지(봉 N/M)를 값 자리에 그대로 쓴다.
  const tableRows = useMemo(
    () => (data?.indicators_table || []).map((r) => ({
      name: r.name,
      value: r.value == null ? `봉 ${r.bars}/${r.required_bars}` : String(r.value),
      signal: toSignalEnum(r.signal),
    })),
    [data]
  );

  if (error) return <Banner tone="error">API 오류: {error} — 백엔드(8000) 확인.</Banner>;
  if (!data) return <Banner>{loading ? "차트 불러오는 중…" : "종목을 선택하세요."}</Banner>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <SectionEyebrow index="2" title={`기술적 분석 — ${name}`} />

      {/* 차트 카드 */}
      <Card style={{ padding: "var(--space-4) var(--space-5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)", flexWrap: "wrap", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <ToggleChip label="이평선" active={show.ma} color="#8fb0d9" onClick={() => setShow((s) => ({ ...s, ma: !s.ma }))} />
            <ToggleChip label="VWAP" active={show.vwap} color="var(--accent)" onClick={() => setShow((s) => ({ ...s, vwap: !s.vwap }))} />
            <ToggleChip label="볼린저" active={show.bb} color="rgba(139,152,165,0.9)" onClick={() => setShow((s) => ({ ...s, bb: !s.bb }))} />
            <ToggleChip label="이치모쿠" active={show.ichimoku} color="#5a8fd9" onClick={() => setShow((s) => ({ ...s, ichimoku: !s.ichimoku }))} />
            <ToggleChip label="피보나치" active={show.fib} color="#e0a458" onClick={() => setShow((s) => ({ ...s, fib: !s.fib }))} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            {/* 분봉 출처 — 응답의 source/mock/stale (다른 탭의 배지와 같은 규약). as_of 는 없다. */}
            <AsOfBadge mock={data.mock} stale={data.stale}>
              {data.mock ? "Mock" : data.stale ? "갱신 지연(캐시)" : "실시간"}
            </AsOfBadge>
            <SourceTag source={data.source} />
            <SegmentedControl items={TIMEFRAMES} activeId={interval} onChange={setIntervalId} />
          </div>
        </div>

        <div style={{ position: "relative" }}>
          {CandleChart && <CandleChart candles={data.candles} showVolume showVwap={show.vwap} height={CHART_H} />}
          {show.ma || show.bb || show.ichimoku || show.fib ? <OverlayLayer candles={data.candles} overlays={data.overlays} show={show} /> : null}
        </div>

        {/* 오버레이 범례 */}
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap", marginTop: "var(--space-2)", fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>
          {show.ma && MA_LEGEND.map((m) => (
            <span key={m.label} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 10, height: 2, background: m.color, display: "inline-block" }} /> {m.label}
            </span>
          ))}
          {show.bb && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 0, borderTop: "2px dashed rgba(139,152,165,0.8)", display: "inline-block" }} /> 볼린저(20,2)</span>}
        </div>
      </Card>

      {/* 지표 테이블 */}
      <Card style={{ padding: "var(--space-4) var(--space-5)" }}>
        <SectionLabel>지표 현재값 · 신호 ({interval})</SectionLabel>
        {IndicatorTable && <IndicatorTable rows={tableRows} dense />}
      </Card>
    </div>
  );
}
