// A안(풀페이지 탭 전환) 연결 프로토타입 — 5개 탭 화면을 하나의 앱 셸로 묶어
// 실제 탭바 클릭으로 화면이 전환되고, 종목 검색이 탭1~4에 걸쳐 공유되는 클릭스루.

function AppShell() {
  const [activeTab, setActiveTab] = React.useState("overview");
  const [ticker, setTicker] = React.useState("005930");
  const stock = window.APP_SHELL_STOCKS[ticker];
  const suggestions = window.APP_SHELL_SUGGESTIONS;

  const sharedProps = {
    stock,
    suggestions,
    onSelectStock: (s) => setTicker(s.ticker),
    activeTab,
    onTabChange: setActiveTab,
  };

  switch (activeTab) {
    case "technical":
      return <window.Tab2Technical {...sharedProps} />;
    case "flow":
      return <window.Tab3Flow {...sharedProps} />;
    case "macro":
      return <window.Tab6Macro macro={window.APP_SHELL_MACRO} suggestions={suggestions} onSelectStock={sharedProps.onSelectStock} activeTab={activeTab} onTabChange={setActiveTab} />;
    case "screener":
      return (
        <window.Tab5Screener
          market={window.APP_SHELL_MARKET}
          watchlist={window.APP_SHELL_WATCHLIST}
          rows={window.APP_SHELL_ROWS}
          stockDetails={window.APP_SHELL_STOCK_DETAILS}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      );
    case "overview":
    default:
      return <window.Tab1Overview {...sharedProps} />;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(<AppShell />);
