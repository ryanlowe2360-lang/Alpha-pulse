import asyncio
import logging

from fastapi import APIRouter, HTTPException

from models.sentiment import SentimentResponse
from scrapers.reddit import reddit_scraper
from scrapers.twitter import twitter_scraper
from services.cache import sentiment_cache
from services.sentiment_scorer import RawMention, score_tickers
from services.stocktwits import fetch_mentions_as_raw as stocktwits_fetch_mentions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sentiment", tags=["sentiment"])


async def _scrape_stocktwits() -> list[RawMention]:
    """StockTwits requires no API key — always available."""
    try:
        return await stocktwits_fetch_mentions()
    except Exception:
        logger.exception("StockTwits scrape error")
        return []


async def _scrape_reddit() -> list[RawMention]:
    if not reddit_scraper.is_configured():
        logger.info("Reddit API keys not configured, skipping Reddit")
        return []
    try:
        return await reddit_scraper.fetch_mentions()
    except Exception:
        logger.exception("Reddit scrape error")
        return []


async def _scrape_twitter() -> list[RawMention]:
    if not twitter_scraper.is_configured():
        logger.info("X API keys not configured, using StockTwits only")
        return []
    try:
        return await twitter_scraper.fetch_mentions()
    except Exception:
        logger.exception("Twitter scrape error")
        return []


def _build_source_label(
    stocktwits: list[RawMention],
    reddit: list[RawMention],
    twitter: list[RawMention],
) -> tuple[str, list[str]]:
    """Return (source_label, active_sources) based on which scrapers returned data."""
    active: list[str] = []
    if stocktwits:
        active.append("stocktwits")
    if reddit:
        active.append("reddit")
    if twitter:
        active.append("twitter")
    label = active[0] if len(active) == 1 else "combined"
    return label, active


@router.get("", response_model=SentimentResponse)
async def get_combined_sentiment() -> SentimentResponse:
    """Merged sentiment from all active sources (StockTwits + optional Reddit/X)."""
    cached = await sentiment_cache.get("combined")
    if cached is not None:
        cached.cached = True
        return cached

    stocktwits_mentions, reddit_mentions, twitter_mentions = await asyncio.gather(
        _scrape_stocktwits(), _scrape_reddit(), _scrape_twitter()
    )

    all_mentions = stocktwits_mentions + reddit_mentions + twitter_mentions

    if not all_mentions:
        raise HTTPException(
            status_code=503,
            detail="No data sources available. StockTwits may be down.",
        )

    source, active = _build_source_label(stocktwits_mentions, reddit_mentions, twitter_mentions)
    result = score_tickers(all_mentions, source=source)
    result.active_sources = active
    await sentiment_cache.set("combined", result)
    return result


@router.get("/reddit", response_model=SentimentResponse)
async def get_reddit_sentiment() -> SentimentResponse:
    """Reddit-only sentiment for all tickers."""
    cached = await sentiment_cache.get("reddit")
    if cached is not None:
        cached.cached = True
        return cached

    if not reddit_scraper.is_configured():
        raise HTTPException(status_code=503, detail="Reddit API not configured.")

    mentions = await _scrape_reddit()
    if not mentions:
        raise HTTPException(status_code=503, detail="Failed to fetch Reddit data.")

    result = score_tickers(mentions, source="reddit")
    await sentiment_cache.set("reddit", result)
    return result


@router.get("/twitter", response_model=SentimentResponse)
async def get_twitter_sentiment() -> SentimentResponse:
    """Twitter-only sentiment for all tickers."""
    cached = await sentiment_cache.get("twitter")
    if cached is not None:
        cached.cached = True
        return cached

    if not twitter_scraper.is_configured():
        raise HTTPException(status_code=503, detail="Twitter API not configured.")

    mentions = await _scrape_twitter()
    if not mentions:
        raise HTTPException(status_code=503, detail="Failed to fetch Twitter data.")

    result = score_tickers(mentions, source="twitter")
    await sentiment_cache.set("twitter", result)
    return result
