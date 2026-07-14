// 카테고리 가중치 — 설정 패널이 조절하고 탭1이 API 로 보낸다.
//
// 저장하는 값은 슬라이더 raw 값(각 0~100)이지 합 100 으로 정규화한 값이 아니다.
// 백엔드 score_stock 이 어차피 total_w 로 나눠 정규화하므로 비율만 같으면 점수도 같고,
// raw 를 그대로 두면 슬라이더를 하나 움직일 때 나머지 슬라이더가 따라 튀지 않는다.
// 화면에 보이는 % 는 normalizeWeights 로 계산한다.

export const CATEGORIES = ["flow", "trend", "momentum", "volume", "volatility"];

// backend/core/config.py DEFAULT_WEIGHTS 와 같은 값이어야 한다 — 다르면
// "아무것도 안 건드렸는데 점수가 달라진다"가 된다(수집기가 구운 기준선과 어긋난다).
export const DEFAULT_WEIGHTS = {
  flow: 30,
  trend: 20,
  momentum: 20,
  volume: 15,
  volatility: 15,
};

const STORAGE_KEY = "signal_service.weights.v1";

export function loadWeights() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // 키를 전부 검사한다 — 빠진 카테고리를 그대로 보내면 백엔드가 400 을 던진다.
    if (saved && CATEGORIES.every((k) => typeof saved[k] === "number")) {
      return saved;
    }
  } catch {
    // 손상된 값 → 기본값으로. 설정 하나 때문에 앱이 죽지 않는다.
  }
  return DEFAULT_WEIGHTS;
}

export function saveWeights(weights) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(weights));
  } catch {
    // 사파리 프라이빗 모드 등 — 저장만 실패하고 이번 세션 동작은 유지한다.
  }
}

// 표시용 합-100 백분율. 최대잉여법이라 반올림 오차가 나도 합이 정확히 100 이다.
export function normalizeWeights(raw) {
  const sum = CATEGORIES.reduce((s, k) => s + (raw[k] || 0), 0) || 1;
  const exact = CATEGORIES.map((k) => ((raw[k] || 0) / sum) * 100);
  const floors = exact.map(Math.floor);
  let remainder = 100 - floors.reduce((s, v) => s + v, 0);

  const order = exact
    .map((v, i) => ({ i, frac: v - floors[i] }))
    .sort((a, b) => b.frac - a.frac);

  const out = {};
  const result = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    result[i] += 1;
    remainder -= 1;
  }
  CATEGORIES.forEach((k, i) => (out[k] = result[i]));
  return out;
}
