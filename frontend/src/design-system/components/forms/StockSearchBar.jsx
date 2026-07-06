import React, { useState } from "react";

/**
 * @param {StockSearchBarProps} props
 */
export function StockSearchBar({ placeholder = "종목명 또는 코드 검색", suggestions = [], onSelect }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const filtered = value
    ? suggestions.filter((s) => s.name.includes(value) || s.ticker.includes(value)).slice(0, 6)
    : suggestions.slice(0, 6);

  return (
    <div style={{ position: "relative", width: 320 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          background: "var(--bg-inset)",
          border: `1px solid ${focused ? "var(--accent)" : "var(--border-default)"}`,
          borderRadius: "var(--radius-md)",
          padding: "0 var(--space-3)",
          height: 36,
          transition: "border-color var(--duration-base) var(--ease-standard)",
        }}
      >
        <img
          src="https://unpkg.com/lucide-static@latest/icons/search.svg"
          alt=""
          width="15"
          height="15"
          style={{ opacity: 0.55, filter: "invert(var(--icon-invert, 1))" }}
        />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: "none",
            border: "none",
            outline: "none",
            color: "var(--text-primary)",
            fontSize: "var(--text-sm)",
            fontFamily: "var(--font-body)",
          }}
        />
      </div>
      {focused && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 42,
            left: 0,
            right: 0,
            background: "var(--bg-surface-raised)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)",
            overflow: "hidden",
            zIndex: 20,
          }}
        >
          {filtered.map((s) => (
            <div
              key={s.ticker}
              onMouseDown={() => onSelect && onSelect(s)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "var(--space-2) var(--space-3)",
                cursor: "pointer",
                fontSize: "var(--text-sm)",
              }}
            >
              <span style={{ color: "var(--text-primary)" }}>{s.name}</span>
              <span className="ds-numeric" style={{ color: "var(--text-tertiary)" }}>
                {s.ticker}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
