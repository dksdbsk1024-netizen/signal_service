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
    const mm = String((i % 6) * 10).padStart(2, "0");
    out.push({ t: `${hh}:${mm}`, o, h, l, c, v });
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
    out.push({ t: String(i), o, h, l, c, v });
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
  return { dates, foreign, institution };
}

function genProgram(points, amp) {
  const net = [];
  for (let i = 0; i < points; i++) {
    net.push(Math.round((Math.sin(i * 0.4) * 0.5 + (Math.random() - 0.5)) * amp));
  }
  return { net };
}

function genOrderBook(base, tick, qtyAmp) {
  const asks = [];
  const bids = [];
  for (let i = 1; i <= 10; i++) {
    asks.push({ price: base + tick * i, qty: Math.round(qtyAmp * (0.3 + Math.random()) * (1 - i * 0.04)) });
    bids.push({ price: base - tick * i, qty: Math.round(qtyAmp * (0.3 + Math.random()) * (1 - i * 0.04)) });
  }
  return { asks, bids };
}

function genBrokers(names, buyAmp) {
  return names.map((name) => {
    const buy = Math.round(buyAmp * (0.3 + Math.random()));
    const sell = Math.round(buyAmp * (0.3 + Math.random()));
    return { name, buy, sell, net: buy - sell };
  });
}

const BROKER_NAMES = ["미래에셋", "키움증권", "NH투자", "삼성증권", "한국투자", "메릴린치", "모건스탠리", "골드만삭스"];

