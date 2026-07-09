"""KIS 거래원(회원사) 실연동 단독 검증 — 진짜 창구인지, 비중·외국계 집계가 말이 되는지.

앱(deps.PROVIDER)을 거치지 않고 KISProvider 를 직접 찔러본다 — STOCK_PROVIDER 설정과 무관하다.

    python -m backend.scripts.check_kis_broker          # 삼성전자 005930
    python -m backend.scripts.check_kis_broker 000660   # SK하이닉스

"실데이터가 맞나"의 근거는 셋 다 **시차에 면역인 불변량**이다. 창구 수량·거래량은 장중
내내 증가하므로 두 응답의 순간값을 직접 비교하면 안 된다(체결강도에서 겪은 함정).

  1. mock/stale 플래그 (Mock 폴백이면 실연동 실패)
  2. **한 응답 안의 항등식** — 창구 비중 `rlim == 수량 / acml_vol × 100` (10개 전부),
     그리고 `glob_ntby_qty == glob_total_shnu_qty - glob_total_seln_qty`.
     KIS 가 따로 계산해 내려주는 값들이라, 매핑이 틀리면 여기서 깨진다.
  3. **현재가 API(다른 TR)와의 단조성 교차검증** — 누적 거래량은 줄어들지 않는다.
     현재가를 **먼저** 받고 거래원을 **나중에** 받으면 `현재가.acml_vol <= 거래원.acml_vol`
     이어야 한다. 두 TR 이 같은 종목의 같은 누적 거래량을 보고 있다는 증거이며,
     순간값 일치를 요구하지 않으므로 장중에도 안정적이다.

거래원 집계는 당일 체결에서만 나온다. 장 시작 전·휴장일에는 KIS 가 수량 0 을 주고
Mock 으로 폴백하는 게 정상 동작이다(실패가 아님).

**매도 상위 5 와 매수 상위 5 는 창구 집합이 다르다.** 한쪽에만 든 창구의 반대편 수량은
0 이 아니라 미상이므로 창구별 순매수는 계산하지 않는다. 외국계만 KIS 가 전체 집계를
따로 주므로 순매수를 낼 수 있다(상위 5 밖 창구까지 포함된 값).
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
_BAR_WIDTH = 20


def _check(label: str, ok: bool, detail: str = "") -> bool:
    print(f"  [{'OK' if ok else 'FAIL'}] {label}" + (f" - {detail}" if detail else ""))
    return ok


def _side(title: str, rows: list[dict], max_pct: float) -> None:
    print(f"\n{title}")
    for r in rows:
        bar = _BAR * max(round(r["pct"] / max_pct * _BAR_WIDTH), 1)
        flag = " [외국계]" if r["foreign"] else ""
        print(f"  {r['rank']} {r['name']:<10} {r['qty']:>10,}주 {r['pct']:>6.2f}%  {bar}{flag}")


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

    # 현재가를 **먼저**. 누적 거래량 단조성으로 교차검증하려면 순서가 중요하다.
    try:
        price = provider.get_current_price(ticker)
        data = provider.get_broker_activity(ticker)
    except kis.KISAuthError as e:
        print(f"[FAIL] 인증 거부 - 키를 확인하세요.\n  {e}")
        if e.msg_cd == "EGW00133":
            print("  (토큰 발급은 앱키당 1분에 1회. 잠시 후 재시도하세요.)")
        return 1

    print(f"거래원 ({ticker}): source={data['source']}  as_of={data['as_of']}")

    if data["mock"]:
        print("\n[FAIL] mock=True - KIS 응답을 못 받고 Mock 으로 폴백했습니다.")
        print("       장 시작 전·휴장일이면 정상입니다. 장중(09:00~15:30)에 다시 돌려보세요.")
        return 1
    if data["stale"]:
        print("\n[WARN] stale=True - 이번 요청은 실패하고 직전 캐시를 반환했습니다.")
        return 1
    if price["mock"]:
        print("[FAIL] 현재가가 Mock 입니다 - 교차검증 불가.")
        return 1

    sellers, buyers, foreign = data["sellers"], data["buyers"], data["foreign"]
    volume = data["volume"]
    max_pct = max(r["pct"] for r in sellers + buyers) or 1.0

    _side("매도 상위", sellers, max_pct)
    _side("매수 상위", buyers, max_pct)
    print(f"\n당일 거래량 {volume:,}주")
    print(f"외국계 전체: 매도 {foreign['sell_qty']:,} ({foreign['sell_pct']:.2f}%) / "
          f"매수 {foreign['buy_qty']:,} ({foreign['buy_pct']:.2f}%) / "
          f"순매수 {foreign['net_qty']:+,}주")

    print("\n구조:")
    ok = True
    ok &= _check("매도·매수 각각 상위 5 이하", len(sellers) <= 5 and len(buyers) <= 5,
                 f"매도 {len(sellers)} / 매수 {len(buyers)}")
    ok &= _check("창구명이 비어있지 않음", all(r["name"] for r in sellers + buyers))
    for label, rows in (("매도", sellers), ("매수", buyers)):
        ok &= _check(f"{label} 수량 내림차순",
                     [r["qty"] for r in rows] == sorted((r["qty"] for r in rows), reverse=True))
    ok &= _check("한 창구 수량 <= 당일 거래량", all(r["qty"] <= volume for r in sellers + buyers))
    ok &= _check("상위 5 합 <= 당일 거래량",
                 sum(r["qty"] for r in sellers) <= volume and sum(r["qty"] for r in buyers) <= volume,
                 f"매도합 {sum(r['qty'] for r in sellers):,} / 매수합 {sum(r['qty'] for r in buyers):,}")

    # 매도·매수 상위가 같은 집합이면 이 TR 을 잘못 읽고 있다는 신호(같을 수도 있으나 드물다).
    only_sell = {r["name"] for r in sellers} - {r["name"] for r in buyers}
    print(f"  [INFO] 매도 상위에만 있는 창구: {sorted(only_sell) or '없음'} "
          f"- 이 창구들의 매수량은 0 이 아니라 미상입니다.")

    print("\n한 응답 안의 항등식 (KIS 가 따로 계산해 준 값):")
    # 비중은 KIS 가 내려주는 값. 우리가 곱한 값과 맞아야 매핑이 옳다.
    bad = [f"{r['name']} {r['pct']} vs {r['qty'] / volume * 100:.2f}"
           for r in sellers + buyers if abs(r["pct"] - r["qty"] / volume * 100) >= 0.01]
    ok &= _check("창구 비중 == 수량 / 거래량 × 100 (10개 전부)", not bad, "; ".join(bad))
    ok &= _check("외국계 순매수 == 매수 - 매도",
                 foreign["net_qty"] == foreign["buy_qty"] - foreign["sell_qty"],
                 f"{foreign['net_qty']:,} vs {foreign['buy_qty'] - foreign['sell_qty']:,}")
    ok &= _check("외국계 매도 비중 == 매도량 / 거래량 × 100",
                 abs(foreign["sell_pct"] - foreign["sell_qty"] / volume * 100) < 0.01,
                 f"{foreign['sell_pct']} vs {foreign['sell_qty'] / volume * 100:.2f}")
    # 외국계 집계는 상위 5 밖 창구까지 포함하므로 상위 5 안 외국계 합보다 작을 수 없다.
    top5_foreign_sell = sum(r["qty"] for r in sellers if r["foreign"])
    ok &= _check("외국계 전체 매도 >= 상위 5 안 외국계 매도 합",
                 foreign["sell_qty"] >= top5_foreign_sell,
                 f"{foreign['sell_qty']:,} >= {top5_foreign_sell:,}")

    print("\n현재가 API(FHKST01010100) 교차검증 — 누적 거래량 단조성:")
    # 현재가를 먼저 받았으므로 거래원의 acml_vol 이 같거나 더 크다. 순간값 일치는 요구하지 않는다.
    ok &= _check("현재가.거래량 <= 거래원.거래량 (나중에 받은 쪽이 크다)",
                 price["volume"] <= volume,
                 f"{price['volume']:,} <= {volume:,} (차 {volume - price['volume']:,}주)")
    ok &= _check("두 거래량 차이가 1% 미만 (같은 종목·같은 세션)",
                 volume > 0 and (volume - price["volume"]) / volume < 0.01,
                 f"{(volume - price['volume']) / volume * 100:.4f}%" if volume else "거래량 0")

    print()
    if not ok:
        print("[FAIL] 위 항목 중 실패가 있습니다.")
        return 1
    print(f"[OK] {ticker} 거래원 실데이터 확인. 매도 1위 {sellers[0]['name']} "
          f"({sellers[0]['pct']:.2f}%), 매수 1위 {buyers[0]['name']} ({buyers[0]['pct']:.2f}%), "
          f"외국계 순매수 {foreign['net_qty']:+,}주")
    print("     네이버금융·MTS 의 거래원 창구명·수량과 대조하세요.")
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    sys.exit(main(args[0] if args else DEFAULT_TICKER))
