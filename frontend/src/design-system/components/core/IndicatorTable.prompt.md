지표명·현재값·신호(매수/매도/중립)를 나열하는 테이블. 탭2(기술적 분석) 하단에 주로 쓰인다.

```jsx
<IndicatorTable
  rows={[
    { name: "RSI(14)", value: "68.2", signal: "buy" },
    { name: "MACD", value: "+124", signal: "buy" },
    { name: "스토캐스틱", value: "42.1", signal: "neutral" },
  ]}
/>
```

- `dense`로 행 패딩을 좁혀 차트와 나란히 배치할 때 사용.
