const { CandleChart, IndicatorTable, StockHeader, TabNavigation, StockSearchBar } = window.Ds_a0b250;

const TABS = [
  { id: "overview", label: "종합 신호" },
  { id: "technical", label: "기술적 분석" },
  { id: "flow", label: "수급" },
  { id: "macro", label: "매크로/시장" },
  { id: "screener", label: "관심종목" },
];

const TIMEFRAMES = [
  { id: "1m", label: "1분" },
  { id: "5m", label: "5분" },
  { id: "1d", label: "일봉" },
];

const OSCILLATORS = [
  { id: "rsi", label: "RSI(14)" },
  { id: "macd", label: "MACD" },
  { id: "stoch", label: "스토캐스틱" },
];

const FULL_TIMEFRAMES = [
  { id: "1m", label: "1분" },
  { id: "1d", label: "일" },
  { id: "1w", label: "주" },
  { id: "1mo", label: "월" },
  { id: "1y", label: "년" },
];

const MA_PERIODS = [
  { period: 5, color: "var(--accent-strong)" },
  { period: 20, color: "var(--status-live)" },
  { period: 60, color: "var(--signal-sell)" },
  { period: 120, color: "var(--text-secondary)" },
];

const DRAW_TOOLS = [
  { id: "cursor", glyph: "↖" },
  { id: "trend", glyph: "╱" },
  { id: "hline", glyph: "—" },
  { id: "rect", glyph: "▭" },
  { id: "ellipse", glyph: "◯" },
  { id: "text", glyph: "T" },
  { id: "fib", glyph: "≡" },
  { id: "eraser", glyph: "⌫" },
];

