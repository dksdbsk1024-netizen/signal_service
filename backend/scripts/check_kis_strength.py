"""KIS 체결강도 실연동 단독 검증 — 진짜 체결강도인지, 매수우위 판정이 말이 되는지.

앱(deps.PROVIDER)을 거치지 않고 KISProvider 를 직접 찔러본다 — STOCK_PROVIDER 설정과 무관하다.

    python -m backend.scripts.check_kis_strength          # 삼성전자 005930
    python -m backend.scripts.check_kis_strength 000660   # SK하이닉스

"실데이터가 맞나"의 근거는 세 가지다:
  1. mock/stale 플래그 (Mock 폴백이면 실연동 실패)
  2. **현재가 API(다른 TR)와의 교차검증** — 체결 TR 이 주는 마지막 체결가·등락률이
     현재가 TR(FHKST01010100)의 값과 정확히 일치해야 한다. 합성 데이터라면 두 API 가
     이렇게 맞아떨어질 수 없다.
  3. 체결 틱 자체의 정합성 — 30틱이 최신→과거 순, 체결강도는 당일 **누적** 비율이라
     30틱 사이에서 거의 안 움직인다(실측 폭 0.01~0.05).

체결강도는 당일 체결에서만 나온다. 장 시작 전·휴장일에는 KIS 가 0 을 주고 Mock 으로
폴백하는 게 정상 동작이다(실패가 아님).

체결강도 > 100 = 매수 체결 우위. 다만 이건 가격 방향과 1:1 이 아니다 — 누적 체결강도가
100 아래인데 주가가 오르는 종목이 흔하다(실측: 000660 이 92.9 / +3.95%). 그래서 방향
일치는 [INFO] 로만 찍고 판정에 쓰지 않는다.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from backend.core import kis
from backend.core.providers import KISProvider

DEFAULT_TICKER = "005930"

_BAR = "#"          # ASCII 만 — Windows cp949 콘솔에서 유니코드 블록은 죽는다.
_BAR_WIDTH = 40
_SCALE_MAX = 200.0  # 게이지 상한. 체결강도 200 이면 매수 체결이 매도의 2배.


def _check(label: str, ok: bool, detail: str = "") -> bool:
    print(f"  [{'OK' if ok else 'FAIL'}] {label}" + (f" - {detail}" if detail else ""))
    return ok


def _gauge(strength: float) -> None:
    """0~200 스케일 막대. 100(중립) 위치를 '|' 로 표시한다."""
    filled = max(round(min(strength, _SCALE_MAX) / _SCALE_MAX * _BAR_WIDTH), 1)
    mid = round(100.0 / _SCALE_MAX * _BAR_WIDTH)
    bar = "".join(
        _BAR if i < filled else ("|" if i == mid else "-") for i in range(_BAR_WIDTH)
    )
    side = "매수 우위" if strength > 100 else "매도 우위" if strength < 100 else "중립"
    print(f"\n  0 [{bar}] {int(_SCALE_MAX)}")
    print(f"    체결강도 {strength:.1f}  ({side})   ('|' = 100 중립)")


def main(ticker: str = DEFAULT_TICKER) -> int:
    # Windows 기본 콘솔은 cp949 — 일부 기호에서 UnicodeEncodeError 로 죽는다.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    # 인자 없는 load_dotenv() 는 REPL·디버거에서 cwd 기준으로 바뀐다 (api.deps 와 동일).
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    app_key = os.getenv("KIS_APP_KEY", "")
    app_secret = os.getenv("KIS_APP_SECRET", "")
    if not app_key or not app_secret:
        print("[FAIL] KIS_APP_KEY / KIS_APP_SECRET 이 backend/.env 에 없습니다.")
        return 1

    provider = KISProvider(app_key, app_secret)

    # -- 1. 체결강도 --
    try:
        data = provider.get_trade_strength(ticker)
    except kis.KISAuthError as e:
        print(f"[FAIL] 인증 거부 - 키를 확인하세요.\n  {e}")
        if e.msg_cd == "EGW00133":
            print("  (토큰 발급은 앱키당 1분에 1회. 잠시 후 재시도하세요.)")
        return 1

    print(f"체결강도 ({ticker}): source={data['source']}  as_of={data['as_of']}")

    if data["mock"]:
        print("\n[FAIL] mock=True - KIS 응답을 못 받고 Mock 으로 폴백했습니다.")
        print("       장 시작 전·휴장일이면 정상입니다. 장중(09:00~15:30)에 다시 돌려보세요.")
        return 1
    if data["stale"]:
        print("\n[WARN] stale=True - 이번 요청은 실패하고 직전 캐시를 반환했습니다.")
        return 1

    _gauge(data["strength"])

    # -- 2. 원본 틱 + 현재가 API 로 교차검증 (실데이터의 결정적 증거) --
    # 정규화된 dict 에는 체결 틱이 안 남는다. 원본 30틱을 다시 받아 구조를 본다.
    # 체결가·체결강도는 틱마다 움직이므로 두 응답을 **연달아** 받아 비교 대상을 좁힌다.
    token = kis.get_access_token(app_key, app_secret)
    try:
        rows = kis._fetch_trade_strength(ticker, token, app_key, app_secret)
        price = provider.get_current_price(ticker)
    except kis.KISAuthError as e:
        print(f"[FAIL] {e}")
        return 1
    if price["mock"]:
        print("[FAIL] 현재가가 Mock 입니다 - 교차검증 불가.")
        return 1

    norm = kis._normalize_trade_strength(ticker, rows)   # 이 응답으로부터의 기대값
    head = rows[0]
    rltvs = [float(r["tday_rltv"]) for r in rows]
    hours = [r["stck_cntg_hour"] for r in rows]
    prices = [kis._to_int(r["stck_prpr"]) for r in rows]

    print(f"\n최근 체결 {len(rows)}틱: {hours[-1]} ~ {hours[0]}, "
          f"체결강도 {min(rltvs):.2f}~{max(rltvs):.2f}, "
          f"체결가 {min(prices):,}~{max(prices):,}")

    print("\n구조:")
    ok = True
    ok &= _check("최신→과거 순(rows[0] = 마지막 체결)",
                 all(hours[i] >= hours[i + 1] for i in range(len(hours) - 1)),
                 f"{hours[0]} >= ... >= {hours[-1]}")
    ok &= _check("정규화가 최신 틱의 tday_rltv 를 고름",
                 norm["strength"] == round(rltvs[0], 1),
                 f"{norm['strength']} vs {rltvs[0]}")
    ok &= _check("as_of 가 마지막 체결 시각",
                 norm["as_of"].endswith(f"{head['stck_cntg_hour'][:2]}:"
                                        f"{head['stck_cntg_hour'][2:4]}:"
                                        f"{head['stck_cntg_hour'][4:]} KST"),
                 norm["as_of"])
    ok &= _check("체결강도 > 0", data["strength"] > 0)
    # 누적 비율이라 30틱(수 초) 사이에서는 소수 둘째 자리만 움직인다.
    # 폭이 크면 tday_rltv 가 '틱별 강도'라는 뜻 — 그러면 최신 틱만 쓰는 건 틀린 해석이다.
    ok &= _check("30틱 내 체결강도 변동 < 1.0 (당일 누적값)",
                 max(rltvs) - min(rltvs) < 1.0, f"폭 {max(rltvs) - min(rltvs):.2f}")
    # 위 provider 호출과 이 호출 사이에 체결이 더 붙는다 — 값이 조금 움직이는 건 정상.
    ok &= _check("provider 값이 방금 받은 틱과 같은 수준(드리프트 < 1.0)",
                 abs(data["strength"] - norm["strength"]) < 1.0,
                 f"{data['strength']} vs {norm['strength']}")

    print("\n현재가 API(FHKST01010100) 교차검증:")
    # 두 TR 이 같은 전일 종가를 깔고 있어야 한다. 체결가·현재가와 달리 이 값은 장중에
    # 안 변하므로 두 응답의 시차와 무관하다 — 합성 데이터라면 여기서 어긋난다.
    tick_prdy_close = {kis._to_int(r["stck_prpr"]) - kis._to_int(r["prdy_vrss"]) for r in rows}
    price_prdy_close = price["price"] - price["change"]
    ok &= _check("전일 종가 일치 (틱 30개 전부 == 현재가 TR)",
                 tick_prdy_close == {price_prdy_close},
                 f"틱 {sorted(tick_prdy_close)} vs 현재가 {price_prdy_close:,}")
    ok &= _check("현재가가 최근 30틱 체결가 범위 안",
                 min(prices) <= price["price"] <= max(prices),
                 f"{min(prices):,} <= {price['price']:,} <= {max(prices):,}")
    # 마지막 틱과 현재가는 한 호가단위쯤 어긋날 수 있다(두 응답 사이에 체결이 더 붙는다).
    # 그래서 '같은 체결가를 가진 틱'을 찾아 그 틱의 등락률과 맞춘다 — 시차와 무관한 비교.
    same = next((r for r in rows if kis._to_int(r["stck_prpr"]) == price["price"]), None)
    ok &= _check("현재가와 같은 체결가의 틱이 존재", same is not None)
    if same is not None:
        ok &= _check("그 틱의 등락률 == 현재가 등락률",
                     abs(kis._to_float(same["prdy_ctrt"]) - price["change_pct"]) < 0.01,
                     f"{same['prdy_ctrt']}% vs {price['change_pct']}%")
    ok &= _check("모든 체결가가 당일 저가~고가 안",
                 price["low"] <= min(prices) and max(prices) <= price["high"],
                 f"당일 {price['low']:,}~{price['high']:,}")

    # 방향 일치는 참고용. 누적 체결강도 < 100 인데 주가가 오르는 종목은 흔하다.
    agrees = (data["strength"] > 100) == (price["change_pct"] > 0)
    print(f"\n  [INFO] 방향 {'일치' if agrees else '불일치'} - "
          f"체결강도 {data['strength']:.1f} ({'매수' if data['strength'] > 100 else '매도'}우위) / "
          f"주가 {price['change_pct']:+.2f}%")
    if not agrees:
        print("         불일치는 정상일 수 있습니다 - 누적 체결강도와 가격 방향은 1:1 이 아닙니다.")

    print()
    if not ok:
        print("[FAIL] 위 항목 중 실패가 있습니다.")
        return 1
    print(f"[OK] {ticker} 체결강도 실데이터 확인. {data['strength']:.1f} "
          f"({'매수' if data['strength'] > 100 else '매도'}우위), "
          f"현재가 {price['price']:,}원 ({price['change_pct']:+.2f}%)")
    print("     네이버금융·MTS 의 체결강도와 대조하세요 (틱마다 소수점이 움직입니다).")
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    sys.exit(main(args[0] if args else DEFAULT_TICKER))
