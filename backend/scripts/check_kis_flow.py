"""KIS 수급(외국인·기관·프로그램) 실연동 단독 검증 — 진짜 수급인지, 부호·단위가 맞는지.

앱(deps.PROVIDER)은 여전히 Mock 이다. 이 스크립트는 KISProvider 만 직접 찔러본다.

    python -m backend.scripts.check_kis_flow          # 삼성전자 005930
    python -m backend.scripts.check_kis_flow 000660   # SK하이닉스

"실데이터가 맞나"의 근거는 네 가지다:
  1. mock/stale 플래그 (Mock 폴백이면 실연동 실패)
  2. **투자자 항등식** — 개인+외국인+기관 순매수 대금 합이 0 근처여야 한다. 한쪽이 사면
     반대쪽이 판다. 백만원→억원 환산이 틀리면 이게 깨진다. 잔차는 기타법인·내외국인
     몫이므로 **총 매수+매도 대금** 대비로 잰다(순매수 합 대비로 재면 순매수가 0 근처인
     날 비율이 폭발한다).
  3. **암묵 평균단가** — 순매수 대금 ÷ 순매수 수량 이 그날 종가 근처여야 한다.
     대금(백만원)과 수량(주)은 서로 다른 필드다. 합성 데이터라면 맞아떨어질 수 없다.
     단 **순매수가 0 근처인 날엔 이 비율이 발산한다**(매수·매도 평균단가가 달라서). 그래서
     순매수 수량이 가장 큰 날을 골라서 잰다.
  4. **프로그램 대금 ↔ 수량 정합** — 같은 검사를 프로그램매매 TR(원 단위)에 대해 반복.

장중에는 확정 수급이 없어 스냅샷이 가집계 추정치(estimated=True)로 나온다. 정상이다.
추정치는 '추정 순매수 수량 × 현재가' 라 확정 대금과 오차가 있다.
"""

from __future__ import annotations

import os
import sys

from dotenv import load_dotenv

from backend.core import kis
from backend.core.providers import KISProvider

DEFAULT_TICKER = "005930"

_BAR = "#"          # ASCII 만 — Windows cp949 콘솔에서 유니코드 블록은 죽는다.
_BAR_WIDTH = 24

# 항등식 잔차 허용치. 기타법인·내외국인이 빠져 있어 정확히 0 은 아니다.
_IDENTITY_TOL = 0.02          # 3주체 총 매수+매도 대금 대비 2%
# 암묵 평균단가는 그날 종가에서 크게 벗어날 수 없다(상·하한가 ±30%).
_AVG_PRICE_TOL = 0.30

_NTBY = ("prsn_ntby_tr_pbmn", "frgn_ntby_tr_pbmn", "orgn_ntby_tr_pbmn")
_GROSS = ("prsn_shnu_tr_pbmn", "frgn_shnu_tr_pbmn", "orgn_shnu_tr_pbmn",
          "prsn_seln_tr_pbmn", "frgn_seln_tr_pbmn", "orgn_seln_tr_pbmn")


def _identity_residual(row: dict) -> tuple[float, float]:
    """(순매수 합 억원, 총 매수+매도 대금 억원). 앞이 뒤에 비해 0 이어야 한다."""
    net = sum(kis._pbmn_to_eok(row[k]) for k in _NTBY)
    gross = sum(abs(kis._pbmn_to_eok(row[k])) for k in _GROSS)
    return net, gross


def _check(label: str, ok: bool, detail: str = "") -> bool:
    print(f"  [{'OK' if ok else 'FAIL'}] {label}" + (f" - {detail}" if detail else ""))
    return ok


def _side(v: float) -> str:
    return "순매수" if v > 0 else "순매도" if v < 0 else "중립"


def _hist(label: str, values: list[float], dates: list[str]) -> None:
    """일별 순매수 부호 막대. 0 을 가운데 두고 좌(매도)/우(매수)."""
    scale = max((abs(v) for v in values), default=1.0) or 1.0
    print(f"\n{label} (억원)")
    for d, v in zip(dates, values):
        n = max(round(abs(v) / scale * _BAR_WIDTH), 1) if v else 0
        left = (_BAR * n).rjust(_BAR_WIDTH) if v < 0 else " " * _BAR_WIDTH
        right = _BAR * n if v > 0 else ""
        print(f"  {d}  {left}|{right.ljust(_BAR_WIDTH)} {v:>+10,.1f}")


