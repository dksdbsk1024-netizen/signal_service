"""발표 캘린더 (확정 상수 + 규칙 기반 추정) — DESIGN.md §7 매크로 레이어.

외부 경제캘린더 API(Finnhub 등) 없이, 2026년 공개된 확정 일정을 상수로 관리한다.
- 통화정책: 미국 FOMC(연 8회)·한국 금통위(연 8회) — 확정 날짜 상수.
- 파생:     옵션 만기(월물 = 매월 둘째 목요일)·분기 동시만기(3·6·9·12월 네 마녀의 날)·
            MSCI 지수 리밸런싱(반기 5·11월 / 분기 2·8월).
- 경제지표: 미국 CPI 는 BLS 공식 일정 확정 상수. 나머지(미국 PPI·한국 CPI·한국 PPI)는
            발표 패턴이 규칙적 → 확정 상수가 없으면 규칙 기반으로 다음 발표일을
            추정한다(confirmed=False estimated 플래그로 구분).

각 이벤트 = {date, country, name, category, importance, confirmed, d_day, past}.
  · date       "YYYY-MM-DD"
  · country    "US" | "KR" | "GL"(글로벌)
  · category   "통화정책" | "경제지표" | "파생"
  · importance "high" | "medium" | "low"
  · confirmed  True = 공식 확정 일정, False = 규칙 추정/미확정(공식 일정 확인 권장)
  · d_day      이벤트 날짜 - 오늘 (하드코딩 아님, 매 호출 계산). 음수 = 지난 이벤트
  · past       d_day < 0

로직은 프레임워크 독립 — 순수 datetime 계산만 사용한다.

주의: 파일명이 stdlib `calendar` 와 같지만 패키지 모듈(`backend.core.calendar`)이라
      절대 import(`import calendar`)와 충돌하지 않는다.
"""

from __future__ import annotations

import datetime

CATEGORY_MONETARY = "통화정책"
CATEGORY_INDICATOR = "경제지표"
CATEGORY_DERIV = "파생"

# ── 확정 상수 (2026) ───────────────────────────────────────────
# 미국 FOMC 정책결정일 = 이틀 회의 중 둘째 날(성명·기자회견·점도표). 2026 공식 일정.
FOMC_2026 = [
    "2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17",
    "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09",
]

# 한국 금통위 통화정책방향 결정회의(기준금리 결정) 2026 — 연 8회 확정 상수.
# 출처: 한국은행 공식 일정(2025-10-30 발표) — "2026년 금통위 정기회의 개최 예정일정".
#   https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755
# ★ 규칙 추정 금지: 기준금리 결정회의는 1·2·4·5·7·8·10·11월만 개최.
#   3·6·9·12월은 금융안정회의(기준금리 결정 없음)라 이 목록에 넣지 않는다.
#   → "매월 둘째/넷째 목요일" 식 규칙으로 추정하면 6·9·12월에 없는 회의가 생기므로 금지.
# 요일 주의: 대부분 목요일이나 4월 회의는 금요일(2026-04-10).
BOK_MPC_2026 = [
    "2026-01-15",  # 목
    "2026-02-26",  # 목
    "2026-04-10",  # 금
    "2026-05-28",  # 목
    "2026-07-16",  # 목  ← 오늘(2026-07-07) 기준 다음 금통위 (D-9)
    "2026-08-27",  # 목
    "2026-10-22",  # 목
    "2026-11-26",  # 목
]

# MSCI 지수 리밸런싱 반영일(리뷰 반영 마감, 장 마감 기준). 반기(5·11월)=대형, 분기(2·8월).
# ※ confirmed=False — 반영일은 통상 해당 월 말 영업일. 공식 발표로 교체 권장.
MSCI_2026 = [
    ("2026-02-27", "medium"),  # 분기 리뷰(QIR)
    ("2026-05-29", "high"),    # 반기 리뷰(SAIR) — 대형 리밸런싱
    ("2026-08-31", "medium"),  # 분기 리뷰(QIR)
    ("2026-11-30", "high"),    # 반기 리뷰(SAIR) — 대형 리밸런싱
]

# 미국 CPI 발표일 2026 — BLS 공식 일정 확정 상수(전월분을 익월 발표, 08:30 ET).
# 출처: BLS Schedule of Releases for the CPI (news.release archives 로 교차확인).
#   https://www.bls.gov/schedule/news_release/cpi.htm
# ★ 규칙 추정 금지: 발표일이 매월 둘째 주 화/수/목 등으로 들쭉날쭉("day=12 롤" 부정확).
#   예) 6월분 발표는 7월 14일(화)이지 7월 13일(월)이 아니다.
# (date, 기준월). 기준월은 참고용 — get_calendar 는 date 만 사용.
US_CPI_2026 = [
    ("2026-01-13", "2025-12"),
    ("2026-02-13", "2026-01"),
    ("2026-03-11", "2026-02"),
    ("2026-04-10", "2026-03"),
    ("2026-05-12", "2026-04"),
    ("2026-06-10", "2026-05"),
    ("2026-07-14", "2026-06"),  # ← 오늘(2026-07-07) 기준 다음 미국 CPI (D-7)
    ("2026-08-12", "2026-07"),
    ("2026-09-11", "2026-08"),
    ("2026-10-14", "2026-09"),
    ("2026-11-10", "2026-10"),
    ("2026-12-10", "2026-11"),
]

