from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from models.stocktwits import StocktwitsDetailResponse, StocktwitsResponse
from services.cache import TTLCache
from services.stocktwits import fetch_ticker_detail, fetch_trending_sentiment

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sentiment", tags=["stocktwits"])

# StockTwits trending data refreshes slowly — 5-minute cache
_trending_cache = TTLCache(ttl=300)

# Per-ticker detail — 3-minute cache
_detail_cache = TTLCache(ttl=180)


@router.get("/stocktwits", response_model=StocktwitsResponse)
async def get_stocktwits_sentiment() -> StocktwitsResponse:
    """StockTwits trending ticker sentiment scores and message volume."""
    cached = await _trending_cache.get("trending")
    if cached is not None:
        cached.cached = True
        return cached

    try:
        result = await fetch_trending_sentiment()
    except Exception:
        logger.exception("StockTwits trending fetch failed")
        raise HTTPException(
            status_code=502,
            detail="Failed to fetch StockTwits data.",
        )

    await _trending_cache.set("trending", result)
    return result


@router.get("/stocktwits/{ticker}", response_model=StocktwitsDetailResponse)
async def get_stocktwits_ticker(ticker: str) -> StocktwitsDetailResponse:
    """Detailed StockTwits sentiment for a specific ticker."""
    key = ticker.upper()

    cached = await _detail_cache.get(key)
    if cached is not None:
        cached.cached = True
        return cached

    try:
        result = await fetch_ticker_detail(key)
    except Exception:
        logger.exception("StockTwits detail fetch failed for %s", key)
        raise HTTPException(
            status_code=502,
            detail=f"Failed to fetch StockTwits data for {key}.",
        )

    await _detail_cache.set(key, result)
    return result
