const { DirectionGauge, ContributionBar } = window.Ds_a0b250;

// ── shared: 설정 사이드 패널 (가중치 슬라이더 · 프리셋 · 지표 파라미터 · 알림 임계값 · 미리보기) ──
// 이전 "탭6 — 설정"의 화면 구성 그대로, 모달 대신 우측 슬라이드 패널로 배치만 변경.

const SETTINGS_FACTORS = [
  { key: "flow", label: "수급" },
  { key: "trend", label: "추세" },
  { key: "momentum", label: "모멘텀" },
  { key: "volume", label: "거래량" },
  { key: "volatility", label: "변동성" },
];

// 예시 종목의 지표별 원점수(-100~100). 미리보기용 고정 샘플.
const SETTINGS_SAMPLE_RAW = { flow: 58, trend: 34, momentum: 61, volume: 22, volatility: -28 };

const SETTINGS_PRESETS = {
  balanced: { label: "균형", weights: { flow: 20, trend: 20, momentum: 20, volume: 20, volatility: 20 } },
  flow: { label: "수급 중시", weights: { flow: 45, trend: 15, momentum: 15, volume: 15, volatility: 10 } },
  momentum: { label: "모멘텀 중시", weights: { flow: 15, trend: 15, momentum: 45, volume: 15, volatility: 10 } },
};

const SETTINGS_GOLD_STEPS = [1, 0.8, 0.6, 0.4, 0.25];

function settingsNormalizeWeights(raw) {
  const sum = SETTINGS_FACTORS.reduce((s, f) => s + raw[f.key], 0) || 1;
  const exact = SETTINGS_FACTORS.map((f) => (raw[f.key] / sum) * 100);
  const floors = exact.map(Math.floor);
  let remainder = 100 - floors.reduce((s, v) => s + v, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < remainder; k++) result[order[k].i] += 1;
  const out = {};
  SETTINGS_FACTORS.forEach((f, i) => (out[f.key] = result[i]));
  return out;
}

function SettingsCard({ children, style }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-xs)",
        padding: "var(--space-4)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SettingsSectionLabel({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "var(--tracking-wide)" }}>
        {children}
      </div>
      {right}
    </div>
  );
}

function SettingsFieldLabel({ children, hint }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-1)" }}>
      <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: "var(--weight-medium)" }}>{children}</span>
      {hint && <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>{hint}</span>}
    </div>
  );
}

function SettingsPresetRow({ activePreset, onApply }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-2)" }}>
      {Object.entries(SETTINGS_PRESETS).map(([id, p]) => {
        const active = activePreset === id;
        return (
          <button
            key={id}
            onClick={() => onApply(id)}
            style={{
              appearance: "none",
              cursor: "pointer",
              flex: 1,
              padding: "var(--space-2) var(--space-3)",
              fontSize: "var(--text-xs)",
              fontWeight: active ? "var(--weight-semibold)" : "var(--weight-regular)",
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
              background: active ? "var(--accent-bg)" : "var(--bg-inset)",
              border: active ? "1px solid var(--accent)" : "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              transition: "border-color var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)",
            }}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function SettingsStackedWeightBar({ weights }) {
  return (
    <div style={{ display: "flex", width: "100%", height: 10, borderRadius: "var(--radius-xs)", overflow: "hidden", border: "1px solid var(--border-default)" }}>
      {SETTINGS_FACTORS.map((f, i) => (
        <div
          key={f.key}
          style={{
            width: `${weights[f.key]}%`,
            background: "var(--accent)",
            opacity: SETTINGS_GOLD_STEPS[i],
            borderRight: i < SETTINGS_FACTORS.length - 1 ? "1px solid var(--bg-surface)" : "none",
          }}
          title={`${f.label} ${weights[f.key]}%`}
        />
      ))}
    </div>
  );
}

function SettingsWeightSlider({ factor, index, rawValue, normalizedPct, onChange }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: 2 }}>
        <div style={{ width: 9, height: 9, borderRadius: 2, background: "var(--accent)", opacity: SETTINGS_GOLD_STEPS[index], flexShrink: 0 }} />
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: "var(--weight-medium)", flex: 1 }}>
          {factor.label}
        </span>
        <span className="ds-numeric" style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>
          {normalizedPct}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={rawValue}
        onChange={(e) => onChange(factor.key, Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--accent)" }}
      />
    </div>
  );
}

