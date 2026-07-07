/* @ds-bundle: {"format":4,"namespace":"Ds_a0b250","components":[{"name":"CandleChart","sourcePath":"components/core/CandleChart.jsx"},{"name":"ContributionBar","sourcePath":"components/core/ContributionBar.jsx"},{"name":"DirectionGauge","sourcePath":"components/core/DirectionGauge.jsx"},{"name":"IndicatorTable","sourcePath":"components/core/IndicatorTable.jsx"},{"name":"StockHeader","sourcePath":"components/core/StockHeader.jsx"},{"name":"StockSearchBar","sourcePath":"components/forms/StockSearchBar.jsx"},{"name":"TabNavigation","sourcePath":"components/navigation/TabNavigation.jsx"}],"sourceHashes":{"components/core/CandleChart.jsx":"7d4941b565e9","components/core/ContributionBar.jsx":"efcff2fbbcba","components/core/DirectionGauge.jsx":"f9e7ea70c499","components/core/IndicatorTable.jsx":"a3a451484782","components/core/StockHeader.jsx":"db5e25b06b29","components/forms/StockSearchBar.jsx":"d7fd6ea86a2f","components/navigation/TabNavigation.jsx":"b5624ebfd98d","ui_kits/_shared/SettingsPanel.jsx":"59637dc08343","ui_kits/app-shell/AppShell.jsx":"645c1251a427","ui_kits/app-shell/data.js":"9499ac052f94","ui_kits/flow-tab/Tab3Flow.jsx":"728707fd0db4","ui_kits/macro-tab/Tab6Macro.jsx":"7f5ffe7e025d","ui_kits/overview-tab/Tab1Overview.jsx":"144803515d42","ui_kits/screener-tab/Tab5Screener.jsx":"5137cad4ab44","ui_kits/settings-tab/SettingsEntryDemo.jsx":"ffdd8f7df5f2","ui_kits/technical-tab/Tab2Technical.jsx":"0860d04861fe"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.Ds_a0b250 = window.Ds_a0b250 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/CandleChart.jsx
try { (() => {
const DEFAULT_CANDLES = [{
  t: "09:00",
  o: 70100,
  h: 70400,
  l: 69950,
  c: 70350,
  v: 82000
}, {
  t: "09:10",
  o: 70350,
  h: 70600,
  l: 70300,
  c: 70500,
  v: 65000
}, {
  t: "09:20",
  o: 70500,
  h: 70550,
  l: 70100,
  c: 70200,
  v: 71000
}, {
  t: "09:30",
  o: 70200,
  h: 70750,
  l: 70180,
  c: 70700,
  v: 98000
}, {
  t: "09:40",
  o: 70700,
  h: 70900,
  l: 70600,
  c: 70850,
  v: 88000
}, {
  t: "09:50",
  o: 70850,
  h: 71100,
  l: 70800,
  c: 71050,
  v: 120000
}, {
  t: "10:00",
  o: 71050,
  h: 71300,
  l: 70950,
  c: 71300,
  v: 134000
}, {
  t: "10:10",
  o: 71300,
  h: 71350,
  l: 71050,
  c: 71150,
  v: 76000
}, {
  t: "10:20",
  o: 71150,
  h: 71400,
  l: 71100,
  c: 71300,
  v: 91000
}, {
  t: "10:30",
  o: 71300,
  h: 71450,
  l: 71200,
  c: 71300,
  v: 68000
}];

/**
 * @param {CandleChartProps} props
 */
function CandleChart({
  candles = DEFAULT_CANDLES,
  showVolume = true,
  showVwap = true,
  mini = false,
  height = 260,
  vbWidth
}) {
  const width = "100%";
  const padding = mini ? {
    top: 8,
    right: 4,
    bottom: 4,
    left: 4
  } : {
    top: 12,
    right: 12,
    bottom: 8,
    left: 44
  };
  const volH = showVolume && !mini ? 48 : showVolume && mini ? 24 : 0;
  const volGap = showVolume ? 8 : 0;
  const priceH = height - volH - volGap;
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);
  const maxP = Math.max(...highs);
  const minP = Math.min(...lows);
  const priceRange = maxP - minP || 1;
  const maxV = Math.max(...candles.map(c => c.v));
  const n = candles.length;

  // viewBox-based layout. vbWidth lets a caller pass the true measured pixel
  // width of the rendered container so x/y units are 1:1 — this keeps candle
  // proportions and font sizes from stretching non-uniformly when the SVG's
  // rendered width differs from its viewBox width. Defaults to 1000 (legacy behavior).
  const vbW = vbWidth || 1000;
  const vbH = height;
  const plotLeft = mini ? 8 : 52;
  const plotRight = mini ? 8 : 12;
  const plotW = vbW - plotLeft - plotRight;
  const xAt = i => plotLeft + (i + 0.5) * (plotW / n);
  const cw = plotW / n * (mini ? 0.5 : 0.62);
  const yAt = p => padding.top + (1 - (p - minP) / priceRange) * priceH;
  const vBarH = v => v / maxV * (volH - 4);
  const vwapValues = showVwap ? candles.map((_, i) => {
    const slice = candles.slice(0, i + 1);
    const sum = slice.reduce((s, c) => s + (c.h + c.l + c.c) / 3, 0);
    return sum / slice.length;
  }) : [];
  const vwapPath = vwapValues.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      background: "var(--bg-surface)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${vbW} ${height}`,
    width: "100%",
    height: height,
    preserveAspectRatio: "none"
  }, !mini && [0, 0.25, 0.5, 0.75, 1].map((f, i) => {
    const y = padding.top + f * priceH;
    const price = maxP - f * priceRange;
    return /*#__PURE__*/React.createElement("g", {
      key: i
    }, /*#__PURE__*/React.createElement("line", {
      x1: plotLeft,
      y1: y,
      x2: vbW - plotRight,
      y2: y,
      stroke: "var(--border-default)",
      strokeWidth: "1",
      opacity: "0.5"
    }), /*#__PURE__*/React.createElement("text", {
      x: plotLeft - 4,
      y: y + 3,
      fontSize: "12",
      textAnchor: "end",
      fill: "var(--text-tertiary)",
      fontFamily: "var(--font-numeric)"
    }, Math.round(price).toLocaleString("ko-KR")));
  }), candles.map((c, i) => {
    const isUp = c.c >= c.o;
    const color = isUp ? "var(--signal-buy)" : "var(--signal-sell)";
    const bodyTop = yAt(Math.max(c.o, c.c));
    const bodyBottom = yAt(Math.min(c.o, c.c));
    const x = xAt(i);
    return /*#__PURE__*/React.createElement("g", {
      key: i
    }, /*#__PURE__*/React.createElement("line", {
      x1: x,
      y1: yAt(c.h),
      x2: x,
      y2: yAt(c.l),
      stroke: color,
      strokeWidth: mini ? 1.5 : 2
    }), /*#__PURE__*/React.createElement("rect", {
      x: x - cw / 2,
      y: bodyTop,
      width: cw,
      height: Math.max(1.5, bodyBottom - bodyTop),
      fill: color
    }));
  }), showVwap && /*#__PURE__*/React.createElement("path", {
    d: vwapPath,
    fill: "none",
    stroke: "var(--accent)",
    strokeWidth: mini ? 1.5 : 2,
    opacity: "0.9"
  }), showVolume && candles.map((c, i) => {
    const isUp = c.c >= c.o;
    const color = isUp ? "var(--signal-buy)" : "var(--signal-sell)";
    const x = xAt(i);
    const h = vBarH(c.v);
    return /*#__PURE__*/React.createElement("rect", {
      key: i,
      x: x - cw / 2,
      y: height - volH + (volH - 4 - h),
      width: cw,
      height: h,
      fill: color,
      opacity: "0.55"
    });
  })), !mini && showVwap && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-3)",
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      padding: "0 var(--space-2) var(--space-1)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 2,
      background: "var(--accent)",
      display: "inline-block"
    }
  }), " VWAP")));
}
Object.assign(__ds_scope, { CandleChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/CandleChart.jsx", error: String((e && e.message) || e) }); }

// components/core/ContributionBar.jsx
try { (() => {
function barColor(score) {
  if (score > 2) return "var(--signal-buy)";
  if (score < -2) return "var(--signal-sell)";
  return "var(--signal-neutral)";
}

/**
 * @param {ContributionBarProps} props
 */
function ContributionBar({
  items = [],
  maxAbs,
  dense = false
}) {
  const scale = maxAbs || Math.max(10, ...items.map(it => Math.abs(it.score)));
  const rowGap = dense ? "var(--space-1)" : "var(--space-2)";
  const rowHeight = dense ? 20 : 26;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: rowGap,
      width: "100%"
    }
  }, items.map((it, i) => {
    const pct = Math.min(100, Math.abs(it.score) / scale * 100);
    const isPositive = it.score >= 0;
    const color = barColor(it.score);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 72,
        flexShrink: 0,
        fontSize: "var(--text-xs)",
        color: "var(--text-secondary)",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      },
      title: it.name
    }, it.name), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        height: rowHeight,
        background: "var(--bg-inset)",
        borderRadius: "var(--radius-xs)",
        position: "relative",
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        left: "50%",
        top: 0,
        bottom: 0,
        width: 1,
        background: "var(--border-strong)"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: 2,
        bottom: 2,
        left: isPositive ? "50%" : `calc(50% - ${pct / 2}%)`,
        width: `${pct / 2}%`,
        background: color,
        borderRadius: "var(--radius-xs)"
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "ds-numeric",
      style: {
        width: 44,
        flexShrink: 0,
        textAlign: "right",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--weight-semibold)",
        color
      }
    }, it.score > 0 ? "+" : "", it.score), typeof it.weight === "number" && /*#__PURE__*/React.createElement("div", {
      style: {
        width: 34,
        flexShrink: 0,
        textAlign: "right",
        fontSize: "var(--text-2xs)",
        color: "var(--text-tertiary)"
      }
    }, it.weight, "%"));
  }));
}
Object.assign(__ds_scope, { ContributionBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/ContributionBar.jsx", error: String((e && e.message) || e) }); }

// components/core/DirectionGauge.jsx
try { (() => {
/**
 * Maps a -100..100 score to the 5-zone label used across the product.
 */
function zoneFor(score) {
  if (score >= 60) return {
    key: "strongBuy",
    label: "적극매수",
    color: "var(--signal-buy-strong)"
  };
  if (score >= 20) return {
    key: "buy",
    label: "매수",
    color: "var(--signal-buy)"
  };
  if (score > -20) return {
    key: "neutral",
    label: "중립",
    color: "var(--signal-neutral)"
  };
  if (score > -60) return {
    key: "sell",
    label: "매도",
    color: "var(--signal-sell)"
  };
  return {
    key: "strongSell",
    label: "적극매도",
    color: "var(--signal-sell-strong)"
  };
}

// angle(score): -100 -> 180deg (left/baseline), 0 -> 90deg (top), 100 -> 0deg (right/baseline)
function angleForScore(score) {
  const clamped = Math.max(-100, Math.min(100, score));
  return 180 - (clamped + 100) / 200 * 180;
}
function polar(cx, cy, r, angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad)
  };
}
function arcPath(cx, cy, r, angleStart, angleEnd) {
  const p1 = polar(cx, cy, r, angleStart);
  const p2 = polar(cx, cy, r, angleEnd);
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;
}
const ZONE_BOUNDARIES = [180, 144, 108, 72, 36, 0];
const ZONE_COLORS = ["var(--signal-sell-strong)", "var(--signal-sell)", "var(--signal-neutral)", "var(--signal-buy)", "var(--signal-buy-strong)"];
const SIZES = {
  lg: {
    w: 320,
    h: 190,
    r: 130,
    stroke: 22,
    needle: 108,
    scoreFont: "var(--text-4xl)",
    labelFont: "var(--text-lg)"
  },
  md: {
    w: 220,
    h: 132,
    r: 90,
    stroke: 16,
    needle: 74,
    scoreFont: "var(--text-2xl)",
    labelFont: "var(--text-sm)"
  },
  sm: {
    w: 160,
    h: 96,
    r: 64,
    stroke: 11,
    needle: 52,
    scoreFont: "var(--text-lg)",
    labelFont: "var(--text-2xs)"
  }
};

/**
 * @param {DirectionGaugeProps} props
 */
function DirectionGauge({
  score = 0,
  size = "lg",
  showScoreLabel = true,
  subtitle
}) {
  const cfg = SIZES[size] || SIZES.lg;
  const cx = cfg.w / 2;
  const cy = cfg.h - 6;
  const zone = zoneFor(score);
  const needleAngle = angleForScore(score);
  const tip = polar(cx, cy, cfg.needle, needleAngle);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      width: cfg.w
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: cfg.w,
    height: cfg.h,
    viewBox: `0 0 ${cfg.w} ${cfg.h}`
  }, ZONE_BOUNDARIES.slice(0, -1).map((start, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: arcPath(cx, cy, cfg.r, start, ZONE_BOUNDARIES[i + 1]),
    fill: "none",
    stroke: ZONE_COLORS[i],
    strokeWidth: cfg.stroke,
    strokeLinecap: "butt",
    opacity: "0.9"
  })), /*#__PURE__*/React.createElement("line", {
    x1: cx,
    y1: cy,
    x2: tip.x,
    y2: tip.y,
    stroke: "var(--text-primary)",
    strokeWidth: Math.max(2, cfg.stroke / 7),
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: Math.max(4, cfg.stroke / 4),
    fill: "var(--text-primary)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: cfg.scoreFont,
      fontWeight: "var(--weight-bold)",
      color: zone.color,
      marginTop: "var(--space-2)",
      lineHeight: 1
    }
  }, score > 0 ? "+" : "", score), showScoreLabel && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: cfg.labelFont,
      fontWeight: "var(--weight-semibold)",
      color: zone.color,
      marginTop: "var(--space-1)"
    }
  }, zone.label), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-tertiary)",
      marginTop: "var(--space-1)"
    }
  }, subtitle));
}
Object.assign(__ds_scope, { DirectionGauge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/DirectionGauge.jsx", error: String((e && e.message) || e) }); }

// components/core/IndicatorTable.jsx
try { (() => {
const SIGNAL_META = {
  buy: {
    label: "매수",
    color: "var(--signal-buy)",
    bg: "var(--signal-buy-bg)"
  },
  sell: {
    label: "매도",
    color: "var(--signal-sell)",
    bg: "var(--signal-sell-bg)"
  },
  neutral: {
    label: "중립",
    color: "var(--signal-neutral)",
    bg: "var(--signal-neutral-bg)"
  }
};

/**
 * @param {IndicatorTableProps} props
 */
function IndicatorTable({
  rows = [],
  dense = false
}) {
  const rowPad = dense ? "6px 10px" : "10px 12px";
  return /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "var(--text-sm)"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, ["지표", "값", "신호"].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      textAlign: i === 2 ? "right" : i === 1 ? "right" : "left",
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      fontWeight: "var(--weight-medium)",
      padding: rowPad,
      borderBottom: "1px solid var(--border-default)"
    }
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, i) => {
    const meta = SIGNAL_META[r.signal] || SIGNAL_META.neutral;
    return /*#__PURE__*/React.createElement("tr", {
      key: i
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: rowPad,
        color: "var(--text-body)",
        borderBottom: "1px solid var(--border-default)"
      }
    }, r.name), /*#__PURE__*/React.createElement("td", {
      className: "ds-numeric",
      style: {
        padding: rowPad,
        textAlign: "right",
        color: "var(--text-body)",
        borderBottom: "1px solid var(--border-default)"
      }
    }, r.value), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: rowPad,
        textAlign: "right",
        borderBottom: "1px solid var(--border-default)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-block",
        fontSize: "var(--text-2xs)",
        fontWeight: "var(--weight-semibold)",
        color: meta.color,
        background: meta.bg,
        borderRadius: "var(--radius-xs)",
        padding: "2px 8px"
      }
    }, meta.label)));
  })));
}
Object.assign(__ds_scope, { IndicatorTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IndicatorTable.jsx", error: String((e && e.message) || e) }); }

// components/core/StockHeader.jsx
try { (() => {
const MARKET_STATUS = {
  open: {
    label: "장중",
    color: "var(--status-live)"
  },
  closed: {
    label: "장마감",
    color: "var(--status-closed)"
  },
  after: {
    label: "시간외",
    color: "var(--status-after)"
  }
};
function formatNumber(n) {
  return n.toLocaleString("ko-KR");
}

/**
 * @param {StockHeaderProps} props
 */
function StockHeader({
  name,
  ticker,
  price,
  changePct,
  changeAmt,
  volume,
  marketCap,
  marketStatus = "open"
}) {
  const isUp = changePct > 0;
  const isFlat = changePct === 0;
  const color = isFlat ? "var(--signal-neutral)" : isUp ? "var(--signal-buy)" : "var(--signal-sell)";
  const bg = isFlat ? "var(--signal-neutral-bg)" : isUp ? "var(--signal-buy-bg)" : "var(--signal-sell-bg)";
  const status = MARKET_STATUS[marketStatus] || MARKET_STATUS.open;
  const sign = changePct > 0 ? "+" : "";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      width: "100%",
      gap: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-lg)",
      fontWeight: "var(--weight-semibold)",
      color: "var(--text-primary)"
    }
  }, name), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--text-tertiary)"
    }
  }, ticker), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontSize: "var(--text-2xs)",
      fontWeight: "var(--weight-semibold)",
      color: status.color,
      background: "var(--bg-inset)",
      borderRadius: "var(--radius-pill)",
      padding: "2px 8px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: status.color,
      display: "inline-block"
    }
  }), status.label)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: "var(--space-3)",
      marginTop: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-3xl)",
      fontWeight: "var(--weight-bold)",
      color
    }
  }, formatNumber(price)), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: "var(--weight-semibold)",
      color,
      background: bg,
      borderRadius: "var(--radius-sm)",
      padding: "3px 8px"
    }
  }, sign, changeAmt !== undefined ? `${formatNumber(changeAmt)} ` : "", sign, Math.abs(changePct).toFixed(2), "%"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-6)",
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, "\uAC70\uB798\uB7C9"), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--text-body)",
      marginTop: 2
    }
  }, volume)), marketCap && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, "\uC2DC\uAC00\uCD1D\uC561"), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--text-body)",
      marginTop: 2
    }
  }, marketCap))));
}
Object.assign(__ds_scope, { StockHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StockHeader.jsx", error: String((e && e.message) || e) }); }

// components/forms/StockSearchBar.jsx
try { (() => {
const {
  useState
} = React;
/**
 * @param {StockSearchBarProps} props
 */
function StockSearchBar({
  placeholder = "종목명 또는 코드 검색",
  suggestions = [],
  onSelect
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const filtered = value ? suggestions.filter(s => s.name.includes(value) || s.ticker.includes(value)).slice(0, 6) : suggestions.slice(0, 6);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 320
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-2)",
      background: "var(--bg-inset)",
      border: `1px solid ${focused ? "var(--accent)" : "var(--border-default)"}`,
      borderRadius: "var(--radius-md)",
      padding: "0 var(--space-3)",
      height: 36,
      transition: "border-color var(--duration-base) var(--ease-standard)"
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "https://unpkg.com/lucide-static@latest/icons/search.svg",
    alt: "",
    width: "15",
    height: "15",
    style: {
      opacity: 0.55,
      filter: "invert(var(--icon-invert, 1))"
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: value,
    onChange: e => setValue(e.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => setTimeout(() => setFocused(false), 120),
    placeholder: placeholder,
    style: {
      flex: 1,
      background: "none",
      border: "none",
      outline: "none",
      color: "var(--text-primary)",
      fontSize: "var(--text-sm)",
      fontFamily: "var(--font-body)"
    }
  })), focused && filtered.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 42,
      left: 0,
      right: 0,
      background: "var(--bg-surface-raised)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-md)",
      overflow: "hidden",
      zIndex: 20
    }
  }, filtered.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.ticker,
    onMouseDown: () => onSelect && onSelect(s),
    style: {
      display: "flex",
      justifyContent: "space-between",
      padding: "var(--space-2) var(--space-3)",
      cursor: "pointer",
      fontSize: "var(--text-sm)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-primary)"
    }
  }, s.name), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      color: "var(--text-tertiary)"
    }
  }, s.ticker)))));
}
Object.assign(__ds_scope, { StockSearchBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/StockSearchBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TabNavigation.jsx
try { (() => {
/**
 * @param {TabNavigationProps} props
 */
function TabNavigation({
  tabs = [],
  activeId,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-1)",
      borderBottom: "1px solid var(--border-default)",
      background: "var(--bg-surface)",
      padding: "0 var(--space-4)"
    }
  }, tabs.map(tab => {
    const active = tab.id === activeId;
    return /*#__PURE__*/React.createElement("button", {
      key: tab.id,
      onClick: () => onChange && onChange(tab.id),
      style: {
        appearance: "none",
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: "var(--space-3) var(--space-3)",
        fontSize: "var(--text-sm)",
        fontWeight: active ? "var(--weight-semibold)" : "var(--weight-regular)",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
        marginBottom: -1,
        transition: "color var(--duration-base) var(--ease-standard)"
      }
    }, tab.label);
  }));
}
Object.assign(__ds_scope, { TabNavigation });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TabNavigation.jsx", error: String((e && e.message) || e) }); }

// ui_kits/_shared/SettingsPanel.jsx
try { (() => {
const {
  DirectionGauge,
  ContributionBar
} = window.Ds_a0b250;

// ── shared: 설정 사이드 패널 (가중치 슬라이더 · 프리셋 · 지표 파라미터 · 알림 임계값 · 미리보기) ──
// 이전 "탭6 — 설정"의 화면 구성 그대로, 모달 대신 우측 슬라이드 패널로 배치만 변경.

const SETTINGS_FACTORS = [{
  key: "flow",
  label: "수급"
}, {
  key: "trend",
  label: "추세"
}, {
  key: "momentum",
  label: "모멘텀"
}, {
  key: "volume",
  label: "거래량"
}, {
  key: "volatility",
  label: "변동성"
}];

// 예시 종목의 지표별 원점수(-100~100). 미리보기용 고정 샘플.
const SETTINGS_SAMPLE_RAW = {
  flow: 58,
  trend: 34,
  momentum: 61,
  volume: 22,
  volatility: -28
};
const SETTINGS_PRESETS = {
  balanced: {
    label: "균형",
    weights: {
      flow: 20,
      trend: 20,
      momentum: 20,
      volume: 20,
      volatility: 20
    }
  },
  flow: {
    label: "수급 중시",
    weights: {
      flow: 45,
      trend: 15,
      momentum: 15,
      volume: 15,
      volatility: 10
    }
  },
  momentum: {
    label: "모멘텀 중시",
    weights: {
      flow: 15,
      trend: 15,
      momentum: 45,
      volume: 15,
      volatility: 10
    }
  }
};
const SETTINGS_GOLD_STEPS = [1, 0.8, 0.6, 0.4, 0.25];
function settingsNormalizeWeights(raw) {
  const sum = SETTINGS_FACTORS.reduce((s, f) => s + raw[f.key], 0) || 1;
  const exact = SETTINGS_FACTORS.map(f => raw[f.key] / sum * 100);
  const floors = exact.map(Math.floor);
  let remainder = 100 - floors.reduce((s, v) => s + v, 0);
  const order = exact.map((v, i) => ({
    i,
    frac: v - Math.floor(v)
  })).sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < remainder; k++) result[order[k].i] += 1;
  const out = {};
  SETTINGS_FACTORS.forEach((f, i) => out[f.key] = result[i]);
  return out;
}
function SettingsCard({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-xs)",
      padding: "var(--space-4)",
      ...style
    }
  }, children);
}
function SettingsSectionLabel({
  children,
  right
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 700,
      color: "var(--text-tertiary)",
      letterSpacing: "var(--tracking-wide)"
    }
  }, children), right);
}
function SettingsFieldLabel({
  children,
  hint
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: "var(--space-1)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)",
      fontWeight: "var(--weight-medium)"
    }
  }, children), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, hint));
}
function SettingsPresetRow({
  activePreset,
  onApply
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-2)"
    }
  }, Object.entries(SETTINGS_PRESETS).map(([id, p]) => {
    const active = activePreset === id;
    return /*#__PURE__*/React.createElement("button", {
      key: id,
      onClick: () => onApply(id),
      style: {
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
        transition: "border-color var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard)"
      }
    }, p.label);
  }));
}
function SettingsStackedWeightBar({
  weights
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      width: "100%",
      height: 10,
      borderRadius: "var(--radius-xs)",
      overflow: "hidden",
      border: "1px solid var(--border-default)"
    }
  }, SETTINGS_FACTORS.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: f.key,
    style: {
      width: `${weights[f.key]}%`,
      background: "var(--accent)",
      opacity: SETTINGS_GOLD_STEPS[i],
      borderRight: i < SETTINGS_FACTORS.length - 1 ? "1px solid var(--bg-surface)" : "none"
    },
    title: `${f.label} ${weights[f.key]}%`
  })));
}
function SettingsWeightSlider({
  factor,
  index,
  rawValue,
  normalizedPct,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-2)",
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 2,
      background: "var(--accent)",
      opacity: SETTINGS_GOLD_STEPS[index],
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)",
      fontWeight: "var(--weight-medium)",
      flex: 1
    }
  }, factor.label), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 700,
      color: "var(--text-primary)"
    }
  }, normalizedPct, "%")), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 0,
    max: 100,
    step: 1,
    value: rawValue,
    onChange: e => onChange(factor.key, Number(e.target.value)),
    style: {
      width: "100%",
      accentColor: "var(--accent)"
    }
  }));
}
function SettingsWeightCard({
  raw,
  weights,
  activePreset,
  onApplyPreset,
  onSlider
}) {
  return /*#__PURE__*/React.createElement(SettingsCard, null, /*#__PURE__*/React.createElement(SettingsSectionLabel, {
    right: /*#__PURE__*/React.createElement("span", {
      className: "ds-numeric",
      style: {
        fontSize: "var(--text-2xs)",
        color: "var(--text-tertiary)"
      }
    }, "\uD569\uACC4 100%")
  }, "\uC9C0\uD45C \uAC00\uC911\uCE58"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(SettingsPresetRow, {
    activePreset: activePreset,
    onApply: onApplyPreset
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(SettingsStackedWeightBar, {
    weights: weights
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)"
    }
  }, SETTINGS_FACTORS.map((f, i) => /*#__PURE__*/React.createElement(SettingsWeightSlider, {
    key: f.key,
    factor: f,
    index: i,
    rawValue: raw[f.key],
    normalizedPct: weights[f.key],
    onChange: onSlider
  }))));
}
function SettingsNumberStepper({
  value,
  onChange,
  min = 1,
  max = 200,
  suffix
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-1)",
      background: "var(--bg-inset)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      padding: "var(--space-1) var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onChange(Math.max(min, value - 1)),
    style: {
      appearance: "none",
      cursor: "pointer",
      border: "none",
      background: "none",
      color: "var(--text-tertiary)",
      fontSize: "var(--text-md)",
      width: 20,
      lineHeight: 1
    }
  }, "\u2212"), /*#__PURE__*/React.createElement("input", {
    className: "ds-numeric",
    type: "text",
    inputMode: "numeric",
    value: value,
    onChange: e => {
      const raw = e.target.value.replace(/[^0-9]/g, "");
      onChange(raw === "" ? 0 : Math.min(max, Number(raw)));
    },
    style: {
      width: 40,
      textAlign: "center",
      background: "transparent",
      border: "none",
      outline: "none",
      fontSize: "var(--text-sm)",
      fontWeight: "var(--weight-semibold)",
      color: "var(--text-primary)"
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => onChange(Math.min(max, value + 1)),
    style: {
      appearance: "none",
      cursor: "pointer",
      border: "none",
      background: "none",
      color: "var(--text-tertiary)",
      fontSize: "var(--text-md)",
      width: 20,
      lineHeight: 1
    }
  }, "+"), suffix && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      flexShrink: 0,
      paddingRight: 2
    }
  }, suffix));
}
function SettingsParamRow({
  label,
  hint,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "var(--space-2) 0",
      borderBottom: "1px solid var(--border-default)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)",
      fontWeight: "var(--weight-medium)"
    }
  }, label), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      marginTop: 1
    }
  }, hint)), children);
}
function SettingsIndicatorParamsCard({
  params,
  setParams
}) {
  const set = key => v => setParams(p => ({
    ...p,
    [key]: v
  }));
  return /*#__PURE__*/React.createElement(SettingsCard, null, /*#__PURE__*/React.createElement(SettingsSectionLabel, null, "\uC9C0\uD45C \uD30C\uB77C\uBBF8\uD130"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement(SettingsParamRow, {
    label: "RSI \uAE30\uAC04",
    hint: "\uACFC\uB9E4\uC218/\uACFC\uB9E4\uB3C4 \uD310\uC815 \uAD6C\uAC04"
  }, /*#__PURE__*/React.createElement(SettingsNumberStepper, {
    value: params.rsiPeriod,
    onChange: set("rsiPeriod"),
    min: 2,
    max: 60,
    suffix: "\uC77C"
  })), /*#__PURE__*/React.createElement(SettingsParamRow, {
    label: "\uC774\uD3C9\uC120 \uB2E8\uAE30",
    hint: "\uB2E8\uAE30 \uCD94\uC138 \uAE30\uC900\uC120"
  }, /*#__PURE__*/React.createElement(SettingsNumberStepper, {
    value: params.maShort,
    onChange: set("maShort"),
    min: 2,
    max: 60,
    suffix: "\uC77C"
  })), /*#__PURE__*/React.createElement(SettingsParamRow, {
    label: "\uC774\uD3C9\uC120 \uC7A5\uAE30",
    hint: "\uC7A5\uAE30 \uCD94\uC138 \uAE30\uC900\uC120"
  }, /*#__PURE__*/React.createElement(SettingsNumberStepper, {
    value: params.maLong,
    onChange: set("maLong"),
    min: 5,
    max: 240,
    suffix: "\uC77C"
  })), /*#__PURE__*/React.createElement(SettingsParamRow, {
    label: "\uBCFC\uB9B0\uC800 \uAE30\uAC04",
    hint: "\uBCC0\uB3D9\uC131 \uBC34\uB4DC \uD3ED"
  }, /*#__PURE__*/React.createElement(SettingsNumberStepper, {
    value: params.bbPeriod,
    onChange: set("bbPeriod"),
    min: 5,
    max: 60,
    suffix: "\uC77C"
  })), /*#__PURE__*/React.createElement(SettingsParamRow, {
    label: "ATR \uAE30\uAC04",
    hint: "\uC190\uC808/\uBAA9\uD45C\uAC00 \uC0B0\uCD9C \uAE30\uC900"
  }, /*#__PURE__*/React.createElement(SettingsNumberStepper, {
    value: params.atrPeriod,
    onChange: set("atrPeriod"),
    min: 2,
    max: 60,
    suffix: "\uC77C"
  }))));
}
function SettingsToggle({
  checked,
  onChange
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => onChange(!checked),
    style: {
      appearance: "none",
      cursor: "pointer",
      border: "1px solid " + (checked ? "var(--accent)" : "var(--border-strong)"),
      background: checked ? "var(--accent-bg)" : "var(--bg-inset)",
      width: 38,
      height: 22,
      borderRadius: 999,
      position: "relative",
      flexShrink: 0,
      transition: "border-color var(--duration-fast) var(--ease-standard)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 2,
      left: checked ? 18 : 2,
      width: 16,
      height: 16,
      borderRadius: "50%",
      background: checked ? "var(--accent)" : "var(--n-8)",
      transition: "left var(--duration-fast) var(--ease-standard)"
    }
  }));
}
function SettingsAlertCard({
  alert,
  setAlert
}) {
  return /*#__PURE__*/React.createElement(SettingsCard, null, /*#__PURE__*/React.createElement(SettingsSectionLabel, null, "\uC54C\uB9BC \uC784\uACC4\uAC12"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)",
      fontWeight: "var(--weight-medium)"
    }
  }, "\uC54C\uB9BC \uC0AC\uC6A9"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      marginTop: 1
    }
  }, "\uC2A4\uCF54\uC5B4\uAC00 \uC784\uACC4\uAC12\uC744 \uB118\uC73C\uBA74 \uC54C\uB9BC")), /*#__PURE__*/React.createElement(SettingsToggle, {
    checked: alert.enabled,
    onChange: v => setAlert(a => ({
      ...a,
      enabled: v
    }))
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      opacity: alert.enabled ? 1 : 0.4,
      pointerEvents: alert.enabled ? "auto" : "none"
    }
  }, /*#__PURE__*/React.createElement(SettingsFieldLabel, {
    hint: `±${alert.threshold}`
  }, "\uC2A4\uCF54\uC5B4 \uC784\uACC4\uAC12"), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: 10,
    max: 100,
    step: 5,
    value: alert.threshold,
    onChange: e => setAlert(a => ({
      ...a,
      threshold: Number(e.target.value)
    })),
    style: {
      width: "100%",
      accentColor: "var(--accent)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--signal-sell)"
    }
  }, "\u2212", alert.threshold, " \uC774\uD558 \uB9E4\uB3C4 \uC54C\uB9BC"), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--signal-buy)"
    }
  }, "+", alert.threshold, " \uC774\uC0C1 \uB9E4\uC218 \uC54C\uB9BC")))));
}
function SettingsPreviewCard({
  weights
}) {
  const contributions = SETTINGS_FACTORS.map(f => ({
    name: f.label,
    score: Math.round(SETTINGS_SAMPLE_RAW[f.key] * weights[f.key] / 100)
  }));
  const finalScore = Math.max(-100, Math.min(100, contributions.reduce((s, c) => s + c.score, 0)));
  return /*#__PURE__*/React.createElement(SettingsCard, null, /*#__PURE__*/React.createElement(SettingsSectionLabel, {
    right: /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--text-2xs)",
        color: "var(--text-tertiary)"
      }
    }, "SK\uD558\uC774\uB2C9\uC2A4 (\uC608\uC2DC)")
  }, "\uBBF8\uB9AC\uBCF4\uAE30 \u2014 \uAC00\uC911\uCE58 \uBC18\uC601 \uC2DC"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      padding: "var(--space-2) 0 var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(DirectionGauge, {
    score: finalScore,
    size: "md",
    subtitle: "\uD604\uC7AC \uC124\uC815 \uAE30\uC900"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--border-default)",
      marginBottom: "var(--space-4)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      fontWeight: 700,
      letterSpacing: "var(--tracking-wide)",
      marginBottom: "var(--space-2)"
    }
  }, "\uC9C0\uD45C\uBCC4 \uAE30\uC5EC\uB3C4"), /*#__PURE__*/React.createElement(ContributionBar, {
    items: contributions,
    dense: true
  }));
}

