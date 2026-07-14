// 탭1 — 종합 신호 + 매매 계획. /api/signal/{ticker} 연결.
import React, { useEffect, useState } from "react";
import {
  API, Ds, NAME_BY_TICKER, fmtWon, fmtVolume,
  SectionEyebrow, Card, SectionLabel, FieldLabel, NumberField, Banner, LabelBadge,
} from "../ui.jsx";
import { normalizeWeights } from "../weights.js";

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

export default function OverviewTab({ ticker, weights }) {
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
        // 서버는 이 가중치로 스냅샷의 원지표를 재채점한다. KIS 는 안 부른다.
        // 합-100 으로 정규화해 보내는 이유: 응답의 contributions[].weight 를 UI 가 "%"로
        // 찍는다. raw(예: 100/20/20/15/15)를 그대로 보내면 합이 170% 인 백분율이 화면에
        // 나오고, 설정 패널이 보여 주는 정규화 % 와도 어긋난다. 비율이 같으니 점수는 동일하다.
        if (weights) qs.set("weights", JSON.stringify(normalizeWeights(weights)));
        const res = await fetch(`${API}/api/signal/${ticker}?${qs}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData(await res.json());
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message || "요청 실패");
      } finally { setLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); ctrl.abort(); };
    // weights 는 객체다 — App 이 setWeights 로만 새 객체를 만들기에 참조 비교가 안전하다.
    // 여기 인라인 리터럴을 넘기면 매 렌더 refetch 가 돈다.
  }, [ticker, account, riskPct, entry, weights]);

  const header = data?.header;
  const signal = data?.signal;
  const plan = data?.trade_plan;
  // 장 초반엔 봉이 모자라 계획을 못 만든다 — 서버가 사유를 함께 준다.
  const planBlocked = data?.trade_plan_unavailable;
  const name = NAME_BY_TICKER[ticker] || ticker;

  if (error) return <Banner tone="error">API 오류: {error} — 백엔드(8000) 확인.</Banner>;
  if (!data) return <Banner>{loading ? "신호 불러오는 중…" : "종목을 선택하세요."}</Banner>;

  const coverage = signal.coverage;
  // provisional = 신뢰도가 임계치 미만. 숫자를 아예 안 띄운다 — 흐리게 하는 게 아니다.
  // 못 믿을 값을 믿을 만한 값과 같은 크기로 보여주는 것이 위험의 본질이라서다.
  const provisional = signal.provisional;
  // 임계치는 넘었지만 아직 전 지표가 데워지진 않은 구간 → 숫자 + 신뢰도 배지.
  const lowConfidence = !provisional && coverage != null && coverage < 1;
  const pct = (v) => Math.round(v * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <SectionEyebrow index="A" title="종합 신호 — 3초 결론" />

      <Card style={{ padding: "var(--space-5) var(--space-6)" }}>
        {StockHeader && (
          <StockHeader name={name} ticker={header.ticker} price={header.price} changePct={header.change_pct} changeAmt={header.change} volume={fmtVolume(header.volume)} marketStatus={header.market_status} />
        )}
      </Card>

      {lowConfidence && (
        <Banner tone="warn">
          신뢰도 {pct(coverage)}% — 봉 {signal.bars}개. 일부 지표가 아직 집계 중입니다
          (전 지표 반영은 봉 60개). 봉이 쌓이면 자동으로 보정됩니다.
        </Banner>
      )}

      <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-8) var(--space-6)", boxShadow: "var(--shadow-sm)" }}>
        {provisional ? (
          // 게이지 숫자도 라벨도 없다. 신뢰할 수 없는 값에 결론의 크기를 주지 않는다.
          <div style={{ textAlign: "center", padding: "var(--space-6) 0" }}>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-secondary)" }}>
              집계 중…
            </div>
            <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
              봉 {signal.bars}/{signal.bars_for_signal}개 · 신뢰도 {pct(coverage ?? 0)}%
              (신호 표시 기준 {pct(signal.min_coverage)}%)
            </div>
            <div style={{ marginTop: "var(--space-3)", fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>
              지표가 충분히 쌓이기 전의 방향은 신호로 보기 어렵습니다.
            </div>
          </div>
        ) : (
          <React.Fragment>
            {DirectionGauge && <DirectionGauge score={signal.final_score} size="lg" subtitle={`${header.as_of} 갱신`} />}
            <LabelBadge label={signal.label} />
          </React.Fragment>
        )}
      </Card>

      {signal.contributions.length > 0 && (
        <Card style={{ padding: "var(--space-5) var(--space-6)" }}>
          {/* 집계 중에도 켜진 지표는 보여 준다 — 진짜 관측이고, 장 초반에 트레이더가
              실제로 보는 정보다. 다만 "근거"가 아니라 "참고"로 격을 낮춘다. */}
          <SectionLabel>
            {provisional
              ? `참고 — 현재 켜진 지표 ${signal.contributions.length}개 (아직 신호 산출 전)`
              : `근거 — 지표 기여도 (상위 ${signal.contributions.length}개)`}
          </SectionLabel>
          {ContributionBar && (
            <ContributionBar items={signal.contributions.map((c) => ({ name: c.name, score: c.contribution, weight: c.weight }))} />
          )}
        </Card>
      )}

      <SectionEyebrow index="B" title="매매 계획 — 신호를 실행으로" />

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "var(--space-4)", alignItems: "start" }}>
        <Card style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <SectionLabel>입력 (변경 시 서버 재계산)</SectionLabel>
          <div>
            <FieldLabel hint={`현재가 ${header.price.toLocaleString("ko-KR")}`}>진입가</FieldLabel>
            {/* 계획이 없으면 서버가 채워 준 진입가도 없다 → 현재가로 떨어진다. */}
            <NumberField value={entry ?? plan?.entry ?? header.price} onChange={setEntry} suffix="원" />
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

        {plan ? (
          <TradePlanView plan={plan} />
        ) : (
          // 가짜 손절가를 그리느니 왜 못 그리는지 말한다. 손절가 0원은 손절이 아니다.
          <Card>
            <SectionLabel>손절가 · 목표가 (ATR 기반)</SectionLabel>
            <Banner tone="warn">
              {planBlocked?.message
                || "ATR을 계산할 수 없어 손절·목표가를 낼 수 없습니다."}
            </Banner>
          </Card>
        )}
      </div>
    </div>
  );
}
