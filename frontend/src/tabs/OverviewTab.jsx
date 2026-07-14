// 종합신호 — 전폭 3열 대시보드. 기술적분석·수급 탭을 흡수했다.
// 신호·매매계획(/api/signal) | 차트·지표(/api/technical) | 호가·수급(/api/flow).
//
// 세 엔드포인트를 각각 폴링한다(하나로 합치지 않는다): 갱신 주기가 같아도 실패는 따로다.
// 수급 API 가 죽어도 신호 열은 살아 있어야 한다 — 로딩/에러를 열마다 따로 처리하는 이유.
import React, { useEffect, useState } from "react";
import { API, NAME_BY_TICKER, Banner } from "../ui.jsx";
import { normalizeWeights } from "../weights.js";
import useAutoRefresh from "../hooks/useAutoRefresh.js";
import DashboardHeader from "../sections/DashboardHeader.jsx";
import SignalSection from "../sections/SignalSection.jsx";
import TradePlanSection from "../sections/TradePlanSection.jsx";
import ChartSection from "../sections/ChartSection.jsx";
import IndicatorSection from "../sections/IndicatorSection.jsx";
import OrderBookSection from "../sections/OrderBookSection.jsx";
import InvestorFlowSection from "../sections/InvestorFlowSection.jsx";

// 열 하나의 상태 게이트. data 가 있으면 error 가 있어도 그린다 —
// 갱신 실패로 화면을 비우면 방금까지 보던 값이 사라진다. 실패는 헤더가 알린다.
function ColumnGate({ state, loadingText, children }) {
  if (state.data) return children;
  if (state.error) return <Banner tone="error">API 오류: {state.error} — 백엔드(8000) 확인.</Banner>;
  return <Banner>{loadingText}</Banner>;
}

export default function OverviewTab({ ticker, weights }) {
  const [account, setAccount] = useState(10_000_000);
  const [riskPct, setRiskPct] = useState(1);
  const [entry, setEntry] = useState(null);   // null → 서버가 현재가로 채움
  const [interval, setIntervalId] = useState("1m");  // API 파라미터라 부모가 든다

  // ticker 변경 시 진입가 오버라이드 해제 (새 종목 현재가 사용).
  useEffect(() => { setEntry(null); }, [ticker]);

  const sig = useAutoRefresh(
    async (signal) => {
      const qs = new URLSearchParams({ account: String(account), risk_pct: String(riskPct) });
      if (entry != null) qs.set("entry", String(entry));
      // 서버는 이 가중치로 스냅샷의 원지표를 재채점한다. KIS 는 안 부른다.
      // 합-100 으로 정규화해 보내는 이유: 응답의 contributions[].weight 를 UI 가 "%"로
      // 찍는다. raw(예: 100/20/20/15/15)를 그대로 보내면 합이 170% 인 백분율이 화면에 나온다.
      if (weights) qs.set("weights", JSON.stringify(normalizeWeights(weights)));
      const res = await fetch(`${API}/api/signal/${ticker}?${qs}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    [ticker, account, riskPct, entry, weights],
    { debounceMs: 300 },   // 슬라이더를 끌 때마다 쏘지 않는다
  );

  // /api/technical·/api/flow 는 스냅샷이 아니라 매 요청 KIS 를 실시간으로 부른다.
  // 장이 닫힌 밤·주말에 60초 폴링을 계속하면, 수집기 게이트(market_hours.should_collect)로
  // 막아 둔 장외 KIS 호출을 열어둔 대시보드가 그대로 도로 연다 — 시세는 변하지도 않는데.
  // /api/signal 은 스냅샷 읽기(KIS 0회)라 계속 폴링한다. 장이 열리면 이 응답의
  // market_status 가 바뀌면서 아래 두 폴링을 다시 켜 준다 — 새로고침이 필요 없다.
  const marketStatus = sig.data?.header?.market_status;
  const marketLive = marketStatus === "open" || marketStatus === "after";

  const tech = useAutoRefresh(
    async (signal) => {
      const res = await fetch(`${API}/api/technical/${ticker}?interval=${interval}&bars=120`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    [ticker, interval],
    { enabled: marketLive },
  );

  const flow = useAutoRefresh(
    async (signal) => {
      const res = await fetch(`${API}/api/flow/${ticker}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    [ticker],
    { enabled: marketLive },
  );

  const name = NAME_BY_TICKER[ticker] || ticker;
  const sigData = sig.data;
  const techData = tech.data;
  const flowData = flow.data;

  return (
    <React.Fragment>
      <DashboardHeader
        ticker={ticker}
        name={name}
        header={sigData?.header}
        asOf={sigData?.as_of}
        fetchedAt={sig.fetchedAt}
        isRefreshing={sig.isRefreshing || tech.isRefreshing || flow.isRefreshing}
        error={sig.error || tech.error || flow.error}
        onRefresh={() => { sig.refresh(); tech.refresh(); flow.refresh(); }}
      />

      <div className="dash-grid">
        {/* 1열 — 신호 + 매매계획 */}
        <div className="dash-col">
          <ColumnGate state={sig} loadingText="신호 불러오는 중…">
            {sigData && (
              <React.Fragment>
                <SignalSection
                  signal={sigData.signal}
                  coverage={sigData.signal.coverage}
                  asOf={sigData.header.as_of}
                />
                <TradePlanSection
                  tradePlan={sigData.trade_plan}
                  tradePlanUnavailable={sigData.trade_plan_unavailable}
                  price={sigData.header.price}
                  entry={entry}
                  onEntryChange={setEntry}
                  account={account}
                  onAccountChange={setAccount}
                  riskPct={riskPct}
                  onRiskPctChange={setRiskPct}
                />
              </React.Fragment>
            )}
          </ColumnGate>
        </div>

        {/* 2열 — 차트 + 지표 */}
        <div className="dash-col">
          <ColumnGate state={tech} loadingText="차트 불러오는 중…">
            {techData && (
              <React.Fragment>
                <ChartSection
                  candles={techData.candles}
                  overlays={techData.overlays}
                  interval={interval}
                  onIntervalChange={setIntervalId}
                  mock={techData.mock}
                  stale={techData.stale}
                  source={techData.source}
                />
                <IndicatorSection table={techData.indicators_table} interval={interval} />
              </React.Fragment>
            )}
          </ColumnGate>
        </div>

        {/* 3열 — 호가 + 수급 */}
        <div className="dash-col dash-col-right">
          <ColumnGate state={flow} loadingText="수급 불러오는 중…">
            {flowData && (
              <React.Fragment>
                <OrderBookSection
                  orderbook={flowData.orderbook}
                  tradeStrength={flowData.trade_strength}
                  price={flowData.header.price}
                  changePct={flowData.header.change_pct}
                />
                <InvestorFlowSection series={flowData.series} brokers={flowData.brokers} />
              </React.Fragment>
            )}
          </ColumnGate>
        </div>
      </div>
    </React.Fragment>
  );
}