// 우측 상단 톱니바퀴 버튼 — 탭 바에서 빠진 "설정"의 진입점.
function SettingsGearButton({
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    "aria-label": "\uC124\uC815",
    title: "\uC124\uC815",
    style: {
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
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "https://unpkg.com/lucide-static@latest/icons/settings.svg",
    alt: "",
    width: "16",
    height: "16",
    style: {
      opacity: 0.75,
      filter: "invert(var(--icon-invert, 1))"
    }
  }));
}

// 우측 슬라이드 패널 — 가중치/프리셋/지표 파라미터/알림, 이전 "탭6 — 설정"과 동일한 내용.
function SettingsPanel({
  open,
  onClose
}) {
  const [activePreset, setActivePreset] = React.useState("balanced");
  const [raw, setRaw] = React.useState({
    ...SETTINGS_PRESETS.balanced.weights
  });
  const [params, setParams] = React.useState({
    rsiPeriod: 14,
    maShort: 5,
    maLong: 20,
    bbPeriod: 20,
    atrPeriod: 14
  });
  const [alert, setAlert] = React.useState({
    enabled: true,
    threshold: 60
  });
  const [savedAt, setSavedAt] = React.useState(null);
  const weights = settingsNormalizeWeights(raw);
  const applyPreset = id => {
    setActivePreset(id);
    setRaw({
      ...SETTINGS_PRESETS[id].weights
    });
  };
  const handleSlider = (key, value) => {
    setActivePreset(null);
    setRaw(r => ({
      ...r,
      [key]: value
    }));
  };
  const reset = () => {
    setActivePreset("balanced");
    setRaw({
      ...SETTINGS_PRESETS.balanced.weights
    });
    setParams({
      rsiPeriod: 14,
      maShort: 5,
      maLong: 20,
      bbPeriod: 20,
      atrPeriod: 14
    });
    setAlert({
      enabled: true,
      threshold: 60
    });
    setSavedAt(null);
  };
  if (!open) return null;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.5)",
      zIndex: 40
    }
  }), /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
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
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "var(--space-4) var(--space-5)",
      borderBottom: "1px solid var(--border-default)",
      background: "var(--bg-surface)",
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 700,
      color: "var(--text-primary)"
    }
  }, "\uC124\uC815"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "\uB2EB\uAE30",
    style: {
      appearance: "none",
      cursor: "pointer",
      background: "none",
      border: "none",
      color: "var(--text-tertiary)",
      fontSize: 20,
      lineHeight: 1,
      padding: 4
    }
  }, "\xD7")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "var(--space-4) var(--space-5)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(SettingsWeightCard, {
    raw: raw,
    weights: weights,
    activePreset: activePreset,
    onApplyPreset: applyPreset,
    onSlider: handleSlider
  }), /*#__PURE__*/React.createElement(SettingsIndicatorParamsCard, {
    params: params,
    setParams: setParams
  }), /*#__PURE__*/React.createElement(SettingsAlertCard, {
    alert: alert,
    setAlert: setAlert
  }), /*#__PURE__*/React.createElement(SettingsPreviewCard, {
    weights: weights
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: "var(--space-3)",
      padding: "var(--space-4) var(--space-5)",
      borderTop: "1px solid var(--border-default)",
      flexShrink: 0
    }
  }, savedAt && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      marginRight: "auto"
    }
  }, savedAt.toLocaleTimeString("ko-KR", {
    hour12: false
  }), " \uC800\uC7A5\uB428"), /*#__PURE__*/React.createElement("button", {
    onClick: reset,
    style: {
      appearance: "none",
      cursor: "pointer",
      padding: "var(--space-2) var(--space-5)",
      fontSize: "var(--text-sm)",
      fontWeight: "var(--weight-medium)",
      color: "var(--text-secondary)",
      background: "var(--bg-inset)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)"
    }
  }, "\uCD08\uAE30\uD654"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSavedAt(new Date()),
    style: {
      appearance: "none",
      cursor: "pointer",
      padding: "var(--space-2) var(--space-5)",
      fontSize: "var(--text-sm)",
      fontWeight: "var(--weight-semibold)",
      color: "var(--text-on-signal)",
      background: "var(--accent)",
      border: "1px solid var(--accent)",
      borderRadius: "var(--radius-sm)"
    }
  }, "\uC800\uC7A5"))));
}
window.SettingsGearButton = SettingsGearButton;
window.SettingsPanel = SettingsPanel;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/_shared/SettingsPanel.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app-shell/AppShell.jsx
try { (() => {
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
    onSelectStock: s => setTicker(s.ticker),
    activeTab,
    onTabChange: setActiveTab
  };
  switch (activeTab) {
    case "technical":
      return /*#__PURE__*/React.createElement(window.Tab2Technical, sharedProps);
    case "flow":
      return /*#__PURE__*/React.createElement(window.Tab3Flow, sharedProps);
    case "macro":
      return /*#__PURE__*/React.createElement(window.Tab6Macro, {
        macro: window.APP_SHELL_MACRO,
        suggestions: suggestions,
        onSelectStock: sharedProps.onSelectStock,
        activeTab: activeTab,
        onTabChange: setActiveTab
      });
    case "screener":
      return /*#__PURE__*/React.createElement(window.Tab5Screener, {
        market: window.APP_SHELL_MARKET,
        watchlist: window.APP_SHELL_WATCHLIST,
        rows: window.APP_SHELL_ROWS,
        stockDetails: window.APP_SHELL_STOCK_DETAILS,
        activeTab: activeTab,
        onTabChange: setActiveTab
      });
    case "overview":
    default:
      return /*#__PURE__*/React.createElement(window.Tab1Overview, sharedProps);
  }
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(AppShell, null));
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app-shell/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app-shell/data.js
try { (() => {
// Shared mock data for the connected A안 app-shell prototype.
// Merges the per-tab datasets (tab1~4 share ticker-keyed stock records; tab5/screener has its own shape).

function genCandlesSimple(base) {
  const out = [];
  let price = base;
  for (let i = 0; i < 14; i++) {
    const o = price;
    const drift = (Math.sin(i * 1.3) + (i % 3 === 0 ? 0.6 : -0.2)) * base * 0.0025;
    const c = Math.round(o + drift);
    const h = Math.round(Math.max(o, c) + base * 0.0015);
    const l = Math.round(Math.min(o, c) - base * 0.0015);
    const v = Math.round(50000 + Math.random() * 90000);
    const hh = String(9 + Math.floor(i / 6)).padStart(2, "0");
    const mm = String(i % 6 * 10).padStart(2, "0");
    out.push({
      t: `${hh}:${mm}`,
      o,
      h,
      l,
      c,
      v
    });
    price = c;
  }
  return out;
}
function genCandlesTF(base, count, volAmp) {
  const out = [];
  let price = base;
  for (let i = 0; i < count; i++) {
    const o = price;
    const drift = (Math.sin(i * 0.9) + (i % 5 === 0 ? 0.7 : -0.15)) * base * 0.0018;
    const noise = (Math.random() - 0.5) * base * 0.001;
    const c = Math.round(o + drift + noise);
    const h = Math.round(Math.max(o, c) + base * 0.0012);
    const l = Math.round(Math.min(o, c) - base * 0.0012);
    const v = Math.round(volAmp * (0.5 + Math.random()));
    out.push({
      t: String(i),
      o,
      h,
      l,
      c,
      v
    });
    price = c;
  }
  return out;
}
function genNetBuy(days, foreignAmp, instAmp) {
  const dates = [];
  const foreign = [];
  const institution = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(2026, 5, 1 + i);
    dates.push(`${d.getMonth() + 1}/${d.getDate()}`);
    const fBias = Math.sin(i * 0.6) * 0.6 + (i % 6 === 0 ? 0.8 : 0);
    const iBias = Math.cos(i * 0.5) * 0.5 - (i % 7 === 0 ? 0.6 : 0);
    foreign.push(Math.round((fBias + (Math.random() - 0.5) * 0.6) * foreignAmp));
    institution.push(Math.round((iBias + (Math.random() - 0.5) * 0.6) * instAmp));
  }
  return {
    dates,
    foreign,
    institution
  };
}
function genProgram(points, amp) {
  const net = [];
  for (let i = 0; i < points; i++) {
    net.push(Math.round((Math.sin(i * 0.4) * 0.5 + (Math.random() - 0.5)) * amp));
  }
  return {
    net
  };
}
function genOrderBook(base, tick, qtyAmp) {
  const asks = [];
  const bids = [];
  for (let i = 1; i <= 10; i++) {
    asks.push({
      price: base + tick * i,
      qty: Math.round(qtyAmp * (0.3 + Math.random()) * (1 - i * 0.04))
    });
    bids.push({
      price: base - tick * i,
      qty: Math.round(qtyAmp * (0.3 + Math.random()) * (1 - i * 0.04))
    });
  }
  return {
    asks,
    bids
  };
}
function genBrokers(names, buyAmp) {
  return names.map(name => {
    const buy = Math.round(buyAmp * (0.3 + Math.random()));
    const sell = Math.round(buyAmp * (0.3 + Math.random()));
    return {
      name,
      buy,
      sell,
      net: buy - sell
    };
  });
}
const BROKER_NAMES = ["미래에셋", "키움증권", "NH투자", "삼성증권", "한국투자", "메릴린치", "모건스탠리", "골드만삭스"];
window.APP_SHELL_STOCKS = {
  "005930": {
    header: {
      name: "삼성전자",
      ticker: "005930",
      price: 71300,
      changePct: 1.8,
      changeAmt: 1250,
      volume: "12.4M",
      marketCap: "425.7조",
      marketStatus: "open"
    },
    score: 62,
    updatedAt: "09:32",
    contributions: [{
      name: "수급",
      score: 18,
      weight: 30
    }, {
      name: "모멘텀",
      score: 11,
      weight: 25
    }, {
      name: "추세",
      score: 6,
      weight: 20
    }, {
      name: "변동성",
      score: -9,
      weight: 15
    }, {
      name: "거래량",
      score: -3,
      weight: 10
    }],
    candles: genCandlesSimple(71000),
    history: [{
      time: "09:00",
      signal: "중립"
    }, {
      time: "09:40",
      signal: "매수"
    }, {
      time: "10:20",
      signal: "적극매수"
    }],
    reason: {
      timestamp: "17분 전",
      headline: "수급 기여도 +18로 상승 전환",
      body: "외국인 순매수가 전일 대비 강해지며 수급 지표가 가장 크게 기여했습니다. 모멘텀(+11)과 추세(+6)도 함께 개선되며 적극매수 구간에 진입했습니다."
    },
    news: [{
      tag: "공시",
      headline: "삼성전자, 3분기 실적 컨센서스 상회 전망",
      timestamp: "21분 전"
    }, {
      tag: "속보",
      headline: "외국인 순매수 5거래일 연속 지속",
      timestamp: "48분 전"
    }],
    alerts: [{
      kind: "buy",
      text: "스코어 +60 돌파 — 적극매수 전환",
      timestamp: "10:20"
    }, {
      kind: "neutral",
      text: "거래량 급증 감지 (평균 대비 +180%)",
      timestamp: "09:52"
    }, {
      kind: "buy",
      text: "VWAP 상향 돌파",
      timestamp: "09:41"
    }],
    community: [{
      author: "장투는옳다",
      role: "주주",
      text: "수급 들어오는거 보니 오늘 갭 더 갈듯",
      timestamp: "3분 전"
    }, {
      author: "무주고민중",
      role: "관망",
      text: "외국인 순매수 언제까지 이어질지 지켜봐야",
      timestamp: "8분 전"
    }, {
      author: "삼전20년째",
      role: "주주",
      text: "적극매수 뜨면 항상 조정 왔었는데 이번엔 다르길",
      timestamp: "15분 전"
    }],
    candlesByTimeframe: {
      "1m": genCandlesTF(71000, 60, 40000),
      "5m": genCandlesTF(70600, 48, 90000),
      "1d": genCandlesTF(68200, 30, 400000),
      "1w": genCandlesTF(60500, 52, 900000),
      "1mo": genCandlesTF(55000, 36, 2500000),
      "1y": genCandlesTF(42000, 10, 8000000)
    },
    flow: {
      netBuy: genNetBuy(20, 320, 210),
      program: genProgram(24, 180),
      strength: 132.4,
      orderBook: genOrderBook(71300, 100, 42000),
      brokers: genBrokers(BROKER_NAMES, 8500000000)
    },
    risk: {
      atr: 1480
    }
  },
  "000660": {
    header: {
      name: "SK하이닉스",
      ticker: "000660",
      price: 218500,
      changePct: -2.6,
      changeAmt: -5800,
      volume: "3.2M",
      marketCap: "159.1조",
      marketStatus: "open"
    },
    score: -41,
    updatedAt: "09:32",
    contributions: [{
      name: "수급",
      score: -14,
      weight: 30
    }, {
      name: "모멘텀",
      score: -10,
      weight: 25
    }, {
      name: "추세",
      score: -8,
      weight: 20
    }, {
      name: "변동성",
      score: -6,
      weight: 15
    }, {
      name: "거래량",
      score: 4,
      weight: 10
    }],
    candles: genCandlesSimple(220000),
    history: [{
      time: "09:00",
      signal: "매수"
    }, {
      time: "09:30",
      signal: "중립"
    }, {
      time: "10:10",
      signal: "매도"
    }],
    reason: {
      timestamp: "9분 전",
      headline: "수급·모멘텀 동반 약화로 매도 전환",
      body: "외국인·기관 동반 순매도가 이어지며 수급 기여도가 -14까지 하락했습니다. 단기 추세선 이탈도 함께 확인되어 매도 구간으로 전환됐습니다."
    },
    news: [{
      tag: "속보",
      headline: "메모리 반도체 가격 하락 우려 재부각",
      timestamp: "12분 전"
    }],
    alerts: [{
      kind: "sell",
      text: "스코어 -40 이탈 — 매도 전환",
      timestamp: "10:10"
    }, {
      kind: "sell",
      text: "추세선(20일) 하향 이탈",
      timestamp: "09:35"
    }],
    community: [{
      author: "메모리사이클",
      role: "관망",
      text: "가격 하락 기사에 너무 민감하게 반응하는듯",
      timestamp: "5분 전"
    }, {
      author: "하이닉스홀더",
      role: "주주",
      text: "손절 라인 잡아놨는데 여기서 버텨야하나",
      timestamp: "11분 전"
    }],
    candlesByTimeframe: {
      "1m": genCandlesTF(219500, 60, 20000),
      "5m": genCandlesTF(222000, 48, 45000),
      "1d": genCandlesTF(230000, 30, 180000),
      "1w": genCandlesTF(205000, 52, 400000),
      "1mo": genCandlesTF(180000, 36, 1100000),
      "1y": genCandlesTF(140000, 10, 3600000)
    },
    flow: {
      netBuy: genNetBuy(20, 260, 340),
      program: genProgram(24, 140),
      strength: 78.6,
      orderBook: genOrderBook(218500, 500, 9000),
      brokers: genBrokers(BROKER_NAMES, 6200000000)
    },
    risk: {
      atr: 5200
    }
  },
  "373220": {
    header: {
      name: "LG에너지솔루션",
      ticker: "373220",
      price: 412000,
      changePct: 0.1,
      changeAmt: 500,
      volume: "1.1M",
      marketCap: "96.4조",
      marketStatus: "after"
    },
    score: 3,
    updatedAt: "09:31",
    contributions: [{
      name: "수급",
      score: 2,
      weight: 30
    }, {
      name: "모멘텀",
      score: -1,
      weight: 25
    }, {
      name: "추세",
      score: 1,
      weight: 20
    }, {
      name: "변동성",
      score: 0,
      weight: 15
    }, {
      name: "거래량",
      score: -2,
      weight: 10
    }],
    candles: genCandlesSimple(412000),
    history: [{
      time: "09:00",
      signal: "중립"
    }, {
      time: "09:50",
      signal: "중립"
    }, {
      time: "10:20",
      signal: "중립"
    }],
    reason: {
      timestamp: "31분 전",
      headline: "지표 간 방향 혼재로 중립 유지",
      body: "수급(+2)과 추세(+1)는 소폭 개선됐지만 모멘텀(-1)·거래량(-2)이 상쇄하며 뚜렷한 방향성이 나타나지 않고 있습니다."
    },
    news: [{
      tag: "공시",
      headline: "미국 신규 배터리 공장 착공 발표",
      timestamp: "1시간 전"
    }],
    alerts: [{
      kind: "neutral",
      text: "스코어 중립 구간(-20~20) 3시간째 유지",
      timestamp: "10:20"
    }],
    community: [{
      author: "배터리아저씨",
      role: "주주",
      text: "미국 공장 소식 나쁘지 않은데 왜 안 움직이지",
      timestamp: "20분 전"
    }],
    candlesByTimeframe: {
      "1m": genCandlesTF(411500, 60, 8000),
      "5m": genCandlesTF(410800, 48, 18000),
      "1d": genCandlesTF(408000, 30, 70000),
      "1w": genCandlesTF(390000, 52, 150000),
      "1mo": genCandlesTF(350000, 36, 420000),
      "1y": genCandlesTF(300000, 10, 1200000)
    },
    flow: {
      netBuy: genNetBuy(20, 90, 60),
      program: genProgram(24, 40),
      strength: 101.2,
      orderBook: genOrderBook(412000, 1000, 2200),
      brokers: genBrokers(BROKER_NAMES, 1800000000)
    },
    risk: {
      atr: 9100
    }
  }
};
window.APP_SHELL_SUGGESTIONS = [{
  name: "삼성전자",
  ticker: "005930"
}, {
  name: "SK하이닉스",
  ticker: "000660"
}, {
  name: "LG에너지솔루션",
  ticker: "373220"
}];

// ---- Tab5 스크리너 데이터 (독립적 종목 유니버스) ----
function genCandlesScreener(base) {
  const out = [];
  let price = base;
  for (let i = 0; i < 12; i++) {
    const o = price;
    const drift = (Math.sin(i * 1.1) + (i % 4 === 0 ? 0.5 : -0.15)) * base * 0.003;
    const c = Math.round(o + drift);
    const h = Math.round(Math.max(o, c) + base * 0.0018);
    const l = Math.round(Math.min(o, c) - base * 0.0018);
    const v = Math.round(40000 + Math.random() * 80000);
    out.push({
      t: `${i}`,
      o,
      h,
      l,
      c,
      v
    });
    price = c;
  }
  return out;
}
function seriesScreener(base, n, vol) {
  const out = [base];
  for (let i = 1; i < n; i++) out.push(out[i - 1] + (Math.random() - 0.45) * vol);
  return out;
}
window.APP_SHELL_MARKET = [{
  label: "코스피",
  value: "2,847.31",
  changePct: 1.12,
  series: seriesScreener(2800, 20, 8)
}, {
  label: "코스닥",
  value: "853.55",
  changePct: -1.71,
  series: seriesScreener(870, 20, 4)
}, {
  label: "원/달러",
  value: "1,352.40",
  changePct: -0.28,
  series: seriesScreener(1355, 20, 2)
}, {
  label: "거래대금",
  value: "18.4조",
  changePct: 0.6,
  series: seriesScreener(17, 20, 1)
}];
window.APP_SHELL_ROWS = [{
  ticker: "000660",
  name: "SK하이닉스",
  price: 244100,
  changePct: 0.65,
  score: 71,
  buyPct: 67,
  volume: "1,234억"
}, {
  ticker: "005930",
  name: "삼성전자",
  price: 320000,
  changePct: 3.39,
  score: 58,
  buyPct: 61,
  volume: "905억"
}, {
  ticker: "006400",
  name: "삼성SDI",
  price: 214500,
  changePct: 6.72,
  score: 64,
  buyPct: 58,
  volume: "298억"
}, {
  ticker: "010130",
  name: "고려아연",
  price: 745000,
  changePct: -0.19,
  score: -8,
  buyPct: 48,
  volume: "244억"
}, {
  ticker: "096770",
  name: "SK이노베이션",
  price: 118900,
  changePct: 11.22,
  score: 82,
  buyPct: 71,
  volume: "199억"
}, {
  ticker: "247540",
  name: "에코프로비엠",
  price: 165600,
  changePct: 4.21,
  score: 39,
  buyPct: 59,
  volume: "211억"
}, {
  ticker: "066570",
  name: "LG전자",
  price: 94400,
  changePct: -2.26,
  score: -34,
  buyPct: 38,
  volume: "150억"
}, {
  ticker: "003670",
  name: "포스코퓨처엠",
  price: 231400,
  changePct: -3.05,
  score: -52,
  buyPct: 31,
  volume: "132억"
}, {
  ticker: "035420",
  name: "NAVER",
  price: 189500,
  changePct: 0.42,
  score: 6,
  buyPct: 51,
  volume: "121억"
}, {
  ticker: "051910",
  name: "LG화학",
  price: 302500,
  changePct: 1.85,
  score: 24,
  buyPct: 55,
  volume: "98억"
}];
const CONTRIB_BY_TICKER = {
  "000660": [{
    name: "수급",
    score: 28
  }, {
    name: "모멘텀",
    score: 18
  }, {
    name: "추세",
    score: 12
  }, {
    name: "변동성",
    score: -5
  }],
  "005930": [{
    name: "모멘텀",
    score: 22
  }, {
    name: "수급",
    score: 19
  }, {
    name: "추세",
    score: 10
  }, {
    name: "거래량",
    score: 4
  }],
  "006400": [{
    name: "수급",
    score: 24
  }, {
    name: "추세",
    score: 15
  }, {
    name: "모멘텀",
    score: 11
  }, {
    name: "변동성",
    score: -8
  }],
  "010130": [{
    name: "변동성",
    score: -12
  }, {
    name: "모멘텀",
    score: -6
  }, {
    name: "수급",
    score: 3
  }, {
    name: "추세",
    score: -2
  }],
  "096770": [{
    name: "거래량",
    score: 31
  }, {
    name: "수급",
    score: 27
  }, {
    name: "모멘텀",
    score: 20
  }, {
    name: "추세",
    score: 9
  }],
  "247540": [{
    name: "모멘텀",
    score: 16
  }, {
    name: "수급",
    score: 12
  }, {
    name: "추세",
    score: 8
  }, {
    name: "변동성",
    score: -6
  }],
  "066570": [{
    name: "수급",
    score: -20
  }, {
    name: "추세",
    score: -14
  }, {
    name: "모멘텀",
    score: -9
  }, {
    name: "거래량",
    score: 2
  }],
  "003670": [{
    name: "수급",
    score: -28
  }, {
    name: "모멘텀",
    score: -18
  }, {
    name: "추세",
    score: -15
  }, {
    name: "변동성",
    score: -6
  }],
  "035420": [{
    name: "추세",
    score: 5
  }, {
    name: "수급",
    score: 3
  }, {
    name: "모멘텀",
    score: -2
  }, {
    name: "변동성",
    score: 1
  }],
  "051910": [{
    name: "모멘텀",
    score: 13
  }, {
    name: "수급",
    score: 9
  }, {
    name: "추세",
    score: 6
  }, {
    name: "거래량",
    score: -3
  }]
};
window.APP_SHELL_STOCK_DETAILS = Object.fromEntries(window.APP_SHELL_ROWS.map(r => [r.ticker, {
  name: r.name,
  price: r.price,
  changePct: r.changePct,
  score: r.score,
  candles: genCandlesScreener(r.price),
  contributions: CONTRIB_BY_TICKER[r.ticker]
}]));
window.APP_SHELL_WATCHLIST = window.APP_SHELL_ROWS.map(r => ({
  name: r.name,
  ticker: r.ticker
}));

// ---- 탭6 매크로/시장 데이터 ----
window.APP_SHELL_MACRO = {
  phase: {
    score: 34,
    asOf: "09:31 실시간"
  },
  domesticIndices: [{
    label: "코스피",
    value: "2,847.31",
    changePct: 1.12,
    advancers: 612,
    decliners: 288,
    series: seriesScreener(2800, 20, 8)
  }, {
    label: "코스닥",
    value: "853.55",
    changePct: -0.42,
    advancers: 410,
    decliners: 520,
    series: seriesScreener(870, 20, 4)
  }],
  overseas: {
    asOf: "07/05 05:10 · 미 증시 마감 기준",
    items: [{
      label: "S&P500",
      value: "6,142.8",
      changePct: 0.58
    }, {
      label: "나스닥",
      value: "20,015.3",
      changePct: 0.91
    }, {
      label: "코스피200 야간선물",
      value: "+0.35%",
      changePct: 0.35
    }]
  },
  fxRates: {
    asOf: "09:31 실시간",
    items: [{
      label: "원/달러",
      value: "1,352.40",
      changePct: -0.28,
      changeLabel: "-0.28%"
    }, {
      label: "국고채 3년",
      value: "3.02%",
      changePct: -0.3,
      changeLabel: "-3bp"
    }, {
      label: "미국채 10년",
      value: "4.28%",
      changePct: 0.7,
      changeLabel: "+2bp"
    }]
  },
  flow: {
    asOf: "09:31 실시간",
    foreignNet: 3180,
    instNet: -540
  },
  volatility: {
    asOf: "전일 마감 기준",
    vix: 14.2,
    vixChangePct: -3.1,
    fearGreed: 58
  },
  sectors: [{
    name: "반도체",
    changePct: 2.8
  }, {
    name: "2차전지",
    changePct: -1.4
  }, {
    name: "바이오",
    changePct: 0.6
  }, {
    name: "자동차",
    changePct: 1.1
  }, {
    name: "인터넷",
    changePct: -2.3
  }, {
    name: "조선",
    changePct: 3.4
  }, {
    name: "철강",
    changePct: -0.8
  }, {
    name: "화학",
    changePct: 0.2
  }, {
    name: "은행",
    changePct: 1.6
  }, {
    name: "증권",
    changePct: -1.9
  }, {
    name: "유통",
    changePct: 0.4
  }, {
    name: "건설",
    changePct: -2.7
  }],
  calendar: {
    year: 2026,
    month: 7,
    today: 6,
    events: [{
      week: "7월 2주차",
      day: 6,
      weekday: "월",
      country: "US",
      title: "ISM 서비스업 구매관리자지수 발표",
      time: "오후 11시 발표 예정"
    }, {
      week: "7월 2주차",
      day: 9,
      weekday: "목",
      country: "US",
      title: "기존주택 매매건수 발표",
      time: "오후 11시 발표 예정"
    }, {
      week: "7월 2주차",
      day: 9,
      weekday: "목",
      country: "US",
      title: "주간 신규실업수당 청구건수 발표",
      time: "오후 9시 30분 발표 예정"
    }, {
      week: "7월 3주차",
      day: 14,
      weekday: "화",
      country: "US",
      title: "근원 소비자물가지수 발표(전월 대비)",
      time: "오후 9시 30분 발표 예정"
    }, {
      week: "7월 3주차",
      day: 14,
      weekday: "화",
      country: "US",
      title: "소비자물가지수(CPI) 발표(전년 대비)",
      time: "오후 9시 30분 발표 예정"
    }, {
      week: "7월 3주차",
      day: 15,
      weekday: "수",
      country: "US",
      title: "생산자물가지수(PPI) 발표(전월 대비)",
      time: "오후 9시 30분 발표 예정"
    }, {
      week: "7월 3주차",
      day: 15,
      weekday: "수",
      country: "US",
      title: "존슨 앤 존슨 실적발표",
      time: "오후 9시 이후"
    }, {
      week: "7월 3주차",
      day: 16,
      weekday: "목",
      country: "US",
      title: "근원 소매판매 발표(전월 대비)",
      time: "오후 9시 30분 발표 예정"
    }, {
      week: "7월 3주차",
      day: 16,
      weekday: "목",
      country: "KR",
      title: "한국은행 금융통화위원회",
      time: "오전 9시 예정"
    }]
  },
  // ---- 경제지표 카드 그리드 (섹션 A) — 실제치/예상치/이전치 + 서프라이즈 ----
  economicIndicators: [{
    name: "소비자물가지수(CPI)",
    period: "6월 · 전년동월대비",
    country: "KR",
    unit: "%",
    decimals: 1,
    actual: 2.3,
    forecast: 2.1,
    prior: 2.0,
    asOf: "07/02 발표",
    trend: [1.6, 1.7, 1.9, 2.0, 2.0, 2.3]
  }, {
    name: "근원 CPI",
    period: "6월 · 전년동월대비",
    country: "KR",
    unit: "%",
    decimals: 1,
    actual: 2.0,
    forecast: 2.0,
    prior: 1.9,
    asOf: "07/02 발표",
    trend: [1.7, 1.8, 1.8, 1.9, 1.9, 2.0]
  }, {
    name: "생산자물가지수(PPI)",
    period: "6월 · 전월대비",
    country: "KR",
    unit: "%",
    decimals: 1,
    actual: 0.3,
    forecast: 0.1,
    prior: -0.1,
    asOf: "07/03 발표",
    trend: [-0.3, -0.2, -0.1, -0.1, -0.1, 0.3]
  }, {
    name: "기준금리",
    period: "7월 금통위",
    country: "KR",
    unit: "%",
    decimals: 2,
    actual: 2.5,
    forecast: 2.5,
    prior: 2.5,
    asOf: "07/16 예정",
    trend: [2.75, 2.75, 2.5, 2.5, 2.5, 2.5]
  }, {
    name: "실업률",
    period: "6월",
    country: "KR",
    unit: "%",
    decimals: 1,
    actual: 2.8,
    forecast: 2.9,
    prior: 2.9,
    asOf: "07/09 발표",
    trend: [3.1, 3.0, 2.9, 2.9, 2.9, 2.8]
  }, {
    name: "소비자물가지수(CPI)",
    period: "6월 · 전년동월대비",
    country: "US",
    unit: "%",
    decimals: 1,
    actual: 3.1,
    forecast: 2.9,
    prior: 2.8,
    asOf: "07/14 예정",
    trend: [2.4, 2.5, 2.6, 2.7, 2.8, 3.1]
  }, {
    name: "근원 CPI",
    period: "6월 · 전년동월대비",
    country: "US",
    unit: "%",
    decimals: 1,
    actual: 3.4,
    forecast: 3.3,
    prior: 3.3,
    asOf: "07/14 예정",
    trend: [3.2, 3.3, 3.3, 3.3, 3.3, 3.4]
  }, {
    name: "생산자물가지수(PPI)",
    period: "6월 · 전월대비",
    country: "US",
    unit: "%",
    decimals: 1,
    actual: 0.4,
    forecast: 0.2,
    prior: 0.1,
    asOf: "07/15 예정",
    trend: [0.0, 0.1, 0.1, 0.1, 0.1, 0.4]
  }, {
    name: "기준금리(FOMC 상단)",
    period: "6월 FOMC",
    country: "US",
    unit: "%",
    decimals: 2,
    actual: 5.5,
    forecast: 5.5,
    prior: 5.5,
    asOf: "06/18 발표",
    trend: [5.5, 5.5, 5.5, 5.5, 5.5, 5.5]
  }, {
    name: "ISM 제조업 PMI",
    period: "6월",
    country: "US",
    unit: "pt",
    decimals: 1,
    actual: 48.5,
    forecast: 49.0,
    prior: 48.7,
    asOf: "07/01 발표",
    trend: [49.5, 49.2, 48.9, 48.8, 48.7, 48.5]
  }]
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app-shell/data.js", error: String((e && e.message) || e) }); }

// ui_kits/flow-tab/Tab3Flow.jsx
try { (() => {
const {
  StockHeader,
  TabNavigation,
  StockSearchBar
} = window.Ds_a0b250;
const TABS = [{
  id: "overview",
  label: "종합 신호"
}, {
  id: "technical",
  label: "기술적 분석"
}, {
  id: "flow",
  label: "수급"
}, {
  id: "macro",
  label: "매크로/시장"
}, {
  id: "screener",
  label: "관심종목"
}];
const NETBUY_MODES = [{
  id: "daily",
  label: "일별"
}, {
  id: "cum",
  label: "누적"
}];
function fmtWon(v) {
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  const abs = Math.abs(Math.round(v));
  return sign + abs.toLocaleString("ko-KR");
}
function fmtEok(v) {
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return sign + Math.abs(Math.round(v)).toLocaleString("ko-KR") + "억";
}
function SegmentedControl({
  items,
  activeId,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      background: "var(--bg-inset)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      padding: 2,
      gap: 2
    }
  }, items.map(it => {
    const active = it.id === activeId;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      onClick: () => onChange(it.id),
      style: {
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
        transition: "color var(--duration-fast) var(--ease-standard)"
      }
    }, it.label);
  }));
}
function SectionLabel({
  children,
  right
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 700,
      color: "var(--text-tertiary)",
      letterSpacing: "var(--tracking-wide)"
    }
  }, children), right);
}
function Card({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-xs)",
      padding: "var(--space-4)",
      ...style
    }
  }, children);
}