window.APP_SHELL_STOCKS = {
  "005930": {
    header: { name: "삼성전자", ticker: "005930", price: 71300, changePct: 1.8, changeAmt: 1250, volume: "12.4M", marketCap: "425.7조", marketStatus: "open" },
    score: 62,
    updatedAt: "09:32",
    contributions: [
      { name: "수급", score: 18, weight: 30 },
      { name: "모멘텀", score: 11, weight: 25 },
      { name: "추세", score: 6, weight: 20 },
      { name: "변동성", score: -9, weight: 15 },
      { name: "거래량", score: -3, weight: 10 },
    ],
    candles: genCandlesSimple(71000),
    history: [
      { time: "09:00", signal: "중립" },
      { time: "09:40", signal: "매수" },
      { time: "10:20", signal: "적극매수" },
    ],
    reason: {
      timestamp: "17분 전",
      headline: "수급 기여도 +18로 상승 전환",
      body: "외국인 순매수가 전일 대비 강해지며 수급 지표가 가장 크게 기여했습니다. 모멘텀(+11)과 추세(+6)도 함께 개선되며 적극매수 구간에 진입했습니다.",
    },
    news: [
      { tag: "공시", headline: "삼성전자, 3분기 실적 컨센서스 상회 전망", timestamp: "21분 전" },
      { tag: "속보", headline: "외국인 순매수 5거래일 연속 지속", timestamp: "48분 전" },
    ],
    alerts: [
      { kind: "buy", text: "스코어 +60 돌파 — 적극매수 전환", timestamp: "10:20" },
      { kind: "neutral", text: "거래량 급증 감지 (평균 대비 +180%)", timestamp: "09:52" },
      { kind: "buy", text: "VWAP 상향 돌파", timestamp: "09:41" },
    ],
    community: [
      { author: "장투는옳다", role: "주주", text: "수급 들어오는거 보니 오늘 갭 더 갈듯", timestamp: "3분 전" },
      { author: "무주고민중", role: "관망", text: "외국인 순매수 언제까지 이어질지 지켜봐야", timestamp: "8분 전" },
      { author: "삼전20년째", role: "주주", text: "적극매수 뜨면 항상 조정 왔었는데 이번엔 다르길", timestamp: "15분 전" },
    ],
    candlesByTimeframe: {
      "1m": genCandlesTF(71000, 60, 40000),
      "5m": genCandlesTF(70600, 48, 90000),
      "1d": genCandlesTF(68200, 30, 400000),
      "1w": genCandlesTF(60500, 52, 900000),
      "1mo": genCandlesTF(55000, 36, 2500000),
      "1y": genCandlesTF(42000, 10, 8000000),
    },
    flow: {
      netBuy: genNetBuy(20, 320, 210),
      program: genProgram(24, 180),
      strength: 132.4,
      orderBook: genOrderBook(71300, 100, 42000),
      brokers: genBrokers(BROKER_NAMES, 8500000000),
    },
    risk: { atr: 1480 },
  },
  "000660": {
    header: { name: "SK하이닉스", ticker: "000660", price: 218500, changePct: -2.6, changeAmt: -5800, volume: "3.2M", marketCap: "159.1조", marketStatus: "open" },
    score: -41,
    updatedAt: "09:32",
    contributions: [
      { name: "수급", score: -14, weight: 30 },
      { name: "모멘텀", score: -10, weight: 25 },
      { name: "추세", score: -8, weight: 20 },
      { name: "변동성", score: -6, weight: 15 },
      { name: "거래량", score: 4, weight: 10 },
    ],
    candles: genCandlesSimple(220000),
    history: [
      { time: "09:00", signal: "매수" },
      { time: "09:30", signal: "중립" },
      { time: "10:10", signal: "매도" },
    ],
    reason: {
      timestamp: "9분 전",
      headline: "수급·모멘텀 동반 약화로 매도 전환",
      body: "외국인·기관 동반 순매도가 이어지며 수급 기여도가 -14까지 하락했습니다. 단기 추세선 이탈도 함께 확인되어 매도 구간으로 전환됐습니다.",
    },
    news: [{ tag: "속보", headline: "메모리 반도체 가격 하락 우려 재부각", timestamp: "12분 전" }],
    alerts: [
      { kind: "sell", text: "스코어 -40 이탈 — 매도 전환", timestamp: "10:10" },
      { kind: "sell", text: "추세선(20일) 하향 이탈", timestamp: "09:35" },
    ],
    community: [
      { author: "메모리사이클", role: "관망", text: "가격 하락 기사에 너무 민감하게 반응하는듯", timestamp: "5분 전" },
      { author: "하이닉스홀더", role: "주주", text: "손절 라인 잡아놨는데 여기서 버텨야하나", timestamp: "11분 전" },
    ],
    candlesByTimeframe: {
      "1m": genCandlesTF(219500, 60, 20000),
      "5m": genCandlesTF(222000, 48, 45000),
      "1d": genCandlesTF(230000, 30, 180000),
      "1w": genCandlesTF(205000, 52, 400000),
      "1mo": genCandlesTF(180000, 36, 1100000),
      "1y": genCandlesTF(140000, 10, 3600000),
    },
    flow: {
      netBuy: genNetBuy(20, 260, 340),
      program: genProgram(24, 140),
      strength: 78.6,
      orderBook: genOrderBook(218500, 500, 9000),
      brokers: genBrokers(BROKER_NAMES, 6200000000),
    },
    risk: { atr: 5200 },
  },
  "373220": {
    header: { name: "LG에너지솔루션", ticker: "373220", price: 412000, changePct: 0.1, changeAmt: 500, volume: "1.1M", marketCap: "96.4조", marketStatus: "after" },
    score: 3,
    updatedAt: "09:31",
    contributions: [
      { name: "수급", score: 2, weight: 30 },
      { name: "모멘텀", score: -1, weight: 25 },
      { name: "추세", score: 1, weight: 20 },
      { name: "변동성", score: 0, weight: 15 },
      { name: "거래량", score: -2, weight: 10 },
    ],
    candles: genCandlesSimple(412000),
    history: [
      { time: "09:00", signal: "중립" },
      { time: "09:50", signal: "중립" },
      { time: "10:20", signal: "중립" },
    ],
    reason: {
      timestamp: "31분 전",
      headline: "지표 간 방향 혼재로 중립 유지",
      body: "수급(+2)과 추세(+1)는 소폭 개선됐지만 모멘텀(-1)·거래량(-2)이 상쇄하며 뚜렷한 방향성이 나타나지 않고 있습니다.",
    },
    news: [{ tag: "공시", headline: "미국 신규 배터리 공장 착공 발표", timestamp: "1시간 전" }],
    alerts: [{ kind: "neutral", text: "스코어 중립 구간(-20~20) 3시간째 유지", timestamp: "10:20" }],
    community: [{ author: "배터리아저씨", role: "주주", text: "미국 공장 소식 나쁘지 않은데 왜 안 움직이지", timestamp: "20분 전" }],
    candlesByTimeframe: {
      "1m": genCandlesTF(411500, 60, 8000),
      "5m": genCandlesTF(410800, 48, 18000),
      "1d": genCandlesTF(408000, 30, 70000),
      "1w": genCandlesTF(390000, 52, 150000),
      "1mo": genCandlesTF(350000, 36, 420000),
      "1y": genCandlesTF(300000, 10, 1200000),
    },
    flow: {
      netBuy: genNetBuy(20, 90, 60),
      program: genProgram(24, 40),
      strength: 101.2,
      orderBook: genOrderBook(412000, 1000, 2200),
      brokers: genBrokers(BROKER_NAMES, 1800000000),
    },
    risk: { atr: 9100 },
  },
};

