// 종합 신호 표시 섹션 — 게이지 + 라벨 + 기여도 + 신뢰도 배너.
// fetch 하지 않는다. /api/signal 응답의 signal 객체를 그대로 받아 그린다.
// Fragment 로 반환하는 이유: 카드 3개(배너·게이지·기여도)가 부모 flex 의 직계 자식이어야
// 부모가 주는 gap 이 추출 전과 동일하게 먹는다. div 로 감싸면 간격이 바뀐다.
import React from "react";
import { Ds, Card, SectionLabel, Banner, LabelBadge } from "../ui.jsx";

const { DirectionGauge, ContributionBar } = Ds;

// asOf 는 브리프 시그니처에 없지만 게이지 subtitle 이 header.as_of 를 쓴다 —
// signal 객체엔 없는 값이라 부모가 넘겨야 픽셀이 유지된다.
export default function SignalSection({ signal, coverage, asOf }) {
  // provisional = 신뢰도가 임계치 미만. 숫자를 아예 안 띄운다 — 흐리게 하는 게 아니다.
  // 못 믿을 값을 믿을 만한 값과 같은 크기로 보여주는 것이 위험의 본질이라서다.
  const provisional = signal.provisional;
  // 임계치는 넘었지만 아직 전 지표가 데워지진 않은 구간 → 숫자 + 신뢰도 배지.
  const lowConfidence = !provisional && coverage != null && coverage < 1;
  const pct = (v) => Math.round(v * 100);

  return (
    <React.Fragment>
      {lowConfidence && (
        <Banner tone="warn">
          신뢰도 {pct(coverage)}% — 봉 {signal.bars}개. 일부 지표가 아직 집계 중입니다
          (전 지표 반영은 봉 60개). 봉이 쌓이면 자동으로 보정됩니다.
        </Banner>
      )}

      <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--space-4)", padding: "var(--space-8) var(--space-6)", boxShadow: "var(--shadow-sm)" }}>
        {provisional ? (
          // 게이지 숫자도 라벨도 없다. 신뢰할 수 없는 값에 결론의 크기를 주지 않는다.
          <div style={{ textAlign: "center", padding: "var(--space-6) 0" }}>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, color: "var(--text-secondary)" }}>
              집계 중…
            </div>
            <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-tertiary)" }}>
              봉 {signal.bars}/{signal.bars_for_signal}개 · 신뢰도 {pct(coverage ?? 0)}%
              (신호 표시 기준 {pct(signal.min_coverage)}%)
            </div>
            <div style={{ marginTop: "var(--space-3)", fontSize: "var(--text-2xs)", color: "var(--text-tertiary)" }}>
              지표가 충분히 쌓이기 전의 방향은 신호로 보기 어렵습니다.
            </div>
          </div>
        ) : (
          <React.Fragment>
            {DirectionGauge && <DirectionGauge score={signal.final_score} size="lg" subtitle={`${asOf} 갱신`} />}
            <LabelBadge label={signal.label} />
          </React.Fragment>
        )}
      </Card>

      {signal.contributions.length > 0 && (
        <Card style={{ padding: "var(--space-5) var(--space-6)" }}>
          {/* 집계 중에도 켜진 지표는 보여 준다 — 진짜 관측이고, 장 초반에 트레이더가
              실제로 보는 정보다. 다만 "근거"가 아니라 "참고"로 격을 낮춘다. */}
          <SectionLabel>
            {provisional
              ? `참고 — 현재 켜진 지표 ${signal.contributions.length}개 (아직 신호 산출 전)`
              : `근거 — 지표 기여도 (상위 ${signal.contributions.length}개)`}
          </SectionLabel>
          {ContributionBar && (
            <ContributionBar items={signal.contributions.map((c) => ({ name: c.name, score: c.contribution, weight: c.weight }))} />
          )}
        </Card>
      )}
    </React.Fragment>
  );
}
