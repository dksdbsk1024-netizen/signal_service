// 탭1 — 종합 신호 + 매매 계획. /api/signal/{ticker} 연결.
import React, { useEffect, useState } from "react";
import {
  API, Ds, NAME_BY_TICKER, fmtWon, fmtVolume,
  SectionEyebrow, Card, SectionLabel, FieldLabel, NumberField, Banner, LabelBadge,
} from "../ui.jsx";

const { DirectionGauge, ContributionBar, StockHeader } = Ds;

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

export default function OverviewTab({ ticker }) {
  const [account, setAccount] = useState(10_000_000);
  const [riskPct, setRiskPct] = useState(1);
  const [entry, setEntry] = useState(null); // null → 서버가 현재가로 채움
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ticker 변경 시 진입가 오버라이드 해제 (새 종목 현재가 사용).
  useEffect(() => { setEntry(null); }, [ticker]);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const qs = new URLSearchParams({ account: String(account), risk_pct: String(riskPct) });
        if (entry != null) qs.set("entry", String(entry));
        const res = await fetch(`${API}/api/signal/${ticker}?${qs}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message || "요청 실패");
      } finally { setLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [ticker, account, riskPct, entry]);

  const header = data?.header;
  const signal = data?.signal;
  const plan = data?.trade_plan;
  const name = NAME_BY_TICKER[ticker] || ticker;

  if (error) return <Banner tone="error">API 오류: {error} — 백엔드(8000) 확인.</Banner>;
  if (!data) return <Banner>{loading ? "신호 불러오는 중…" : "종목을 선택하세요."}</Banner>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <SectionEyebrow index="A" title="종합 신호 — 3초 결론" />

      <Card style={{ padding: "var(--space-5) var(--space-6)" }}>
        {StockHeader && (
          <StockHeader name={name} ticker={header.ticker} price={header.price} changePct={header.change_pct} changeAmt={header.change} volume={fmtVolume(header.volume)} marketStatus="closed" />
        )}
      </Card>

      <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-8) var(--space-6)", boxShadow: "var(--shadow-sm)" }}>
        {DirectionGauge && <DirectionGauge score={signal.final_score} size="lg" subtitle={`${header.as_of} 갱신`} />}
        <LabelBadge label={signal.label} />
      </Card>

      <Card style={{ padding: "var(--space-5) var(--space-6)" }}>
        <SectionLabel>근거 — 지표 기여도 (상위 {signal.contributions.length}개)</SectionLabel>
        {ContributionBar && (
          <ContributionBar items={signal.contributions.map((c) => ({ name: c.name, score: c.contribution, weight: c.weight }))} />
        )}
      </Card>

      <SectionEyebrow index="B" title="매매 계획 — 신호를 실행으로" />

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "var(--space-4)", alignItems: "start" }}>
        <Card style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <SectionLabel>입력 (변경 시 서버 재계산)</SectionLabel>
          <div>
            <FieldLabel hint={`현재가 ${header.price.toLocaleString("ko-KR")}`}>진입가</FieldLabel>
            <NumberField value={entry ?? plan.entry} onChange={setEntry} suffix="원" />
          </div>
          <div>
            <FieldLabel>계좌 규모</FieldLabel>
            <NumberField value={account} onChange={setAccount} suffix="원" />
          </div>
          <div>
            <FieldLabel hint={`${riskPct}%`}>감당 리스크</FieldLabel>
            <input type="range" min={0.5} max={5} step={0.5} value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--accent)" }} />
          </div>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>방향: 롱(매수) 기준 · 손절 1×ATR</div>
        </Card>

        <TradePlanView plan={plan} />
      </div>
    </div>
  );
}