window.APP_SHELL_SUGGESTIONS = [
  { name: "삼성전자", ticker: "005930" },
  { name: "SK하이닉스", ticker: "000660" },
  { name: "LG에너지솔루션", ticker: "373220" },
];

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
    out.push({ t: `${i}`, o, h, l, c, v });
    price = c;
  }
  return out;
}

function seriesScreener(base, n, vol) {
  const out = [base];
  for (let i = 1; i < n; i++) out.push(out[i - 1] + (Math.random() - 0.45) * vol);
  return out;
}

window.APP_SHELL_MARKET = [
  { label: "코스피", value: "2,847.31", changePct: 1.12, series: seriesScreener(2800, 20, 8) },
  { label: "코스닥", value: "853.55", changePct: -1.71, series: seriesScreener(870, 20, 4) },
  { label: "원/달러", value: "1,352.40", changePct: -0.28, series: seriesScreener(1355, 20, 2) },
  { label: "거래대금", value: "18.4조", changePct: 0.6, series: seriesScreener(17, 20, 1) },
];

window.APP_SHELL_ROWS = [
  { ticker: "000660", name: "SK하이닉스", price: 244100, changePct: 0.65, score: 71, buyPct: 67, volume: "1,234억" },
  { ticker: "005930", name: "삼성전자", price: 320000, changePct: 3.39, score: 58, buyPct: 61, volume: "905억" },
  { ticker: "006400", name: "삼성SDI", price: 214500, changePct: 6.72, score: 64, buyPct: 58, volume: "298억" },
  { ticker: "010130", name: "고려아연", price: 745000, changePct: -0.19, score: -8, buyPct: 48, volume: "244억" },
  { ticker: "096770", name: "SK이노베이션", price: 118900, changePct: 11.22, score: 82, buyPct: 71, volume: "199억" },
  { ticker: "247540", name: "에코프로비엠", price: 165600, changePct: 4.21, score: 39, buyPct: 59, volume: "211억" },
  { ticker: "066570", name: "LG전자", price: 94400, changePct: -2.26, score: -34, buyPct: 38, volume: "150억" },
  { ticker: "003670", name: "포스코퓨처엠", price: 231400, changePct: -3.05, score: -52, buyPct: 31, volume: "132억" },
  { ticker: "035420", name: "NAVER", price: 189500, changePct: 0.42, score: 6, buyPct: 51, volume: "121억" },
  { ticker: "051910", name: "LG화학", price: 302500, changePct: 1.85, score: 24, buyPct: 55, volume: "98억" },
];

