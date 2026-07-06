OHLCV 데이터를 캔들스틱으로 그리는 차트. 상승 캔들=빨강, 하락 캔들=파랑(국내 관습). VWAP 오버레이와 하단 거래량 서브패널을 지원한다.

```jsx
<CandleChart candles={data} showVolume showVwap height={280} />
```

- `mini`로 탭1용 축소판(축 라벨 없음, 얇은 볼륨바)으로 전환.
- 이동평균선 등 추가 오버레이가 필요하면 이 컴포넌트를 감싸 `<path>`를 추가하는 방식을 권장(현재는 VWAP만 내장).
- 실제 서비스에서는 `candles`를 실시간 데이터로 교체.