function SettingsWeightCard({ raw, weights, activePreset, onApplyPreset, onSlider }) {
  return (
    <SettingsCard>
      <SettingsSectionLabel right={<span className="ds-numeric" style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>합계 100%</span>}>
        지표 가중치
      </SettingsSectionLabel>

      <div style={{ marginBottom: "var(--space-4)" }}>
        <SettingsPresetRow activePreset={activePreset} onApply={onApplyPreset} />
      </div>

      <div style={{ marginBottom: "var(--space-4)" }}>
        <SettingsStackedWeightBar weights={weights} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {SETTINGS_FACTORS.map((f, i) => (
          <SettingsWeightSlider
            key={f.key}
            factor={f}
            index={i}
            rawValue={raw[f.key]}
            normalizedPct={weights[f.key]}
            onChange={onSlider}
          />
        ))}
      </div>
    </SettingsCard>
  );
}

function SettingsNumberStepper({ value, onChange, min = 1, max = 200, suffix }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-1)",
        background: "var(--bg-inset)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        padding: "var(--space-1) var(--space-2)",
      }}
    >
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        style={{ appearance: "none", cursor: "pointer", border: "none", background: "none", color: "var(--text-tertiary)", fontSize: "var(--text-md)", width: 20, lineHeight: 1 }}
      >
        −
      </button>
      <input
        className="ds-numeric"
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, "");
          onChange(raw === "" ? 0 : Math.min(max, Number(raw)));
        }}
        style={{
          width: 40,
          textAlign: "center",
          background: "transparent",
          border: "none",
          outline: "none",
          fontSize: "var(--text-sm)",
          fontWeight: "var(--weight-semibold)",
          color: "var(--text-primary)",
        }}
      />
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        style={{ appearance: "none", cursor: "pointer", border: "none", background: "none", color: "var(--text-tertiary)", fontSize: "var(--text-md)", width: 20, lineHeight: 1 }}
      >
        +
      </button>
      {suffix && <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", flexShrink: 0, paddingRight: 2 }}>{suffix}</span>}
    </div>
  );
}

function SettingsParamRow({ label, hint, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-2) 0", borderBottom: "1px solid var(--border-default)" }}>
      <div>
        <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: "var(--weight-medium)" }}>{label}</div>
        {hint && <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", marginTop: 1 }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

// 아직 백엔드에 닿지 않는 컨트롤에 붙인다. 조용히 무시되는 설정은 잘못된 설정보다 나쁘다.
function SettingsNotWiredBadge() {
  return (
    <span
      title="지표를 다시 계산해야 해서(수집기) 아직 반영되지 않습니다"
      style={{
        fontSize: "var(--text-2xs)",
        fontWeight: 700,
        color: "var(--text-tertiary)",
        background: "var(--bg-inset)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        padding: "1px 6px",
      }}
    >
      미연동
    </span>
  );
}

function SettingsIndicatorParamsCard({ params, setParams }) {
  const set = (key) => (v) => setParams((p) => ({ ...p, [key]: v }));
  return (
    <SettingsCard>
      <SettingsSectionLabel right={<SettingsNotWiredBadge />}>지표 파라미터</SettingsSectionLabel>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <SettingsParamRow label="RSI 기간" hint="과매수/과매도 판정 구간">
          <SettingsNumberStepper value={params.rsiPeriod} onChange={set("rsiPeriod")} min={2} max={60} suffix="일" />
        </SettingsParamRow>
        <SettingsParamRow label="이평선 단기" hint="단기 추세 기준선">
          <SettingsNumberStepper value={params.maShort} onChange={set("maShort")} min={2} max={60} suffix="일" />
        </SettingsParamRow>
        <SettingsParamRow label="이평선 장기" hint="장기 추세 기준선">
          <SettingsNumberStepper value={params.maLong} onChange={set("maLong")} min={5} max={240} suffix="일" />
        </SettingsParamRow>
        <SettingsParamRow label="볼린저 기간" hint="변동성 밴드 폭">
          <SettingsNumberStepper value={params.bbPeriod} onChange={set("bbPeriod")} min={5} max={60} suffix="일" />
        </SettingsParamRow>
        <SettingsParamRow label="ATR 기간" hint="손절/목표가 산출 기준">
          <SettingsNumberStepper value={params.atrPeriod} onChange={set("atrPeriod")} min={2} max={60} suffix="일" />
        </SettingsParamRow>
      </div>
    </SettingsCard>
  );
}

function SettingsToggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        appearance: "none",
        cursor: "pointer",
        border: "1px solid " + (checked ? "var(--accent)" : "var(--border-strong)"),
        background: checked ? "var(--accent-bg)" : "var(--bg-inset)",
        width: 38,
        height: 22,
        borderRadius: 999,
        position: "relative",
        flexShrink: 0,
        transition: "border-color var(--duration-fast) var(--ease-standard)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: "50%",
          background: checked ? "var(--accent)" : "var(--n-8)",
          transition: "left var(--duration-fast) var(--ease-standard)",
        }}
      />
    </button>
  );
}

