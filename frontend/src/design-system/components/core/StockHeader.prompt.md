모든 종목 화면 최상단에 고정되는 요약 스트립. 현재가·등락률·거래량·시가총액과 장 상태 배지를 보여준다.

```jsx
<StockHeader
  name="삼성전자"
  ticker="005930"
  price={71300}
  changePct={1.8}
  changeAmt={1250}
  volume="12.4M"
  marketCap="425.7조"
  marketStatus="open"
/>
```

- 등락 색상은 국내 관습 고정: 상승=빨강, 하락=파랑, 보합=회색.
- `marketStatus`는 장중/장마감/시간외 배지로 데이터 신선도를 알려준다.
