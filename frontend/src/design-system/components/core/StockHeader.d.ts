/**
 */
export interface StockHeaderProps {
  /** 종목명 (예: 삼성전자) */
  name: string;
  /** 종목 코드 (예: 005930) */
  ticker: string;
  /** 현재가 */
  price: number;
  /** 등락률(%). 양수=상승(빨강), 음수=하락(파랑), 0=중립(회색). */
  changePct: number;
  /** 등락 금액. 생략 가능. */
  changeAmt?: number;
  /** 거래량 표시 문자열 (예: "12.4M") */
  volume: string;
  /** 시가총액 표시 문자열. 생략 시 해당 컬럼 숨김. */
  marketCap?: string;
  /** 장 상태 배지. */
  marketStatus?: "open" | "closed" | "after";
}
