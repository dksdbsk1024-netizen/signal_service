export interface ContributionBarItem {
  /** 지표명 (예: 수급, 모멘텀, 변동성) */
  name: string;
  /** 기여 점수. 양수=매수 기여(빨강), 음수=매도 기여(파랑). */
  score: number;
  /** 가중치(%). 있으면 우측에 함께 표시. */
  weight?: number;
}

/**
 */
export interface ContributionBarProps {
  items: ContributionBarItem[];
  /** 막대 스케일 기준값. 생략 시 items 중 최대 절대값(최소 10) 자동 계산. */
  maxAbs?: number;
  /** true면 행 높이/간격을 좁혀 탭2·3 등 고밀도 화면에 사용. */
  dense?: boolean;
}