// ---- 외국인·기관 순매수 추이 (daily grouped bars / cumulative lines) ----
function NetBuyTrendChart({
  data,
  mode,
  height = 200,
  vbWidth = 760
}) {
  const padTop = 14;
  const padBottom = 22;
  const plotLeft = 8;
  const plotRight = 8;
  const plotW = vbWidth - plotLeft - plotRight;
  const plotH = height - padTop - padBottom;
  const n = data.dates.length;
  const xAt = i => plotLeft + (i + 0.5) * (plotW / n);
  if (mode === "daily") {
    const maxAbs = Math.max(...data.foreign.map(Math.abs), ...data.institution.map(Math.abs), 1);
    const yAt = v => padTop + (1 - (v + maxAbs) / (maxAbs * 2)) * plotH;
    const zeroY = yAt(0);
    const groupW = plotW / n;
    const barW = groupW * 0.32;
    return /*#__PURE__*/React.createElement("svg", {
      viewBox: `0 0 ${vbWidth} ${height}`,
      width: "100%",
      height: height,
      preserveAspectRatio: "none"
    }, /*#__PURE__*/React.createElement("line", {
      x1: plotLeft,
      y1: zeroY,
      x2: vbWidth - plotRight,
      y2: zeroY,
      stroke: "var(--border-strong)",
      strokeWidth: "1"
    }), data.dates.map((d, i) => {
      const fx = xAt(i) - barW * 0.65;
      const ix = xAt(i) + barW * 0.65;
      const fv = data.foreign[i];
      const iv = data.institution[i];
      const fColor = fv >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";
      const iColor = iv >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";
      return /*#__PURE__*/React.createElement("g", {
        key: i
      }, /*#__PURE__*/React.createElement("rect", {
        x: fx - barW / 2,
        y: Math.min(zeroY, yAt(fv)),
        width: barW,
        height: Math.max(1, Math.abs(yAt(fv) - zeroY)),
        fill: fColor,
        opacity: "0.95"
      }), /*#__PURE__*/React.createElement("rect", {
        x: ix - barW / 2,
        y: Math.min(zeroY, yAt(iv)),
        width: barW,
        height: Math.max(1, Math.abs(yAt(iv) - zeroY)),
        fill: iColor,
        opacity: "0.5"
      }));
    }), data.dates.map((d, i) => i % Math.ceil(n / 8) === 0 ? /*#__PURE__*/React.createElement("text", {
      key: "t" + i,
      x: xAt(i),
      y: height - 6,
      fontSize: "12",
      textAnchor: "middle",
      fill: "var(--text-tertiary)",
      fontFamily: "var(--font-body)"
    }, d) : null));
  }

  // cumulative
  const cumForeign = [];
  const cumInst = [];
  data.foreign.reduce((s, v, i) => (cumForeign.push(s + v), s + v), 0);
  data.institution.reduce((s, v, i) => (cumInst.push(s + v), s + v), 0);
  const all = [...cumForeign, ...cumInst, 0];
  const maxV = Math.max(...all);
  const minV = Math.min(...all);
  const range = maxV - minV || 1;
  const yAt = v => padTop + (1 - (v - minV) / range) * plotH;
  const zeroY = yAt(0);
  const pathFor = series => series.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
  const foreignColor = cumForeign[cumForeign.length - 1] >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";
  const instColor = cumInst[cumInst.length - 1] >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${vbWidth} ${height}`,
    width: "100%",
    height: height,
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("line", {
    x1: plotLeft,
    y1: zeroY,
    x2: vbWidth - plotRight,
    y2: zeroY,
    stroke: "var(--border-strong)",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("path", {
    d: pathFor(cumInst),
    fill: "none",
    stroke: instColor,
    strokeWidth: "2",
    strokeDasharray: "5 4",
    opacity: "0.75"
  }), /*#__PURE__*/React.createElement("path", {
    d: pathFor(cumForeign),
    fill: "none",
    stroke: foreignColor,
    strokeWidth: "2.5"
  }), data.dates.map((d, i) => i % Math.ceil(n / 8) === 0 ? /*#__PURE__*/React.createElement("text", {
    key: "t" + i,
    x: xAt(i),
    y: height - 6,
    fontSize: "12",
    textAnchor: "middle",
    fill: "var(--text-tertiary)",
    fontFamily: "var(--font-body)"
  }, d) : null));
}
function LegendSwatch({
  color,
  opacity,
  dashed,
  label
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: dashed ? 2 : 8,
      borderRadius: dashed ? 0 : 2,
      background: dashed ? "none" : color,
      borderTop: dashed ? `2px dashed ${color}` : "none",
      opacity: opacity != null ? opacity : 1,
      display: "inline-block"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, label));
}

// ---- 프로그램 매매 동향 ----
function ProgramTradingStrip({
  program
}) {
  const last = program.net[program.net.length - 1];
  const total = program.net.reduce((s, v) => s + v, 0);
  const color = total >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";
  const maxAbs = Math.max(...program.net.map(Math.abs), 1);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-5)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, "\uD504\uB85C\uADF8\uB7A8 \uC21C\uB9E4\uC218 (\uB2F9\uC77C \uB204\uC801)"), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-lg)",
      fontWeight: 700,
      color,
      marginTop: 2
    }
  }, fmtEok(total))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      alignItems: "flex-end",
      gap: 3,
      height: 40
    }
  }, program.net.map((v, i) => {
    const h = Math.max(2, Math.abs(v) / maxAbs * 36);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        flex: 1,
        height: h,
        background: v >= 0 ? "var(--signal-buy)" : "var(--signal-sell)",
        opacity: 0.75,
        borderRadius: 1
      }
    });
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, "\uC9C1\uC804 \uCCB4\uACB0"), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 600,
      color: last >= 0 ? "var(--signal-buy)" : "var(--signal-sell)"
    }
  }, fmtEok(last))));
}

// ---- 체결강도 미터 ----
function ExecutionStrengthMeter({
  value
}) {
  // value: 0~200, 100 = balanced. render as split bar around center.
  const clamped = Math.max(20, Math.min(200, value));
  const buyPct = Math.min(100, clamped / 200 * 100);
  const dominant = value >= 100;
  const color = dominant ? "var(--signal-buy)" : "var(--signal-sell)";
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, "\uCCB4\uACB0\uAC15\uB3C4"), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-lg)",
      fontWeight: 700,
      color
    }
  }, value.toFixed(1), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 500,
      color: "var(--text-tertiary)",
      marginLeft: 6
    }
  }, dominant ? "매수 우위" : "매도 우위"))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: 10,
      borderRadius: "var(--radius-pill)",
      background: "var(--bg-inset)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: "50%",
      top: 0,
      bottom: 0,
      width: 1,
      background: "var(--border-strong)",
      zIndex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: dominant ? "50%" : `${buyPct}%`,
      right: dominant ? `${100 - buyPct}%` : "50%",
      background: color,
      opacity: 0.85
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, "0"), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, "100"), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, "200")));
}

// ---- 호가창 Level 2 ----
function OrderBookRow({
  price,
  qty,
  maxQty,
  side,
  currentPrice
}) {
  const pct = Math.max(2, qty / maxQty * 100);
  const isAsk = side === "ask";
  const barColor = isAsk ? "var(--signal-sell)" : "var(--signal-buy)";
  const isNearPrice = price === currentPrice;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "grid",
      gridTemplateColumns: "1fr 72px",
      alignItems: "center",
      height: 22,
      borderBottom: "1px solid var(--border-default)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      justifyContent: isAsk ? "flex-start" : "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${pct}%`,
      height: "100%",
      background: barColor,
      opacity: 0.16
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      position: "relative",
      fontSize: "var(--text-xs)",
      fontWeight: isNearPrice ? 700 : 500,
      color: barColor,
      paddingLeft: "var(--space-2)"
    }
  }, price.toLocaleString("ko-KR")), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      position: "relative",
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)",
      textAlign: "right",
      paddingRight: "var(--space-2)"
    }
  }, qty.toLocaleString("ko-KR")));
}
function OrderBook({
  book,
  currentPrice,
  changePct
}) {
  const maxQty = Math.max(...book.asks.map(r => r.qty), ...book.bids.map(r => r.qty));
  const priceColor = changePct >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 72px",
      padding: "0 0 var(--space-1)",
      borderBottom: "1px solid var(--border-strong)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      paddingLeft: "var(--space-2)"
    }
  }, "\uD638\uAC00"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      textAlign: "right",
      paddingRight: "var(--space-2)"
    }
  }, "\uC794\uB7C9")), /*#__PURE__*/React.createElement("div", null, book.asks.slice().sort((a, b) => b.price - a.price).map(r => /*#__PURE__*/React.createElement(OrderBookRow, {
    key: "a" + r.price,
    price: r.price,
    qty: r.qty,
    maxQty: maxQty,
    side: "ask",
    currentPrice: currentPrice
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: "var(--space-2) 0",
      background: "var(--bg-inset)",
      border: "1px solid var(--border-strong)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 700,
      color: priceColor
    }
  }, currentPrice.toLocaleString("ko-KR")), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: priceColor
    }
  }, changePct > 0 ? "+" : "", changePct.toFixed(2), "%")), /*#__PURE__*/React.createElement("div", null, book.bids.slice().sort((a, b) => b.price - a.price).map(r => /*#__PURE__*/React.createElement(OrderBookRow, {
    key: "b" + r.price,
    price: r.price,
    qty: r.qty,
    maxQty: maxQty,
    side: "bid",
    currentPrice: currentPrice
  }))));
}

