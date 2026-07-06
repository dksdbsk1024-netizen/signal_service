import React from "react";

function barColor(score) {
  if (score > 2) return "var(--signal-buy)";
  if (score < -2) return "var(--signal-sell)";
  return "var(--signal-neutral)";
}

/**
 * @param {ContributionBarProps} props
 */
export function ContributionBar({ items = [], maxAbs, dense = false }) {
  const scale = maxAbs || Math.max(10, ...items.map((it) => Math.abs(it.score)));
  const rowGap = dense ? "var(--space-1)" : "var(--space-2)";
  const rowHeight = dense ? 20 : 26;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: rowGap, width: "100%" }}>
      {items.map((it, i) => {
        const pct = Math.min(100, (Math.abs(it.score) / scale) * 100);
        const isPositive = it.score >= 0;
        const color = barColor(it.score);
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div
              style={{
                width: 72,
                flexShrink: 0,
                fontSize: "var(--text-xs)",
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={it.name}
            >
              {it.name}
            </div>
            <div
              style={{
                flex: 1,
                height: rowHeight,
                background: "var(--bg-inset)",
                borderRadius: "var(--radius-xs)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* center line */}
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "var(--border-strong)" }} />
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  bottom: 2,
                  left: isPositive ? "50%" : `calc(50% - ${pct / 2}%)`,
                  width: `${pct / 2}%`,
                  background: color,
                  borderRadius: "var(--radius-xs)",
                }}
              />
            </div>
            <div
              className="ds-numeric"
              style={{
                width: 44,
                flexShrink: 0,
                textAlign: "right",
                fontSize: "var(--text-sm)",
                fontWeight: "var(--weight-semibold)",
                color,
              }}
            >
              {it.score > 0 ? "+" : ""}
              {it.score}
            </div>
            {typeof it.weight === "number" && (
              <div style={{ width: 34, flexShrink: 0, textAlign: "right", fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>
                {it.weight}%
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
