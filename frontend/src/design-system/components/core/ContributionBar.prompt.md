지표별 기여 점수를 중앙 기준(0) 좌우 막대로 보여주는 컴포넌트. 매수 기여는 오른쪽/빨강, 매도 기여는 왼쪽/파랑으로 뻗는다.

```jsx
<ContributionBar
  items={[
    { name: "수급", score: 18, weight: 30 },
    { name: "모멘텀", score: 11, weight: 25 },
    { name: "변동성", score: -9, weight: 15 },
  ]}
/>
```

- `dense`로 탭2·3처럼 정보 밀도가 높은 화면에 맞춰 행 간격을 좁힐 수 있다.
- `weight`를 생략하면 가중치 컬럼이 자동으로 숨겨진다.