// -- quant helpers (mock, computed from close series for a believable oscillator) --
function ema(values, period) {
  const k = 2 / (period + 1);
  const out = [];
  let prev;
  values.forEach((v, i) => {
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}

function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(50);
  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = Math.max(diff, 0);
    const loss = Math.max(-diff, 0);
    if (i <= period) {
      gainSum += gain;
      lossSum += loss;
      out[i] = 50;
    } else {
      gainSum = (gainSum * (period - 1) + gain) / period;
      lossSum = (lossSum * (period - 1) + loss) / period;
      const rs = lossSum === 0 ? 100 : gainSum / lossSum;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

function macd(closes) {
  const fast = ema(closes, 12);
  const slow = ema(closes, 26);
  const line = closes.map((_, i) => fast[i] - slow[i]);
  const signal = ema(line, 9);
  const hist = line.map((v, i) => v - signal[i]);
  return { line, signal, hist };
}

function stochastic(candles, period = 14) {
  const k = [];
  const d = [];
  for (let i = 0; i < candles.length; i++) {
    const from = Math.max(0, i - period + 1);
    const slice = candles.slice(from, i + 1);
    const hi = Math.max(...slice.map((c) => c.h));
    const lo = Math.min(...slice.map((c) => c.l));
    const kv = hi === lo ? 50 : ((candles[i].c - lo) / (hi - lo)) * 100;
    k.push(kv);
  }
  for (let i = 0; i < k.length; i++) {
    const from = Math.max(0, i - 2);
    const slice = k.slice(from, i + 1);
    d.push(slice.reduce((s, v) => s + v, 0) / slice.length);
  }
  return { k, d };
}

function bollinger(closes, period = 20, mult = 2) {
  const mid = [];
  const upper = [];
  const lower = [];
  closes.forEach((_, i) => {
    const from = Math.max(0, i - period + 1);
    const slice = closes.slice(from, i + 1);
    const mean = slice.reduce((s, v) => s + v, 0) / slice.length;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length;
    const sd = Math.sqrt(variance);
    mid.push(mean);
    upper.push(mean + sd * mult);
    lower.push(mean - sd * mult);
  });
  return { mid, upper, lower };
}

function sma(values, period) {
  return values.map((_, i) => {
    const from = Math.max(0, i - period + 1);
    const slice = values.slice(from, i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

// -- chart geometry shared with CandleChart's internal (non-mini) layout --
const VB_W = 1000;
const PLOT_LEFT = 52;
const PLOT_RIGHT = 12;

function makeXAt(n, vbW = VB_W) {
  const plotW = vbW - PLOT_LEFT - PLOT_RIGHT;
  return (i) => PLOT_LEFT + (i + 0.5) * (plotW / n);
}

function OverlayToggleChip({ active, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: "none",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-2)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-medium)",
        color: active ? "var(--accent-strong)" : "var(--text-tertiary)",
        background: active ? "var(--accent-bg)" : "var(--bg-inset)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border-default)"}`,
        borderRadius: "var(--radius-pill)",
        padding: "var(--space-1) var(--space-3)",
        whiteSpace: "nowrap",
        transition: "color var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard)",
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: active ? "var(--accent)" : "var(--border-strong)",
        }}
      />
      {label}
    </button>
  );
}

function SegmentedControl({ items, activeId, onChange }) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "var(--bg-inset)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        padding: 2,
        gap: 2,
      }}
    >
      {items.map((it) => {
        const active = it.id === activeId;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            style={{
              appearance: "none",
              cursor: "pointer",
              border: "none",
              borderRadius: "var(--radius-xs)",
              padding: "var(--space-1) var(--space-3)",
              fontSize: "var(--text-xs)",
              fontWeight: active ? "var(--weight-semibold)" : "var(--weight-regular)",
              color: active ? "var(--text-primary)" : "var(--text-tertiary)",
              background: active ? "var(--bg-surface-raised)" : "transparent",
              boxShadow: active ? "var(--shadow-xs)" : "none",
              whiteSpace: "nowrap",
              transition: "color var(--duration-fast) var(--ease-standard)",
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
      <div style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--text-tertiary)", letterSpacing: "var(--tracking-wide)" }}>
        {children}
      </div>
      {right}
    </div>
  );
}

// draws MA / Bollinger overlay lines aligned to CandleChart's internal (non-mini) coordinate space
function ChartOverlaySvg({ candles, height, showMa, showBoll, vbWidth = VB_W }) {
  const closes = candles.map((c) => c.c);
  const n = candles.length;
  const xAt = makeXAt(n, vbWidth);
  const volH = 48;
  const volGap = 8;
  const priceH = height - volH - volGap;
  const padTop = 12;

  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const maxP = Math.max(...highs);
  const minP = Math.min(...lows);
  const priceRange = maxP - minP || 1;
  const yAt = (p) => padTop + (1 - (p - minP) / priceRange) * priceH;

  const ma20 = sma(closes, 20);
  const boll = bollinger(closes, 20);

  const pathFor = (series) => series.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");

  return (
    <svg
      viewBox={`0 0 ${vbWidth} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
    >
      {showBoll && (
        <React.Fragment>
          <path d={pathFor(boll.upper)} fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
          <path d={pathFor(boll.lower)} fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
        </React.Fragment>
      )}
      {showMa && <path d={pathFor(ma20)} fill="none" stroke="var(--signal-buy-strong)" strokeWidth="1.5" opacity="0.9" />}
    </svg>
  );
}

function DrawToolRail({ activeTool, onSelect }) {
  return (
    <div
      style={{
        width: 44,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "var(--space-1)",
        padding: "var(--space-3) 0",
        borderRight: "1px solid var(--border-default)",
        background: "var(--bg-surface)",
      }}
    >
      {DRAW_TOOLS.map((tool) => {
        const active = tool.id === activeTool;
        return (
          <button
            key={tool.id}
            onClick={() => onSelect(tool.id)}
            title={tool.id}
            style={{
              appearance: "none",
              cursor: "pointer",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              borderRadius: "var(--radius-sm)",
              background: active ? "var(--accent-bg)" : "transparent",
              color: active ? "var(--accent-strong)" : "var(--text-tertiary)",
              fontSize: "var(--text-md)",
            }}
          >
            {tool.glyph}
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      <button
        title="reset"
        style={{
          appearance: "none",
          cursor: "pointer",
          width: 32,
          height: 32,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          borderRadius: "var(--radius-sm)",
          background: "transparent",
          color: "var(--text-tertiary)",
          fontSize: "var(--text-md)",
        }}
      >
        ⌂
      </button>
    </div>
  );
}

function MaLegendChip({ period, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: "none",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: "none",
        border: "none",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-medium)",
        color: active ? color : "var(--text-tertiary)",
        opacity: active ? 1 : 0.5,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 10, height: 2, background: color, display: "inline-block" }} />
      {period}
    </button>
  );
}

const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

function formatCompactNumber(v) {
  if (v >= 1000000) return (v / 1000000).toFixed(2) + "M";
  if (v >= 1000) return Math.round(v / 1000) + "K";
  return Math.round(v).toString();
}

// price + volume in a single coordinated SVG: right-side axis, current-price line,
// high/low callouts, volume subpanel with its own axis + MA line, bottom date ticks
function FullPriceVolumeChart({ candles, mas, height, vbWidth, virtualCount }) {
  const n = virtualCount || candles.length;
  const plotLeft = 8;
  const plotRight = 64;
  const plotW = vbWidth - plotLeft - plotRight;
  const xAt = (i) => plotLeft + (i + 0.5) * (plotW / n);
  const cw = (plotW / n) * 0.6;

  const axisLabelH = 22;
  const gap = 14;
  const volH = Math.max(80, Math.round(height * 0.22));
  const padTop = 10;
  const priceH = height - volH - gap - axisLabelH - padTop;

  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const maxP = Math.max(...highs);
  const minP = Math.min(...lows);
  const priceRange = maxP - minP || 1;
  const yAt = (p) => padTop + (1 - (p - minP) / priceRange) * priceH;

  const volTop = padTop + priceH + gap;
  const maxV = Math.max(...candles.map((c) => c.v));
  const vAt = (v) => volTop + volH - (v / maxV) * (volH - 4);

  const last = candles[candles.length - 1];
  const first = candles[0];
  const lastUp = last.c >= first.c;
  const lastColor = lastUp ? "var(--signal-buy)" : "var(--signal-sell)";

  const hiIdx = highs.indexOf(maxP);
  const loIdx = lows.indexOf(minP);
  const hiPct = (((maxP - first.c) / first.c) * 100).toFixed(2);
  const loPct = (((minP - first.c) / first.c) * 100).toFixed(2);

  const volMa = sma(candles.map((c) => c.v), 20);

  const tickCount = Math.min(7, n);
  const ticks = Array.from({ length: tickCount }, (_, k) => {
    const idx = Math.min(n - 1, Math.round((k + 0.5) * (n / tickCount)));
    return { idx, label: MONTH_NAMES[idx % 12] };
  });

  return (
    <svg viewBox={`0 0 ${vbWidth} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      {/* price gridlines + right-side labels */}
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const y = padTop + f * priceH;
        const price = maxP - f * priceRange;
        return (
          <g key={"pg" + i}>
            <line x1={plotLeft} y1={y} x2={vbWidth - plotRight} y2={y} stroke="var(--border-default)" strokeWidth="1" opacity="0.5" />
            <text x={vbWidth - plotRight + 8} y={y + 4} fontSize="14" textAnchor="start" fill="var(--text-tertiary)" fontFamily="var(--font-numeric)">
              {Math.round(price).toLocaleString("ko-KR")}
            </text>
          </g>
        );
      })}

      {/* MA overlay lines */}
      {mas
        .filter((m) => m.visible)
        .map((m) => {
          const series = sma(candles.map((c) => c.c), m.period);
          const path = series.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
          return <path key={m.period} d={path} fill="none" stroke={m.color} strokeWidth="1.5" opacity="0.9" />;
        })}

      {/* candles */}
      {candles.map((c, i) => {
        const isUp = c.c >= c.o;
        const color = isUp ? "var(--signal-buy)" : "var(--signal-sell)";
        const bodyTop = yAt(Math.max(c.o, c.c));
        const bodyBottom = yAt(Math.min(c.o, c.c));
        const x = xAt(i);
        return (
          <g key={i}>
            <line x1={x} y1={yAt(c.h)} x2={x} y2={yAt(c.l)} stroke={color} strokeWidth="1.5" />
            <rect x={x - cw / 2} y={bodyTop} width={cw} height={Math.max(1.5, bodyBottom - bodyTop)} fill={color} />
          </g>
        );
      })}

      {/* high / low callouts */}
      <circle cx={xAt(hiIdx)} cy={yAt(maxP)} r="2.5" fill="var(--signal-buy)" />
      <text x={Math.max(plotLeft + 70, Math.min(vbWidth - plotRight - 70, xAt(hiIdx)))} y={Math.max(padTop + 12, yAt(maxP) - 10)} fontSize="14" textAnchor="middle" fill="var(--signal-buy)" fontFamily="var(--font-numeric)" fontWeight="700">
        {Math.round(maxP).toLocaleString("ko-KR")}원 ({hiPct > 0 ? "+" : ""}{hiPct}%)
      </text>
      <circle cx={xAt(loIdx)} cy={yAt(minP)} r="2.5" fill="var(--signal-sell)" />
      <text x={Math.max(plotLeft + 70, Math.min(vbWidth - plotRight - 70, xAt(loIdx)))} y={Math.min(padTop + priceH - 4, yAt(minP) + 18)} fontSize="14" textAnchor="middle" fill="var(--signal-sell)" fontFamily="var(--font-numeric)" fontWeight="700">
        {Math.round(minP).toLocaleString("ko-KR")}원 ({loPct > 0 ? "+" : ""}{loPct}%)
      </text>

      {/* current price line + pinned tag */}
      <line x1={plotLeft} y1={yAt(last.c)} x2={vbWidth - plotRight} y2={yAt(last.c)} stroke={lastColor} strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />
      <rect x={vbWidth - plotRight} y={yAt(last.c) - 11} width={plotRight} height="22" fill={lastColor} />
      <text x={vbWidth - plotRight + 8} y={yAt(last.c) + 5} fontSize="14" fontWeight="700" fill="var(--text-on-signal)" fontFamily="var(--font-numeric)">
        {last.c.toLocaleString("ko-KR")}
      </text>

      {/* separator */}
      <line x1="0" y1={volTop - gap / 2} x2={vbWidth} y2={volTop - gap / 2} stroke="var(--border-default)" strokeWidth="1" />

      {/* volume label */}
      <text x={plotLeft} y={volTop + 12} fontSize="13" fill="var(--text-tertiary)" fontFamily="var(--font-body)">거래량 (20)</text>

      {/* volume gridlines + right-side labels */}
      {[0, 0.5, 1].map((f, i) => {
        const y = volTop + volH - f * (volH - 4);
        const v = maxV * f;
        return (
          <g key={"vg" + i}>
            <line x1={plotLeft} y1={y} x2={vbWidth - plotRight} y2={y} stroke="var(--border-default)" strokeWidth="1" opacity="0.35" />
            <text x={vbWidth - plotRight + 8} y={y + 4} fontSize="13" textAnchor="start" fill="var(--text-tertiary)" fontFamily="var(--font-numeric)">
              {formatCompactNumber(v)}
            </text>
          </g>
        );
      })}

      {/* volume bars */}
      {candles.map((c, i) => {
        const isUp = c.c >= c.o;
        const color = isUp ? "var(--signal-buy)" : "var(--signal-sell)";
        const x = xAt(i);
        const y = vAt(c.v);
        return <rect key={"v" + i} x={x - cw / 2} y={y} width={cw} height={volTop + volH - y} fill={color} opacity="0.6" />;
      })}

      {/* volume MA(20) */}
      <path d={volMa.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${vAt(v)}`).join(" ")} fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity="0.85" />

      {/* current volume tag */}
      <rect x={vbWidth - plotRight} y={volTop + volH - 11} width={plotRight} height="22" fill="var(--bg-inset)" stroke="var(--border-strong)" strokeWidth="1" />
      <text x={vbWidth - plotRight + 8} y={volTop + volH + 5} fontSize="13" fontWeight="700" fill="var(--text-primary)" fontFamily="var(--font-numeric)">
        {formatCompactNumber(last.v)}
      </text>

      {/* bottom date axis */}
      {ticks.map((t, i) => (
        <text key={i} x={xAt(t.idx)} y={height - 6} fontSize="13" textAnchor="middle" fill="var(--text-tertiary)" fontFamily="var(--font-body)">
          {t.label}
        </text>
      ))}
    </svg>
  );
}

function FullChartView({ stock, timeframe, setTimeframe, onClose }) {
  const [mas, setMas] = React.useState(
    MA_PERIODS.map((m, i) => ({ ...m, visible: i < 2 }))
  );
  const [activeTool, setActiveTool] = React.useState("cursor");
  const chartAreaRef = React.useRef(null);
  const [chartHeight, setChartHeight] = React.useState(420);
  const [chartWidth, setChartWidth] = React.useState(960);
  const [visibleCount, setVisibleCount] = React.useState(null);

  React.useEffect(() => {
    const el = chartAreaRef.current;
    if (!el) return;
    const measure = () => {
      setChartHeight(Math.max(240, Math.round(el.clientHeight)));
      setChartWidth(Math.max(320, Math.round(el.clientWidth)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const candles = stock.candlesByTimeframe[timeframe] || stock.candlesByTimeframe["1d"];
  const timeframeLabel = (FULL_TIMEFRAMES.find((t) => t.id === timeframe) || {}).label || "";

  React.useEffect(() => {
    setVisibleCount(candles.length);
  }, [timeframe, candles.length]);

  const MIN_VISIBLE = 6;
  const MAX_VISIBLE = candles.length * 3;
  const count = Math.min(MAX_VISIBLE, Math.max(MIN_VISIBLE, visibleCount || candles.length));
  const visibleCandles = count <= candles.length ? candles.slice(candles.length - count) : candles;
  const virtualCount = count;

  const handleWheelZoom = (e) => {
    e.preventDefault();
    const step = Math.max(1, Math.round(count * 0.08));
    setVisibleCount((v) => {
      const cur = v || candles.length;
      const next = e.deltaY > 0 ? cur + step : cur - step;
      return Math.min(MAX_VISIBLE, Math.max(MIN_VISIBLE, next));
    });
  };

  const toggleMa = (period) => {
    setMas((prev) => prev.map((m) => (m.period === period ? { ...m, visible: !m.visible } : m)));
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "var(--bg-base)", display: "flex", flexDirection: "column", fontFamily: "var(--font-body)" }} data-theme="dark">
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3) var(--space-4)", borderBottom: "1px solid var(--border-default)", background: "var(--bg-surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <div style={{ width: 20, height: 20, borderRadius: "var(--radius-xs)", background: "var(--bg-inset)", border: "1px solid var(--border-default)", flexShrink: 0 }} />
          <span style={{ fontSize: "var(--text-md)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" }}>
            {stock.header.name}
          </span>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>· {timeframeLabel}</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <SegmentedControl items={FULL_TIMEFRAMES} activeId={timeframe} onChange={setTimeframe} />
          <button
            style={{
              appearance: "none",
              cursor: "pointer",
              background: "none",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--weight-medium)",
              padding: "var(--space-1) var(--space-3)",
            }}
          >
            + 보조지표
          </button>
          <button
            style={{
              appearance: "none",
              cursor: "pointer",
              background: "none",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--weight-medium)",
              padding: "var(--space-1) var(--space-3)",
            }}
          >
            종목비교
          </button>
          <button
            style={{
              appearance: "none",
              cursor: "pointer",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              fontSize: "var(--text-sm)",
            }}
          >
            ⚙
          </button>
          <button
            onClick={onClose}
            style={{
              appearance: "none",
              cursor: "pointer",
              background: "none",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              fontSize: "var(--text-xs)",
              fontWeight: "var(--weight-semibold)",
              padding: "var(--space-1) var(--space-3)",
            }}
          >
            ✕ 작게보기
          </button>
        </div>
      </div>

      {/* body */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <DrawToolRail activeTool={activeTool} onSelect={setActiveTool} />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, padding: "var(--space-4)" }}>
            <div ref={chartAreaRef} onWheel={handleWheelZoom} style={{ flex: 1, minHeight: 0, position: "relative", cursor: "crosshair" }}>
              <div style={{ position: "absolute", top: 4, left: 12, zIndex: 1, display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                <span style={{ fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>이동평균선</span>
                {mas.map((m) => (
                  <MaLegendChip key={m.period} period={m.period} color={m.color} active={m.visible} onClick={() => toggleMa(m.period)} />
                ))}
              </div>
              <FullPriceVolumeChart candles={visibleCandles} mas={mas} height={chartHeight} vbWidth={chartWidth} virtualCount={virtualCount} />
            </div>
        </div>
      </div>
    </div>
  );
}

function OscillatorPanel({ candles, kind, height, vbWidth = VB_W }) {
  const closes = candles.map((c) => c.c);
  const n = candles.length;
  const xAt = makeXAt(n, vbWidth);
  const padTop = 6;
  const padBottom = 6;
  const plotH = height - padTop - padBottom;

  if (kind === "rsi") {
    const values = rsi(closes);
    const yAt = (v) => padTop + (1 - v / 100) * plotH;
    const path = values.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
    const last = values[values.length - 1];
    const lastColor = last >= 70 ? "var(--signal-sell)" : last <= 30 ? "var(--signal-buy)" : "var(--text-tertiary)";
    return (
      <svg viewBox={`0 0 ${vbWidth} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <line x1={PLOT_LEFT} y1={yAt(70)} x2={vbWidth - PLOT_RIGHT} y2={yAt(70)} stroke="var(--signal-sell)" strokeWidth="1" opacity="0.35" strokeDasharray="4 3" />
        <line x1={PLOT_LEFT} y1={yAt(30)} x2={vbWidth - PLOT_RIGHT} y2={yAt(30)} stroke="var(--signal-buy)" strokeWidth="1" opacity="0.35" strokeDasharray="4 3" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />
        <text x={PLOT_LEFT - 8} y={yAt(70) + 4} fontSize="18" textAnchor="end" fill="var(--text-tertiary)" fontFamily="var(--font-numeric)">70</text>
        <text x={PLOT_LEFT - 8} y={yAt(30) + 4} fontSize="18" textAnchor="end" fill="var(--text-tertiary)" fontFamily="var(--font-numeric)">30</text>
        <text x={vbWidth - PLOT_RIGHT} y={padTop + 14} fontSize="20" textAnchor="end" fill={lastColor} fontWeight="700" fontFamily="var(--font-numeric)">
          {last.toFixed(1)}
        </text>
      </svg>
    );
  }

  if (kind === "macd") {
    const { line, signal, hist } = macd(closes);
    const maxAbs = Math.max(...hist.map((v) => Math.abs(v)), ...line.map((v) => Math.abs(v)), ...signal.map((v) => Math.abs(v)), 1);
    const yAt = (v) => padTop + (1 - (v + maxAbs) / (maxAbs * 2)) * plotH;
    const plotW = vbWidth - PLOT_LEFT - PLOT_RIGHT;
    const barW = (plotW / n) * 0.5;
    const linePath = line.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
    const signalPath = signal.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
    return (
      <svg viewBox={`0 0 ${vbWidth} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <line x1={PLOT_LEFT} y1={yAt(0)} x2={vbWidth - PLOT_RIGHT} y2={yAt(0)} stroke="var(--border-default)" strokeWidth="1" />
        {hist.map((v, i) => (
          <rect
            key={i}
            x={xAt(i) - barW / 2}
            y={v >= 0 ? yAt(v) : yAt(0)}
            width={barW}
            height={Math.max(1, Math.abs(yAt(v) - yAt(0)))}
            fill={v >= 0 ? "var(--signal-buy)" : "var(--signal-sell)"}
            opacity="0.6"
          />
        ))}
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="2" />
        <path d={signalPath} fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="4 3" />
      </svg>
    );
  }

  // stochastic
  const { k, d } = stochastic(candles);
  const yAt = (v) => padTop + (1 - v / 100) * plotH;
  const kPath = k.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
  const dPath = d.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${vbWidth} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <line x1={PLOT_LEFT} y1={yAt(80)} x2={vbWidth - PLOT_RIGHT} y2={yAt(80)} stroke="var(--signal-sell)" strokeWidth="1" opacity="0.35" strokeDasharray="4 3" />
      <line x1={PLOT_LEFT} y1={yAt(20)} x2={vbWidth - PLOT_RIGHT} y2={yAt(20)} stroke="var(--signal-buy)" strokeWidth="1" opacity="0.35" strokeDasharray="4 3" />
      <path d={kPath} fill="none" stroke="var(--accent)" strokeWidth="2" />
      <path d={dPath} fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeDasharray="4 3" />
      <text x={PLOT_LEFT - 8} y={yAt(80) + 4} fontSize="18" textAnchor="end" fill="var(--text-tertiary)" fontFamily="var(--font-numeric)">80</text>
      <text x={PLOT_LEFT - 8} y={yAt(20) + 4} fontSize="18" textAnchor="end" fill="var(--text-tertiary)" fontFamily="var(--font-numeric)">20</text>
    </svg>
  );
}

function computeIndicatorRows(candles) {
  const closes = candles.map((c) => c.c);
  const lastClose = closes[closes.length - 1];
  const r = rsi(closes);
  const lastRsi = r[r.length - 1];
  const { line, signal } = macd(closes);
  const macdDiff = line[line.length - 1] - signal[signal.length - 1];
  const { k, d } = stochastic(candles);
  const lastK = k[k.length - 1];
  const lastD = d[d.length - 1];
  const ma20 = sma(closes, 20);
  const lastMa20 = ma20[ma20.length - 1];
  const boll = bollinger(closes, 20);
  const lastUpper = boll.upper[boll.upper.length - 1];
  const lastLower = boll.lower[boll.lower.length - 1];

  return [
    { name: "RSI(14)", value: lastRsi.toFixed(1), signal: lastRsi >= 70 ? "sell" : lastRsi <= 30 ? "buy" : "neutral" },
    { name: "MACD", value: macdDiff >= 0 ? `+${macdDiff.toFixed(0)}` : macdDiff.toFixed(0), signal: macdDiff > 0 ? "buy" : macdDiff < 0 ? "sell" : "neutral" },
    { name: "스토캐스틱 %K", value: lastK.toFixed(1), signal: lastK >= 80 ? "sell" : lastK <= 20 ? "buy" : "neutral" },
    { name: "스토캐스틱 %D", value: lastD.toFixed(1), signal: lastD >= 80 ? "sell" : lastD <= 20 ? "buy" : "neutral" },
    { name: "이동평균(20)", value: lastMa20.toLocaleString("ko-KR"), signal: lastClose >= lastMa20 ? "buy" : "sell" },
    { name: "볼린저 상단", value: Math.round(lastUpper).toLocaleString("ko-KR"), signal: lastClose >= lastUpper ? "sell" : "neutral" },
    { name: "볼린저 하단", value: Math.round(lastLower).toLocaleString("ko-KR"), signal: lastClose <= lastLower ? "buy" : "neutral" },
  ];
}

function Tab2Technical({ stock, onSelectStock, suggestions, activeTab: activeTabProp, onTabChange }) {
  const [internalTab, setInternalTab] = React.useState("technical");
  const activeTab = activeTabProp ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [showSettings, setShowSettings] = React.useState(false);
  const [timeframe, setTimeframe] = React.useState("1m");
  const [showMa, setShowMa] = React.useState(true);
  const [showVwap, setShowVwap] = React.useState(true);
  const [showBoll, setShowBoll] = React.useState(false);
  const [showVolume, setShowVolume] = React.useState(true);
  const [oscKind, setOscKind] = React.useState("rsi");
  const [oscOpen, setOscOpen] = React.useState(true);
  const [fullChartOpen, setFullChartOpen] = React.useState(false);
  const [fullTimeframe, setFullTimeframe] = React.useState("1d");

  const candles = stock.candlesByTimeframe[timeframe];
  const chartHeight = 420;
  const oscHeight = 140;
  const rows = computeIndicatorRows(candles);

  return (
    <div style={{ minHeight: "100%", background: "var(--bg-base)", fontFamily: "var(--font-body)" }} data-theme="dark">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3) var(--space-6)", borderBottom: "1px solid var(--border-default)", background: "var(--bg-surface)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
          <div style={{ fontSize: "var(--text-md)", fontWeight: 900, color: "var(--text-primary)", letterSpacing: "var(--tracking-tight)" }}>단기매매 신호</div>
          <StockSearchBar suggestions={suggestions} onSelect={onSelectStock} />
        </div>
        <window.SettingsGearButton onClick={() => setShowSettings(true)} />
      </div>
      <TabNavigation tabs={TABS} activeId={activeTab} onChange={setActiveTab} />
      <window.SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />

      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "var(--space-4) var(--space-6) var(--space-12)", display: "grid", gridTemplateColumns: "1fr 320px", gap: "var(--space-4)", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-xs)", padding: "var(--space-3) var(--space-5)" }}>
            <StockHeader {...stock.header} />
          </div>

          {/* controls: timeframe + overlay toggles */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)" }}>
            <SegmentedControl items={TIMEFRAMES} activeId={timeframe} onChange={setTimeframe} />
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <OverlayToggleChip active={showMa} label="이동평균선" onClick={() => setShowMa((v) => !v)} />
              <OverlayToggleChip active={showVwap} label="VWAP" onClick={() => setShowVwap((v) => !v)} />
              <OverlayToggleChip active={showBoll} label="볼린저밴드" onClick={() => setShowBoll((v) => !v)} />
              <OverlayToggleChip active={showVolume} label="거래량" onClick={() => setShowVolume((v) => !v)} />
              <button
                onClick={() => setFullChartOpen(true)}
                style={{
                  appearance: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  fontSize: "var(--text-xs)",
                  fontWeight: "var(--weight-semibold)",
                  color: "var(--text-primary)",
                  background: "var(--bg-inset)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "var(--radius-pill)",
                  padding: "var(--space-1) var(--space-3)",
                  whiteSpace: "nowrap",
                }}
              >
                ⤢ 차트 크게 보기
              </button>
            </div>
          </div>

          {/* main chart, dense: chart card + oscillator stacked */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-3) var(--space-4)" }}>
            <div style={{ position: "relative" }}>
              <CandleChart candles={candles} showVolume={showVolume} showVwap={showVwap} height={chartHeight} />
              <ChartOverlaySvg candles={candles} height={chartHeight} showMa={showMa} showBoll={showBoll} />
            </div>

            <div style={{ height: 1, background: "var(--border-default)", margin: "var(--space-3) 0" }} />

            <SectionLabel
              right={
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                  <SegmentedControl items={OSCILLATORS} activeId={oscKind} onChange={setOscKind} />
                  <button
                    onClick={() => setOscOpen((v) => !v)}
                    style={{
                      appearance: "none",
                      cursor: "pointer",
                      background: "none",
                      border: "1px solid var(--border-default)",
                      borderRadius: "var(--radius-xs)",
                      color: "var(--text-tertiary)",
                      fontSize: "var(--text-2xs)",
                      fontWeight: 700,
                      padding: "var(--space-1) var(--space-2)",
                    }}
                  >
                    {oscOpen ? "접기" : "펼치기"}
                  </button>
                </div>
              }
            >
              오실레이터
            </SectionLabel>
            {oscOpen && <OscillatorPanel candles={candles} kind={oscKind} height={oscHeight} />}
          </div>
        </div>

        {/* right rail — dense indicator table */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", position: "sticky", top: "var(--space-4)" }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", padding: "var(--space-4)" }}>
            <SectionLabel>지표 현재값 · 신호</SectionLabel>
            <IndicatorTable rows={rows} dense />
          </div>
        </div>
      </div>

      {fullChartOpen && (
        <FullChartView
          stock={stock}
          timeframe={fullTimeframe}
          setTimeframe={setFullTimeframe}
          onClose={() => setFullChartOpen(false)}
        />
      )}
    </div>
  );
}

window.Tab2Technical = Tab2Technical;