// ---- 거래원 상위 테이블 ----
function BrokerTable({
  brokers
}) {
  const [sortKey, setSortKey] = React.useState("net");
  const cols = [{
    key: "rank",
    label: "순위",
    align: "left"
  }, {
    key: "name",
    label: "창구",
    align: "left"
  }, {
    key: "buy",
    label: "매수",
    align: "right"
  }, {
    key: "sell",
    label: "매도",
    align: "right"
  }, {
    key: "net",
    label: "순매수",
    align: "right"
  }];
  const sorted = brokers.slice().sort((a, b) => sortKey === "buy" ? b.buy - a.buy : sortKey === "sell" ? b.sell - a.sell : Math.abs(b.net) - Math.abs(a.net));
  return /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "var(--text-xs)"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, cols.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    onClick: () => c.key !== "rank" && c.key !== "name" && setSortKey(c.key),
    style: {
      textAlign: c.align,
      fontSize: "var(--text-2xs)",
      color: sortKey === c.key ? "var(--accent-strong)" : "var(--text-tertiary)",
      fontWeight: 600,
      padding: "var(--space-2)",
      borderBottom: "1px solid var(--border-default)",
      whiteSpace: "nowrap",
      cursor: c.key === "rank" || c.key === "name" ? "default" : "pointer"
    }
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, sorted.map((b, i) => /*#__PURE__*/React.createElement("tr", {
    key: b.name
  }, /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "var(--space-2)",
      color: "var(--text-tertiary)",
      borderBottom: "1px solid var(--border-default)"
    }
  }, i + 1), /*#__PURE__*/React.createElement("td", {
    style: {
      padding: "var(--space-2)",
      color: "var(--text-primary)",
      fontWeight: 500,
      borderBottom: "1px solid var(--border-default)",
      whiteSpace: "nowrap"
    }
  }, b.name), /*#__PURE__*/React.createElement("td", {
    className: "ds-numeric",
    style: {
      padding: "var(--space-2)",
      textAlign: "right",
      color: "var(--signal-buy)",
      borderBottom: "1px solid var(--border-default)"
    }
  }, b.buy.toLocaleString("ko-KR")), /*#__PURE__*/React.createElement("td", {
    className: "ds-numeric",
    style: {
      padding: "var(--space-2)",
      textAlign: "right",
      color: "var(--signal-sell)",
      borderBottom: "1px solid var(--border-default)"
    }
  }, b.sell.toLocaleString("ko-KR")), /*#__PURE__*/React.createElement("td", {
    className: "ds-numeric",
    style: {
      padding: "var(--space-2)",
      textAlign: "right",
      fontWeight: 700,
      color: b.net >= 0 ? "var(--signal-buy)" : "var(--signal-sell)",
      borderBottom: "1px solid var(--border-default)"
    }
  }, fmtWon(b.net))))));
}
function Tab3Flow({
  stock,
  onSelectStock,
  suggestions,
  activeTab: activeTabProp,
  onTabChange
}) {
  const [internalTab, setInternalTab] = React.useState("flow");
  const activeTab = activeTabProp ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [showSettings, setShowSettings] = React.useState(false);
  const [netBuyMode, setNetBuyMode] = React.useState("daily");
  const {
    header,
    flow
  } = stock;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100%",
      background: "var(--bg-base)",
      fontFamily: "var(--font-body)"
    },
    "data-theme": "dark"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "var(--space-3) var(--space-6)",
      borderBottom: "1px solid var(--border-default)",
      background: "var(--bg-surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 900,
      color: "var(--text-primary)",
      letterSpacing: "var(--tracking-tight)"
    }
  }, "\uB2E8\uAE30\uB9E4\uB9E4 \uC2E0\uD638"), /*#__PURE__*/React.createElement(StockSearchBar, {
    suggestions: suggestions,
    onSelect: onSelectStock
  })), /*#__PURE__*/React.createElement(window.SettingsGearButton, {
    onClick: () => setShowSettings(true)
  })), /*#__PURE__*/React.createElement(TabNavigation, {
    tabs: TABS,
    activeId: activeTab,
    onChange: setActiveTab
  }), /*#__PURE__*/React.createElement(window.SettingsPanel, {
    open: showSettings,
    onClose: () => setShowSettings(false)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1440,
      margin: "0 auto",
      padding: "var(--space-4) var(--space-6) var(--space-12)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-xs)",
      padding: "var(--space-3) var(--space-5)"
    }
  }, /*#__PURE__*/React.createElement(StockHeader, header)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "300px 1fr",
      gap: "var(--space-3)",
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement(Card, {
    style: {
      position: "sticky",
      top: "var(--space-4)",
      padding: "var(--space-3) var(--space-2) var(--space-3) var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "\uD638\uAC00\uCC3D (Level 2)")), /*#__PURE__*/React.createElement(OrderBook, {
    book: flow.orderBook,
    currentPrice: header.price,
    changePct: header.changePct
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(SectionLabel, {
    right: /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)"
      }
    }, /*#__PURE__*/React.createElement(LegendSwatch, {
      color: "var(--text-primary)",
      label: "\uC678\uAD6D\uC778"
    }), /*#__PURE__*/React.createElement(LegendSwatch, {
      color: "var(--text-primary)",
      opacity: 0.5,
      dashed: netBuyMode === "cum",
      label: "\uAE30\uAD00"
    }), /*#__PURE__*/React.createElement(SegmentedControl, {
      items: NETBUY_MODES,
      activeId: netBuyMode,
      onChange: setNetBuyMode
    }))
  }, "\uC678\uAD6D\uC778\xB7\uAE30\uAD00 \uC21C\uB9E4\uC218 \uCD94\uC774"), /*#__PURE__*/React.createElement(NetBuyTrendChart, {
    data: flow.netBuy,
    mode: netBuyMode,
    height: 200
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(SectionLabel, null, "\uD504\uB85C\uADF8\uB7A8 \uB9E4\uB9E4 \uB3D9\uD5A5"), /*#__PURE__*/React.createElement(ProgramTradingStrip, {
    program: flow.program
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(ExecutionStrengthMeter, {
    value: flow.strength
  })), /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(SectionLabel, null, "\uAC70\uB798\uC6D0 \uC0C1\uC704"), /*#__PURE__*/React.createElement(BrokerTable, {
    brokers: flow.brokers
  }))))));
}
window.Tab3Flow = Tab3Flow;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/flow-tab/Tab3Flow.jsx", error: String((e && e.message) || e) }); }

