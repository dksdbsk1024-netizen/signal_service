/**
 */
export interface DirectionGaugeProps {
  /** 최종 스코어. -100(적극매도) ~ 100(적극매수). */
  score: number;
  /** 게이지 크기. lg는 탭1 히어로용, sm은 리스트/카드 내 압축 표시용. */
  size?: "lg" | "md" | "sm";
  /** 스코어 아래 5단계 라벨(적극매수 등)을 표시할지 여부. */
  showScoreLabel?: boolean;
  /** 라벨 아래 보조 텍스트(예: 갱신 시각). */
  subtitle?: string;
}