function SettingsAlertCard({ alert, setAlert }) {
  return (
    <SettingsCard>
      <SettingsSectionLabel right={<SettingsNotWiredBadge />}>알림 임계값</SettingsSectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: "var(--weight-medium)" }}>알림 사용</div>
            <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", marginTop: 1 }}>스코어가 임계값을 넘으면 알림</div>
          </div>
          <SettingsToggle checked={alert.enabled} onChange={(v) => setAlert((a) => ({ ...a, enabled: v }))} />
        </div>

        <div style={{ opacity: alert.enabled ? 1 : 0.4, pointerEvents: alert.enabled ? "auto" : "none" }}>
          <SettingsFieldLabel hint={`±${alert.threshold}`}>스코어 임계값</SettingsFieldLabel>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={alert.threshold}
            onChange={(e) => setAlert((a) => ({ ...a, threshold: Number(e.target.value) }))}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
            <span
              className="ds-numeric"
              style={{ fontSize: "var(--text-2xs)", color: "var(--signal-sell)" }}
            >
              −{alert.threshold} 이하 매도 알림
            </span>
            <span
              className="ds-numeric"
              style={{ fontSize: "var(--text-2xs)", color: "var(--signal-buy)" }}
            >
              +{alert.threshold} 이상 매수 알림
            </span>
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}

function SettingsPreviewCard({ weights }) {
  const contributions = SETTINGS_FACTORS.map((f) => ({
    name: f.label,
    score: Math.round((SETTINGS_SAMPLE_RAW[f.key] * weights[f.key]) / 100),
  }));
  const finalScore = Math.max(-100, Math.min(100, contributions.reduce((s, c) => s + c.score, 0)));

  return (
    <SettingsCard>
      <SettingsSectionLabel right={<span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>SK하이닉스 (예시)</span>}>
        미리보기 — 가중치 반영 시
      </SettingsSectionLabel>
      <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-2) 0 var(--space-4)" }}>
        <DirectionGauge score={finalScore} size="md" subtitle="현재 설정 기준" />
      </div>
      <div style={{ height: 1, background: "var(--border-default)", marginBottom: "var(--space-4)" }} />
      <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", fontWeight: 700, letterSpacing: "var(--tracking-wide)", marginBottom: "var(--space-2)" }}>
        지표별 기여도
      </div>
      <ContributionBar items={contributions} dense />
    </SettingsCard>
  );
}

// 우측 상단 톱니바퀴 버튼 — 탭 바에서 빠진 "설정"의 진입점.
function SettingsGearButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="설정"
      title="설정"
      style={{
        appearance: "none",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        background: "var(--bg-inset)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        flexShrink: 0,
      }}
    >
      <img
        src="https://unpkg.com/lucide-static@latest/icons/settings.svg"
        alt=""
        width="16"
        height="16"
        style={{ opacity: 0.75, filter: "invert(var(--icon-invert, 1))" }}
      />
    </button>
  );
}