// ui_kits/macro-tab/Tab6Macro.jsx
try { (() => {
const {
  TabNavigation,
  StockSearchBar
} = window.Ds_a0b250;
const TABS = [{
  id: "overview",
  label: "종합 신호"
}, {
  id: "technical",
  label: "기술적 분석"
}, {
  id: "flow",
  label: "수급"
}, {
  id: "macro",
  label: "매크로/시장"
}, {
  id: "screener",
  label: "관심종목"
}];
function changeColor(pct) {
  if (pct > 0) return "var(--signal-buy)";
  if (pct < 0) return "var(--signal-sell)";
  return "var(--signal-neutral)";
}
function fmtPct(pct) {
  return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
}
function phaseZoneFor(score) {
  if (score >= 60) return {
    label: "강한 리스크온",
    color: "var(--signal-buy-strong)"
  };
  if (score >= 20) return {
    label: "리스크온",
    color: "var(--signal-buy)"
  };
  if (score > -20) return {
    label: "중립",
    color: "var(--signal-neutral)"
  };
  if (score > -60) return {
    label: "리스크오프",
    color: "var(--signal-sell)"
  };
  return {
    label: "강한 리스크오프",
    color: "var(--signal-sell-strong)"
  };
}
function angleForScore(score) {
  const clamped = Math.max(-100, Math.min(100, score));
  return 180 - (clamped + 100) / 200 * 180;
}
function polar(cx, cy, r, angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad)
  };
}
function arcPath(cx, cy, r, angleStart, angleEnd) {
  const p1 = polar(cx, cy, r, angleStart);
  const p2 = polar(cx, cy, r, angleEnd);
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;
}
const ZONE_BOUNDARIES = [180, 144, 108, 72, 36, 0];
const ZONE_COLORS = ["var(--signal-sell-strong)", "var(--signal-sell)", "var(--signal-neutral)", "var(--signal-buy)", "var(--signal-buy-strong)"];

// market-phase gauge — same visual grammar as the ticker DirectionGauge, but
// labeled 리스크온/오프 since this reads the whole market, not one stock.
function MarketPhaseGauge({
  score
}) {
  const w = 320;
  const h = 190;
  const r = 130;
  const stroke = 22;
  const cx = w / 2;
  const cy = h - 6;
  const zone = phaseZoneFor(score);
  const needleAngle = angleForScore(score);
  const tip = polar(cx, cy, 108, needleAngle);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      width: w
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: w,
    height: h,
    viewBox: `0 0 ${w} ${h}`
  }, ZONE_BOUNDARIES.slice(0, -1).map((start, i) => /*#__PURE__*/React.createElement("path", {
    key: i,
    d: arcPath(cx, cy, r, start, ZONE_BOUNDARIES[i + 1]),
    fill: "none",
    stroke: ZONE_COLORS[i],
    strokeWidth: stroke,
    opacity: "0.9"
  })), /*#__PURE__*/React.createElement("line", {
    x1: cx,
    y1: cy,
    x2: tip.x,
    y2: tip.y,
    stroke: "var(--text-primary)",
    strokeWidth: "3",
    strokeLinecap: "round"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: cx,
    cy: cy,
    r: "5",
    fill: "var(--text-primary)"
  })), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-4xl)",
      fontWeight: "var(--weight-bold)",
      color: zone.color,
      marginTop: "var(--space-2)",
      lineHeight: 1
    }
  }, score > 0 ? "+" : "", score), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-lg)",
      fontWeight: "var(--weight-semibold)",
      color: zone.color,
      marginTop: "var(--space-1)"
    }
  }, zone.label));
}
function Sparkline({
  points,
  color,
  width = 72,
  height = 26
}) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${height - (p - min) / range * height}`).join(" ");
  return /*#__PURE__*/React.createElement("svg", {
    width: width,
    height: height,
    viewBox: `0 0 ${width} ${height}`
  }, /*#__PURE__*/React.createElement("path", {
    d: d,
    fill: "none",
    stroke: color,
    strokeWidth: "1.5"
  }));
}
function AsOfBadge({
  children,
  live
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontSize: "var(--text-2xs)",
      color: live ? "var(--status-live)" : "var(--text-tertiary)",
      fontWeight: 600
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: "50%",
      background: live ? "var(--status-live)" : "var(--text-tertiary)"
    }
  }), children);
}

// 섹션 A(경제지표) / 섹션 B(시세) 경계를 확실히 구분하는 앵커형 구획 헤딩.
function MacroSectionHeading({
  index,
  title,
  subtitle,
  right
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      fontWeight: 800,
      color: "var(--accent)",
      letterSpacing: "var(--tracking-wide)",
      border: "1px solid var(--accent)",
      borderRadius: "var(--radius-pill)",
      padding: "2px 9px",
      flexShrink: 0
    }
  }, index), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 800,
      color: "var(--text-primary)",
      flexShrink: 0
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: "var(--border-default)"
    }
  }), right), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-tertiary)"
    }
  }, subtitle));
}

// 한국/미국 구분 토글 — 경제지표 섹션 전용, 매수/매도 색과 무관한 중립 세그먼트.
function CountryFilter({
  activeId,
  onChange
}) {
  const items = [{
    id: "all",
    label: "전체"
  }, {
    id: "KR",
    label: "한국"
  }, {
    id: "US",
    label: "미국"
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      background: "var(--bg-inset)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      padding: 2,
      gap: 2
    }
  }, items.map(it => {
    const active = it.id === activeId;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      onClick: () => onChange(it.id),
      style: {
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
        whiteSpace: "nowrap"
      }
    }, it.label);
  }));
}

// 예상치 대비 서프라이즈 표시 — 매수/매도(빨강/파랑) 팔레트와 겹치지 않도록
// 상회=accent(금색)·부합=중립회색·하회=text-secondary 로만 구분한다.
function SurpriseChip({
  actual,
  forecast,
  unit,
  decimals = 1
}) {
  const diff = actual - forecast;
  const tolerance = Math.max(0.05, Math.abs(forecast) * 0.01);
  if (Math.abs(diff) <= tolerance) {
    return /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--text-2xs)",
        fontWeight: 600,
        color: "var(--text-tertiary)"
      }
    }, "\uC608\uC0C1 \uBD80\uD569");
  }
  const beat = diff > 0;
  return /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      fontWeight: 700,
      color: beat ? "var(--accent-strong)" : "var(--text-secondary)"
    }
  }, beat ? "▲" : "▼", " \uC608\uC0C1\uB300\uBE44 ", diff > 0 ? "+" : "", diff.toFixed(decimals), unit);
}

// 경제지표 카드 — 실제치/예상치/이전치 + 서프라이즈 강조 + 최근 추세 미니차트.
// 발표 주기가 실시간과 다르므로 as_of 라벨(발표 시점)을 항상 병기한다.
function EconomicIndicatorCard({
  indicator
}) {
  const {
    name,
    period,
    actual,
    forecast,
    prior,
    unit,
    decimals = 1,
    asOf,
    trend
  } = indicator;
  const fmt = v => `${v.toFixed(decimals)}${unit}`;
  return /*#__PURE__*/React.createElement(CardShell, {
    title: name,
    asOf: asOf
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, period), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-xl)",
      fontWeight: 800,
      color: "var(--text-primary)",
      marginTop: 2,
      lineHeight: 1
    }
  }, fmt(actual)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement(SurpriseChip, {
    actual: actual,
    forecast: forecast,
    unit: unit,
    decimals: decimals
  }))), trend && /*#__PURE__*/React.createElement(Sparkline, {
    points: trend,
    color: "var(--text-tertiary)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-4)",
      paddingTop: "var(--space-2)",
      borderTop: "1px solid var(--border-default)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "9px",
      color: "var(--text-tertiary)"
    }
  }, "\uC608\uC0C1\uCE58"), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      color: "var(--text-secondary)"
    }
  }, fmt(forecast))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "9px",
      color: "var(--text-tertiary)"
    }
  }, "\uC774\uC804\uCE58"), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      color: "var(--text-secondary)"
    }
  }, fmt(prior)))));
}
function EconomicIndicatorGrid({
  indicators,
  filter
}) {
  const filtered = filter === "all" ? indicators : indicators.filter(i => i.country === filter);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(200px, 1fr))",
      gap: "var(--space-4)"
    }
  }, filtered.map(ind => /*#__PURE__*/React.createElement("div", {
    key: `${ind.country}-${ind.name}`,
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: "var(--space-3)",
      right: "var(--space-3)",
      zIndex: 1
    }
  }, /*#__PURE__*/React.createElement(CountryTag, {
    code: ind.country
  })), /*#__PURE__*/React.createElement(EconomicIndicatorCard, {
    indicator: ind
  }))));
}
function CardShell({
  title,
  asOf,
  live,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-xs)",
      padding: "var(--space-4)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 700,
      color: "var(--text-tertiary)",
      letterSpacing: "var(--tracking-wide)",
      whiteSpace: "nowrap"
    }
  }, title), asOf && /*#__PURE__*/React.createElement(AsOfBadge, {
    live: live
  }, asOf)), children);
}

// compact fact chip used in the top phase banner — surfaces the concrete numbers
// behind the risk-on/off call, in keeping with the product's "근거 공개" principle.
// mode="pct": changeVal is a percent, rendered via fmtPct.
// mode="amount": changeVal is a raw signed amount (already formatted into `delta`), colored by sign only.
function FactChip({
  label,
  value,
  mode = "pct",
  changeVal,
  colorSign,
  delta
}) {
  const valueColor = mode === "amount" ? changeColor(delta >= 0 ? 1 : delta < 0 ? -1 : 0) : "var(--text-primary)";
  const pctColor = changeColor(colorSign ?? changeVal);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 6,
      padding: "var(--space-2) var(--space-3)",
      background: "var(--bg-inset)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-pill)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 700,
      color: valueColor
    }
  }, value), mode === "pct" && /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      fontWeight: 600,
      color: pctColor
    }
  }, fmtPct(changeVal)));
}
function StatRow({
  label,
  value,
  changePct,
  series
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 700,
      color: "var(--text-primary)",
      marginTop: 2
    }
  }, value), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: changeColor(changePct),
      marginTop: 2,
      fontWeight: 600
    }
  }, fmtPct(changePct))), series && /*#__PURE__*/React.createElement(Sparkline, {
    points: series,
    color: changeColor(changePct)
  }));
}
function DomesticIndexCard({
  indices
}) {
  return /*#__PURE__*/React.createElement(CardShell, {
    title: "\uAD6D\uB0B4 \uC9C0\uC218",
    asOf: "09:31 \uC2E4\uC2DC\uAC04",
    live: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)"
    }
  }, indices.map(idx => {
    const total = idx.advancers + idx.decliners;
    const upPct = idx.advancers / total * 100;
    return /*#__PURE__*/React.createElement("div", {
      key: idx.label,
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)"
      }
    }, /*#__PURE__*/React.createElement(StatRow, {
      label: idx.label,
      value: idx.value,
      changePct: idx.changePct,
      series: idx.series
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        height: 6,
        borderRadius: "var(--radius-pill)",
        overflow: "hidden",
        display: "flex"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: `${upPct}%`,
        background: "var(--signal-buy)"
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        width: `${100 - upPct}%`,
        background: "var(--signal-sell)"
      }
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "ds-numeric",
      style: {
        fontSize: "var(--text-2xs)",
        color: "var(--signal-buy)"
      }
    }, "\uC0C1\uC2B9 ", idx.advancers), /*#__PURE__*/React.createElement("span", {
      className: "ds-numeric",
      style: {
        fontSize: "var(--text-2xs)",
        color: "var(--signal-sell)"
      }
    }, "\uD558\uB77D ", idx.decliners)));
  })));
}
function OverseasCard({
  overseas
}) {
  return /*#__PURE__*/React.createElement(CardShell, {
    title: "\uD574\uC678 \uC99D\uC2DC",
    asOf: overseas.asOf
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)"
    }
  }, overseas.items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: it.label,
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      padding: "var(--space-2) 0",
      borderTop: i > 0 ? "1px solid var(--border-default)" : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)"
    }
  }, it.label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 700,
      color: "var(--text-primary)"
    }
  }, it.value), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      color: changeColor(it.changePct)
    }
  }, fmtPct(it.changePct)))))));
}
function FxRatesCard({
  fxRates
}) {
  return /*#__PURE__*/React.createElement(CardShell, {
    title: "\uD658\uC728 \xB7 \uAE08\uB9AC",
    asOf: fxRates.asOf,
    live: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)"
    }
  }, fxRates.items.map((it, i) => /*#__PURE__*/React.createElement("div", {
    key: it.label,
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      padding: "var(--space-2) 0",
      borderTop: i > 0 ? "1px solid var(--border-default)" : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)"
    }
  }, it.label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 700,
      color: "var(--text-primary)"
    }
  }, it.value), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      color: changeColor(it.changePct)
    }
  }, it.changeLabel))))));
}
function fmtEok(v) {
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return sign + Math.abs(Math.round(v)).toLocaleString("ko-KR") + "억";
}
function MarketFlowCard({
  flow
}) {
  return /*#__PURE__*/React.createElement(CardShell, {
    title: "\uC2DC\uC7A5 \uC218\uAE09 (\uC804\uCCB4)",
    asOf: flow.asOf,
    live: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)"
    }
  }, "\uC678\uAD6D\uC778 \uC21C\uB9E4\uC218"), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-lg)",
      fontWeight: 700,
      color: flow.foreignNet >= 0 ? "var(--signal-buy)" : "var(--signal-sell)"
    }
  }, fmtEok(flow.foreignNet))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--border-default)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)"
    }
  }, "\uAE30\uAD00 \uC21C\uB9E4\uC218"), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-lg)",
      fontWeight: 700,
      color: flow.instNet >= 0 ? "var(--signal-buy)" : "var(--signal-sell)"
    }
  }, fmtEok(flow.instNet)))));
}

// horizontal fear/greed strip — risk-off(fear)=blue, risk-on(greed)=red, matching the product's color convention
function FearGreedBar({
  value
}) {
  const pct = Math.max(0, Math.min(100, value));
  const label = pct >= 75 ? "극단적 탐욕" : pct >= 55 ? "탐욕" : pct >= 45 ? "중립" : pct >= 25 ? "공포" : "극단적 공포";
  const color = pct >= 55 ? "var(--signal-buy)" : pct <= 45 ? "var(--signal-sell)" : "var(--signal-neutral)";
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, "\uACF5\uD3EC\xB7\uD0D0\uC695 \uC9C0\uC218"), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 700,
      color
    }
  }, pct, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 500,
      color: "var(--text-tertiary)"
    }
  }, label))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: 10,
      borderRadius: "var(--radius-pill)",
      background: "linear-gradient(90deg, var(--signal-sell) 0%, var(--signal-neutral) 50%, var(--signal-buy) 100%)",
      opacity: 0.9
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: -3,
      left: `calc(${pct}% - 3px)`,
      width: 8,
      height: 16,
      borderRadius: 2,
      background: "var(--text-primary)",
      boxShadow: "var(--shadow-xs)"
    }
  })));
}
function VolatilityCard({
  vol
}) {
  return /*#__PURE__*/React.createElement(CardShell, {
    title: "\uBCC0\uB3D9\uC131 \xB7 \uC2EC\uB9AC",
    asOf: vol.asOf
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)"
    }
  }, "VIX"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 700,
      color: "var(--text-primary)"
    }
  }, vol.vix.toFixed(1)), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      color: changeColor(-vol.vixChangePct)
    }
  }, fmtPct(vol.vixChangePct)))), /*#__PURE__*/React.createElement(FearGreedBar, {
    value: vol.fearGreed
  }));
}
function SectorHeatmap({
  sectors
}) {
  const maxAbs = Math.max(...sectors.map(s => Math.abs(s.changePct)), 1);
  return /*#__PURE__*/React.createElement(CardShell, {
    title: "\uC5C5\uC885 \uD788\uD2B8\uB9F5",
    asOf: "09:31 \uC2E4\uC2DC\uAC04",
    live: true
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(6, 1fr)",
      gap: "var(--space-2)"
    }
  }, sectors.map(s => {
    const intensity = 0.18 + Math.abs(s.changePct) / maxAbs * 0.72;
    const color = s.changePct >= 0 ? "var(--signal-buy)" : "var(--signal-sell)";
    return /*#__PURE__*/React.createElement("div", {
      key: s.name,
      style: {
        background: color,
        opacity: intensity,
        borderRadius: "var(--radius-sm)",
        padding: "var(--space-3) var(--space-2)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minHeight: 64,
        justifyContent: "space-between"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--text-2xs)",
        fontWeight: 700,
        color: "var(--text-on-signal)"
      }
    }, s.name), /*#__PURE__*/React.createElement("span", {
      className: "ds-numeric",
      style: {
        fontSize: "var(--text-sm)",
        fontWeight: 700,
        color: "var(--text-on-signal)"
      }
    }, fmtPct(s.changePct)));
  })));
}
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
function CountryTag({
  code
}) {
  const bg = code === "US" ? "rgba(77,141,255,0.16)" : code === "KR" ? "rgba(255,92,92,0.16)" : "var(--bg-inset)";
  const color = code === "US" ? "var(--signal-sell)" : code === "KR" ? "var(--signal-buy)" : "var(--text-tertiary)";
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 22,
      height: 16,
      padding: "0 4px",
      borderRadius: 3,
      background: bg,
      color,
      fontSize: "9px",
      fontWeight: 800,
      letterSpacing: "0.2px"
    }
  }, code);
}

// compact month grid — highlights today and marks days that carry a scheduled event
function MiniCalendar({
  year,
  month,
  today,
  eventDays
}) {
  const first = new Date(year, month - 1, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({
      day: daysInPrevMonth - startWeekday + 1 + i,
      inMonth: false
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      inMonth: true
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({
      day: cells.length - startWeekday - daysInMonth + 1,
      inMonth: false
    });
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 800,
      color: "var(--text-primary)"
    }
  }, year, "\uB144 ", month, "\uC6D4"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-1)"
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      width: 22,
      height: 22,
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      background: "var(--bg-inset)",
      color: "var(--text-tertiary)",
      cursor: "pointer",
      fontSize: "11px"
    }
  }, "\u2039"), /*#__PURE__*/React.createElement("button", {
    style: {
      width: 22,
      height: 22,
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      background: "var(--bg-inset)",
      color: "var(--text-tertiary)",
      cursor: "pointer",
      fontSize: "11px"
    }
  }, "\u203A"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      gap: 2,
      marginBottom: 4
    }
  }, WEEKDAY_LABELS.map(w => /*#__PURE__*/React.createElement("div", {
    key: w,
    style: {
      textAlign: "center",
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      padding: "2px 0"
    }
  }, w))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)",
      gap: 2
    }
  }, cells.map((c, i) => {
    const isToday = c.inMonth && c.day === today;
    const hasEvent = c.inMonth && eventDays.has(c.day);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "4px 0",
        borderRadius: "var(--radius-sm)",
        background: isToday ? "var(--accent)" : "transparent",
        opacity: c.inMonth ? 1 : 0.3
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--text-2xs)",
        fontWeight: isToday ? 800 : 500,
        color: isToday ? "var(--text-on-signal)" : "var(--text-secondary)"
      }
    }, c.day), /*#__PURE__*/React.createElement("span", {
      style: {
        width: 3,
        height: 3,
        borderRadius: "50%",
        background: hasEvent && !isToday ? "var(--accent)" : "transparent"
      }
    }));
  })));
}
function EconomicCalendarCard({
  calendar
}) {
  const eventDays = new Set(calendar.events.map(e => e.day));
  const groups = [];
  calendar.events.forEach(e => {
    let g = groups.find(g => g.week === e.week);
    if (!g) {
      g = {
        week: e.week,
        items: []
      };
      groups.push(g);
    }
    g.items.push(e);
  });
  return /*#__PURE__*/React.createElement(CardShell, {
    title: "\uACBD\uC81C\uC9C0\uD45C \uC77C\uC815",
    style: {
      padding: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(MiniCalendar, {
    year: calendar.year,
    month: calendar.month,
    today: calendar.today,
    eventDays: eventDays
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--border-default)",
      margin: "var(--space-1) 0"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)",
      maxHeight: 420,
      overflowY: "auto"
    }
  }, groups.map(g => /*#__PURE__*/React.createElement("div", {
    key: g.week,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      fontWeight: 700,
      color: "var(--text-tertiary)"
    }
  }, g.week), g.items.map((ev, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      gap: "var(--space-2)",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      width: 26,
      flexShrink: 0,
      paddingTop: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 700,
      color: "var(--text-primary)"
    }
  }, ev.day), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "9px",
      color: "var(--text-tertiary)"
    }
  }, ev.weekday)), /*#__PURE__*/React.createElement(CountryTag, {
    code: ev.country
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-body)",
      lineHeight: 1.35
    }
  }, ev.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "9px",
      color: "var(--text-tertiary)",
      marginTop: 2
    }
  }, ev.time))))))));
}

// full-width hero banner: the market regime call, made big per the brief, with the
// concrete numbers behind it surfaced as chips (transparency principle applied to
// the macro judgement, not just per-ticker scoring).
function PhaseBanner({
  macro
}) {
  const kospi = macro.domesticIndices[0];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: "var(--space-6)",
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-sm)",
      padding: "var(--space-6) var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement(MarketPhaseGauge, {
    score: macro.phase.score
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)",
      maxWidth: 260
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 700,
      color: "var(--text-tertiary)",
      letterSpacing: "var(--tracking-wide)"
    }
  }, "\uC2DC\uC7A5 \uAD6D\uBA74 \uC885\uD569 \uD310\uC815"), /*#__PURE__*/React.createElement(AsOfBadge, {
    live: true
  }, macro.phase.asOf)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)",
      lineHeight: 1.5
    }
  }, "\uCF54\uC2A4\uD53C\xB7\uCF54\uC2A4\uB2E5 \uB4F1\uB77D, \uC678\uAD6D\uC778\xB7\uAE30\uAD00 \uC218\uAE09, VIX \uB4F1\uC744 \uC885\uD569\uD574 \uC0B0\uCD9C\uD55C \uC2DC\uC7A5 \uC804\uCCB4 \uAD6D\uBA74\uC785\uB2C8\uB2E4. \uAC1C\uBCC4 \uC885\uBAA9 \uC2E0\uD638\uB294 \uC774 \uAD6D\uBA74 \uC704\uC5D0\uC11C \uD310\uB2E8\uD558\uC138\uC694."))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: "var(--space-2)",
      justifyContent: "flex-end"
    }
  }, /*#__PURE__*/React.createElement(FactChip, {
    label: "\uCF54\uC2A4\uD53C",
    value: kospi.value,
    mode: "pct",
    changeVal: kospi.changePct
  }), /*#__PURE__*/React.createElement(FactChip, {
    label: "\uC678\uAD6D\uC778 \uC21C\uB9E4\uC218",
    value: fmtEok(macro.flow.foreignNet),
    mode: "amount",
    delta: macro.flow.foreignNet
  }), /*#__PURE__*/React.createElement(FactChip, {
    label: "VIX",
    value: macro.volatility.vix.toFixed(1),
    mode: "pct",
    changeVal: macro.volatility.vixChangePct,
    colorSign: -macro.volatility.vixChangePct
  })));
}
function Tab6Macro({
  macro,
  onSelectStock,
  suggestions,
  activeTab: activeTabProp,
  onTabChange
}) {
  const [internalTab, setInternalTab] = React.useState("macro");
  const activeTab = activeTabProp ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [showSettings, setShowSettings] = React.useState(false);
  const [countryFilter, setCountryFilter] = React.useState("all");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100%",
      background: "var(--bg-base)",
      fontFamily: "var(--font-body)"
    },
    "data-theme": "dark"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "var(--space-3) var(--space-6)",
      borderBottom: "1px solid var(--border-default)",
      background: "var(--bg-surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 900,
      color: "var(--text-primary)",
      letterSpacing: "var(--tracking-tight)"
    }
  }, "\uB2E8\uAE30\uB9E4\uB9E4 \uC2E0\uD638"), /*#__PURE__*/React.createElement(StockSearchBar, {
    suggestions: suggestions,
    onSelect: onSelectStock
  })), /*#__PURE__*/React.createElement(window.SettingsGearButton, {
    onClick: () => setShowSettings(true)
  })), /*#__PURE__*/React.createElement(TabNavigation, {
    tabs: TABS,
    activeId: activeTab,
    onChange: setActiveTab
  }), /*#__PURE__*/React.createElement(window.SettingsPanel, {
    open: showSettings,
    onClose: () => setShowSettings(false)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1320,
      margin: "0 auto",
      padding: "var(--space-8) var(--space-6) var(--space-16)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-10)"
    }
  }, /*#__PURE__*/React.createElement(PhaseBanner, {
    macro: macro
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(MacroSectionHeading, {
    index: "A",
    title: "\uACBD\uC81C\uC9C0\uD45C",
    subtitle: "\uBC1C\uD45C \uC8FC\uAE30 \uB370\uC774\uD130 \u2014 \uC2E4\uC81C\uCE58\uB294 \uBC1C\uD45C \uC2DC\uC810 \uAE30\uC900\uC774\uBA70 \uC2DC\uC138\uC640 \uC2E0\uC120\uB3C4\uAC00 \uB2E4\uB985\uB2C8\uB2E4.",
    right: /*#__PURE__*/React.createElement(CountryFilter, {
      activeId: countryFilter,
      onChange: setCountryFilter
    })
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "320px 1fr",
      gap: "var(--space-6)",
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      top: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement(EconomicCalendarCard, {
    calendar: macro.calendar
  })), /*#__PURE__*/React.createElement(EconomicIndicatorGrid, {
    indicators: macro.economicIndicators,
    filter: countryFilter
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(MacroSectionHeading, {
    index: "B",
    title: "\uC2DC\uC138",
    subtitle: "\uAD6D\uB0B4\uC678 \uC9C0\uC218\xB7\uD658\uC728\xB7\uAE08\uB9AC\xB7\uC218\uAE09\xB7\uBCC0\uB3D9\uC131 \u2014 \uC2E4\uC2DC\uAC04~\uC804\uC77C \uAE30\uC900 \uD63C\uC7AC."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(240px, 1fr))",
      gap: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(DomesticIndexCard, {
    indices: macro.domesticIndices
  }), /*#__PURE__*/React.createElement(OverseasCard, {
    overseas: macro.overseas
  }), /*#__PURE__*/React.createElement(FxRatesCard, {
    fxRates: macro.fxRates
  }), /*#__PURE__*/React.createElement(MarketFlowCard, {
    flow: macro.flow
  }), /*#__PURE__*/React.createElement(VolatilityCard, {
    vol: macro.volatility
  })), /*#__PURE__*/React.createElement(SectorHeatmap, {
    sectors: macro.sectors
  }))));
}
window.Tab6Macro = Tab6Macro;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/macro-tab/Tab6Macro.jsx", error: String((e && e.message) || e) }); }

// ui_kits/overview-tab/Tab1Overview.jsx
try { (() => {
const {
  DirectionGauge,
  ContributionBar,
  StockHeader,
  CandleChart,
  TabNavigation,
  StockSearchBar
} = window.Ds_a0b250;
const TABS = [{
  id: "overview",
  label: "종합 신호"
}, {
  id: "technical",
  label: "기술적 분석"
}, {
  id: "flow",
  label: "수급"
}, {
  id: "macro",
  label: "매크로/시장"
}, {
  id: "screener",
  label: "관심종목"
}];
const ATR_MULTS = [{
  id: "1",
  label: "1×",
  value: 1
}, {
  id: "1.5",
  label: "1.5×",
  value: 1.5
}, {
  id: "2",
  label: "2×",
  value: 2
}];
const R_MULTS = [{
  id: "1",
  label: "1R",
  value: 1
}, {
  id: "2",
  label: "2R",
  value: 2
}, {
  id: "3",
  label: "3R",
  value: 3
}];
function fmtWon(v) {
  const sign = v < 0 ? "-" : "";
  return sign + Math.abs(Math.round(v)).toLocaleString("ko-KR");
}
function SignalHistoryTimeline({
  events
}) {
  const colorFor = s => {
    if (s === "적극매수") return "var(--signal-buy-strong)";
    if (s === "매수") return "var(--signal-buy)";
    if (s === "적극매도") return "var(--signal-sell-strong)";
    if (s === "매도") return "var(--signal-sell)";
    return "var(--signal-neutral)";
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      width: "100%",
      padding: "var(--space-4) 0"
    }
  }, events.map((ev, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 2,
      background: "var(--border-default)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      minWidth: 64
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 10,
      height: 10,
      borderRadius: "50%",
      background: colorFor(ev.signal),
      boxShadow: `0 0 0 3px ${colorFor(ev.signal)}22`
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      fontWeight: 700,
      color: colorFor(ev.signal)
    }
  }, ev.signal), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, ev.time)))));
}
function SectionLabel({
  children,
  right
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 700,
      color: "var(--text-tertiary)",
      letterSpacing: "var(--tracking-wide)"
    }
  }, children), right);
}

// 섹션 A(종합 신호) / 섹션 B(매매 계획) 경계를 확실히 구분하기 위한 앵커형 구획 헤딩.
function SectionEyebrow({
  index,
  title
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      fontWeight: 800,
      color: "var(--accent)",
      letterSpacing: "var(--tracking-wide)",
      border: "1px solid var(--accent)",
      borderRadius: "var(--radius-pill)",
      padding: "2px 9px",
      flexShrink: 0
    }
  }, index), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 800,
      color: "var(--text-primary)",
      flexShrink: 0
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 1,
      background: "var(--border-default)"
    }
  }));
}
function SegmentedControl({
  items,
  activeId,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      background: "var(--bg-inset)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      padding: 2,
      gap: 2
    }
  }, items.map(it => {
    const active = it.id === activeId;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      onClick: () => onChange(it.id),
      style: {
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
        transition: "color var(--duration-fast) var(--ease-standard)"
      }
    }, it.label);
  }));
}
function PlanCard({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-xs)",
      padding: "var(--space-4)",
      ...style
    }
  }, children);
}
function FieldLabel({
  children,
  hint
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      marginBottom: "var(--space-1)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)",
      fontWeight: "var(--weight-medium)"
    }
  }, children), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, hint));
}
function NumberField({
  value,
  onChange,
  suffix
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-1)",
      background: "var(--bg-inset)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      padding: "var(--space-2) var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "ds-numeric",
    type: "text",
    inputMode: "numeric",
    value: value,
    onChange: e => {
      const raw = e.target.value.replace(/[^0-9.-]/g, "");
      onChange(raw === "" ? 0 : Number(raw));
    },
    style: {
      flex: 1,
      width: "100%",
      minWidth: 0,
      background: "transparent",
      border: "none",
      outline: "none",
      fontSize: "var(--text-md)",
      fontWeight: "var(--weight-semibold)",
      color: "var(--text-primary)"
    }
  }), suffix && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-tertiary)",
      flexShrink: 0
    }
  }, suffix));
}
function RiskSlider({
  value,
  onChange,
  min = 0.5,
  max = 5,
  step = 0.5
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: min,
    max: max,
    step: step,
    value: value,
    onChange: e => onChange(Number(e.target.value)),
    style: {
      width: "100%",
      accentColor: "var(--accent)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, min, "%"), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, max, "%")));
}

// ---- 손절가 / 목표가 카드 ----
function StopTargetCard({
  entry,
  stopPrice,
  targetPrice,
  atr,
  atrMult
}) {
  const stopPct = (stopPrice - entry) / entry * 100;
  const targetPct = (targetPrice - entry) / entry * 100;
  return /*#__PURE__*/React.createElement(PlanCard, null, /*#__PURE__*/React.createElement(SectionLabel, {
    right: /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--text-2xs)",
        color: "var(--text-tertiary)"
      }
    }, "ATR(14) ", /*#__PURE__*/React.createElement("span", {
      className: "ds-numeric",
      style: {
        color: "var(--text-secondary)"
      }
    }, fmtWon(atr)), " \xD7 ", atrMult)
  }, "\uC190\uC808\uAC00 \xB7 \uBAA9\uD45C\uAC00 \uC81C\uC548"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--signal-sell-bg)",
      border: "1px solid var(--signal-sell-border)",
      borderRadius: "var(--radius-sm)",
      padding: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--signal-sell)",
      fontWeight: 700
    }
  }, "\uC190\uC808\uAC00"), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-xl)",
      fontWeight: 700,
      color: "var(--signal-sell)",
      marginTop: 4
    }
  }, fmtWon(stopPrice)), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--signal-sell)",
      marginTop: 2,
      opacity: 0.85
    }
  }, stopPct.toFixed(2), "%")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--signal-buy-bg)",
      border: "1px solid var(--signal-buy-border)",
      borderRadius: "var(--radius-sm)",
      padding: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--signal-buy)",
      fontWeight: 700
    }
  }, "\uBAA9\uD45C\uAC00"), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-xl)",
      fontWeight: 700,
      color: "var(--signal-buy)",
      marginTop: 4
    }
  }, fmtWon(targetPrice)), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--signal-buy)",
      marginTop: 2,
      opacity: 0.85
    }
  }, "+", targetPct.toFixed(2), "%"))));
}

// ---- 손익비(R:R) 수직 바 시각화 ----
function RiskRewardBar({
  entry,
  stopPrice,
  targetPrice,
  rr
}) {
  const height = 220;
  const padTop = 16;
  const padBottom = 16;
  const plotH = height - padTop - padBottom;
  const maxP = targetPrice;
  const minP = stopPrice;
  const range = maxP - minP || 1;
  const yAt = p => padTop + (1 - (p - minP) / range) * plotH;
  const entryY = yAt(entry);
  const stopY = yAt(stopPrice);
  const targetY = yAt(targetPrice);
  const barX = 130;
  const barW = 28;
  return /*#__PURE__*/React.createElement(PlanCard, null, /*#__PURE__*/React.createElement(SectionLabel, {
    right: /*#__PURE__*/React.createElement("span", {
      className: "ds-numeric",
      style: {
        fontSize: "var(--text-sm)",
        fontWeight: 700,
        color: rr >= 2 ? "var(--signal-buy)" : rr >= 1 ? "var(--accent-strong)" : "var(--signal-sell)"
      }
    }, "R:R 1 : ", rr.toFixed(2))
  }, "\uC190\uC775\uBE44 \uC2DC\uAC01\uD654"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-5)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: barX + barW + 90,
    height: height,
    viewBox: `0 0 ${barX + barW + 90} ${height}`
  }, /*#__PURE__*/React.createElement("rect", {
    x: barX,
    y: targetY,
    width: barW,
    height: Math.max(1, entryY - targetY),
    fill: "var(--signal-buy)",
    opacity: "0.35"
  }), /*#__PURE__*/React.createElement("rect", {
    x: barX,
    y: entryY,
    width: barW,
    height: Math.max(1, stopY - entryY),
    fill: "var(--signal-sell)",
    opacity: "0.35"
  }), /*#__PURE__*/React.createElement("rect", {
    x: barX,
    y: Math.min(targetY, stopY),
    width: barW,
    height: Math.max(1, Math.abs(stopY - targetY)),
    fill: "none",
    stroke: "var(--border-strong)",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("line", {
    x1: barX - 12,
    y1: targetY,
    x2: barX + barW + 12,
    y2: targetY,
    stroke: "var(--signal-buy)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("text", {
    x: barX + barW + 18,
    y: targetY + 4,
    fontSize: "13",
    fill: "var(--signal-buy)",
    fontWeight: "700",
    fontFamily: "var(--font-numeric)"
  }, "\uBAA9\uD45C ", fmtWon(targetPrice)), /*#__PURE__*/React.createElement("line", {
    x1: barX - 12,
    y1: entryY,
    x2: barX + barW + 12,
    y2: entryY,
    stroke: "var(--text-primary)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("text", {
    x: barX + barW + 18,
    y: entryY + 4,
    fontSize: "13",
    fill: "var(--text-primary)",
    fontWeight: "700",
    fontFamily: "var(--font-numeric)"
  }, "\uC9C4\uC785 ", fmtWon(entry)), /*#__PURE__*/React.createElement("line", {
    x1: barX - 12,
    y1: stopY,
    x2: barX + barW + 12,
    y2: stopY,
    stroke: "var(--signal-sell)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("text", {
    x: barX + barW + 18,
    y: stopY + 4,
    fontSize: "13",
    fill: "var(--signal-sell)",
    fontWeight: "700",
    fontFamily: "var(--font-numeric)"
  }, "\uC190\uC808 ", fmtWon(stopPrice)))));
}

// ---- 포지션 사이징 계산기 ----
function PositionSizingCard({
  accountSize,
  riskPct,
  entry,
  stopPrice
}) {
  const riskAmount = accountSize * (riskPct / 100);
  const riskPerShare = Math.max(1, entry - stopPrice);
  const qty = Math.max(0, Math.floor(riskAmount / riskPerShare));
  const notional = qty * entry;
  const weightPct = accountSize > 0 ? notional / accountSize * 100 : 0;
  const rows = [{
    label: "리스크 금액",
    value: fmtWon(riskAmount) + "원"
  }, {
    label: "주당 리스크",
    value: fmtWon(riskPerShare) + "원"
  }, {
    label: "매수 수량",
    value: qty.toLocaleString("ko-KR") + "주"
  }, {
    label: "투입 금액",
    value: fmtWon(notional) + "원"
  }, {
    label: "계좌 비중",
    value: weightPct.toFixed(1) + "%"
  }];
  return /*#__PURE__*/React.createElement(PlanCard, null, /*#__PURE__*/React.createElement(SectionLabel, null, "\uD3EC\uC9C0\uC158 \uC0AC\uC774\uC9D5"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-2)"
    }
  }, rows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: r.label,
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      padding: "var(--space-2) 0",
      borderBottom: i < rows.length - 1 ? "1px solid var(--border-default)" : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-tertiary)"
    }
  }, r.label), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: i === 2 || i === 3 ? "var(--text-lg)" : "var(--text-sm)",
      fontWeight: i === 2 || i === 3 ? 700 : 600,
      color: "var(--text-primary)"
    }
  }, r.value)))));
}
function EntryFormCard({
  entry,
  setEntry,
  currentPrice,
  atrMultId,
  setAtrMultId,
  rMultId,
  setRMultId,
  accountSize,
  setAccountSize,
  riskPct,
  setRiskPct
}) {
  return /*#__PURE__*/React.createElement(PlanCard, {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "\uC9C4\uC785\uAC00 \uC785\uB825"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, {
    hint: `현재가 ${currentPrice.toLocaleString("ko-KR")}`
  }, "\uC9C4\uC785\uAC00"), /*#__PURE__*/React.createElement(NumberField, {
    value: entry,
    onChange: setEntry,
    suffix: "\uC6D0"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, null, "\uC190\uC808 ATR \uBC30\uC218"), /*#__PURE__*/React.createElement(SegmentedControl, {
    items: ATR_MULTS,
    activeId: atrMultId,
    onChange: setAtrMultId
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, null, "\uBAA9\uD45C R \uBC30\uC218"), /*#__PURE__*/React.createElement(SegmentedControl, {
    items: R_MULTS,
    activeId: rMultId,
    onChange: setRMultId
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--border-default)"
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, null, "\uACC4\uC88C \uADDC\uBAA8"), /*#__PURE__*/React.createElement(NumberField, {
    value: accountSize,
    onChange: setAccountSize,
    suffix: "\uC6D0"
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FieldLabel, {
    hint: `${riskPct}%`
  }, "\uAC10\uB2F9 \uB9AC\uC2A4\uD06C"), /*#__PURE__*/React.createElement(RiskSlider, {
    value: riskPct,
    onChange: setRiskPct
  })));
}
function SidebarCard({
  title,
  timestamp,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      padding: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 700,
      color: "var(--text-tertiary)"
    }
  }, title), timestamp && /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, timestamp)), children);
}
function ReasonCard({
  reason
}) {
  if (!reason) return null;
  return /*#__PURE__*/React.createElement(SidebarCard, {
    title: "\uC65C \uC2E0\uD638\uAC00 \uBC14\uB00C\uC5C8\uB098",
    timestamp: reason.timestamp
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 700,
      color: "var(--text-primary)",
      marginBottom: "var(--space-2)"
    }
  }, reason.headline), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-secondary)",
      lineHeight: "var(--leading-relaxed)"
    }
  }, reason.body));
}
function NewsCard({
  news
}) {
  if (!news || news.length === 0) return null;
  return /*#__PURE__*/React.createElement(SidebarCard, {
    title: "\uD55C \uC904 \uC694\uC57D"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)"
    }
  }, news.map((n, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      gap: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flexShrink: 0,
      fontSize: "var(--text-2xs)",
      fontWeight: 700,
      color: "var(--text-secondary)",
      background: "var(--bg-inset)",
      borderRadius: "var(--radius-xs)",
      padding: "2px 6px",
      height: "fit-content"
    }
  }, n.tag), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-body)",
      lineHeight: "var(--leading-normal)"
    }
  }, n.headline), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      marginTop: 2
    }
  }, n.timestamp))))));
}
function AlertLogCard({
  alerts
}) {
  if (!alerts || alerts.length === 0) return null;
  const colorFor = kind => {
    if (kind === "buy") return "var(--signal-buy)";
    if (kind === "sell") return "var(--signal-sell)";
    return "var(--signal-neutral)";
  };
  return /*#__PURE__*/React.createElement(SidebarCard, {
    title: "\uCD5C\uADFC \uC54C\uB9BC"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column"
    }
  }, alerts.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: "var(--space-2)",
      padding: "var(--space-2) 0",
      borderTop: i > 0 ? "1px solid var(--border-default)" : "none"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: colorFor(a.kind),
      marginTop: 6,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-body)"
    }
  }, a.text), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      marginTop: 2
    }
  }, a.timestamp))))));
}
function CommunityCard({
  ticker,
  posts
}) {
  if (!posts || posts.length === 0) return null;
  return /*#__PURE__*/React.createElement(SidebarCard, {
    title: "\uC885\uBAA9\uD1A0\uB860\uBC29"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column"
    }
  }, posts.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      padding: "var(--space-3) 0",
      borderTop: i > 0 ? "1px solid var(--border-default)" : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      fontWeight: 700,
      color: p.role === "주주" ? "var(--signal-buy)" : "var(--text-tertiary)",
      border: `1px solid ${p.role === "주주" ? "var(--signal-buy-border)" : "var(--border-strong)"}`,
      borderRadius: "var(--radius-xs)",
      padding: "1px 5px"
    }
  }, p.role), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 600,
      color: "var(--text-primary)"
    }
  }, p.author), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      marginLeft: "auto"
    }
  }, p.timestamp)), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-body)",
      lineHeight: "var(--leading-normal)",
      whiteSpace: "pre-line"
    }
  }, p.text)))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      marginTop: "var(--space-2)",
      textAlign: "center"
    }
  }, ticker, " \uD1A0\uB860\uBC29 \uC804\uCCB4\uBCF4\uAE30"));
}
function Tab1Overview({
  stock,
  onSelectStock,
  suggestions,
  activeTab: activeTabProp,
  onTabChange
}) {
  const [internalTab, setInternalTab] = React.useState("overview");
  const activeTab = activeTabProp ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [showSettings, setShowSettings] = React.useState(false);

  // ---- 섹션 B · 매매 계획 상태 ----
  const [entry, setEntry] = React.useState(stock.header.price);
  const [atrMultId, setAtrMultId] = React.useState("1.5");
  const [rMultId, setRMultId] = React.useState("2");
  const [accountSize, setAccountSize] = React.useState(10000000);
  const [riskPct, setRiskPct] = React.useState(1);
  React.useEffect(() => {
    setEntry(stock.header.price);
  }, [stock.header.price]);
  const atrMult = (ATR_MULTS.find(m => m.id === atrMultId) || ATR_MULTS[1]).value;
  const rMult = (R_MULTS.find(m => m.id === rMultId) || R_MULTS[1]).value;
  const stopDistance = stock.risk.atr * atrMult;
  const stopPrice = Math.max(1, entry - stopDistance);
  const targetPrice = entry + stopDistance * rMult;
  const rr = stopDistance > 0 ? (targetPrice - entry) / (entry - stopPrice) : 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100%",
      background: "var(--bg-base)",
      fontFamily: "var(--font-body)"
    },
    "data-theme": "dark"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "var(--space-3) var(--space-6)",
      borderBottom: "1px solid var(--border-default)",
      background: "var(--bg-surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 900,
      color: "var(--text-primary)",
      letterSpacing: "var(--tracking-tight)"
    }
  }, "\uB2E8\uAE30\uB9E4\uB9E4 \uC2E0\uD638"), /*#__PURE__*/React.createElement(StockSearchBar, {
    suggestions: suggestions,
    onSelect: onSelectStock
  })), /*#__PURE__*/React.createElement(window.SettingsGearButton, {
    onClick: () => setShowSettings(true)
  })), /*#__PURE__*/React.createElement(TabNavigation, {
    tabs: TABS,
    activeId: activeTab,
    onChange: setActiveTab
  }), /*#__PURE__*/React.createElement(window.SettingsPanel, {
    open: showSettings,
    onClose: () => setShowSettings(false)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1240,
      margin: "0 auto",
      padding: "var(--space-8) var(--space-6) var(--space-16)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-10)"
    }
  }, /*#__PURE__*/React.createElement(SectionEyebrow, {
    index: "A",
    title: "\uC885\uD569 \uC2E0\uD638 \u2014 3\uCD08 \uACB0\uB860"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 300px",
      gap: "var(--space-6)",
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-8)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-xs)",
      padding: "var(--space-5) var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement(StockHeader, stock.header)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-sm)",
      padding: "var(--space-8) var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement(DirectionGauge, {
    score: stock.score,
    size: "lg",
    subtitle: `${stock.updatedAt} 갱신`
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      padding: "var(--space-5) var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "\uADFC\uAC70 \u2014 \uC9C0\uD45C \uAE30\uC5EC\uB3C4 \uC0C1\uC704 ", stock.contributions.length, "\uAC1C"), /*#__PURE__*/React.createElement(ContributionBar, {
    items: stock.contributions
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.3fr 1fr",
      gap: "var(--space-5)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      padding: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "\uCC38\uACE0 \u2014 \uBBF8\uB2C8 \uCC28\uD2B8 (VWAP)"), /*#__PURE__*/React.createElement(CandleChart, {
    candles: stock.candles,
    mini: true,
    height: 140
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      padding: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "\uCC38\uACE0 \u2014 \uB2F9\uC77C \uC2E0\uD638 \uD788\uC2A4\uD1A0\uB9AC"), /*#__PURE__*/React.createElement(SignalHistoryTimeline, {
    events: stock.history
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)",
      position: "sticky",
      top: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement(ReasonCard, {
    reason: stock.reason
  }), /*#__PURE__*/React.createElement(NewsCard, {
    news: stock.news
  }), /*#__PURE__*/React.createElement(AlertLogCard, {
    alerts: stock.alerts
  }), /*#__PURE__*/React.createElement(CommunityCard, {
    ticker: stock.header.name,
    posts: stock.community
  }))), /*#__PURE__*/React.createElement(SectionEyebrow, {
    index: "B",
    title: "\uB9E4\uB9E4 \uACC4\uD68D \u2014 \uC2E0\uD638\uB97C \uC2E4\uD589\uC73C\uB85C"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "340px 1fr",
      gap: "var(--space-4)",
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement(EntryFormCard, {
    entry: entry,
    setEntry: setEntry,
    currentPrice: stock.header.price,
    atrMultId: atrMultId,
    setAtrMultId: setAtrMultId,
    rMultId: rMultId,
    setRMultId: setRMultId,
    accountSize: accountSize,
    setAccountSize: setAccountSize,
    riskPct: riskPct,
    setRiskPct: setRiskPct
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(StopTargetCard, {
    entry: entry,
    stopPrice: stopPrice,
    targetPrice: targetPrice,
    atr: stock.risk.atr,
    atrMult: atrMultId + "×"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 320px",
      gap: "var(--space-4)",
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement(RiskRewardBar, {
    entry: entry,
    stopPrice: stopPrice,
    targetPrice: targetPrice,
    rr: rr
  }), /*#__PURE__*/React.createElement(PositionSizingCard, {
    accountSize: accountSize,
    riskPct: riskPct,
    entry: entry,
    stopPrice: stopPrice
  }))))));
}
window.Tab1Overview = Tab1Overview;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/overview-tab/Tab1Overview.jsx", error: String((e && e.message) || e) }); }

// ui_kits/screener-tab/Tab5Screener.jsx
try { (() => {
const {
  DirectionGauge,
  ContributionBar,
  StockHeader,
  CandleChart,
  TabNavigation,
  StockSearchBar
} = window.Ds_a0b250;
const TABS = [{
  id: "overview",
  label: "종합 신호"
}, {
  id: "technical",
  label: "기술적 분석"
}, {
  id: "flow",
  label: "수급"
}, {
  id: "macro",
  label: "매크로/시장"
}, {
  id: "screener",
  label: "관심종목"
}];
function changeColor(pct) {
  if (pct > 0) return "var(--signal-buy)";
  if (pct < 0) return "var(--signal-sell)";
  return "var(--signal-neutral)";
}
function scoreColor(score) {
  if (score >= 60) return "var(--signal-buy-strong)";
  if (score >= 20) return "var(--signal-buy)";
  if (score > -20) return "var(--signal-neutral)";
  if (score > -60) return "var(--signal-sell)";
  return "var(--signal-sell-strong)";
}
function scoreLabel(score) {
  if (score >= 60) return "적극매수";
  if (score >= 20) return "매수";
  if (score > -20) return "중립";
  if (score > -60) return "매도";
  return "적극매도";
}

// tiny inline sparkline, no external deps
function Sparkline({
  points,
  color,
  width = 64,
  height = 24
}) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${height - (p - min) / range * height}`).join(" ");
  return /*#__PURE__*/React.createElement("svg", {
    width: width,
    height: height,
    viewBox: `0 0 ${width} ${height}`
  }, /*#__PURE__*/React.createElement("path", {
    d: d,
    fill: "none",
    stroke: color,
    strokeWidth: "1.5"
  }));
}
function MarketStrip({
  items
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: `repeat(${items.length}, 1fr)`,
      gap: "var(--space-3)"
    }
  }, items.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      padding: "var(--space-3) var(--space-4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, m.label), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 700,
      color: "var(--text-primary)",
      marginTop: 2
    }
  }, m.value), /*#__PURE__*/React.createElement("div", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: changeColor(m.changePct),
      marginTop: 2
    }
  }, m.changePct > 0 ? "+" : "", m.changePct.toFixed(2), "%")), /*#__PURE__*/React.createElement(Sparkline, {
    points: m.series,
    color: changeColor(m.changePct)
  }))));
}
function RatioBar({
  buyPct
}) {
  const sellPct = 100 - buyPct;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      width: 130
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--signal-sell)",
      width: 26,
      textAlign: "right"
    }
  }, sellPct), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      height: 6,
      borderRadius: "var(--radius-pill)",
      overflow: "hidden",
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${sellPct}%`,
      background: "var(--signal-sell)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${buyPct}%`,
      background: "var(--signal-buy)"
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--signal-buy)",
      width: 26
    }
  }, buyPct));
}
function WatchlistChips({
  items,
  activeTicker,
  onPick
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-2)",
      flexWrap: "wrap"
    }
  }, items.map(it => {
    const active = it.ticker === activeTicker;
    return /*#__PURE__*/React.createElement("button", {
      key: it.ticker,
      onClick: () => onPick(it.ticker),
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: "var(--radius-pill)",
        border: `1px solid ${active ? "var(--accent)" : "var(--border-default)"}`,
        background: active ? "var(--accent-bg)" : "var(--bg-inset)",
        color: "var(--text-body)",
        fontSize: "var(--text-xs)",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: scoreColor(it.score)
      }
    }), it.name);
  }));
}
function ConditionBuilder({
  conditions
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-2)",
      flexWrap: "wrap"
    }
  }, conditions.map((c, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      fontWeight: 700
    }
  }, "AND"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-body)",
      background: "var(--bg-inset)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      padding: "5px 10px"
    }
  }, c))), /*#__PURE__*/React.createElement("button", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--accent)",
      background: "none",
      border: "1px dashed var(--border-strong)",
      borderRadius: "var(--radius-sm)",
      padding: "5px 10px",
      cursor: "pointer"
    }
  }, "+ \uC870\uAC74 \uCD94\uAC00"));
}
function ResultTable({
  rows,
  activeTicker,
  onSelect
}) {
  const cols = ["순위", "종목", "현재가", "등락률", "스코어", "체결강도(매도/매수)", "거래량"];
  return /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      fontSize: "var(--text-sm)",
      tableLayout: "auto"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, cols.map((c, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: {
      textAlign: i === 0 || i === 1 ? "left" : "right",
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      fontWeight: 500,
      padding: "8px 10px",
      borderBottom: "1px solid var(--border-default)",
      whiteSpace: "nowrap"
    }
  }, c)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, i) => {
    const active = r.ticker === activeTicker;
    return /*#__PURE__*/React.createElement("tr", {
      key: r.ticker,
      onClick: () => onSelect(r.ticker),
      style: {
        cursor: "pointer",
        background: active ? "var(--bg-surface-raised)" : "transparent"
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "10px",
        color: "var(--text-tertiary)",
        borderBottom: "1px solid var(--border-default)"
      }
    }, i + 1), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "10px",
        borderBottom: "1px solid var(--border-default)",
        minWidth: 168
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        whiteSpace: "nowrap"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--text-2xs)",
        fontWeight: 700,
        color: "var(--text-on-signal)",
        background: scoreColor(r.score),
        borderRadius: "var(--radius-xs)",
        padding: "2px 6px",
        whiteSpace: "nowrap",
        flexShrink: 0
      }
    }, scoreLabel(r.score)), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: "var(--text-primary)",
        fontWeight: 600,
        whiteSpace: "nowrap"
      }
    }, r.name), /*#__PURE__*/React.createElement("div", {
      className: "ds-numeric",
      style: {
        fontSize: "var(--text-2xs)",
        color: "var(--text-tertiary)",
        whiteSpace: "nowrap"
      }
    }, r.ticker)))), /*#__PURE__*/React.createElement("td", {
      className: "ds-numeric",
      style: {
        padding: "10px",
        textAlign: "right",
        color: "var(--text-body)",
        borderBottom: "1px solid var(--border-default)"
      }
    }, r.price.toLocaleString("ko-KR")), /*#__PURE__*/React.createElement("td", {
      className: "ds-numeric",
      style: {
        padding: "10px",
        textAlign: "right",
        color: changeColor(r.changePct),
        fontWeight: 600,
        borderBottom: "1px solid var(--border-default)"
      }
    }, r.changePct > 0 ? "+" : "", r.changePct.toFixed(2), "%"), /*#__PURE__*/React.createElement("td", {
      className: "ds-numeric",
      style: {
        padding: "10px",
        textAlign: "right",
        color: scoreColor(r.score),
        fontWeight: 700,
        borderBottom: "1px solid var(--border-default)"
      }
    }, r.score > 0 ? "+" : "", r.score), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "10px",
        textAlign: "right",
        borderBottom: "1px solid var(--border-default)"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: "auto"
      }
    }, /*#__PURE__*/React.createElement(RatioBar, {
      buyPct: r.buyPct
    }))), /*#__PURE__*/React.createElement("td", {
      className: "ds-numeric",
      style: {
        padding: "10px",
        textAlign: "right",
        color: "var(--text-secondary)",
        borderBottom: "1px solid var(--border-default)"
      }
    }, r.volume));
  })));
}
function LiveRankingPanel({
  rows,
  activeTicker,
  onSelect
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--space-3) var(--space-4)",
      borderBottom: "1px solid var(--border-default)",
      fontSize: "var(--text-xs)",
      fontWeight: 700,
      color: "var(--text-tertiary)"
    }
  }, "\uC2E4\uC2DC\uAC04 \uC2A4\uCF54\uC5B4 \uB7AD\uD0B9"), /*#__PURE__*/React.createElement("div", null, rows.map((r, i) => {
    const active = r.ticker === activeTicker;
    return /*#__PURE__*/React.createElement("div", {
      key: r.ticker,
      onClick: () => onSelect(r.ticker),
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "var(--space-2) var(--space-4)",
        cursor: "pointer",
        background: active ? "var(--bg-surface-raised)" : "transparent",
        borderBottom: i < rows.length - 1 ? "1px solid var(--border-default)" : "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "ds-numeric",
      style: {
        fontSize: "var(--text-2xs)",
        color: "var(--text-tertiary)",
        width: 14
      }
    }, i + 1), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: "var(--text-sm)",
        color: "var(--text-primary)"
      }
    }, r.name)), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "right"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "ds-numeric",
      style: {
        fontSize: "var(--text-sm)",
        color: "var(--text-body)"
      }
    }, r.price.toLocaleString("ko-KR")), /*#__PURE__*/React.createElement("div", {
      className: "ds-numeric",
      style: {
        fontSize: "var(--text-2xs)",
        color: changeColor(r.changePct)
      }
    }, r.changePct > 0 ? "+" : "", r.changePct.toFixed(2), "%")));
  })));
}
function DetailPanel({
  stock
}) {
  if (!stock) return null;
  const top = stock.contributions.slice().sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
  const reason = top ? `${top.name} 기여도 ${top.score > 0 ? "+" : ""}${top.score} — ${scoreLabel(stock.score)} 판단의 핵심 근거` : "";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      padding: "var(--space-4)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-sm)",
      fontWeight: 700,
      color: "var(--text-primary)"
    }
  }, stock.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 8,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-lg)",
      fontWeight: 700,
      color: changeColor(stock.changePct)
    }
  }, stock.price.toLocaleString("ko-KR")), /*#__PURE__*/React.createElement("span", {
    className: "ds-numeric",
    style: {
      fontSize: "var(--text-xs)",
      color: changeColor(stock.changePct)
    }
  }, stock.changePct > 0 ? "+" : "", stock.changePct.toFixed(2), "%"))), /*#__PURE__*/React.createElement(CandleChart, {
    candles: stock.candles,
    mini: true,
    height: 110
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)",
      marginBottom: 6
    }
  }, "\uADFC\uAC70 \uC694\uC57D"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      color: "var(--text-body)",
      lineHeight: "var(--leading-relaxed)"
    }
  }, reason)));
}
function Tab5Screener({
  market,
  watchlist,
  rows,
  stockDetails,
  activeTab: activeTabProp,
  onTabChange
}) {
  const [internalTab, setInternalTab] = React.useState("screener");
  const activeTab = activeTabProp ?? internalTab;
  const setActiveTab = onTabChange ?? setInternalTab;
  const [showSettings, setShowSettings] = React.useState(false);
  const [activeTicker, setActiveTicker] = React.useState(rows[0].ticker);
  const detail = stockDetails[activeTicker];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100%",
      background: "var(--bg-base)",
      fontFamily: "var(--font-body)"
    },
    "data-theme": "dark"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "var(--space-3) var(--space-6)",
      borderBottom: "1px solid var(--border-default)",
      background: "var(--bg-surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 900,
      color: "var(--text-primary)",
      letterSpacing: "var(--tracking-tight)"
    }
  }, "\uB2E8\uAE30\uB9E4\uB9E4 \uC2E0\uD638"), /*#__PURE__*/React.createElement(StockSearchBar, {
    suggestions: watchlist
  })), /*#__PURE__*/React.createElement(window.SettingsGearButton, {
    onClick: () => setShowSettings(true)
  })), /*#__PURE__*/React.createElement(TabNavigation, {
    tabs: TABS,
    activeId: activeTab,
    onChange: setActiveTab
  }), /*#__PURE__*/React.createElement(window.SettingsPanel, {
    open: showSettings,
    onClose: () => setShowSettings(false)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--space-6)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-5)"
    }
  }, /*#__PURE__*/React.createElement(MarketStrip, {
    items: market
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 320px",
      gap: "var(--space-5)",
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      padding: "var(--space-4)",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 700,
      color: "var(--text-tertiary)"
    }
  }, "\uAD00\uC2EC\uC885\uBAA9"), /*#__PURE__*/React.createElement(WatchlistChips, {
    items: rows,
    activeTicker: activeTicker,
    onPick: setActiveTicker
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 700,
      color: "var(--text-tertiary)",
      marginTop: "var(--space-2)"
    }
  }, "\uC2A4\uD06C\uB9AC\uB108 \uC870\uAC74"), /*#__PURE__*/React.createElement(ConditionBuilder, {
    conditions: ["VWAP 상향돌파", "거래량 급증", "RSI 다이버전스"]
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--space-3) var(--space-4)",
      borderBottom: "1px solid var(--border-default)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 700,
      color: "var(--text-tertiary)"
    }
  }, "\uC870\uAC74 \uCDA9\uC871 \uC885\uBAA9 \xB7 ", rows.length, "\uAC1C")), /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: "auto"
    }
  }, /*#__PURE__*/React.createElement(ResultTable, {
    rows: rows,
    activeTicker: activeTicker,
    onSelect: setActiveTicker
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(LiveRankingPanel, {
    rows: rows,
    activeTicker: activeTicker,
    onSelect: setActiveTicker
  }), /*#__PURE__*/React.createElement(DetailPanel, {
    stock: detail
  })))));
}
window.Tab5Screener = Tab5Screener;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/screener-tab/Tab5Screener.jsx", error: String((e && e.message) || e) }); }

