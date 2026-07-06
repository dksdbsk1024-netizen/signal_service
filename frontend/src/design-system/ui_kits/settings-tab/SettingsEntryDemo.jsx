const { TabNavigation, StockSearchBar } = window.Ds_a0b250;

// 탭 바에서 빠진 "설정"의 진입점 데모: 우측 상단 톱니바퀴 아이콘 → 우측 슬라이드 패널.
// 탭 구성(5개)은 실제 매매 동선 순서(종합 신호 → 기술적 분석 → 수급 → 매크로/시장 → 관심종목)와 동일.

const TABS = [
  { id: "overview", label: "종합 신호" },
  { id: "technical", label: "기술적 분석" },
  { id: "flow", label: "수급" },
  { id: "macro", label: "매크로/시장" },
  { id: "screener", label: "관심종목" },
];

function SettingsEntryDemo({ suggestions }) {
  const [activeTab, setActiveTab] = React.useState("overview");
  const [showSettings, setShowSettings] = React.useState(true);

  return (
    <div style={{ minHeight: "100%", background: "var(--bg-base)", fontFamily: "var(--font-body)" }} data-theme="dark">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3) var(--space-6)", borderBottom: "1px solid var(--border-default)", background: "var(--bg-surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
          <div style={{ fontSize: "var(--text-md)", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "var(--tracking-tight)" }}>단기매매 신호</div>
          <StockSearchBar suggestions={suggestions} />
        </div>
        <window.SettingsGearButton onClick={() => setShowSettings(true)} />
      </div>
      <TabNavigation tabs={TABS} activeId={activeTab} onChange={setActiveTab} />
      <window.SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "var(--space-10) var(--space-6)" }}>
        <div
          style={{
            border: "1px dashed var(--border-default)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-10)",
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: "var(--text-sm)",
          }}
        >
          탭 콘텐츠 자리 — 우측 상단 톱니바퀴를 눌러 설정 패널을 열고 닫아 보세요.
          <br />
          가중치 슬라이더 · 프리셋 · 지표 파라미터 · 알림 임계값은 기존 "탭6 — 설정" 내용 그대로입니다.
        </div>
      </div>
    </div>
  );
}

window.SettingsEntryDemo = SettingsEntryDemo;
