// 매매 계획 섹션 — 입력(진입가·계좌·리스크) + 손절/목표 + 포지션 사이징.
// 입력 상태는 부모가 든다: 이 값들이 /api/signal fetch 의 의존성이라 섹션이 들면
// 섹션이 fetch 를 알아야 한다. 섹션은 값과 콜백만 받는다.
import React from "react";
import { fmtWon, Card, SectionLabel, FieldLabel, NumberField, Banner } from "../ui.jsx";

function TradePlanView({ plan }) {
  const stopPct = ((plan.stop - plan.entry) / plan.entry) * 100;
  const pos = plan.position;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <Card>
        <SectionLabel right={<span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>ATR(14) <span className="ds-numeric" style={{ color: "var(--text-secondary)" }}>{fmtWon(plan.atr)}</span></span>}>
          손절가 · 목표가 (ATR 기반)
        </SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "var(--space-3)" }}>
          <div style={{ background: "var(--signal-sell-bg)", border: "1px solid var(--signal-sell-border)", borderRadius: "var(--radius-sm)", padding: "var(--space-3)" }}>
            <div style={{ fontSize: "var(--text-2xs)", color: "var(--signal-sell)", fontWeight: 700 }}>손절가 (1×ATR)</div>
            <div className="ds-numeric" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--signal-sell)", marginTop: 4 }}>{fmtWon(plan.stop)}</div>
            <div className="ds-numeric" style={{ fontSize: "var(--text-xs)", color: "var(--signal-sell)", marginTop: 2, opacity: 0.85 }}>{stopPct.toFixed(2)}%</div>
          </div>
          {plan.targets.map((t) => {
            const tPct = ((t.price - plan.entry) / plan.entry) * 100;
            return (
              <div key={t.mult} style={{ background: "var(--signal-buy-bg)", border: "1px solid var(--signal-buy-border)", borderRadius: "var(--radius-sm)", padding: "var(--space-3)" }}>
                <div style={{ fontSize: "var(--text-2xs)", color: "var(--signal-buy)", fontWeight: 700 }}>목표 {t.mult}×ATR · R:R {t.rr}</div>
                <div className="ds-numeric" style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--signal-buy)", marginTop: 4 }}>{fmtWon(t.price)}</div>
                <div className="ds-numeric" style={{ fontSize: "var(--text-xs)", color: "var(--signal-buy)", marginTop: 2, opacity: 0.85 }}>+{tPct.toFixed(2)}%</div>
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <SectionLabel>포지션 사이징</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {[
            { label: "리스크 금액", value: fmtWon(pos.risk_amount) + "원" },
            { label: "주당 리스크", value: fmtWon(pos.per_share_risk) + "원" },
            { label: "매수 수량", value: pos.qty.toLocaleString("ko-KR") + "주", big: true },
            { label: "투입 금액", value: fmtWon(pos.invest_amount) + "원", big: true },
          ].map((r, i, arr) => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "var(--space-2) 0", borderBottom: i < arr.length - 1 ? "1px solid var(--border-default)" : "none" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{r.label}</span>
              <span className="ds-numeric" style={{ fontSize: r.big ? "var(--text-lg)" : "var(--text-sm)", fontWeight: r.big ? 700 : 600, color: "var(--text-primary)" }}>{r.value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// price(현재가)는 브리프 시그니처에 없지만 진입가 힌트/폴백에 필요하다 — 계획이 없으면
// 서버가 채워 준 entry 도 없어서 현재가로 떨어진다.
export default function TradePlanSection({
  tradePlan, tradePlanUnavailable, price,
  entry, onEntryChange, account, onAccountChange, riskPct, onRiskPctChange,
}) {
  const plan = tradePlan;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "var(--space-4)", alignItems: "start" }}>
      <Card style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <SectionLabel>입력 (변경 시 서버 재계산)</SectionLabel>
        <div>
          <FieldLabel hint={`현재가 ${price.toLocaleString("ko-KR")}`}>진입가</FieldLabel>
          {/* 계획이 없으면 서버가 채워 준 진입가도 없다 → 현재가로 떨어진다. */}
          <NumberField value={entry ?? plan?.entry ?? price} onChange={onEntryChange} suffix="원" />
        </div>
        <div>
          <FieldLabel>계좌 규모</FieldLabel>
          <NumberField value={account} onChange={onAccountChange} suffix="원" />
        </div>
        <div>
          <FieldLabel hint={`${riskPct}%`}>감당 리스크</FieldLabel>
          <input type="range" min={0.5} max={5} step={0.5} value={riskPct} onChange={(e) => onRiskPctChange(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
        </div>
        <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>방향: 롱(매수) 기준 · 손절 1×ATR</div>
      </Card>

      {plan ? (
        <TradePlanView plan={plan} />
      ) : (
        // 가짜 손절가를 그리느니 왜 못 그리는지 말한다. 손절가 0원은 손절이 아니다.
        <Card>
          <SectionLabel>손절가 · 목표가 (ATR 기반)</SectionLabel>
          <Banner tone="warn">
            {tradePlanUnavailable?.message
              || "ATR을 계산할 수 없어 손절·목표가를 낼 수 없습니다."}
          </Banner>
        </Card>
      )}
    </div>
  );
}