// ui_kits/settings-tab/SettingsEntryDemo.jsx
try { (() => {
const {
  TabNavigation,
  StockSearchBar
} = window.Ds_a0b250;

// 탭 바에서 빠진 "설정"의 진입점 데모: 우측 상단 톱니바퀴 아이콘 → 우측 슬라이드 패널.
// 탭 구성(5개)은 실제 매매 동선 순서(종합 신호 → 기술적 분석 → 수급 → 매크로/시장 → 관심종목)와 동일.

const TABS = [{
  id: "overview",
  label: "종합 신호"
}, {
  id: "technical",
  label: "기술적 분석"
}, {
  id: "flow",
  label: "수급"
}, {
  id: "macro",
  label: "매크로/시장"
}, {
  id: "screener",
  label: "관심종목"
}];
function SettingsEntryDemo({
  suggestions
}) {
  const [activeTab, setActiveTab] = React.useState("overview");
  const [showSettings, setShowSettings] = React.useState(true);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100%",
      background: "var(--bg-base)",
      fontFamily: "var(--font-body)"
    },
    "data-theme": "dark"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "var(--space-3) var(--space-6)",
      borderBottom: "1px solid var(--border-default)",
      background: "var(--bg-surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 900,
      color: "var(--text-primary)",
      letterSpacing: "var(--tracking-tight)"
    }
  }, "\uB2E8\uAE30\uB9E4\uB9E4 \uC2E0\uD638"), /*#__PURE__*/React.createElement(StockSearchBar, {
    suggestions: suggestions
  })), /*#__PURE__*/React.createElement(window.SettingsGearButton, {
    onClick: () => setShowSettings(true)
  })), /*#__PURE__*/React.createElement(TabNavigation, {
    tabs: TABS,
    activeId: activeTab,
    onChange: setActiveTab
  }), /*#__PURE__*/React.createElement(window.SettingsPanel, {
    open: showSettings,
    onClose: () => setShowSettings(false)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1440,
      margin: "0 auto",
      padding: "var(--space-10) var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px dashed var(--border-default)",
      borderRadius: "var(--radius-md)",
      padding: "var(--space-10)",
      textAlign: "center",
      color: "var(--text-tertiary)",
      fontSize: "var(--text-sm)"
    }
  }, "\uD0ED \uCF58\uD150\uCE20 \uC790\uB9AC \u2014 \uC6B0\uCE21 \uC0C1\uB2E8 \uD1B1\uB2C8\uBC14\uD034\uB97C \uB20C\uB7EC \uC124\uC815 \uD328\uB110\uC744 \uC5F4\uACE0 \uB2EB\uC544 \uBCF4\uC138\uC694.", /*#__PURE__*/React.createElement("br", null), "\uAC00\uC911\uCE58 \uC2AC\uB77C\uC774\uB354 \xB7 \uD504\uB9AC\uC14B \xB7 \uC9C0\uD45C \uD30C\uB77C\uBBF8\uD130 \xB7 \uC54C\uB9BC \uC784\uACC4\uAC12\uC740 \uAE30\uC874 \"\uD0ED6 \u2014 \uC124\uC815\" \uB0B4\uC6A9 \uADF8\uB300\uB85C\uC785\uB2C8\uB2E4.")));
}
window.SettingsEntryDemo = SettingsEntryDemo;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/settings-tab/SettingsEntryDemo.jsx", error: String((e && e.message) || e) }); }

