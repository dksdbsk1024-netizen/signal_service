"""장 시간 판정 — 배지 표시용과 수집 게이트용.

두 창이 다르다. market_status 는 KRX 정규장(09:00~15:30)을 그대로 말하고,
should_collect 는 마감 뒤 10분을 더 연다. 마감 시각에 게이트를 닫으면 마지막
사이클(약 160초)이 종가를 담기 전에 잘려, 그날 마지막 스냅샷이 장중 값으로 남는다.

KRX 휴장일은 모른다(요일과 시각만 본다). 휴장일엔 사이클이 헛돌지만 시세가 변하지
않아 upsert 가 무해하다 — 공휴일 달력은 별건이다.
"""

from __future__ import annotations

import datetime

KST = datetime.timezone(datetime.timedelta(hours=9))

# 수집 게이트 창 (평일). 마감 15:30 + 유예 10분.
_COLLECT_OPEN_HHMM = 900
_COLLECT_CLOSE_HHMM = 1540


def _hhmm(now: datetime.datetime) -> int:
    return now.hour * 100 + now.minute


def market_status(now: datetime.datetime | None = None) -> str:
    """StockHeader 배지용: open(정규장) | after(시간외) | closed.

    KRX 휴장일은 모른다 — 휴장일이면 KIS 가 빈 응답을 주고 provider 가 Mock 으로
    폴백하므로, 배지보다 header["mock"] 이 더 정확한 신선도 신호다.
    """
    now = now or datetime.datetime.now(KST)
    if now.weekday() >= 5:  # 토·일
        return "closed"
    hhmm = _hhmm(now)
    if 900 <= hhmm < 1530:
        return "open"
    if 1530 <= hhmm < 1800:
        return "after"
    return "closed"


def should_collect(now: datetime.datetime | None = None) -> bool:
    """수집기 게이트 — 평일 09:00~15:40 에만 True.

    market_status() == "open" 을 쓰지 않는 이유는 위 모듈 독스트링의 유예 10분 때문이다.
    """
    now = now or datetime.datetime.now(KST)
    if now.weekday() >= 5:
        return False
    return _COLLECT_OPEN_HHMM <= _hhmm(now) < _COLLECT_CLOSE_HHMM
