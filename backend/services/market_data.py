from __future__ import annotations

import asyncio
import logging
import math
from typing import Optional

import yfinance as yf

from models.market import (
    MarketDataResponse,
    MovingAverages,
    OptionsContract,
    OptionsData,
)

logger = logging.getLogger(__name__)

# Options with volume >= this multiple of open interest flagged as unusual
UNUSUAL_VOLUME_RATIO = 3.0
# Min absolute volume to count as unusual (filters out low-liquidity noise)
UNUSUAL_VOLUME_MIN = 500


def _compute_rsi(closes: list[float], period: int = 14) -> Optional[float]:
    """Compute RSI from a list of closing prices."""
    if len(closes) < period + 1:
        return None

    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    recent = deltas[-(period):]

    gains = [d for d in recent if d > 0]
    losses = [-d for d in recent if d < 0]

    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period

    if avg_loss == 0:
        return 100.0

    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)


def _fetch_sync(ticker: str) -> MarketDataResponse:
    """Synchronous yfinance fetch — will be run in executor."""
    stock = yf.Ticker(ticker.upper())

    # ── Price, change, volume from recent history ──
    hist = stock.history(period="1y")

    price: Optional[float] = None
    change_percent: Optional[float] = None
    volume: Optional[int] = None
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    rsi: Optional[float] = None
    sparkline: list = []

    if not hist.empty:
        closes = hist["Close"].tolist()
        volumes = hist["Volume"].tolist()

        price = round(closes[-1], 2)
        volume = int(volumes[-1])

        if len(closes) >= 2:
            prev = closes[-2]
            if prev != 0:
                change_percent = round((closes[-1] - prev) / prev * 100, 2)

        if len(closes) >= 50:
            sma_50 = round(sum(closes[-50:]) / 50, 2)
        if len(closes) >= 200:
            sma_200 = round(sum(closes[-200:]) / 200, 2)

        rsi = _compute_rsi(closes)

        # Last 30 closing prices for sparkline chart
        sparkline = [round(c, 2) for c in closes[-30:]]

    # ── Options chain data ──
    options_data = _fetch_options(stock)

    return MarketDataResponse(
        ticker=ticker.upper(),
        price=price,
        change_percent=change_percent,
        volume=volume,
        moving_averages=MovingAverages(sma_50=sma_50, sma_200=sma_200),
        rsi=rsi,
        sparkline=sparkline,
        options=options_data,
    )


def _fetch_options(stock: yf.Ticker) -> Optional[OptionsData]:
    """Fetch options chain and compute put/call ratio + unusual activity."""
    try:
        expirations = list(stock.options)
    except Exception:
        logger.debug("No options data for %s", stock.ticker)
        return None

    if not expirations:
        return None

    total_call_vol = 0
    total_put_vol = 0
    unusual: list[OptionsContract] = []

    # Scan first 3 expiration dates to keep it fast
    for exp in expirations[:3]:
        try:
            chain = stock.option_chain(exp)
        except Exception:
            logger.debug("Failed to fetch chain for %s exp %s", stock.ticker, exp)
            continue

        for _, row in chain.calls.iterrows():
            vol = _safe_int(row.get("volume"))
            oi = _safe_int(row.get("openInterest"))
            total_call_vol += vol
            if vol >= UNUSUAL_VOLUME_MIN and oi > 0 and vol / oi >= UNUSUAL_VOLUME_RATIO:
                unusual.append(OptionsContract(
                    strike=float(row["strike"]),
                    expiration=exp,
                    type="call",
                    volume=vol,
                    open_interest=oi,
                    implied_volatility=_safe_round(row.get("impliedVolatility")),
                ))

        for _, row in chain.puts.iterrows():
            vol = _safe_int(row.get("volume"))
            oi = _safe_int(row.get("openInterest"))
            total_put_vol += vol
            if vol >= UNUSUAL_VOLUME_MIN and oi > 0 and vol / oi >= UNUSUAL_VOLUME_RATIO:
                unusual.append(OptionsContract(
                    strike=float(row["strike"]),
                    expiration=exp,
                    type="put",
                    volume=vol,
                    open_interest=oi,
                    implied_volatility=_safe_round(row.get("impliedVolatility")),
                ))

    pcr = None
    if total_call_vol > 0:
        pcr = round(total_put_vol / total_call_vol, 4)

    # Sort unusual by volume descending, keep top 10
    unusual.sort(key=lambda c: c.volume, reverse=True)

    return OptionsData(
        put_call_ratio=pcr,
        total_call_volume=total_call_vol,
        total_put_volume=total_put_vol,
        expirations=expirations,
        unusual_activity=unusual[:10],
    )


def _safe_int(val: object) -> int:
    """Convert a value to int, treating NaN/None as 0."""
    if val is None:
        return 0
    try:
        f = float(val)
        if math.isnan(f):
            return 0
        return int(f)
    except (TypeError, ValueError):
        return 0


def _safe_round(val: object, digits: int = 4) -> Optional[float]:
    if val is None:
        return None
    try:
        f = float(val)
        if math.isnan(f):
            return None
        return round(f, digits)
    except (TypeError, ValueError):
        return None


async def fetch_market_data(ticker: str) -> MarketDataResponse:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _fetch_sync, ticker)
