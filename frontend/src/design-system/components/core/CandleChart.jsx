import React from "react";

const DEFAULT_CANDLES = [
  { t: "09:00", o: 70100, h: 70400, l: 69950, c: 70350, v: 82000 },
  { t: "09:10", o: 70350, h: 70600, l: 70300, c: 70500, v: 65000 },
  { t: "09:20", o: 70500, h: 70550, l: 70100, c: 70200, v: 71000 },
  { t: "09:30", o: 70200, h: 70750, l: 70180, c: 70700, v: 98000 },
  { t: "09:40", o: 70700, h: 70900, l: 70600, c: 70850, v: 88000 },
  { t: "09:50", o: 70850, h: 71100, l: 70800, c: 71050, v: 120000 },
  { t: "10:00", o: 71050, h: 71300, l: 70950, c: 71300, v: 134000 },
  { t: "10:10", o: 71300, h: 71350, l: 71050, c: 71150, v: 76000 },
  { t: "10:20", o: 71150, h: 71400, l: 71100, c: 71300, v: 91000 },
  { t: "10:30", o: 71300, h: 71450, l: 71200, c: 71300, v: 68000 },
];

/**
 * @param {CandleChartProps} props
 */
export function CandleChart({
  candles = DEFAULT_CANDLES,
  showVolume = true,
  showVwap = true,
  mini = false,
  height = 260,
  vbWidth,
}) {
  const width = "100%";
  const padding = mini ? { top: 8, right: 4, bottom: 4, left: 4 } : { top: 12, right: 12, bottom: 8, left: 44 };
  const volH = showVolume && !mini ? 48 : showVolume && mini ? 24 : 0;
  const volGap = showVolume ? 8 : 0;
  const priceH = height - volH - volGap;

  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const maxP = Math.max(...highs);
  const minP = Math.min(...lows);
  const priceRange = maxP - minP || 1;
  const maxV = Math.max(...candles.map((c) => c.v));

  const n = candles.length;

  // viewBox-based layout. vbWidth lets a caller pass the true measured pixel
  // width of the rendered container so x/y units are 1:1 — this keeps candle
  // proportions and font sizes from stretching non-uniformly when the SVG's
  // rendered width differs from its viewBox width. Defaults to 1000 (legacy behavior).
  const vbW = vbWidth || 1000;
  const vbH = height;
  const plotLeft = mini ? 8 : 52;
  const plotRight = mini ? 8 : 12;
  const plotW = vbW - plotLeft - plotRight;
  const xAt = (i) => plotLeft + (i + 0.5) * (plotW / n);
  const cw = (plotW / n) * (mini ? 0.5 : 0.62);
  const yAt = (p) => padding.top + (1 - (p - minP) / priceRange) * priceH;
  const vBarH = (v) => (v / maxV) * (volH - 4);

  const vwapValues = showVwap
    ? candles.map((_, i) => {
        const slice = candles.slice(0, i + 1);
        const sum = slice.reduce((s, c) => s + (c.h + c.l + c.c) / 3, 0);
        return sum / slice.length;
      })
    : [];

  const vwapPath = vwapValues
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`)
    .join(" ");

  return (
    <div style={{ width, background: "var(--bg-surface)" }}>
      <svg viewBox={`0 0 ${vbW} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        {/* gridlines */}
        {!mini &&
          [0, 0.25, 0.5, 0.75, 1].map((f, i) => {
            const y = padding.top + f * priceH;
            const price = maxP - f * priceRange;
            return (
              <g key={i}>
                <line x1={plotLeft} y1={y} x2={vbW - plotRight} y2={y} stroke="var(--border-default)" strokeWidth="1" opacity="0.5" />
                <text x={plotLeft - 4} y={y + 3} fontSize="12" textAnchor="end" fill="var(--text-tertiary)" fontFamily="var(--font-numeric)">
                  {Math.round(price).toLocaleString("ko-KR")}
                </text>
              </g>
            );
          })}

        {/* candles */}
        {candles.map((c, i) => {
          const isUp = c.c >= c.o;
          const color = isUp ? "var(--signal-buy)" : "var(--signal-sell)";
          const bodyTop = yAt(Math.max(c.o, c.c));
          const bodyBottom = yAt(Math.min(c.o, c.c));
          const x = xAt(i);
          return (
            <g key={i}>
              <line x1={x} y1={yAt(c.h)} x2={x} y2={yAt(c.l)} stroke={color} strokeWidth={mini ? 1.5 : 2} />
              <rect
                x={x - cw / 2}
                y={bodyTop}
                width={cw}
                height={Math.max(1.5, bodyBottom - bodyTop)}
                fill={color}
              />
            </g>
          );
        })}

        {showVwap && <path d={vwapPath} fill="none" stroke="var(--accent)" strokeWidth={mini ? 1.5 : 2} opacity="0.9" />}

        {/* volume */}
        {showVolume &&
          candles.map((c, i) => {
            const isUp = c.c >= c.o;
            const color = isUp ? "var(--signal-buy)" : "var(--signal-sell)";
            const x = xAt(i);
            const h = vBarH(c.v);
            return (
              <rect
                key={i}
                x={x - cw / 2}
                y={height - volH + (volH - 4 - h)}
                width={cw}
                height={h}
                fill={color}
                opacity="0.55"
              />
            );
          })}
      </svg>
      {!mini && showVwap && (
        <div style={{ display: "flex", gap: "var(--space-3)", fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", padding: "0 var(--space-2) var(--space-1)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 10, height: 2, background: "var(--accent)", display: "inline-block" }} /> VWAP
          </span>
        </div>
      )}
    </div>
  );
}