const CONTRIB_BY_TICKER = {
  "000660": [{ name: "수급", score: 28 }, { name: "모멘텀", score: 18 }, { name: "추세", score: 12 }, { name: "변동성", score: -5 }],
  "005930": [{ name: "모멘텀", score: 22 }, { name: "수급", score: 19 }, { name: "추세", score: 10 }, { name: "거래량", score: 4 }],
  "006400": [{ name: "수급", score: 24 }, { name: "추세", score: 15 }, { name: "모멘텀", score: 11 }, { name: "변동성", score: -8 }],
  "010130": [{ name: "변동성", score: -12 }, { name: "모멘텀", score: -6 }, { name: "수급", score: 3 }, { name: "추세", score: -2 }],
  "096770": [{ name: "거래량", score: 31 }, { name: "수급", score: 27 }, { name: "모멘텀", score: 20 }, { name: "추세", score: 9 }],
  "247540": [{ name: "모멘텀", score: 16 }, { name: "수급", score: 12 }, { name: "추세", score: 8 }, { name: "변동성", score: -6 }],
  "066570": [{ name: "수급", score: -20 }, { name: "추세", score: -14 }, { name: "모멘텀", score: -9 }, { name: "거래량", score: 2 }],
  "003670": [{ name: "수급", score: -28 }, { name: "모멘텀", score: -18 }, { name: "추세", score: -15 }, { name: "변동성", score: -6 }],
  "035420": [{ name: "추세", score: 5 }, { name: "수급", score: 3 }, { name: "모멘텀", score: -2 }, { name: "변동성", score: 1 }],
  "051910": [{ name: "모멘텀", score: 13 }, { name: "수급", score: 9 }, { name: "추세", score: 6 }, { name: "거래량", score: -3 }],
};

window.APP_SHELL_STOCK_DETAILS = Object.fromEntries(
  window.APP_SHELL_ROWS.map((r) => [
    r.ticker,
    {
      name: r.name,
      price: r.price,
      changePct: r.changePct,
      score: r.score,
      candles: genCandlesScreener(r.price),
      contributions: CONTRIB_BY_TICKER[r.ticker],
    },
  ])
);

window.APP_SHELL_WATCHLIST = window.APP_SHELL_ROWS.map((r) => ({ name: r.name, ticker: r.ticker }));

