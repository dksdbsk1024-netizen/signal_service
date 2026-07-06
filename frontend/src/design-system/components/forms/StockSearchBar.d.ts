export interface StockSuggestion {
  name: string;
  ticker: string;
}

/**
 */
export interface StockSearchBarProps {
  placeholder?: string;
  /** 자동완성 후보 목록. */
  suggestions?: StockSuggestion[];
  onSelect?: (s: StockSuggestion) => void;
}
