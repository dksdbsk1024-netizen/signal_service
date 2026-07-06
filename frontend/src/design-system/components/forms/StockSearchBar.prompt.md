종목 티커/명을 입력하면 자동완성 드롭다운을 보여주는 검색바. 모든 탭 상단 고정 영역에 위치.

```jsx
<StockSearchBar
  suggestions={[{ name: "삼성전자", ticker: "005930" }, { name: "SK하이닉스", ticker: "000660" }]}
  onSelect={(s) => loadStock(s.ticker)}
/>
```

- 아이콘은 Lucide(CDN, `lucide-static`)의 `search` 글리프를 사용 — 코드베이스에 자체 아이콘 세트가 없어 대체함(ICONOGRAPHY 참고).
