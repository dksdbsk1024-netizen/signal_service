"""데이터 소스 추상화 (DESIGN.md §6).

데이터 ↔ 로직 분리 원칙: 스코어링·지표는 provider 인터페이스에만 의존한다.
소스를 KIS/FRED로 바꾸든 Mock으로 바꾸든 로직은 그대로 재사용된다.

- StockProvider / MacroProvider: 추상 인터페이스.
- MockProvider: 시드 고정 합성 데이터. API 키 없이 개발·UI 테스트·pytest에 사용.
- KISProvider / MacroDataProvider: 실연동 골격(후순위, NotImplementedError).
"""

from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np
import pandas as pd


# ── 추상 인터페이스 ────────────────────────────────────────────
class StockProvider(ABC):
    """종목 데이터 소스."""

    @abstractmethod
    def get_current_price(self, ticker: str) -> dict:
        """현재가 스냅샷. price/change/change_pct/open/high/low/volume/as_of + source·mock·stale."""

    @abstractmethod
    def get_minute_ohlcv(self, ticker: str, interval: str = "1m") -> pd.DataFrame:
        """분봉 OHLCV. open/high/low/close/volume 컬럼, 시간 오름차순 DatetimeIndex."""

    @abstractmethod
    def get_investor_flow(self, ticker: str) -> dict:
        """투자자별 순매수(외국인·기관·프로그램 등) + as_of."""

    @abstractmethod
    def get_orderbook(self, ticker: str) -> dict:
        """호가창(Level 2)."""

    @abstractmethod
    def get_trade_strength(self, ticker: str) -> dict:
        """체결강도(매수/매도 체결 비율)."""

    @abstractmethod
    def get_investor_flow_series(self, ticker: str, days: int = 20) -> dict:
        """외국인·기관·프로그램 일별 순매수 시계열 (수급 추이 차트용)."""

    @abstractmethod
    def get_broker_activity(self, ticker: str) -> list[dict]:
        """거래원(창구)별 매수/매도/순매수 상위."""


class MacroProvider(ABC):
    """경제지표 + 시세 데이터 소스."""

    @abstractmethod
    def get_economic_indicator(self, name: str) -> dict:
        """경제지표 실제/예상/이전 + as_of."""

    @abstractmethod
    def get_release_calendar(self) -> list[dict]:
        """발표 일정."""

    @abstractmethod
    def get_index(self, name: str) -> dict:
        """지수 시세."""

    @abstractmethod
    def get_fx(self, pair: str) -> dict:
        """환율."""

    @abstractmethod
    def get_volatility(self) -> dict:
        """VIX 등 변동성."""


# ── Mock 구현 ──────────────────────────────────────────────────
def _seed_for(ticker: str) -> int:
    """티커 문자열 → 결정적 시드. 같은 종목은 항상 같은 합성 데이터."""
    return abs(hash(ticker)) % (2**32) if not ticker.isdigit() else int(ticker) % (2**32)


