import React from "react";

/**
 * Maps a -100..100 score to the 5-zone label used across the product.
 */
function zoneFor(score) {
  if (score >= 60) return { key: "strongBuy", label: "적극매수", color: "var(--signal-buy-strong)" };
  if (score >= 20) return { key: "buy", label: "매수", color: "var(--signal-buy)" };
  if (score > -20) return { key: "neutral", label: "중립", color: "var(--signal-neutral)" };
  if (score > -60) return { key: "sell", label: "매도", color: "var(--signal-sell)" };
  return { key: "strongSell", label: "적극매도", color: "var(--signal-sell-strong)" };
}

// angle(score): -100 -> 180deg (left/baseline), 0 -> 90deg (top), 100 -> 0deg (right/baseline)
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

const SIZES = {
  lg: { w: 320, h: 190, r: 130, stroke: 22, needle: 108, scoreFont: "var(--text-4xl)", labelFont: "var(--text-lg)" },
  md: { w: 220, h: 132, r: 90, stroke: 16, needle: 74, scoreFont: "var(--text-2xl)", labelFont: "var(--text-sm)" },
  sm: { w: 160, h: 96, r: 64, stroke: 11, needle: 52, scoreFont: "var(--text-lg)", labelFont: "var(--text-2xs)" },
};

/**
 * @param {DirectionGaugeProps} props
 */
export function DirectionGauge({ score = 0, size = "lg", showScoreLabel = true, subtitle }) {
  const cfg = SIZES[size] || SIZES.lg;
  const cx = cfg.w / 2;
  const cy = cfg.h - 6;
  const zone = zoneFor(score);
  const needleAngle = angleForScore(score);
  const tip = polar(cx, cy, cfg.needle, needleAngle);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: cfg.w }}>
      <svg width={cfg.w} height={cfg.h} viewBox={`0 0 ${cfg.w} ${cfg.h}`}>
        {ZONE_BOUNDARIES.slice(0, -1).map((start, i) => (
          <path
            key={i}
            d={arcPath(cx, cy, cfg.r, start, ZONE_BOUNDARIES[i + 1])}
            fill="none"
            stroke={ZONE_COLORS[i]}
            strokeWidth={cfg.stroke}
            strokeLinecap="butt"
            opacity="0.9"
          />
        ))}
        <line
          x1={cx}
          y1={cy}
          x2={tip.x}
          y2={tip.y}
          stroke="var(--text-primary)"
          strokeWidth={Math.max(2, cfg.stroke / 7)}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={Math.max(4, cfg.stroke / 4)} fill="var(--text-primary)" />
      </svg>
      <div
        className="ds-numeric"
        style={{
          fontSize: cfg.scoreFont,
          fontWeight: "var(--weight-bold)",
          color: zone.color,
          marginTop: "var(--space-2)",
          lineHeight: 1,
        }}
      >
        {score > 0 ? "+" : ""}
        {score}
      </div>
      {showScoreLabel && (
        <div style={{ fontSize: cfg.labelFont, fontWeight: "var(--weight-semibold)", color: zone.color, marginTop: "var(--space-1)" }}>
          {zone.label}
        </div>
      )}
      {subtitle && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)", marginTop: "var(--space-1)" }}>{subtitle}</div>
      )}
    </div>
  );
}
