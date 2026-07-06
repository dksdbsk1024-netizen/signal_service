export interface Candle {
  /** X축 라벨 (시간 또는 날짜 문자열) */
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/**
 */
export interface CandleChartProps {
  /** OHLCV 캔들 배열. 생략 시 데모 데이터 사용. */
  candles?: Candle[];
  /** 하단 거래량 바 표시 여부. */
  showVolume?: boolean;
  /** VWAP 오버레이 라인 표시 여부. */
  showVwap?: boolean;
  /** true면 탭1의 축소판 모드 — 축 라벨·범례 숨김, 얇은 여백. */
  mini?: boolean;
  /** 차트 전체 높이(px). */
  height?: number;
  /** SVG 뷰박스 너비를 렌더링 컨테이너의 실측 픽셀 너비로 지정 — x/y 스케일을 1:1로 맞춰 비율 왜곡을 방지. 생략 시 기본값(1000, 레거시 동작) 사용. */
  vbWidth?: number;
}