// ---- 탭6 매크로/시장 데이터 ----
window.APP_SHELL_MACRO = {
  phase: { score: 34, asOf: "09:31 실시간" },
  domesticIndices: [
    { label: "코스피", value: "2,847.31", changePct: 1.12, advancers: 612, decliners: 288, series: seriesScreener(2800, 20, 8) },
    { label: "코스닥", value: "853.55", changePct: -0.42, advancers: 410, decliners: 520, series: seriesScreener(870, 20, 4) },
  ],
  overseas: {
    asOf: "07/05 05:10 · 미 증시 마감 기준",
    items: [
      { label: "S&P500", value: "6,142.8", changePct: 0.58 },
      { label: "나스닥", value: "20,015.3", changePct: 0.91 },
      { label: "코스피200 야간선물", value: "+0.35%", changePct: 0.35 },
    ],
  },
  fxRates: {
    asOf: "09:31 실시간",
    items: [
      { label: "원/달러", value: "1,352.40", changePct: -0.28, changeLabel: "-0.28%" },
      { label: "국고채 3년", value: "3.02%", changePct: -0.3, changeLabel: "-3bp" },
      { label: "미국채 10년", value: "4.28%", changePct: 0.7, changeLabel: "+2bp" },
    ],
  },
  flow: { asOf: "09:31 실시간", foreignNet: 3180, instNet: -540 },
  volatility: { asOf: "전일 마감 기준", vix: 14.2, vixChangePct: -3.1, fearGreed: 58 },
  sectors: [
    { name: "반도체", changePct: 2.8 },
    { name: "2차전지", changePct: -1.4 },
    { name: "바이오", changePct: 0.6 },
    { name: "자동차", changePct: 1.1 },
    { name: "인터넷", changePct: -2.3 },
    { name: "조선", changePct: 3.4 },
    { name: "철강", changePct: -0.8 },
    { name: "화학", changePct: 0.2 },
    { name: "은행", changePct: 1.6 },
    { name: "증권", changePct: -1.9 },
    { name: "유통", changePct: 0.4 },
    { name: "건설", changePct: -2.7 },
  ],
  calendar: {
    year: 2026,
    month: 7,
    today: 6,
    events: [
      { week: "7월 2주차", day: 6, weekday: "월", country: "US", title: "ISM 서비스업 구매관리자지수 발표", time: "오후 11시 발표 예정" },
      { week: "7월 2주차", day: 9, weekday: "목", country: "US", title: "기존주택 매매건수 발표", time: "오후 11시 발표 예정" },
      { week: "7월 2주차", day: 9, weekday: "목", country: "US", title: "주간 신규실업수당 청구건수 발표", time: "오후 9시 30분 발표 예정" },
      { week: "7월 3주차", day: 14, weekday: "화", country: "US", title: "근원 소비자물가지수 발표(전월 대비)", time: "오후 9시 30분 발표 예정" },
      { week: "7월 3주차", day: 14, weekday: "화", country: "US", title: "소비자물가지수(CPI) 발표(전년 대비)", time: "오후 9시 30분 발표 예정" },
      { week: "7월 3주차", day: 15, weekday: "수", country: "US", title: "생산자물가지수(PPI) 발표(전월 대비)", time: "오후 9시 30분 발표 예정" },
      { week: "7월 3주차", day: 15, weekday: "수", country: "US", title: "존슨 앤 존슨 실적발표", time: "오후 9시 이후" },
      { week: "7월 3주차", day: 16, weekday: "목", country: "US", title: "근원 소매판매 발표(전월 대비)", time: "오후 9시 30분 발표 예정" },
      { week: "7월 3주차", day: 16, weekday: "목", country: "KR", title: "한국은행 금융통화위원회", time: "오전 9시 예정" },
    ],
  },
  // ---- 경제지표 카드 그리드 (섹션 A) — 실제치/예상치/이전치 + 서프라이즈 ----
  economicIndicators: [
    { name: "소비자물가지수(CPI)", period: "6월 · 전년동월대비", country: "KR", unit: "%", decimals: 1, actual: 2.3, forecast: 2.1, prior: 2.0, asOf: "07/02 발표", trend: [1.6, 1.7, 1.9, 2.0, 2.0, 2.3] },
    { name: "근원 CPI", period: "6월 · 전년동월대비", country: "KR", unit: "%", decimals: 1, actual: 2.0, forecast: 2.0, prior: 1.9, asOf: "07/02 발표", trend: [1.7, 1.8, 1.8, 1.9, 1.9, 2.0] },
    { name: "생산자물가지수(PPI)", period: "6월 · 전월대비", country: "KR", unit: "%", decimals: 1, actual: 0.3, forecast: 0.1, prior: -0.1, asOf: "07/03 발표", trend: [-0.3, -0.2, -0.1, -0.1, -0.1, 0.3] },
    { name: "기준금리", period: "7월 금통위", country: "KR", unit: "%", decimals: 2, actual: 2.5, forecast: 2.5, prior: 2.5, asOf: "07/16 예정", trend: [2.75, 2.75, 2.5, 2.5, 2.5, 2.5] },
    { name: "실업률", period: "6월", country: "KR", unit: "%", decimals: 1, actual: 2.8, forecast: 2.9, prior: 2.9, asOf: "07/09 발표", trend: [3.1, 3.0, 2.9, 2.9, 2.9, 2.8] },
    { name: "소비자물가지수(CPI)", period: "6월 · 전년동월대비", country: "US", unit: "%", decimals: 1, actual: 3.1, forecast: 2.9, prior: 2.8, asOf: "07/14 예정", trend: [2.4, 2.5, 2.6, 2.7, 2.8, 3.1] },
    { name: "근원 CPI", period: "6월 · 전년동월대비", country: "US", unit: "%", decimals: 1, actual: 3.4, forecast: 3.3, prior: 3.3, asOf: "07/14 예정", trend: [3.2, 3.3, 3.3, 3.3, 3.3, 3.4] },
    { name: "생산자물가지수(PPI)", period: "6월 · 전월대비", country: "US", unit: "%", decimals: 1, actual: 0.4, forecast: 0.2, prior: 0.1, asOf: "07/15 예정", trend: [0.0, 0.1, 0.1, 0.1, 0.1, 0.4] },
    { name: "기준금리(FOMC 상단)", period: "6월 FOMC", country: "US", unit: "%", decimals: 2, actual: 5.5, forecast: 5.5, prior: 5.5, asOf: "06/18 발표", trend: [5.5, 5.5, 5.5, 5.5, 5.5, 5.5] },
    { name: "ISM 제조업 PMI", period: "6월", country: "US", unit: "pt", decimals: 1, actual: 48.5, forecast: 49.0, prior: 48.7, asOf: "07/01 발표", trend: [49.5, 49.2, 48.9, 48.8, 48.7, 48.5] },
  ],
};
