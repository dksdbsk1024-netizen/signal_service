import React from "react";

const MARKET_STATUS = {
  open: { label: "장중", color: "var(--status-live)" },
  closed: { label: "장마감", color: "var(--status-closed)" },
  after: { label: "시간외", color: "var(--status-after)" },
};

function formatNumber(n) {
  return n.toLocaleString("ko-KR");
}

/**
 * @param {StockHeaderProps} props
 */
export function StockHeader({
  name,
  ticker,
  price,
  changePct,
  changeAmt,
  volume,
  marketCap,
  marketStatus = "open",
}) {
  const isUp = changePct > 0;
  const isFlat = changePct === 0;
  const color = isFlat ? "var(--signal-neutral)" : isUp ? "var(--signal-buy)" : "var(--signal-sell)";
  const bg = isFlat ? "var(--signal-neutral-bg)" : isUp ? "var(--signal-buy-bg)" : "var(--signal-sell-bg)";
  const status = MARKET_STATUS[marketStatus] || MARKET_STATUS.open;
  const sign = changePct > 0 ? "+" : "";

  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", width: "100%", gap: "var(--space-6)" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span style={{ fontSize: "var(--text-lg)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>{name}</span>
          <span className="ds-numeric" style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>{ticker}</span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: "var(--text-2xs)",
              fontWeight: "var(--weight-semibold)",
              color: status.color,
              background: "var(--bg-inset)",
              borderRadius: "var(--radius-pill)",
              padding: "2px 8px",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: status.color, display: "inline-block" }} />
            {status.label}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
          <span className="ds-numeric" style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--weight-bold)", color }}>
            {formatNumber(price)}
          </span>
          <span
            className="ds-numeric"
            style={{
              fontSize: "var(--text-sm)",
              fontWeight: "var(--weight-semibold)",
              color,
              background: bg,
              borderRadius: "var(--radius-sm)",
              padding: "3px 8px",
            }}
          >
            {sign}
            {changeAmt !== undefined ? `${formatNumber(changeAmt)} ` : ""}
            {sign}
            {Math.abs(changePct).toFixed(2)}%
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: "var(--space-6)", textAlign: "right" }}>
        <div>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>거래량</div>
          <div className="ds-numeric" style={{ fontSize: "var(--text-sm)", color: "var(--text-body)", marginTop: 2 }}>
            {volume}
          </div>
        </div>
        {marketCap && (
          <div>
            <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>시가총액</div>
            <div className="ds-numeric" style={{ fontSize: "var(--text-sm)", color: "var(--text-body)", marginTop: 2 }}>
              {marketCap}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