class MockProvider(StockProvider, MacroProvider):
    """결정적 합성 데이터 provider.

    종목 코드로 시드를 고정해 검색 종목이 바뀌면 값도 바뀌되 재현 가능하다.
    기하 브라운 운동 유사 랜덤워크로 그럴듯한 OHLCV를 만든다.
    """

    def __init__(self, bars: int = 240, as_of: str = "2026-07-06 15:30 KST"):
        self.bars = bars
        self.as_of = as_of

    # -- 종목 --
    def get_current_price(self, ticker: str) -> dict:
        """당일 분봉에서 파생한 현재가. kis._normalize 와 동일 스키마.

        전일 종가가 없으므로 등락은 '당일 시가 대비'로 근사한다(KIS 는 전일 종가 대비).
        """
        df = self.get_minute_ohlcv(ticker)
        last = float(df["close"].iloc[-1])
        first = float(df["open"].iloc[0])
        change = last - first
        return {
            "ticker": ticker,
            "market": "",
            "sector": "",
            "price": round(last, 1),
            "change": round(change, 1),
            "change_pct": round(change / first * 100, 2) if first else 0.0,
            "sign": "2" if change > 0 else "5" if change < 0 else "3",
            "open": round(first, 1),
            "high": round(float(df["high"].max()), 1),
            "low": round(float(df["low"].min()), 1),
            "volume": int(df["volume"].sum()),
            "as_of": self.as_of,
            "source": "mock",
            "mock": True,
            "stale": False,
        }

    def get_minute_ohlcv(self, ticker: str, interval: str = "1m") -> pd.DataFrame:
        rng = np.random.default_rng(_seed_for(ticker))
        n = self.bars
        base = 10000 + rng.integers(0, 90000)  # 종목별 기준가
        # 로그수익률 랜덤워크 + 약한 추세
        drift = rng.normal(0, 0.0003)
        rets = rng.normal(drift, 0.004, n)
        close = base * np.exp(np.cumsum(rets))
        # OHLC 파생
        noise = np.abs(rng.normal(0, 0.002, n)) * close
        open_ = np.concatenate([[close[0]], close[:-1]])
        high = np.maximum(open_, close) + noise
        low = np.minimum(open_, close) - noise
        volume = rng.integers(5_000, 500_000, n).astype(float)
        # 마지막 봉 거래량을 확률적으로 급증시켜 volume_surge 신호가 살아있게
        if rng.random() < 0.5:
            volume[-1] *= rng.uniform(1.5, 4.0)
        idx = pd.date_range(end=pd.Timestamp("2026-07-06 15:30"), periods=n, freq="1min")
        return pd.DataFrame(
            {"open": open_, "high": high, "low": low, "close": close, "volume": volume},
            index=idx,
        )

    def get_investor_flow(self, ticker: str) -> dict:
        rng = np.random.default_rng(_seed_for(ticker) + 1)
        foreign = float(rng.normal(0, 50))
        institution = float(rng.normal(0, 40))
        program = float(rng.normal(0, 30))
        return {
            "foreign": round(foreign, 1),
            "institution": round(institution, 1),
            "program": round(program, 1),
            "retail": round(-(foreign + institution), 1),  # 개인은 반대편(근사)
            "unit": "억원",
            "as_of": self.as_of,
        }

    def get_orderbook(self, ticker: str) -> dict:
        rng = np.random.default_rng(_seed_for(ticker) + 2)
        mid = float(self.get_minute_ohlcv(ticker)["close"].iloc[-1])
        tick = max(round(mid * 0.001), 1)
        asks = [
            {"price": round(mid + tick * i), "qty": int(rng.integers(10, 5000))}
            for i in range(1, 11)
        ]
        bids = [
            {"price": round(mid - tick * i), "qty": int(rng.integers(10, 5000))}
            for i in range(1, 11)
        ]
        return {"asks": asks, "bids": bids, "as_of": self.as_of}

    def get_trade_strength(self, ticker: str) -> dict:
        rng = np.random.default_rng(_seed_for(ticker) + 3)
        strength = float(rng.uniform(60, 160))  # 100 기준, >100 매수 우위
        return {"strength": round(strength, 1), "as_of": self.as_of}

    def get_investor_flow_series(self, ticker: str, days: int = 20) -> dict:
        rng = np.random.default_rng(_seed_for(ticker) + 4)
        # 종목별 약한 추세(bias)를 준 일별 순매수(억원).
        f_bias, i_bias, p_bias = rng.normal(0, 8, 3)
        foreign = [round(float(rng.normal(f_bias, 30)), 1) for _ in range(days)]
        institution = [round(float(rng.normal(i_bias, 24)), 1) for _ in range(days)]
        program = [round(float(rng.normal(p_bias, 18)), 1) for _ in range(days)]
        dates = [f"{(d % 12) + 1:02d}/{(d % 28) + 1:02d}" for d in range(days)]
        return {
            "dates": dates,
            "foreign": foreign,
            "institution": institution,
            "program": program,
            "unit": "억원",
            "as_of": self.as_of,
        }

    def get_broker_activity(self, ticker: str) -> list[dict]:
        rng = np.random.default_rng(_seed_for(ticker) + 5)
        names = ["미래에셋", "삼성증권", "키움증권", "NH투자", "한국투자", "KB증권",
                 "신한투자", "메리츠", "모간스탠리", "골드만삭스"]
        rows = []
        for name in names:
            buy = int(rng.integers(1_000, 200_000))
            sell = int(rng.integers(1_000, 200_000))
            rows.append({"name": name, "buy": buy, "sell": sell, "net": buy - sell})
        rows.sort(key=lambda r: abs(r["net"]), reverse=True)
        return rows[:8]

    # -- 매크로 (합성 고정값) --
    def get_economic_indicator(self, name: str) -> dict:
        rng = np.random.default_rng(abs(hash(name)) % (2**32))
        actual = round(float(rng.uniform(1.0, 5.0)), 2)
        forecast = round(actual + float(rng.normal(0, 0.2)), 2)
        previous = round(actual + float(rng.normal(0, 0.3)), 2)
        return {
            "name": name,
            "actual": actual,
            "forecast": forecast,
            "previous": previous,
            "surprise": round(actual - forecast, 2),
            "as_of": "2026-06 발표",
        }

    def get_release_calendar(self) -> list[dict]:
        # 발표 캘린더 = 확정 상수 + 규칙 추정(core.calendar). d_day 는 오늘 기준 실시간.
        from .calendar import get_calendar  # 지연 import
        return get_calendar()

    def get_index(self, name: str) -> dict:
        rng = np.random.default_rng(abs(hash(name)) % (2**32) + 7)
        value = round(float(rng.uniform(800, 3000)), 2)
        change_pct = round(float(rng.normal(0, 1.0)), 2)
        return {"name": name, "value": value, "change_pct": change_pct, "as_of": self.as_of}

    def get_fx(self, pair: str) -> dict:
        return {"pair": pair, "value": 1352.4, "change_pct": -0.28, "as_of": self.as_of}

    def get_volatility(self) -> dict:
        return {"name": "VIX", "value": 17.3, "change_pct": 2.1, "as_of": self.as_of}


