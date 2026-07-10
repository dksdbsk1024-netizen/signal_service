import React, { useMemo, useState } from "react";
import { Ds, WATCHLIST, NAME_BY_TICKER, TABS, Banner } from "./ui.jsx";
import OverviewTab from "./tabs/OverviewTab.jsx";
import TechnicalTab from "./tabs/TechnicalTab.jsx";
import FlowTab from "./tabs/FlowTab.jsx";
import ScreenerTab from "./tabs/ScreenerTab.jsx";
import MacroTab from "./tabs/MacroTab.jsx";

const { TabNavigation, StockSearchBar } = Ds;
// SettingsPanel / SettingsGearButton 은 _ds_bundle.js 가 window 전역에 붙인다.
const SettingsPanel = window.SettingsPanel;
const SettingsGearButton = window.SettingsGearButton;

function ComingSoon({ label }) {
  return <Banner>{label} 탭은 다음 단계에서 연결됩니다. (API는 준비됨)</Banner>;
}

// 안전망 — 특정 하위 컴포넌트(예: 디자인 번들 컴포넌트)가 렌더 중 던져도 앱 전체가
// 백지화되지 않도록 격리한다.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }); }
  render() {
    if (this.state.err) return <Banner tone="error">{this.props.label || "컴포넌트"} 렌더 오류: {String(this.state.err.message || this.state.err)}</Banner>;
    return this.props.children;
  }
}

export default function App() {
  // 탭 공통 상태: 종목은 검색바에서 바꾸면 모든 탭이 같은 종목을 본다.
  const [ticker, setTicker] = useState("005930");
  const [activeTab, setActiveTab] = useState("screener");
  const [showSettings, setShowSettings] = useState(false);

  const suggestions = useMemo(() => WATCHLIST, []);
  const name = NAME_BY_TICKER[ticker] || ticker;

  const renderTab = () => {
    switch (activeTab) {
      case "overview": return <OverviewTab ticker={ticker} />;
      case "technical": return <TechnicalTab ticker={ticker} />;
      case "flow": return <FlowTab ticker={ticker} />;
      case "macro": return <MacroTab />;
      case "screener": return <ScreenerTab onPick={(t) => { setTicker(t); setActiveTab("overview"); }} />;
      default: return <OverviewTab ticker={ticker} />;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", fontFamily: "var(--font-body)", color: "var(--text-body)" }} data-theme="dark">
      {/* 상단 고정 바: 로고 + 검색바 + 설정 톱니 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3) var(--space-6)", borderBottom: "1px solid var(--border-default)", background: "var(--bg-surface)", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
          <div style={{ fontSize: "var(--text-md)", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "var(--tracking-tight)" }}>단기매매 신호</div>
          {StockSearchBar && <StockSearchBar suggestions={suggestions} onSelect={(s) => setTicker(s.ticker)} placeholder="종목 코드/명 검색" />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <span className="ds-numeric" style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>{ticker} · {name}</span>
          {SettingsGearButton && <SettingsGearButton onClick={() => setShowSettings(true)} />}
        </div>
      </div>

      {/* 탭 네비게이션 (5탭, 공유) */}
      {TabNavigation && <TabNavigation tabs={TABS} activeId={activeTab} onChange={setActiveTab} />}

      {/* 설정 패널 (우측 슬라이드) */}
      {SettingsPanel && (
        <ErrorBoundary label="설정 패널">
          <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
        </ErrorBoundary>
      )}

      {/* 탭 콘텐츠 */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "var(--space-8) var(--space-6) var(--space-16)" }}>
        <ErrorBoundary label={activeTab} resetKey={activeTab + ticker}>
          {renderTab()}
        </ErrorBoundary>
      </div>
    </div>
  );
}
