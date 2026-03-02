from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from config import settings
from models.news import NewsResponse
from services.cache import news_cache
from services.news import fetch_news

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("/{ticker}", response_model=NewsResponse)
async def get_ticker_news(ticker: str) -> NewsResponse:
    """Latest news articles for a ticker via Finnhub."""
    ticker = ticker.upper()

    if not settings.finnhub_configured:
        raise HTTPException(status_code=503, detail="Finnhub API key not configured.")

    cached = await news_cache.get(ticker)
    if cached is not None:
        cached.cached = True
        return cached

    try:
        result = await fetch_news(ticker)
    except Exception:
        logger.exception("Failed to fetch news for %s", ticker)
        raise HTTPException(
            status_code=502,
            detail="Failed to fetch news for {}".format(ticker),
        )

    await news_cache.set(ticker, result)
    return result
