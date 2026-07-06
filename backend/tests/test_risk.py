"""scoring.py 리스크 계산 — 손절/목표·R:R·포지션 사이징."""

import pytest

from backend.core import scoring


def test_risk_plan_long():
    plan = scoring.risk_plan(entry=10000, atr=200, direction="long")
    assert plan["stop"] == 9800  # entry - 1×ATR
    # 목표 1/1.5/2×ATR
    prices = [t["price"] for t in plan["targets"]]
    assert prices == [10200, 10300, 10400]
    # R:R = 배수
    rrs = [t["rr"] for t in plan["targets"]]
    assert rrs == [1.0, 1.5, 2.0]


def test_risk_plan_short_mirrors():
    plan = scoring.risk_plan(entry=10000, atr=200, direction="short")
    assert plan["stop"] == 10200  # 위쪽 손절
    assert [t["price"] for t in plan["targets"]] == [9800, 9700, 9600]


def test_risk_plan_invalid_atr():
    with pytest.raises(ValueError):
        scoring.risk_plan(entry=10000, atr=0, direction="long")


def test_risk_plan_invalid_direction():
    with pytest.raises(ValueError):
        scoring.risk_plan(entry=10000, atr=200, direction="sideways")


def test_position_size():
    # 계좌 1000만, 리스크 2% = 20만원. 주당 리스크 200원 → 1000주
    pos = scoring.position_size(account=10_000_000, risk_pct=2, entry=10000, stop=9800)
    assert pos["risk_amount"] == 200_000
    assert pos["per_share_risk"] == 200
    assert pos["qty"] == 1000
    assert pos["invest_amount"] == 10_000_000


def test_position_size_rounds_down():
    # 20만 / 300 = 666.6 → 666주
    pos = scoring.position_size(account=10_000_000, risk_pct=2, entry=10000, stop=9700)
    assert pos["qty"] == 666


def test_position_size_zero_risk_raises():
    with pytest.raises(ValueError):
        scoring.position_size(account=10_000_000, risk_pct=2, entry=10000, stop=10000)


def test_risk_and_position_integrate():
    plan = scoring.risk_plan(entry=50000, atr=500, direction="long")
    pos = scoring.position_size(
        account=20_000_000, risk_pct=1, entry=plan["entry"], stop=plan["stop"]
    )
    # 주당 리스크 = 1×ATR = 500, 감당 리스크 = 20만 → 400주
    assert pos["per_share_risk"] == 500
    assert pos["qty"] == 400