// ui_kits/technical-tab/Tab2Technical.jsx
try { (() => {
const {
  CandleChart,
  IndicatorTable,
  StockHeader,
  TabNavigation,
  StockSearchBar
} = window.Ds_a0b250;
const TABS = [{
  id: "overview",
  label: "종합 신호"
}, {
  id: "technical",
  label: "기술적 분석"
}, {
  id: "flow",
  label: "수급"
}, {
  id: "macro",
  label: "매크로/시장"
}, {
  id: "screener",
  label: "관심종목"
}];
const TIMEFRAMES = [{
  id: "1m",
  label: "1분"
}, {
  id: "5m",
  label: "5분"
}, {
  id: "1d",
  label: "일봉"
}];
const OSCILLATORS = [{
  id: "rsi",
  label: "RSI(14)"
}, {
  id: "macd",
  label: "MACD"
}, {
  id: "stoch",
  label: "스토캐스틱"
}];
const FULL_TIMEFRAMES = [{
  id: "1m",
  label: "1분"
}, {
  id: "1d",
  label: "일"
}, {
  id: "1w",
  label: "주"
}, {
  id: "1mo",
  label: "월"
}, {
  id: "1y",
  label: "년"
}];
const MA_PERIODS = [{
  period: 5,
  color: "var(--accent-strong)"
}, {
  period: 20,
  color: "var(--status-live)"
}, {
  period: 60,
  color: "var(--signal-sell)"
}, {
  period: 120,
  color: "var(--text-secondary)"
}];
const DRAW_TOOLS = [{
  id: "cursor",
  glyph: "↖"
}, {
  id: "trend",
  glyph: "╱"
}, {
  id: "hline",
  glyph: "—"
}, {
  id: "rect",
  glyph: "▭"
}, {
  id: "ellipse",
  glyph: "◯"
}, {
  id: "text",
  glyph: "T"
}, {
  id: "fib",
  glyph: "≡"
}, {
  id: "eraser",
  glyph: "⌫"
}];

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
  return {
    line,
    signal,
    hist
  };
}
function stochastic(candles, period = 14) {
  const k = [];
  const d = [];
  for (let i = 0; i < candles.length; i++) {
    const from = Math.max(0, i - period + 1);
    const slice = candles.slice(from, i + 1);
    const hi = Math.max(...slice.map(c => c.h));
    const lo = Math.min(...slice.map(c => c.l));
    const kv = hi === lo ? 50 : (candles[i].c - lo) / (hi - lo) * 100;
    k.push(kv);
  }
  for (let i = 0; i < k.length; i++) {
    const from = Math.max(0, i - 2);
    const slice = k.slice(from, i + 1);
    d.push(slice.reduce((s, v) => s + v, 0) / slice.length);
  }
  return {
    k,
    d
  };
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
  return {
    mid,
    upper,
    lower
  };
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
  return i => PLOT_LEFT + (i + 0.5) * (plotW / n);
}
function OverlayToggleChip({
  active,
  label,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
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
      transition: "color var(--duration-fast) var(--ease-standard), background var(--duration-fast) var(--ease-standard)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: active ? "var(--accent)" : "var(--border-strong)"
    }
  }), label);
}
function SegmentedControl({
  items,
  activeId,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "inline-flex",
      background: "var(--bg-inset)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      padding: 2,
      gap: 2
    }
  }, items.map(it => {
    const active = it.id === activeId;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      onClick: () => onChange(it.id),
      style: {
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
        transition: "color var(--duration-fast) var(--ease-standard)"
      }
    }, it.label);
  }));
}
function SectionLabel({
  children,
  right
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-xs)",
      fontWeight: 700,
      color: "var(--text-tertiary)",
      letterSpacing: "var(--tracking-wide)"
    }
  }, children), right);
}