def main(ticker: str = DEFAULT_TICKER) -> int:
    # Windows 기본 콘솔은 cp949 — 일부 기호에서 UnicodeEncodeError 로 죽는다.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    load_dotenv()  # backend/.env
    app_key = os.getenv("KIS_APP_KEY", "")
    app_secret = os.getenv("KIS_APP_SECRET", "")
    if not app_key or not app_secret:
        print("[FAIL] KIS_APP_KEY / KIS_APP_SECRET 이 backend/.env 에 없습니다.")
        return 1

    provider = KISProvider(app_key, app_secret)

    # -- 1. 당일 스냅샷 --
    try:
        flow = provider.get_investor_flow(ticker)
        series = provider.get_investor_flow_series(ticker)
        price = provider.get_current_price(ticker)
    except kis.KISAuthError as e:
        print(f"[FAIL] 인증 거부 - 키를 확인하세요.\n  {e}")
        if e.msg_cd == "EGW00133":
            print("  (토큰 발급은 앱키당 1분에 1회. 잠시 후 재시도하세요.)")
        return 1

    for label, d in (("수급 스냅샷", flow), ("수급 시계열", series)):
        print(f"{label} ({ticker}): source={d['source']}  as_of={d['as_of']}")
        if d["mock"]:
            print(f"\n[FAIL] {label} mock=True - KIS 응답을 못 받고 Mock 으로 폴백했습니다.")
            return 1
        if d["stale"]:
            print(f"\n[WARN] {label} stale=True - 이번 요청은 실패하고 직전 캐시를 반환했습니다.")
            return 1

    kind = "장중 가집계 추정치" if flow["estimated"] else "확정치"
    print(f"\n당일 스냅샷 [{kind}]  현재가 {price['price']:,}원 ({price['change_pct']:+.2f}%)")
    for k, name in (("foreign", "외국인"), ("institution", "기관"),
                    ("program", "프로그램"), ("retail", "개인")):
        print(f"  {name:<5} {flow[k]:>+12,.1f} 억원  {_side(flow[k])}")
    smart = flow["foreign"] + flow["institution"]
    print(f"  {'스마트머니(외국인+기관)':<5} {smart:>+10,.1f} 억원  {_side(smart)}")

    # -- 2. 시계열 --
    n = len(series["dates"])
    _hist("외국인 일별 순매수", series["foreign"], series["dates"])
    _hist("기관 일별 순매수", series["institution"], series["dates"])

    print("\n시계열 구조:")
    ok = True
    ok &= _check("dates/foreign/institution/program 길이 일치",
                 len({n, len(series["foreign"]), len(series["institution"]),
                      len(series["program"])}) == 1, f"n={n}")
    ok &= _check("영업일 20일치(요청 days)", n == kis.DEFAULT_FLOW_DAYS, f"n={n}")
    ok &= _check("단위 억원", series["unit"] == "억원" == flow["unit"])

    # -- 3. 원시 응답과 교차검증 (실데이터의 결정적 증거) --
    # 원시 호출은 build_* 를 안 거치므로 재시도가 없다. 짧은 시간에 여러 TR 을 연달아
    # 때리면 초당 호출 제한에 걸릴 수 있어 같은 재시도 정책으로 감싼다.
    token = kis.get_access_token(app_key, app_secret)
    inv_rows = kis._retry_on_data(
        lambda: kis._fetch_investor_daily(ticker, token, app_key, app_secret))
    prog_by_date = kis._retry_on_data(
        lambda: kis._fetch_program_daily(ticker, kis._today_kst(), token, app_key, app_secret))

    confirmed = [r for r in inv_rows if r.get("frgn_ntby_tr_pbmn")]
    row = confirmed[0]                       # 가장 최근 확정일 — 시계열 말단과 대조
    date, clpr = row["stck_bsop_date"], float(row["stck_clpr"])
    f_pbmn = kis._pbmn_to_eok(row["frgn_ntby_tr_pbmn"])
    i_pbmn = kis._pbmn_to_eok(row["orgn_ntby_tr_pbmn"])
    p_pbmn = kis._pbmn_to_eok(row["prsn_ntby_tr_pbmn"])

    print(f"\n확정일 {kis._ymd(date)} 원시 교차검증 (종가 {clpr:,.0f}원):")

    # 시계열은 오래된→최신 순이고 마지막이 가장 최근 확정일이어야 한다.
    # (MM/DD 문자열은 연말을 넘으면 사전순이 깨지므로 정렬 대신 확정일과 직접 대조한다.)
    ok &= _check("시계열 마지막 날짜 == 가장 최근 확정일",
                 series["dates"][-1] == kis._mmdd(date) and kis._ymd(date) in series["as_of"],
                 f"last={series['dates'][-1]} vs 확정일 {kis._mmdd(date)}")
    ok &= _check("시계열 마지막 외국인 값 == 확정 행 값",
                 abs(series["foreign"][-1] - round(f_pbmn, 1)) < 0.05,
                 f"{series['foreign'][-1]:+,.1f} vs {f_pbmn:+,.1f}")

    # (2) 투자자 항등식을 확정 행 **전부**에 건다. 한 행만 보면 큰 값(수조 단위)이
    #     파싱 오류인지 실제 대량 매매인지 구분되지 않는다.
    net, gross = _identity_residual(row)
    ok &= _check("개인+외국인+기관 순매수 합 ≈ 0 (단위 환산 검증)",
                 gross > 0 and abs(net) <= _IDENTITY_TOL * gross,
                 f"개인 {p_pbmn:+,.0f} + 외국인 {f_pbmn:+,.0f} + 기관 {i_pbmn:+,.0f} "
                 f"= {net:+,.0f}억 (매매대금 {gross:,.0f}억의 {abs(net) / gross:.2%})")

    worst, worst_date = 0.0, ""
    for r in confirmed:
        n_, g_ = _identity_residual(r)
        rel = abs(n_) / g_ if g_ else 1.0
        if rel > worst:
            worst, worst_date = rel, r["stck_bsop_date"]
    ok &= _check(f"확정 {len(confirmed)}행 전부 항등식 성립", worst <= _IDENTITY_TOL,
                 f"최악 잔차 {worst:.2%} ({kis._ymd(worst_date)}) — 기타법인·내외국인 몫")

    # (3) 암묵 평균단가 = 순매수 대금 ÷ 순매수 수량. 대금·수량은 별개 필드다.
    #     순매수가 0 근처인 날은 이 비율이 발산하므로 순매수 수량이 가장 큰 날로 잰다.
    big = max(confirmed, key=lambda r: abs(float(r["frgn_ntby_qty"])))
    b_clpr, b_qty = float(big["stck_clpr"]), float(big["frgn_ntby_qty"])
    b_eok = kis._pbmn_to_eok(big["frgn_ntby_tr_pbmn"])
    implied = abs(b_eok) * kis._EOK / abs(b_qty)
    ok &= _check("외국인 대금÷수량 = 그날 종가 부근 (대금 백만원 단위 검증)",
                 abs(implied - b_clpr) <= _AVG_PRICE_TOL * b_clpr,
                 f"{kis._ymd(big['stck_bsop_date'])}: {implied:,.0f}원/주 vs 종가 {b_clpr:,.0f}원")
    ok &= _check("외국인 대금 부호 == 수량 부호 (전 확정행)",
                 all((kis._pbmn_to_eok(r["frgn_ntby_tr_pbmn"]) >= 0)
                     == (float(r["frgn_ntby_qty"]) >= 0) for r in confirmed),
                 f"최근 {len(confirmed)}행")

    # (4) 프로그램: 대금(원) ÷ 수량(주) 도 같은 검사. 역시 순매수가 가장 큰 날로.
    prog_rows = kis._retry_on_data(lambda: _program_rows(ticker, token, app_key, app_secret))
    pg_big = max(prog_rows, key=lambda r: abs(float(r["whol_smtn_ntby_qty"])))
    pg_qty = float(pg_big["whol_smtn_ntby_qty"])
    pg_clpr = float(pg_big["stck_clpr"])
    pg_eok = kis._won_to_eok(pg_big["whol_smtn_ntby_tr_pbmn"])
    pg_implied = abs(pg_eok) * kis._EOK / abs(pg_qty)
    ok &= _check("프로그램 대금÷수량 = 그날 종가 부근 (대금 원 단위 검증)",
                 abs(pg_implied - pg_clpr) <= _AVG_PRICE_TOL * pg_clpr,
                 f"{kis._ymd(pg_big['stck_bsop_date'])}: {pg_implied:,.0f}원/주 "
                 f"vs 종가 {pg_clpr:,.0f}원")
    same = next(r for r in prog_rows if r["stck_bsop_date"] == date)
    ok &= _check("프로그램 억원 == 시계열 마지막 확정일 값",
                 abs(prog_by_date[date] - kis._won_to_eok(same["whol_smtn_ntby_tr_pbmn"])) < 0.05,
                 f"{prog_by_date[date]:+,.1f}억")
    ok &= _check("시계열 마지막 프로그램 값 == 확정 행 값",
                 abs(series["program"][-1] - prog_by_date[date]) < 0.05,
                 f"{series['program'][-1]:+,.1f} vs {prog_by_date[date]:+,.1f}")

    # -- 4. 장중 추정치와 확정치의 관계 --
    today = kis._today_kst()
    est_rows = kis._retry_on_data(
        lambda: kis._fetch_investor_estimate(ticker, token, app_key, app_secret))
    if est_rows:
        print("\n장중 가집계 추정치(HHPTJ04160200) — 시각대별 당일 누적 추정 순매수 수량(주):")
        for r in sorted(est_rows, key=lambda r: int(r["bsop_hour_gb"])):
            print(f"  구간 {r['bsop_hour_gb']}  외국인 {int(r['frgn_fake_ntby_qty']):>+12,}주  "
                  f"기관 {int(r['orgn_fake_ntby_qty']):>+12,}주")

        # 오늘 확정치가 이미 나왔다면(장 종료 후) 마지막 추정치와 대조할 수 있다.
        # 이것이 '누적이냐 시간대별 증분이냐'를 가르는 결정적 검사다.
        today_row = next((r for r in inv_rows if r["stck_bsop_date"] == today
                          and r.get("frgn_ntby_qty")), None)
        if today_row:
            last = kis._latest_estimate(est_rows)
            est_qty = float(last["frgn_fake_ntby_qty"])
            real_qty = float(today_row["frgn_ntby_qty"])
            err = abs(est_qty - real_qty) / abs(real_qty) if real_qty else 1.0
            ok &= _check("마지막 추정 수량 ≈ 당일 확정 수량 (추정치=당일 누적 확인)",
                         err < 0.20,
                         f"추정 {est_qty:+,.0f}주 vs 확정 {real_qty:+,.0f}주 (오차 {err:.1%})")
        else:
            print("  (오늘 확정치가 아직 없어 '누적' 가정은 장 종료 후 재실행해야 검증됩니다.)")

    print()
    if not ok:
        print("[FAIL] 위 항목 중 실패가 있습니다.")
        return 1

    print(f"[OK] {ticker} 수급 실데이터 확인 [{kind}]")
    print(f"     오늘 외국인 {flow['foreign']:+,.1f}억 ({_side(flow['foreign'])}), "
          f"기관 {flow['institution']:+,.1f}억 ({_side(flow['institution'])}), "
          f"프로그램 {flow['program']:+,.1f}억 ({_side(flow['program'])})")
    print(f"     현재가 {price['price']:,}원 ({price['change_pct']:+.2f}%)")
    print("     네이버금융 '투자자별 매매동향'과 대조하세요"
          + ("  (장중 추정치는 확정치와 다를 수 있습니다)." if flow["estimated"] else "."))
    return 0


def _program_rows(ticker: str, token: str, app_key: str, app_secret: str) -> list[dict]:
    """프로그램 일별 TR 원시 행(대금·수량 둘 다 필요해 _fetch_program_daily 로는 부족)."""
    body = kis._get_json(
        kis.PROGRAM_PATH, kis.TR_PROGRAM_DAILY,
        {"FID_COND_MRKT_DIV_CODE": "J", "FID_INPUT_ISCD": ticker,
         "FID_INPUT_DATE_1": kis._today_kst()},
        token, app_key, app_secret, "프로그램매매",
    )
    return body.get("output") or []


if __name__ == "__main__":
    args = sys.argv[1:]
    sys.exit(main(args[0] if args else DEFAULT_TICKER))
