"""KIS 실연동 단독 검증 — 토큰 발급 + 현재가 하나.

앱(deps.PROVIDER)을 거치지 않고 KISProvider 를 직접 찔러본다 — STOCK_PROVIDER 설정과 무관하다.

    python -m backend.scripts.check_kis            # 삼성전자 005930
    python -m backend.scripts.check_kis 000660     # SK하이닉스

두 번 연속 실행해서 2회차에 '토큰: 캐시 재사용' 이 뜨는지 보는 게 디스크 캐시
동작 확인법이다. (매번 재발급하면 KIS 의 1분 1회 제한에 걸린다.)
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

from backend.core import kis
from backend.core.providers import KISProvider

DEFAULT_TICKER = "005930"


def main(ticker: str = DEFAULT_TICKER) -> int:
    # 인자 없는 load_dotenv() 는 REPL·디버거에서 cwd 기준으로 바뀐다 (api.deps 와 동일).
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    app_key = os.getenv("KIS_APP_KEY", "")
    app_secret = os.getenv("KIS_APP_SECRET", "")

    if not app_key or not app_secret:
        print("[FAIL] KIS_APP_KEY / KIS_APP_SECRET 이 backend/.env 에 없습니다.")
        return 1

    print(f"토큰 캐시 파일: {kis.TOKEN_FILE}")
    had_cache = kis.TOKEN_FILE.exists()

    # -- 1. 토큰 --
    try:
        token = kis.get_access_token(app_key, app_secret)
    except kis.KISAuthError as e:
        print(f"[FAIL] 인증 실패 — 키를 확인하세요.\n  {e}")
        if e.msg_cd:
            print(f"  msg_cd={e.msg_cd}  msg1={e.msg1}")
        if e.msg_cd == "EGW00133":
            print("  (토큰 발급은 앱키당 1분에 1회. 잠시 후 재시도하세요.)")
        return 1

    remaining = kis._TOKEN["expires_at"] - time.time()
    reused = had_cache and remaining > 0
    print(f"[OK] 토큰: {'캐시 재사용' if reused else '신규 발급'}")
    print(f"     {token[:8]}...  (만료까지 {remaining / 3600:.1f}h)")

    # -- 2. 현재가 --
    try:
        data = KISProvider(app_key, app_secret).get_current_price(ticker)
    except kis.KISAuthError as e:
        print(f"[FAIL] 현재가 조회 인증 거부: {e}")
        return 1

    print(f"\n현재가 ({ticker}):")
    print(json.dumps(data, ensure_ascii=False, indent=2))

    if data["mock"]:
        print("\n[FAIL] mock=True — 실연동 실패. KIS 응답을 못 받고 Mock 으로 폴백했습니다.")
        return 1
    if data["stale"]:
        print("\n[WARN] stale=True — 이번 요청은 실패하고 직전 캐시값을 반환했습니다.")
        return 1

    print(f"\n[OK] source={data['source']}  {ticker} {data['price']:,}원 "
          f"({data['change']:+,} / {data['change_pct']:+.2f}%)")
    print("     네이버금융 현재가와 대조하세요. 장 마감 후면 직전 영업일 종가입니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TICKER))
