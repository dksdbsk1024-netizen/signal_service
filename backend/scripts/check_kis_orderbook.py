"""KIS 호가(Level 2) 실연동 단독 검증 — 진짜 호가인지, 잔량이 말이 되는지.

앱(deps.PROVIDER)을 거치지 않고 KISProvider 를 직접 찔러본다 — STOCK_PROVIDER 설정과 무관하다.

    python -m backend.scripts.check_kis_orderbook          # 삼성전자 005930
    python -m backend.scripts.check_kis_orderbook 000660   # SK하이닉스

"실데이터가 맞나"의 근거는 세 가지다:
  1. mock/stale 플래그 (Mock 폴백이면 실연동 실패)
  2. **현재가 API(다른 TR)와의 교차검증** — 현재가가 최우선 매수호가와 매도호가
     사이에 있어야 한다. 합성 데이터라면 두 API 가 이렇게 맞아떨어질 수 없다.
  3. 호가 사다리 자체의 정합성 — 매도가 오름차순, 매수가 내림차순, ask1 > bid1,
     호가 간격 일정(가격대별 호가단위), 10호가 잔량 합 <= 전체 잔량.

호가는 장중에만 존재한다. 장 마감 후·휴장일에는 KIS 가 가격 0 을 주고 Mock 으로
폴백하는 게 정상 동작이다(실패가 아님).
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
_BAR_WIDTH = 30


def _check(label: str, ok: bool, detail: str = "") -> bool:
    print(f"  [{'OK' if ok else 'FAIL'}] {label}" + (f" - {detail}" if detail else ""))
    return ok


def _ladder(book: dict, price: int) -> None:
    """국내 관습대로 매도(위) → 현재가 → 매수(아래). 잔량은 막대 길이로."""
    max_qty = max(r["qty"] for r in book["asks"] + book["bids"]) or 1
    print(f"\n{'매도호가':>10} {'잔량':>10}")
    for r in sorted(book["asks"], key=lambda r: -r["price"]):
        bar = _BAR * max(round(r["qty"] / max_qty * _BAR_WIDTH), 1)
        print(f"{r['price']:>10,} {r['qty']:>10,}  {bar}")
    print(f"{'--- 현재가':>10} {price:>10,} ---")
    for r in sorted(book["bids"], key=lambda r: -r["price"]):
        bar = _BAR * max(round(r["qty"] / max_qty * _BAR_WIDTH), 1)
        print(f"{r['price']:>10,} {r['qty']:>10,}  {bar}")
    print(f"{'매수호가':>10} {'잔량':>10}")


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

    # -- 1. 호가 --
    try:
        book = provider.get_orderbook(ticker)
    except kis.KISAuthError as e:
        print(f"[FAIL] 인증 거부 - 키를 확인하세요.\n  {e}")
        if e.msg_cd == "EGW00133":
            print("  (토큰 발급은 앱키당 1분에 1회. 잠시 후 재시도하세요.)")
        return 1

    print(f"호가 ({ticker}): source={book['source']}  as_of={book['as_of']}")

    if book["mock"]:
        print("\n[FAIL] mock=True - KIS 응답을 못 받고 Mock 으로 폴백했습니다.")
        print("       장 마감 후·휴장일이면 정상입니다. 장중(09:00~15:30)에 다시 돌려보세요.")
        return 1
    if book["stale"]:
        print("\n[WARN] stale=True - 이번 요청은 실패하고 직전 캐시를 반환했습니다.")
        return 1

    # -- 2. 현재가 API 와 교차검증 (실데이터의 결정적 증거) --
    try:
        price = provider.get_current_price(ticker)
    except kis.KISAuthError as e:
        print(f"[FAIL] {e}")
        return 1
    if price["mock"]:
        print("[FAIL] 현재가가 Mock 입니다 - 교차검증 불가.")
        return 1

    _ladder(book, price["price"])

    asks, bids = book["asks"], book["bids"]
    ask_qty = sum(r["qty"] for r in asks)
    bid_qty = sum(r["qty"] for r in bids)
    ratio = f"  (매수/매도 = {bid_qty / ask_qty:.2f})" if ask_qty else ""
    print(f"\n10호가 잔량 합: 매도 {ask_qty:,} / 매수 {bid_qty:,}{ratio}")
    print(f"전체 잔량:      매도 {book['total_ask_qty']:,} / 매수 {book['total_bid_qty']:,}")

    print("\n구조:")
    ok = True
    ok &= _check("10호가씩", len(asks) == len(bids) == kis.ORDERBOOK_LEVELS,
                 f"asks {len(asks)} / bids {len(bids)}")
    ok &= _check("매도호가 오름차순(asks[0]=최우선)",
                 all(asks[i]["price"] < asks[i + 1]["price"] for i in range(len(asks) - 1)))
    ok &= _check("매수호가 내림차순(bids[0]=최우선)",
                 all(bids[i]["price"] > bids[i + 1]["price"] for i in range(len(bids) - 1)))
    ok &= _check("ask1 > bid1 (스프레드 양수)", asks[0]["price"] > bids[0]["price"],
                 f"{asks[0]['price']:,} vs {bids[0]['price']:,}")
    ok &= _check("잔량 모두 >= 0", all(r["qty"] >= 0 for r in asks + bids))
    # KIS 의 총잔량은 10호가 합과 같아야 한다. 어긋나면 잔량 필드를 잘못 매핑한 것.
    ok &= _check("10호가 잔량 합 == 전체 잔량",
                 ask_qty == book["total_ask_qty"] and bid_qty == book["total_bid_qty"],
                 f"합 {ask_qty:,}/{bid_qty:,} vs 전체 {book['total_ask_qty']:,}/{book['total_bid_qty']:,}")

    # 호가 간격은 가격대별 호가단위(tick). 한 사다리 안에서는 일정해야 한다.
    ask_gaps = {asks[i + 1]["price"] - asks[i]["price"] for i in range(len(asks) - 1)}
    bid_gaps = {bids[i]["price"] - bids[i + 1]["price"] for i in range(len(bids) - 1)}
    ok &= _check("호가 간격 일정(= 호가단위)", len(ask_gaps) == 1 and ask_gaps == bid_gaps,
                 f"매도 {sorted(ask_gaps)} / 매수 {sorted(bid_gaps)}")

    print("\n현재가 API(FHKST01010100) 교차검증:")
    ok &= _check("bid1 <= 현재가 <= ask1",
                 bids[0]["price"] <= price["price"] <= asks[0]["price"],
                 f"{bids[0]['price']:,} <= {price['price']:,} <= {asks[0]['price']:,}")
    ok &= _check("호가 전 구간이 당일 저가~고가 범위와 겹침",
                 bids[-1]["price"] <= price["high"] and asks[-1]["price"] >= price["low"],
                 f"당일 {price['low']:,}~{price['high']:,}")

    print()
    if not ok:
        print("[FAIL] 위 항목 중 실패가 있습니다.")
        return 1
    print(f"[OK] {ticker} 호가 실데이터 확인. 최우선 {bids[0]['price']:,} / {asks[0]['price']:,}, "
          f"현재가 {price['price']:,}원 ({price['change_pct']:+.2f}%)")
    print("     네이버금융·MTS 호가창의 잔량과 대조하세요 (호가는 초 단위로 바뀝니다).")
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    sys.exit(main(args[0] if args else DEFAULT_TICKER))