// 어떤 프리셋과도 안 맞으면 null — 슬라이더를 건드린 순간 프리셋 칩이 풀린다.
function settingsMatchPreset(raw) {
  const id = Object.keys(SETTINGS_PRESETS).find((key) =>
    SETTINGS_FACTORS.every((f) => SETTINGS_PRESETS[key].weights[f.key] === raw[f.key])
  );
  return id || null;
}

// 우측 슬라이드 패널.
//
// 가중치는 controlled 다 — App 이 들고 있고 localStorage 에 쓰고 탭1이 API 로 보낸다.
// 여기 로컬 state 로 두면 패널 안에서만 살다 죽는다(이전 버전의 버그).
//
// 지표 파라미터·알림은 아직 로컬이다. 적용하려면 지표를 다시 계산해야 해서(수집기·KIS)
// 가중치처럼 요청 시점 재채점으로는 안 된다. 그때까지 "미연동"으로 표시한다 —
// 조용히 아무 일도 안 하는 컨트롤이 없는 컨트롤보다 나쁘다.
function SettingsPanel({ open, onClose, weights: raw, defaultWeights, onWeightsChange }) {
  const [params, setParams] = React.useState({ rsiPeriod: 14, maShort: 5, maLong: 20, bbPeriod: 20, atrPeriod: 14 });
  const [alert, setAlert] = React.useState({ enabled: true, threshold: 60 });

  // 슬라이더는 raw(0~100)를 잡고, 화면 % 는 합-100 정규화 값을 보여 준다.
  // 서버로도 raw 를 그대로 보낸다 — score_stock 이 합으로 나눠 정규화하므로 결과는 같고,
  // 슬라이더 하나를 움직일 때 나머지가 따라 튀지 않는다.
  const weights = settingsNormalizeWeights(raw);
  const activePreset = settingsMatchPreset(raw);

  const applyPreset = (id) => onWeightsChange({ ...SETTINGS_PRESETS[id].weights });
  const handleSlider = (key, value) => onWeightsChange({ ...raw, [key]: value });

  const reset = () => {
    onWeightsChange({ ...defaultWeights });
    setParams({ rsiPeriod: 14, maShort: 5, maLong: 20, bbPeriod: 20, atrPeriod: 14 });
    setAlert({ enabled: true, threshold: 60 });
  };

  if (!open) return null;

  return (
    <React.Fragment>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 40,
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 440,
          background: "var(--bg-base)",
          borderLeft: "1px solid var(--border-default)",
          boxShadow: "var(--shadow-md)",
          zIndex: 41,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--border-default)",
            background: "var(--bg-surface)",
            flexShrink: 0,
          }}
        >
          <div style={{ fontSize: "var(--text-md)", fontWeight: 700, color: "var(--text-primary)" }}>설정</div>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{
              appearance: "none",
              cursor: "pointer",
              background: "none",
              border: "none",
              color: "var(--text-tertiary)",
              fontSize: 20,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-4) var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <SettingsWeightCard raw={raw} weights={weights} activePreset={activePreset} onApplyPreset={applyPreset} onSlider={handleSlider} />
          <SettingsIndicatorParamsCard params={params} setParams={setParams} />
          <SettingsAlertCard alert={alert} setAlert={setAlert} />
          <SettingsPreviewCard weights={weights} />
        </div>

        {/* 저장 버튼은 없다 — 가중치는 바꾸는 즉시 탭1에 적용되고 브라우저에 저장된다. */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-3)", padding: "var(--space-4) var(--space-5)", borderTop: "1px solid var(--border-default)", flexShrink: 0 }}>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)", marginRight: "auto" }}>
            가중치는 바꾸는 즉시 적용·저장됩니다
          </div>
          <button
            onClick={reset}
            style={{
              appearance: "none",
              cursor: "pointer",
              padding: "var(--space-2) var(--space-5)",
              fontSize: "var(--text-sm)",
              fontWeight: "var(--weight-medium)",
              color: "var(--text-secondary)",
              background: "var(--bg-inset)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            기본값으로 초기화
          </button>
        </div>
      </div>
    </React.Fragment>
  );
}

window.SettingsGearButton = SettingsGearButton;
window.SettingsPanel = SettingsPanel;