// draws MA / Bollinger overlay lines aligned to CandleChart's internal (non-mini) coordinate space
function ChartOverlaySvg({
  candles,
  height,
  showMa,
  showBoll,
  vbWidth = VB_W
}) {
  const closes = candles.map(c => c.c);
  const n = candles.length;
  const xAt = makeXAt(n, vbWidth);
  const volH = 48;
  const volGap = 8;
  const priceH = height - volH - volGap;
  const padTop = 12;
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);
  const maxP = Math.max(...highs);
  const minP = Math.min(...lows);
  const priceRange = maxP - minP || 1;
  const yAt = p => padTop + (1 - (p - minP) / priceRange) * priceH;
  const ma20 = sma(closes, 20);
  const boll = bollinger(closes, 20);
  const pathFor = series => series.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${vbWidth} ${height}`,
    width: "100%",
    height: height,
    preserveAspectRatio: "none",
    style: {
      position: "absolute",
      top: 0,
      left: 0,
      pointerEvents: "none"
    }
  }, showBoll && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: pathFor(boll.upper),
    fill: "none",
    stroke: "var(--text-tertiary)",
    strokeWidth: "1.5",
    strokeDasharray: "4 3",
    opacity: "0.7"
  }), /*#__PURE__*/React.createElement("path", {
    d: pathFor(boll.lower),
    fill: "none",
    stroke: "var(--text-tertiary)",
    strokeWidth: "1.5",
    strokeDasharray: "4 3",
    opacity: "0.7"
  })), showMa && /*#__PURE__*/React.createElement("path", {
    d: pathFor(ma20),
    fill: "none",
    stroke: "var(--signal-buy-strong)",
    strokeWidth: "1.5",
    opacity: "0.9"
  }));
}
function DrawToolRail({
  activeTool,
  onSelect
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      flexShrink: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "var(--space-1)",
      padding: "var(--space-3) 0",
      borderRight: "1px solid var(--border-default)",
      background: "var(--bg-surface)"
    }
  }, DRAW_TOOLS.map(tool => {
    const active = tool.id === activeTool;
    return /*#__PURE__*/React.createElement("button", {
      key: tool.id,
      onClick: () => onSelect(tool.id),
      title: tool.id,
      style: {
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
        fontSize: "var(--text-md)"
      }
    }, tool.glyph);
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    title: "reset",
    style: {
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
      fontSize: "var(--text-md)"
    }
  }, "\u2302"));
}
function MaLegendChip({
  period,
  color,
  active,
  onClick
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
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
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 2,
      background: color,
      display: "inline-block"
    }
  }), period);
}
const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
function formatCompactNumber(v) {
  if (v >= 1000000) return (v / 1000000).toFixed(2) + "M";
  if (v >= 1000) return Math.round(v / 1000) + "K";
  return Math.round(v).toString();
}

// price + volume in a single coordinated SVG: right-side axis, current-price line,
// high/low callouts, volume subpanel with its own axis + MA line, bottom date ticks
function FullPriceVolumeChart({
  candles,
  mas,
  height,
  vbWidth,
  virtualCount
}) {
  const n = virtualCount || candles.length;
  const plotLeft = 8;
  const plotRight = 64;
  const plotW = vbWidth - plotLeft - plotRight;
  const xAt = i => plotLeft + (i + 0.5) * (plotW / n);
  const cw = plotW / n * 0.6;
  const axisLabelH = 22;
  const gap = 14;
  const volH = Math.max(80, Math.round(height * 0.22));
  const padTop = 10;
  const priceH = height - volH - gap - axisLabelH - padTop;
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);
  const maxP = Math.max(...highs);
  const minP = Math.min(...lows);
  const priceRange = maxP - minP || 1;
  const yAt = p => padTop + (1 - (p - minP) / priceRange) * priceH;
  const volTop = padTop + priceH + gap;
  const maxV = Math.max(...candles.map(c => c.v));
  const vAt = v => volTop + volH - v / maxV * (volH - 4);
  const last = candles[candles.length - 1];
  const first = candles[0];
  const lastUp = last.c >= first.c;
  const lastColor = lastUp ? "var(--signal-buy)" : "var(--signal-sell)";
  const hiIdx = highs.indexOf(maxP);
  const loIdx = lows.indexOf(minP);
  const hiPct = ((maxP - first.c) / first.c * 100).toFixed(2);
  const loPct = ((minP - first.c) / first.c * 100).toFixed(2);
  const volMa = sma(candles.map(c => c.v), 20);
  const tickCount = Math.min(7, n);
  const ticks = Array.from({
    length: tickCount
  }, (_, k) => {
    const idx = Math.min(n - 1, Math.round((k + 0.5) * (n / tickCount)));
    return {
      idx,
      label: MONTH_NAMES[idx % 12]
    };
  });
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${vbWidth} ${height}`,
    width: "100%",
    height: height,
    preserveAspectRatio: "none"
  }, [0, 0.25, 0.5, 0.75, 1].map((f, i) => {
    const y = padTop + f * priceH;
    const price = maxP - f * priceRange;
    return /*#__PURE__*/React.createElement("g", {
      key: "pg" + i
    }, /*#__PURE__*/React.createElement("line", {
      x1: plotLeft,
      y1: y,
      x2: vbWidth - plotRight,
      y2: y,
      stroke: "var(--border-default)",
      strokeWidth: "1",
      opacity: "0.5"
    }), /*#__PURE__*/React.createElement("text", {
      x: vbWidth - plotRight + 8,
      y: y + 4,
      fontSize: "14",
      textAnchor: "start",
      fill: "var(--text-tertiary)",
      fontFamily: "var(--font-numeric)"
    }, Math.round(price).toLocaleString("ko-KR")));
  }), mas.filter(m => m.visible).map(m => {
    const series = sma(candles.map(c => c.c), m.period);
    const path = series.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
    return /*#__PURE__*/React.createElement("path", {
      key: m.period,
      d: path,
      fill: "none",
      stroke: m.color,
      strokeWidth: "1.5",
      opacity: "0.9"
    });
  }), candles.map((c, i) => {
    const isUp = c.c >= c.o;
    const color = isUp ? "var(--signal-buy)" : "var(--signal-sell)";
    const bodyTop = yAt(Math.max(c.o, c.c));
    const bodyBottom = yAt(Math.min(c.o, c.c));
    const x = xAt(i);
    return /*#__PURE__*/React.createElement("g", {
      key: i
    }, /*#__PURE__*/React.createElement("line", {
      x1: x,
      y1: yAt(c.h),
      x2: x,
      y2: yAt(c.l),
      stroke: color,
      strokeWidth: "1.5"
    }), /*#__PURE__*/React.createElement("rect", {
      x: x - cw / 2,
      y: bodyTop,
      width: cw,
      height: Math.max(1.5, bodyBottom - bodyTop),
      fill: color
    }));
  }), /*#__PURE__*/React.createElement("circle", {
    cx: xAt(hiIdx),
    cy: yAt(maxP),
    r: "2.5",
    fill: "var(--signal-buy)"
  }), /*#__PURE__*/React.createElement("text", {
    x: Math.max(plotLeft + 70, Math.min(vbWidth - plotRight - 70, xAt(hiIdx))),
    y: Math.max(padTop + 12, yAt(maxP) - 10),
    fontSize: "14",
    textAnchor: "middle",
    fill: "var(--signal-buy)",
    fontFamily: "var(--font-numeric)",
    fontWeight: "700"
  }, Math.round(maxP).toLocaleString("ko-KR"), "\uC6D0 (", hiPct > 0 ? "+" : "", hiPct, "%)"), /*#__PURE__*/React.createElement("circle", {
    cx: xAt(loIdx),
    cy: yAt(minP),
    r: "2.5",
    fill: "var(--signal-sell)"
  }), /*#__PURE__*/React.createElement("text", {
    x: Math.max(plotLeft + 70, Math.min(vbWidth - plotRight - 70, xAt(loIdx))),
    y: Math.min(padTop + priceH - 4, yAt(minP) + 18),
    fontSize: "14",
    textAnchor: "middle",
    fill: "var(--signal-sell)",
    fontFamily: "var(--font-numeric)",
    fontWeight: "700"
  }, Math.round(minP).toLocaleString("ko-KR"), "\uC6D0 (", loPct > 0 ? "+" : "", loPct, "%)"), /*#__PURE__*/React.createElement("line", {
    x1: plotLeft,
    y1: yAt(last.c),
    x2: vbWidth - plotRight,
    y2: yAt(last.c),
    stroke: lastColor,
    strokeWidth: "1",
    strokeDasharray: "3 3",
    opacity: "0.8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: vbWidth - plotRight,
    y: yAt(last.c) - 11,
    width: plotRight,
    height: "22",
    fill: lastColor
  }), /*#__PURE__*/React.createElement("text", {
    x: vbWidth - plotRight + 8,
    y: yAt(last.c) + 5,
    fontSize: "14",
    fontWeight: "700",
    fill: "var(--text-on-signal)",
    fontFamily: "var(--font-numeric)"
  }, last.c.toLocaleString("ko-KR")), /*#__PURE__*/React.createElement("line", {
    x1: "0",
    y1: volTop - gap / 2,
    x2: vbWidth,
    y2: volTop - gap / 2,
    stroke: "var(--border-default)",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("text", {
    x: plotLeft,
    y: volTop + 12,
    fontSize: "13",
    fill: "var(--text-tertiary)",
    fontFamily: "var(--font-body)"
  }, "\uAC70\uB798\uB7C9 (20)"), [0, 0.5, 1].map((f, i) => {
    const y = volTop + volH - f * (volH - 4);
    const v = maxV * f;
    return /*#__PURE__*/React.createElement("g", {
      key: "vg" + i
    }, /*#__PURE__*/React.createElement("line", {
      x1: plotLeft,
      y1: y,
      x2: vbWidth - plotRight,
      y2: y,
      stroke: "var(--border-default)",
      strokeWidth: "1",
      opacity: "0.35"
    }), /*#__PURE__*/React.createElement("text", {
      x: vbWidth - plotRight + 8,
      y: y + 4,
      fontSize: "13",
      textAnchor: "start",
      fill: "var(--text-tertiary)",
      fontFamily: "var(--font-numeric)"
    }, formatCompactNumber(v)));
  }), candles.map((c, i) => {
    const isUp = c.c >= c.o;
    const color = isUp ? "var(--signal-buy)" : "var(--signal-sell)";
    const x = xAt(i);
    const y = vAt(c.v);
    return /*#__PURE__*/React.createElement("rect", {
      key: "v" + i,
      x: x - cw / 2,
      y: y,
      width: cw,
      height: volTop + volH - y,
      fill: color,
      opacity: "0.6"
    });
  }), /*#__PURE__*/React.createElement("path", {
    d: volMa.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${vAt(v)}`).join(" "),
    fill: "none",
    stroke: "var(--accent)",
    strokeWidth: "1.5",
    opacity: "0.85"
  }), /*#__PURE__*/React.createElement("rect", {
    x: vbWidth - plotRight,
    y: volTop + volH - 11,
    width: plotRight,
    height: "22",
    fill: "var(--bg-inset)",
    stroke: "var(--border-strong)",
    strokeWidth: "1"
  }), /*#__PURE__*/React.createElement("text", {
    x: vbWidth - plotRight + 8,
    y: volTop + volH + 5,
    fontSize: "13",
    fontWeight: "700",
    fill: "var(--text-primary)",
    fontFamily: "var(--font-numeric)"
  }, formatCompactNumber(last.v)), ticks.map((t, i) => /*#__PURE__*/React.createElement("text", {
    key: i,
    x: xAt(t.idx),
    y: height - 6,
    fontSize: "13",
    textAnchor: "middle",
    fill: "var(--text-tertiary)",
    fontFamily: "var(--font-body)"
  }, t.label)));
}
function FullChartView({
  stock,
  timeframe,
  setTimeframe,
  onClose
}) {
  const [mas, setMas] = React.useState(MA_PERIODS.map((m, i) => ({
    ...m,
    visible: i < 2
  })));
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
  const timeframeLabel = (FULL_TIMEFRAMES.find(t => t.id === timeframe) || {}).label || "";
  React.useEffect(() => {
    setVisibleCount(candles.length);
  }, [timeframe, candles.length]);
  const MIN_VISIBLE = 6;
  const MAX_VISIBLE = candles.length * 3;
  const count = Math.min(MAX_VISIBLE, Math.max(MIN_VISIBLE, visibleCount || candles.length));
  const visibleCandles = count <= candles.length ? candles.slice(candles.length - count) : candles;
  const virtualCount = count;
  const handleWheelZoom = e => {
    e.preventDefault();
    const step = Math.max(1, Math.round(count * 0.08));
    setVisibleCount(v => {
      const cur = v || candles.length;
      const next = e.deltaY > 0 ? cur + step : cur - step;
      return Math.min(MAX_VISIBLE, Math.max(MIN_VISIBLE, next));
    });
  };
  const toggleMa = period => {
    setMas(prev => prev.map(m => m.period === period ? {
      ...m,
      visible: !m.visible
    } : m));
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      zIndex: 2000,
      background: "var(--bg-base)",
      display: "flex",
      flexDirection: "column",
      fontFamily: "var(--font-body)"
    },
    "data-theme": "dark"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "var(--space-3) var(--space-4)",
      borderBottom: "1px solid var(--border-default)",
      background: "var(--bg-surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 20,
      height: 20,
      borderRadius: "var(--radius-xs)",
      background: "var(--bg-inset)",
      border: "1px solid var(--border-default)",
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-md)",
      fontWeight: "var(--weight-semibold)",
      color: "var(--text-primary)"
    }
  }, stock.header.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-sm)",
      color: "var(--text-tertiary)"
    }
  }, "\xB7 ", timeframeLabel)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement(SegmentedControl, {
    items: FULL_TIMEFRAMES,
    activeId: timeframe,
    onChange: setTimeframe
  }), /*#__PURE__*/React.createElement("button", {
    style: {
      appearance: "none",
      cursor: "pointer",
      background: "none",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      color: "var(--text-secondary)",
      fontSize: "var(--text-xs)",
      fontWeight: "var(--weight-medium)",
      padding: "var(--space-1) var(--space-3)"
    }
  }, "+ \uBCF4\uC870\uC9C0\uD45C"), /*#__PURE__*/React.createElement("button", {
    style: {
      appearance: "none",
      cursor: "pointer",
      background: "none",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      color: "var(--text-secondary)",
      fontSize: "var(--text-xs)",
      fontWeight: "var(--weight-medium)",
      padding: "var(--space-1) var(--space-3)"
    }
  }, "\uC885\uBAA9\uBE44\uAD50"), /*#__PURE__*/React.createElement("button", {
    style: {
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
      fontSize: "var(--text-sm)"
    }
  }, "\u2699"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      appearance: "none",
      cursor: "pointer",
      background: "none",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-sm)",
      color: "var(--text-secondary)",
      fontSize: "var(--text-xs)",
      fontWeight: "var(--weight-semibold)",
      padding: "var(--space-1) var(--space-3)"
    }
  }, "\u2715 \uC791\uAC8C\uBCF4\uAE30"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flex: 1,
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement(DrawToolRail, {
    activeTool: activeTool,
    onSelect: setActiveTool
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
      minHeight: 0,
      padding: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    ref: chartAreaRef,
    onWheel: handleWheelZoom,
    style: {
      flex: 1,
      minHeight: 0,
      position: "relative",
      cursor: "crosshair"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 4,
      left: 12,
      zIndex: 1,
      display: "flex",
      alignItems: "center",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--text-2xs)",
      color: "var(--text-tertiary)"
    }
  }, "\uC774\uB3D9\uD3C9\uADE0\uC120"), mas.map(m => /*#__PURE__*/React.createElement(MaLegendChip, {
    key: m.period,
    period: m.period,
    color: m.color,
    active: m.visible,
    onClick: () => toggleMa(m.period)
  }))), /*#__PURE__*/React.createElement(FullPriceVolumeChart, {
    candles: visibleCandles,
    mas: mas,
    height: chartHeight,
    vbWidth: chartWidth,
    virtualCount: virtualCount
  })))));
}
function OscillatorPanel({
  candles,
  kind,
  height,
  vbWidth = VB_W
}) {
  const closes = candles.map(c => c.c);
  const n = candles.length;
  const xAt = makeXAt(n, vbWidth);
  const padTop = 6;
  const padBottom = 6;
  const plotH = height - padTop - padBottom;
  if (kind === "rsi") {
    const values = rsi(closes);
    const yAt = v => padTop + (1 - v / 100) * plotH;
    const path = values.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
    const last = values[values.length - 1];
    const lastColor = last >= 70 ? "var(--signal-sell)" : last <= 30 ? "var(--signal-buy)" : "var(--text-tertiary)";
    return /*#__PURE__*/React.createElement("svg", {
      viewBox: `0 0 ${vbWidth} ${height}`,
      width: "100%",
      height: height,
      preserveAspectRatio: "none"
    }, /*#__PURE__*/React.createElement("line", {
      x1: PLOT_LEFT,
      y1: yAt(70),
      x2: vbWidth - PLOT_RIGHT,
      y2: yAt(70),
      stroke: "var(--signal-sell)",
      strokeWidth: "1",
      opacity: "0.35",
      strokeDasharray: "4 3"
    }), /*#__PURE__*/React.createElement("line", {
      x1: PLOT_LEFT,
      y1: yAt(30),
      x2: vbWidth - PLOT_RIGHT,
      y2: yAt(30),
      stroke: "var(--signal-buy)",
      strokeWidth: "1",
      opacity: "0.35",
      strokeDasharray: "4 3"
    }), /*#__PURE__*/React.createElement("path", {
      d: path,
      fill: "none",
      stroke: "var(--accent)",
      strokeWidth: "2"
    }), /*#__PURE__*/React.createElement("text", {
      x: PLOT_LEFT - 8,
      y: yAt(70) + 4,
      fontSize: "18",
      textAnchor: "end",
      fill: "var(--text-tertiary)",
      fontFamily: "var(--font-numeric)"
    }, "70"), /*#__PURE__*/React.createElement("text", {
      x: PLOT_LEFT - 8,
      y: yAt(30) + 4,
      fontSize: "18",
      textAnchor: "end",
      fill: "var(--text-tertiary)",
      fontFamily: "var(--font-numeric)"
    }, "30"), /*#__PURE__*/React.createElement("text", {
      x: vbWidth - PLOT_RIGHT,
      y: padTop + 14,
      fontSize: "20",
      textAnchor: "end",
      fill: lastColor,
      fontWeight: "700",
      fontFamily: "var(--font-numeric)"
    }, last.toFixed(1)));
  }
  if (kind === "macd") {
    const {
      line,
      signal,
      hist
    } = macd(closes);
    const maxAbs = Math.max(...hist.map(v => Math.abs(v)), ...line.map(v => Math.abs(v)), ...signal.map(v => Math.abs(v)), 1);
    const yAt = v => padTop + (1 - (v + maxAbs) / (maxAbs * 2)) * plotH;
    const plotW = vbWidth - PLOT_LEFT - PLOT_RIGHT;
    const barW = plotW / n * 0.5;
    const linePath = line.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
    const signalPath = signal.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
    return /*#__PURE__*/React.createElement("svg", {
      viewBox: `0 0 ${vbWidth} ${height}`,
      width: "100%",
      height: height,
      preserveAspectRatio: "none"
    }, /*#__PURE__*/React.createElement("line", {
      x1: PLOT_LEFT,
      y1: yAt(0),
      x2: vbWidth - PLOT_RIGHT,
      y2: yAt(0),
      stroke: "var(--border-default)",
      strokeWidth: "1"
    }), hist.map((v, i) => /*#__PURE__*/React.createElement("rect", {
      key: i,
      x: xAt(i) - barW / 2,
      y: v >= 0 ? yAt(v) : yAt(0),
      width: barW,
      height: Math.max(1, Math.abs(yAt(v) - yAt(0))),
      fill: v >= 0 ? "var(--signal-buy)" : "var(--signal-sell)",
      opacity: "0.6"
    })), /*#__PURE__*/React.createElement("path", {
      d: linePath,
      fill: "none",
      stroke: "var(--accent)",
      strokeWidth: "2"
    }), /*#__PURE__*/React.createElement("path", {
      d: signalPath,
      fill: "none",
      stroke: "var(--text-tertiary)",
      strokeWidth: "1.5",
      strokeDasharray: "4 3"
    }));
  }

  // stochastic
  const {
    k,
    d
  } = stochastic(candles);
  const yAt = v => padTop + (1 - v / 100) * plotH;
  const kPath = k.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
  const dPath = d.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(v)}`).join(" ");
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${vbWidth} ${height}`,
    width: "100%",
    height: height,
    preserveAspectRatio: "none"
  }, /*#__PURE__*/React.createElement("line", {
    x1: PLOT_LEFT,
    y1: yAt(80),
    x2: vbWidth - PLOT_RIGHT,
    y2: yAt(80),
    stroke: "var(--signal-sell)",
    strokeWidth: "1",
    opacity: "0.35",
    strokeDasharray: "4 3"
  }), /*#__PURE__*/React.createElement("line", {
    x1: PLOT_LEFT,
    y1: yAt(20),
    x2: vbWidth - PLOT_RIGHT,
    y2: yAt(20),
    stroke: "var(--signal-buy)",
    strokeWidth: "1",
    opacity: "0.35",
    strokeDasharray: "4 3"
  }), /*#__PURE__*/React.createElement("path", {
    d: kPath,
    fill: "none",
    stroke: "var(--accent)",
    strokeWidth: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: dPath,
    fill: "none",
    stroke: "var(--text-tertiary)",
    strokeWidth: "1.5",
    strokeDasharray: "4 3"
  }), /*#__PURE__*/React.createElement("text", {
    x: PLOT_LEFT - 8,
    y: yAt(80) + 4,
    fontSize: "18",
    textAnchor: "end",
    fill: "var(--text-tertiary)",
    fontFamily: "var(--font-numeric)"
  }, "80"), /*#__PURE__*/React.createElement("text", {
    x: PLOT_LEFT - 8,
    y: yAt(20) + 4,
    fontSize: "18",
    textAnchor: "end",
    fill: "var(--text-tertiary)",
    fontFamily: "var(--font-numeric)"
  }, "20"));
}
function computeIndicatorRows(candles) {
  const closes = candles.map(c => c.c);
  const lastClose = closes[closes.length - 1];
  const r = rsi(closes);
  const lastRsi = r[r.length - 1];
  const {
    line,
    signal
  } = macd(closes);
  const macdDiff = line[line.length - 1] - signal[signal.length - 1];
  const {
    k,
    d
  } = stochastic(candles);
  const lastK = k[k.length - 1];
  const lastD = d[d.length - 1];
  const ma20 = sma(closes, 20);
  const lastMa20 = ma20[ma20.length - 1];
  const boll = bollinger(closes, 20);
  const lastUpper = boll.upper[boll.upper.length - 1];
  const lastLower = boll.lower[boll.lower.length - 1];
  return [{
    name: "RSI(14)",
    value: lastRsi.toFixed(1),
    signal: lastRsi >= 70 ? "sell" : lastRsi <= 30 ? "buy" : "neutral"
  }, {
    name: "MACD",
    value: macdDiff >= 0 ? `+${macdDiff.toFixed(0)}` : macdDiff.toFixed(0),
    signal: macdDiff > 0 ? "buy" : macdDiff < 0 ? "sell" : "neutral"
  }, {
    name: "스토캐스틱 %K",
    value: lastK.toFixed(1),
    signal: lastK >= 80 ? "sell" : lastK <= 20 ? "buy" : "neutral"
  }, {
    name: "스토캐스틱 %D",
    value: lastD.toFixed(1),
    signal: lastD >= 80 ? "sell" : lastD <= 20 ? "buy" : "neutral"
  }, {
    name: "이동평균(20)",
    value: lastMa20.toLocaleString("ko-KR"),
    signal: lastClose >= lastMa20 ? "buy" : "sell"
  }, {
    name: "볼린저 상단",
    value: Math.round(lastUpper).toLocaleString("ko-KR"),
    signal: lastClose >= lastUpper ? "sell" : "neutral"
  }, {
    name: "볼린저 하단",
    value: Math.round(lastLower).toLocaleString("ko-KR"),
    signal: lastClose <= lastLower ? "buy" : "neutral"
  }];
}
function Tab2Technical({
  stock,
  onSelectStock,
  suggestions,
  activeTab: activeTabProp,
  onTabChange
}) {
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
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100%",
      background: "var(--bg-base)",
      fontFamily: "var(--font-body)"
    },
    "data-theme": "dark"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "var(--space-3) var(--space-6)",
      borderBottom: "1px solid var(--border-default)",
      background: "var(--bg-surface)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-6)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--text-md)",
      fontWeight: 900,
      color: "var(--text-primary)",
      letterSpacing: "var(--tracking-tight)"
    }
  }, "\uB2E8\uAE30\uB9E4\uB9E4 \uC2E0\uD638"), /*#__PURE__*/React.createElement(StockSearchBar, {
    suggestions: suggestions,
    onSelect: onSelectStock
  })), /*#__PURE__*/React.createElement(window.SettingsGearButton, {
    onClick: () => setShowSettings(true)
  })), /*#__PURE__*/React.createElement(TabNavigation, {
    tabs: TABS,
    activeId: activeTab,
    onChange: setActiveTab
  }), /*#__PURE__*/React.createElement(window.SettingsPanel, {
    open: showSettings,
    onClose: () => setShowSettings(false)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1440,
      margin: "0 auto",
      padding: "var(--space-4) var(--space-6) var(--space-12)",
      display: "grid",
      gridTemplateColumns: "1fr 320px",
      gap: "var(--space-4)",
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      boxShadow: "var(--shadow-xs)",
      padding: "var(--space-3) var(--space-5)"
    }
  }, /*#__PURE__*/React.createElement(StockHeader, stock.header)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      padding: "var(--space-3) var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(SegmentedControl, {
    items: TIMEFRAMES,
    activeId: timeframe,
    onChange: setTimeframe
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-2)"
    }
  }, /*#__PURE__*/React.createElement(OverlayToggleChip, {
    active: showMa,
    label: "\uC774\uB3D9\uD3C9\uADE0\uC120",
    onClick: () => setShowMa(v => !v)
  }), /*#__PURE__*/React.createElement(OverlayToggleChip, {
    active: showVwap,
    label: "VWAP",
    onClick: () => setShowVwap(v => !v)
  }), /*#__PURE__*/React.createElement(OverlayToggleChip, {
    active: showBoll,
    label: "\uBCFC\uB9B0\uC800\uBC34\uB4DC",
    onClick: () => setShowBoll(v => !v)
  }), /*#__PURE__*/React.createElement(OverlayToggleChip, {
    active: showVolume,
    label: "\uAC70\uB798\uB7C9",
    onClick: () => setShowVolume(v => !v)
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setFullChartOpen(true),
    style: {
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
      whiteSpace: "nowrap"
    }
  }, "\u2922 \uCC28\uD2B8 \uD06C\uAC8C \uBCF4\uAE30"))), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      padding: "var(--space-3) var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement(CandleChart, {
    candles: candles,
    showVolume: showVolume,
    showVwap: showVwap,
    height: chartHeight
  }), /*#__PURE__*/React.createElement(ChartOverlaySvg, {
    candles: candles,
    height: chartHeight,
    showMa: showMa,
    showBoll: showBoll
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 1,
      background: "var(--border-default)",
      margin: "var(--space-3) 0"
    }
  }), /*#__PURE__*/React.createElement(SectionLabel, {
    right: /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)"
      }
    }, /*#__PURE__*/React.createElement(SegmentedControl, {
      items: OSCILLATORS,
      activeId: oscKind,
      onChange: setOscKind
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => setOscOpen(v => !v),
      style: {
        appearance: "none",
        cursor: "pointer",
        background: "none",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xs)",
        color: "var(--text-tertiary)",
        fontSize: "var(--text-2xs)",
        fontWeight: 700,
        padding: "var(--space-1) var(--space-2)"
      }
    }, oscOpen ? "접기" : "펼치기"))
  }, "\uC624\uC2E4\uB808\uC774\uD130"), oscOpen && /*#__PURE__*/React.createElement(OscillatorPanel, {
    candles: candles,
    kind: oscKind,
    height: oscHeight
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-3)",
      position: "sticky",
      top: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      borderRadius: "var(--radius-md)",
      padding: "var(--space-4)"
    }
  }, /*#__PURE__*/React.createElement(SectionLabel, null, "\uC9C0\uD45C \uD604\uC7AC\uAC12 \xB7 \uC2E0\uD638"), /*#__PURE__*/React.createElement(IndicatorTable, {
    rows: rows,
    dense: true
  })))), fullChartOpen && /*#__PURE__*/React.createElement(FullChartView, {
    stock: stock,
    timeframe: fullTimeframe,
    setTimeframe: setFullTimeframe,
    onClose: () => setFullChartOpen(false)
  }));
}
window.Tab2Technical = Tab2Technical;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/technical-tab/Tab2Technical.jsx", error: String((e && e.message) || e) }); }

__ds_ns.CandleChart = __ds_scope.CandleChart;

__ds_ns.ContributionBar = __ds_scope.ContributionBar;

__ds_ns.DirectionGauge = __ds_scope.DirectionGauge;

__ds_ns.IndicatorTable = __ds_scope.IndicatorTable;

__ds_ns.StockHeader = __ds_scope.StockHeader;

__ds_ns.StockSearchBar = __ds_scope.StockSearchBar;

__ds_ns.TabNavigation = __ds_scope.TabNavigation;

})();
