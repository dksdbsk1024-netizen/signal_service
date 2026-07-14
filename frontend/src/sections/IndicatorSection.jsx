// 지표 테이블 섹션 — /api/technical 응답의 indicators_table 을 그대로 받아 그린다.
// interval 은 시그니처엔 없지만 카드 라벨이 "지표 현재값 · 신호 (1m)" 로 쓰던 값이다.
import React, { useMemo } from "react";
import { Ds, Card, SectionLabel, toSignalEnum } from "../ui.jsx";

const { IndicatorTable } = Ds;

export default function IndicatorSection({ table, interval }) {
  // 봉 부족 지표는 value=null 로 온다. String(null) 은 화면에 "null" 을 찍는다 —
  // 왜 없는지(봉 N/M)를 값 자리에 그대로 쓴다.
  const tableRows = useMemo(
    () => (table || []).map((r) => ({
      name: r.name,
      value: r.value == null ? `봉 ${r.bars}/${r.required_bars}` : String(r.value),
      signal: toSignalEnum(r.signal),
    })),
    [table]
  );

  return (
    <Card style={{ padding: "var(--space-4) var(--space-5)" }}>
      <SectionLabel>지표 현재값 · 신호 ({interval})</SectionLabel>
      {IndicatorTable && <IndicatorTable rows={tableRows} dense />}
    </Card>
  );
}