# ── 실연동 ─────────────────────────────────────────────────────
class KISProvider(StockProvider):
    """한국투자증권 KIS API 연동. 현재가부터 붙인다 — 나머지는 아직 골격."""

    def __init__(self, app_key: str, app_secret: str, account: str = ""):
        self.app_key = app_key
        self.app_secret = app_secret
        self.account = account  # 현재가 조회엔 불필요. 주문·잔고 단계에서 사용.

    def get_current_price(self, ticker: str) -> dict:
        """실시간 현재가. 캐시·재시도·stale 폴백은 core.kis 가 처리.

        키가 틀리면 core.kis.KISAuthError 가 올라온다(Mock 으로 폴백하지 않음).
        """
        from . import kis  # 지연 import (requests 의존)
        return kis.build_current_price(ticker, self.app_key, self.app_secret)

    def get_minute_ohlcv(self, ticker: str, interval: str = "1m") -> pd.DataFrame:
        raise NotImplementedError("KIS 실연동 미구현 (로드맵 §10 2단계)")

    def get_investor_flow(self, ticker: str) -> dict:
        raise NotImplementedError("KIS 실연동 미구현 (로드맵 §10 2단계)")

    def get_orderbook(self, ticker: str) -> dict:
        raise NotImplementedError("KIS 실연동 미구현 (로드맵 §10 2단계)")

    def get_trade_strength(self, ticker: str) -> dict:
        raise NotImplementedError("KIS 실연동 미구현 (로드맵 §10 2단계)")

    def get_investor_flow_series(self, ticker: str, days: int = 20) -> dict:
        raise NotImplementedError("KIS 실연동 미구현 (로드맵 §10 2단계)")

    def get_broker_activity(self, ticker: str) -> list[dict]:
        raise NotImplementedError("KIS 실연동 미구현 (로드맵 §10 2단계)")


class MacroDataProvider(MacroProvider):
    """경제지표 = 실데이터(미국 FRED · 한국 ECOS, core.macro). 시세 = yfinance 실데이터.
    발표 캘린더 = core.calendar(확정 상수 + 규칙 추정, 오늘 기준 D-day).

    각 소스 키(fred_key/ecos_key)가 있을 때만 해당 지표를 실데이터로 받는다. 키가
    없거나 개별 지표 fetch 실패 시 core.macro 가 지표 단위로 Mock 폴백하므로 앱은 안 죽는다.
    시세(지수·환율·VIX)는 키 불필요 — core.quotes 가 캐시·재시도·stale 폴백을 처리한다.
    `live_quotes=False` 면 시세도 Mock(오프라인 테스트·결정성용).
    """

    def __init__(self, fred_key: str | None, ecos_key: str | None = None,
                 live_quotes: bool = True):
        self.fred_key = fred_key
        self.ecos_key = ecos_key
        self.live_quotes = live_quotes
        self._mock = MockProvider()  # 발표일정은 Mock 유지

    def get_economic_indicator(self, name: str) -> dict:
        from . import macro  # 지연 import (requests 의존)
        return macro.build_indicator(name, fred_key=self.fred_key, ecos_key=self.ecos_key)

    def get_release_calendar(self) -> list[dict]:
        # 확정 상수 + 규칙 추정(core.calendar). 오늘 기준 D-day 실시간 계산.
        from .calendar import get_calendar  # 지연 import
        return get_calendar()

    def _quote(self, name: str) -> dict:
        from . import quotes  # 지연 import (yfinance 의존)
        return quotes.build_quote(name) if self.live_quotes else quotes.mock_quote(name)

    def get_index(self, name: str) -> dict:
        return self._quote(name)

    def get_fx(self, pair: str) -> dict:
        from . import quotes
        return self._quote(quotes.FX_NAME)

    def get_volatility(self) -> dict:
        return self._quote("VIX")
