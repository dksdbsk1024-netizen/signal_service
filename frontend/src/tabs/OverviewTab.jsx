// 탭1 — 종합 신호 + 매매 계획. /api/signal/{ticker} 연결.
// 렌더는 sections/ 로 나갔다. 이 파일에 남는 것은 fetch + 로딩/에러 분기 + 섹션 조립뿐이다.
import React, { useEffect, useState } from "react";
import {
  API, Ds, NAME_BY_TICKER, fmtVolume,
  SectionEyebrow, Card, Banner,
} from "../ui.jsx";
import { normalizeWeights } from "../weights.js";
import SignalSection from "../sections/SignalSection.jsx";
import TradePlanSection from "../sections/TradePlanSection.jsx";

const { StockHeader } = Ds;

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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
      <SectionEyebrow index="A" title="종합 신호 — 3초 결론" />

      <Card style={{ padding: "var(--space-5) var(--space-6)" }}>
        {StockHeader && (
          <StockHeader name={name} ticker={header.ticker} price={header.price} changePct={header.change_pct} changeAmt={header.change} volume={fmtVolume(header.volume)} marketStatus={header.market_status} />
        )}
      </Card>

      <SignalSection signal={signal} coverage={signal.coverage} asOf={header.as_of} />

      <SectionEyebrow index="B" title="매매 계획 — 신호를 실행으로" />

      <TradePlanSection
        tradePlan={plan}
        tradePlanUnavailable={planBlocked}
        price={header.price}
        entry={entry}
        onEntryChange={setEntry}
        account={account}
        onAccountChange={setAccount}
        riskPct={riskPct}
        onRiskPctChange={setRiskPct}
      />
    </div>
  );
}
