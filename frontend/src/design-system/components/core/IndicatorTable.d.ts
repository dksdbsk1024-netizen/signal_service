export interface IndicatorRow {
  /** 지표명 (예: RSI(14), MACD) */
  name: string;
  /** 현재값 표시 문자열 */
  value: string;
  /** 신호 상태 */
  signal: "buy" | "sell" | "neutral";
}

/**
 */
export interface IndicatorTableProps {
  rows: IndicatorRow[];
  /** true면 행 패딩을 좁혀 고밀도 화면(탭2)에 사용. */
  dense?: boolean;
}
