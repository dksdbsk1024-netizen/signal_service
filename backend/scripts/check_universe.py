"""유니버스 종목코드 유효성 검증 — universe_top200.json 의 200개를 실 KIS 로 확인.

목록은 사람이 손으로 적었다. 오타·상장폐지·티커 변경이 섞이면 수집기가 매 사이클마다
그 종목에서 조용히 실패하고, 스크리너에는 그냥 빠진 채로 보인다. 커밋 전에 여기서 걸러라.

    python -m backend.scripts.check_universe          # 전체 200종목
    python -m backend.scripts.check_universe 20       # 앞 20종목만

build_current_price 가 아니라 _fetch_price 를 직접 쓴다 — 전자는 실패를 Mock 으로
덮어써서(폴백) 잘못된 코드가 성공처럼 보인다. 대신 수집기와 같은 재시도(_retry_on_data)를
씌운다. 재시도 없이 한 방에 판정하면 유량 초과(EGW00201)를 '잘못된 티커'로 오진한다.

호출은 kis._RATE 토큰버킷을 통과한다(초당 KIS_MAX_RPS 건). 앱(uvicorn)이 같은 앱키로
수집 중이면 버킷이 프로세스마다 따로라 합산 유량이 한도를 넘는다 — 검증 중엔 앱을 내려라.
"""

# KIS 유량 초과. 티커가 틀린 게 아니라 우리가 너무 빨리 쏜 것.
_THROTTLE = "EGW00201"

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

from backend.core import kis
from backend.core.collector import load_universe


def main(limit: int | None = None) -> int:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    app_key = os.getenv("KIS_APP_KEY", "")
    app_secret = os.getenv("KIS_APP_SECRET", "")
    if not app_key or not app_secret:
        print("[FAIL] KIS_APP_KEY / KIS_APP_SECRET 이 backend/.env 에 없습니다.")
        return 1

    universe = load_universe()
    if limit:
        universe = universe[:limit]

    try:
        token = kis.get_access_token(app_key, app_secret)
    except kis.KISAuthError as e:
        print(f"[FAIL] 인증 실패: {e}")
        return 1

    print(f"{len(universe)}종목 검증 (초당 {kis.KIS_MAX_RPS:.0f}건 상한)\n", flush=True)
    started = time.monotonic()
    bad: list[tuple[str, str, str]] = []
    throttled: list[str] = []

    for i, row in enumerate(universe, 1):
        ticker, name = row["ticker"], row["name"]
        try:
            out = kis._retry_on_data(
                lambda t=ticker: kis._fetch_price(t, token, app_key, app_secret)
            )
        except kis.KISAuthError as e:
            print(f"\n[FAIL] 인증이 중간에 거부됨 — 중단: {e}")
            return 1
        except kis.KISDataError as e:
            if _THROTTLE in str(e):
                throttled.append(ticker)
                print(f"  {i:3d}. {ticker} {name:<20} THROTTLED", flush=True)
            else:
                bad.append((ticker, name, str(e)))
                print(f"  {i:3d}. {ticker} {name:<20} FAIL", flush=True)
            continue
        price = out.get("stck_prpr", "?")
        print(f"  {i:3d}. {ticker} {name:<20} {price}원", flush=True)

    elapsed = time.monotonic() - started
    rps = len(universe) / elapsed if elapsed else 0
    print(f"\n{len(universe)}건 / {elapsed:.1f}초 = {rps:.1f} req/s")

    if throttled:
        print(f"\n[WARN] 유량 초과로 판정 불가 {len(throttled)}개: {', '.join(throttled)}")
        print("       앱(uvicorn)을 내리고 다시 돌리거나 KIS_MAX_RPS 를 낮추세요.")

    if bad:
        print(f"\n[FAIL] 잘못된 종목 {len(bad)}개 — universe_top200.json 을 고치세요:")
        for ticker, name, err in bad:
            print(f"  {ticker} {name}: {err}")
        return 1

    if throttled:
        return 2

    print("\n[OK] 전 종목 유효")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(int(sys.argv[1]) if len(sys.argv) > 1 else None))
