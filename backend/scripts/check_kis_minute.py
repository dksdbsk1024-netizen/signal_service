"""KIS 분봉 실연동 단독 검증 — 진짜 데이터인지, 차트 모양이 말이 되는지.

앱(deps.PROVIDER)을 거치지 않고 KISProvider 를 직접 찔러본다 — STOCK_PROVIDER 설정과 무관하다.

    python -m backend.scripts.check_kis_minute            # 삼성전자 005930, 1m
    python -m backend.scripts.check_kis_minute 000660 5m  # SK하이닉스, 5분봉

"실데이터가 맞나"의 근거는 두 가지다:
  1. attrs.mock/stale 플래그 (Mock 폴백이면 실연동 실패)
  2. **현재가 API(다른 TR)와의 교차검증** — 마지막 봉 종가 == 현재가,
     봉들의 고가/저가 == 현재가 응답의 당일 고가/저가.
     합성 데이터라면 두 API 가 이렇게 맞아떨어질 수 없다.

KIS 분봉(FHKST03010200)은 당일 장중 데이터만 준다. 장 시작 전이나 휴장일에는
빈 응답 → Mock 폴백이 정상 동작이다(실패가 아님).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from backend.core import kis
from backend.core.providers import KISProvider

DEFAULT_TICKER = "005930"
DEFAULT_INTERVAL = "1m"

# ASCII 램프. 유니코드 블록(▁▂▃)은 Windows cp949 콘솔에서 UnicodeEncodeError 를 낸다.
_SPARK = "_.-=+*#@"


def _sparkline(values: list[float], width: int = 60) -> str:
    """종가 시계열을 한 줄로. 차트 모양을 눈으로 확인하는 용도."""
    if len(values) > width:  # 균등 다운샘플
        step = len(values) / width
        values = [values[int(i * step)] for i in range(width)]
    lo, hi = min(values), max(values)
    if hi == lo:
        return _SPARK[0] * len(values)
    return "".join(_SPARK[min(int((v - lo) / (hi - lo) * len(_SPARK)), len(_SPARK) - 1)] for v in values)


def _check(label: str, ok: bool, detail: str = "") -> bool:
    print(f"  [{'OK' if ok else 'FAIL'}] {label}" + (f" — {detail}" if detail else ""))
    return ok


def main(ticker: str = DEFAULT_TICKER, interval: str = DEFAULT_INTERVAL) -> int:
    # Windows 기본 콘솔은 cp949 — '—', '→' 에서 UnicodeEncodeError 로 죽는다.
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

    # -- 1. 분봉 --
    try:
        df = provider.get_minute_ohlcv(ticker, interval)
    except kis.KISAuthError as e:
        print(f"[FAIL] 인증 거부 — 키를 확인하세요.\n  {e}")
        if e.msg_cd == "EGW00133":
            print("  (토큰 발급은 앱키당 1분에 1회. 잠시 후 재시도하세요.)")
        return 1

    src = df.attrs
    print(f"분봉 ({ticker}, {interval}): {len(df)}봉  source={src['source']}")

    if src["mock"]:
        print("\n[FAIL] mock=True — KIS 응답을 못 받고 Mock 으로 폴백했습니다.")
        print("       장 시작 전(09:00 이전)·휴장일이면 정상입니다. 장중에 다시 돌려보세요.")
        return 1
    if src["stale"]:
        print("\n[WARN] stale=True — 이번 요청은 실패하고 직전 캐시를 반환했습니다.")
        return 1

    print(f"기간: {df.index[0]} ~ {df.index[-1]}")
    print("\n앞 3봉:\n" + df.head(3).to_string())
    print("\n뒤 3봉:\n" + df.tail(3).to_string())

    close = df["close"].tolist()
    print(f"\n종가 스파크라인 ({close[0]:,.0f} → {close[-1]:,.0f}):")
    print("  " + _sparkline(close))

    # -- 2. 구조 검증 --
    print("\n구조:")
    ok = True
    ok &= _check("스키마", list(df.columns) == ["open", "high", "low", "close", "volume"])
    ok &= _check("시간 오름차순", bool(df.index.is_monotonic_increasing))
    ok &= _check("중복 봉 없음", bool(df.index.is_unique))
    bad_hi = (df["high"] < df[["open", "close"]].max(axis=1)).sum()
    bad_lo = (df["low"] > df[["open", "close"]].min(axis=1)).sum()
    ok &= _check("고가 >= max(시가,종가)", bad_hi == 0, f"위반 {bad_hi}봉")
    ok &= _check("저가 <= min(시가,종가)", bad_lo == 0, f"위반 {bad_lo}봉")
    ok &= _check("거래량 >= 0", bool((df["volume"] >= 0).all()))
    gaps = df.index.to_series().diff().dropna().value_counts()
    print(f"  [INFO] 봉 간격 분포: {dict(gaps)}")

    # -- 3. 현재가 API 와 교차검증 (실데이터의 결정적 증거) --
    print("\n현재가 API(FHKST01010100) 교차검증:")
    try:
        price = provider.get_current_price(ticker)
    except kis.KISAuthError as e:
        print(f"  [FAIL] {e}")
        return 1
    if price["mock"]:
        print("  [FAIL] 현재가가 Mock 입니다 — 교차검증 불가.")
        return 1

    last_close = float(df["close"].iloc[-1])
    day_high, day_low = float(df["high"].max()), float(df["low"].min())
    ok &= _check("마지막 봉 종가 == 현재가", abs(last_close - price["price"]) < 1,
                 f"봉 {last_close:,.0f} vs 현재가 {price['price']:,}")
    # 240봉이 당일 전체를 못 덮으면 고가/저가는 당일 값보다 좁을 수 있다 — 포함관계만 본다.
    ok &= _check("봉 고가 <= 당일 고가", day_high <= price["high"],
                 f"봉 {day_high:,.0f} vs 당일 {price['high']:,}")
    ok &= _check("봉 저가 >= 당일 저가", day_low >= price["low"],
                 f"봉 {day_low:,.0f} vs 당일 {price['low']:,}")

    print()
    if not ok:
        print("[FAIL] 위 항목 중 실패가 있습니다.")
        return 1
    print(f"[OK] {ticker} {interval} 실데이터 확인. 마지막 봉 {last_close:,.0f}원 "
          f"({price['change_pct']:+.2f}%)")
    print("     네이버금융 분봉 차트와 모양을 대조하세요.")
    return 0


if __name__ == "__main__":
    args = sys.argv[1:]
    sys.exit(main(args[0] if args else DEFAULT_TICKER,
                  args[1] if len(args) > 1 else DEFAULT_INTERVAL))