# 나머지 경제지표는 발표 패턴이 규칙적 → 확정 상수 없으면 규칙 기반 다음 발표일 추정.
# day = 대략적 발표 기준일. 미국 PPI: 익월 중순. 한국 CPI: 초(통계청), 한국 PPI: 하순(한은).
# 주말이면 다음 평일로 롤(발표는 평일). confirmed=False(estimated) 로 표기.
# ※ 미국 CPI 는 US_CPI_2026 확정 상수로 분리했으므로 여기서 제외.
INDICATOR_RULES = [
    {"name": "미국 PPI", "country": "US", "day": 13, "importance": "medium"},
    {"name": "한국 CPI", "country": "KR", "day": 2,  "importance": "medium"},
    {"name": "한국 PPI", "country": "KR", "day": 21, "importance": "low"},
]
_INDICATOR_LOOKAHEAD = 3  # 지표별 앞으로 몇 회분까지 추정 생성


# ── 헬퍼 ───────────────────────────────────────────────────────
def _second_thursday(year: int, month: int) -> datetime.date:
    """해당 월 둘째 목요일 = KOSPI200 옵션/선물 만기일."""
    first = datetime.date(year, month, 1)
    offset = (3 - first.weekday()) % 7  # Mon=0 … Thu=3
    return first + datetime.timedelta(days=offset + 7)


def _roll_weekday(d: datetime.date) -> datetime.date:
    """주말이면 다음 평일로 롤(경제지표 발표는 평일에만)."""
    if d.weekday() == 5:   # 토
        return d + datetime.timedelta(days=2)
    if d.weekday() == 6:   # 일
        return d + datetime.timedelta(days=1)
    return d


def _next_monthly(today: datetime.date, day: int, count: int) -> list[datetime.date]:
    """오늘 이후로 매월 `day` 일(주말 롤) 발표일을 `count` 개 생성."""
    out: list[datetime.date] = []
    y, m = today.year, today.month
    while len(out) < count:
        try:
            cand = datetime.date(y, m, day)
        except ValueError:  # day 가 해당 월에 없음(예: 2/30) → 말일 근사
            cand = datetime.date(y, m, 28)
        cand = _roll_weekday(cand)
        if cand >= today:
            out.append(cand)
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return out


def _event(date: datetime.date | str, country: str, name: str, category: str,
           importance: str, confirmed: bool) -> dict:
    ds = date if isinstance(date, str) else date.isoformat()
    return {
        "date": ds,
        "country": country,
        "name": name,
        "category": category,
        "importance": importance,
        "confirmed": confirmed,
    }


# ── 진입점 ─────────────────────────────────────────────────────
def get_calendar(today: datetime.date | None = None) -> list[dict]:
    """오늘 기준 발표 캘린더(날짜순). d_day·past 는 매 호출 실시간 계산.

    today 인자는 테스트/결정성용. 미지정 시 실제 오늘 날짜.
    """
    today = today or datetime.date.today()
    events: list[dict] = []

    # 통화정책 — FOMC(확정) · 금통위(확정)
    for ds in FOMC_2026:
        events.append(_event(ds, "US", "미국 FOMC", CATEGORY_MONETARY, "high", True))
    for ds in BOK_MPC_2026:
        events.append(_event(ds, "KR", "한국 금통위", CATEGORY_MONETARY, "high", True))

    # 파생 — 옵션 만기(월물) · 분기 동시만기(네 마녀의 날)
    for month in range(1, 13):
        thu = _second_thursday(2026, month)
        if month in (3, 6, 9, 12):
            events.append(_event(thu, "KR", "동시만기 (네 마녀의 날)", CATEGORY_DERIV, "high", True))
        else:
            events.append(_event(thu, "KR", "옵션 만기 (월물)", CATEGORY_DERIV, "low", True))

    # 파생 — MSCI 지수 리밸런싱(반영일, 추정)
    for ds, imp in MSCI_2026:
        events.append(_event(ds, "GL", "MSCI 지수 리밸런싱", CATEGORY_DERIV, imp, False))

    # 경제지표 — 미국 CPI 확정 상수(BLS 공식 일정)
    for ds, _ref in US_CPI_2026:
        events.append(_event(ds, "US", "미국 CPI", CATEGORY_INDICATOR, "high", True))

    # 경제지표 — 나머지(미국 PPI·한국 CPI·한국 PPI) 규칙 기반 추정(다음 발표일)
    for rule in INDICATOR_RULES:
        for d in _next_monthly(today, rule["day"], _INDICATOR_LOOKAHEAD):
            events.append(_event(d, rule["country"], rule["name"],
                                 CATEGORY_INDICATOR, rule["importance"], False))

    # d_day / past 실시간 계산 + 날짜순 정렬
    for e in events:
        ed = datetime.date.fromisoformat(e["date"])
        e["d_day"] = (ed - today).days
        e["past"] = e["d_day"] < 0
    events.sort(key=lambda e: e["date"])
    return events
