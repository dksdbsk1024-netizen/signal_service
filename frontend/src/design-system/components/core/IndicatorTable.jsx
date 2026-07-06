import React from "react";

const SIGNAL_META = {
  buy: { label: "매수", color: "var(--signal-buy)", bg: "var(--signal-buy-bg)" },
  sell: { label: "매도", color: "var(--signal-sell)", bg: "var(--signal-sell-bg)" },
  neutral: { label: "중립", color: "var(--signal-neutral)", bg: "var(--signal-neutral-bg)" },
};

/**
 * @param {IndicatorTableProps} props
 */
export function IndicatorTable({ rows = [], dense = false }) {
  const rowPad = dense ? "6px 10px" : "10px 12px";
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "var(--text-sm)" }}>
      <thead>
        <tr>
          {["지표", "값", "신호"].map((h, i) => (
            <th
              key={i}
              style={{
                textAlign: i === 2 ? "right" : i === 1 ? "right" : "left",
                fontSize: "var(--text-2xs)",
                color: "var(--text-tertiary)",
                fontWeight: "var(--weight-medium)",
                padding: rowPad,
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const meta = SIGNAL_META[r.signal] || SIGNAL_META.neutral;
          return (
            <tr key={i}>
              <td style={{ padding: rowPad, color: "var(--text-body)", borderBottom: "1px solid var(--border-default)" }}>{r.name}</td>
              <td
                className="ds-numeric"
                style={{ padding: rowPad, textAlign: "right", color: "var(--text-body)", borderBottom: "1px solid var(--border-default)" }}
              >
                {r.value}
              </td>
              <td style={{ padding: rowPad, textAlign: "right", borderBottom: "1px solid var(--border-default)" }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "var(--text-2xs)",
                    fontWeight: "var(--weight-semibold)",
                    color: meta.color,
                    background: meta.bg,
                    borderRadius: "var(--radius-xs)",
                    padding: "2px 8px",
                  }}
                >
                  {meta.label}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
