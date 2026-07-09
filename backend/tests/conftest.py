"""pytest 전역 설정 — 테스트를 네트워크에서 떼어낸다.

deps 는 모듈 import 시점에 provider 를 정한다. conftest 는 테스트 모듈 import 보다 먼저
로드되므로 여기서 환경변수로 소스를 고정한다. 테스트 파일 하나에서 dependency_overrides 로
막는 방식은 새 테스트 파일이 생기면 조용히 뚫린다(실측: override 없이 /api/macro 한 번 호출에
외부 연결 24회, 그런데 폴백이 네트워크 실패를 삼켜 테스트는 그대로 통과했다).

- 매크로: FRED/ECOS 키를 비워 core.macro 를 Mock 으로 떨군다. load_dotenv(override=False)는
  이미 있는 키를 덮지 않으므로, deps import 시 .env 값이 이 빈 문자열을 이기지 못한다.
- 시세: yfinance 는 키가 없어도 네트워크를 탄다 → MACRO_LIVE_QUOTES=0 이 따로 필요하다.
"""

from __future__ import annotations

import os

os.environ.setdefault("FRED_API_KEY", "")
os.environ.setdefault("ECOS_API_KEY", "")
os.environ.setdefault("MACRO_LIVE_QUOTES", "0")
