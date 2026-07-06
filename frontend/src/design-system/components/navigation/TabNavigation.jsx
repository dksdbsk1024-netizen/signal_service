import React from "react";

/**
 * @param {TabNavigationProps} props
 */
export function TabNavigation({ tabs = [], activeId, onChange }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-1)",
        borderBottom: "1px solid var(--border-default)",
        background: "var(--bg-surface)",
        padding: "0 var(--space-4)",
      }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            onClick={() => onChange && onChange(tab.id)}
            style={{
              appearance: "none",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "var(--space-3) var(--space-3)",
              fontSize: "var(--text-sm)",
              fontWeight: active ? "var(--weight-semibold)" : "var(--weight-regular)",
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
              transition: "color var(--duration-base) var(--ease-standard)",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
