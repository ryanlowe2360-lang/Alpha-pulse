from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from models.market import MarketDataResponse
from services.cache import market_cache
from services.market_data import fetch_market_data

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/{ticker}", response_model=MarketDataResponse)
async def get_market_data(ticker: str) -> MarketDataResponse:
    """Current price, change %, volume, moving averages, RSI, and options data."""
    ticker = ticker.upper()

    cached = await market_cache.get(ticker)
    if cached is not None:
        cached.cached = True
        return cached

    try:
        result = await fetch_market_data(ticker)
    except Exception:
        logger.exception("Failed to fetch market data for %s", ticker)
        raise HTTPException(
            status_code=502,
            detail="Failed to fetch market data for {}".format(ticker),
        )

    if result.price is None:
        raise HTTPException(
            status_code=404,
            detail="No market data found for ticker {}".format(ticker),
        )

    await market_cache.set(ticker, result)
    return result
