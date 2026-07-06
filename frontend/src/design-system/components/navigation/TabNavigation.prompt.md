5개 탭(종합신호+매매계획·기술적분석·수급·매크로/시장·관심종목)을 전환하는 상단 탭바. 활성 탭은 텍스트 강조 + 골드 언더라인으로 표시한다.

```jsx
<TabNavigation
  tabs={[
    { id: "overview", label: "종합 신호" },
    { id: "technical", label: "기술적 분석" },
    { id: "flow", label: "수급" },
  ]}
  activeId="overview"
  onChange={(id) => setTab(id)}
/>
```

- 아이콘 세트가 아직 정해지지 않아 텍스트 라벨만 사용한다(ICONOGRAPHY 참고).
