from __future__ import annotations

import asyncio
import logging
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

from models.stocktwits import (
    StocktwitsDetailResponse,
    StocktwitsMessage,
    StocktwitsResponse,
    StocktwitsTickerDetail,
    StocktwitsTickerSummary,
)

logger = logging.getLogger(__name__)

BASE_URL = "https://api.stocktwits.com/api/2"

# How many trending symbols to fetch messages for
MAX_TRENDING = 30

# Rate-limit: StockTwits free tier allows 200 requests/hour.
# We add a small delay between per-ticker fetches to stay safe.
REQUEST_DELAY = 0.35  # seconds

# Recency half-life in hours — messages older than this get half weight
RECENCY_HALF_LIFE = 6.0


async def _get_json(client: httpx.AsyncClient, url: str) -> Optional[Dict[str, Any]]:
    """Fetch JSON from StockTwits, returning None on failure."""
    try:
        resp = await client.get(url, timeout=10.0)
        if resp.status_code == 429:
            logger.warning("StockTwits rate-limited on %s", url)
            return None
        resp.raise_for_status()
        return resp.json()
    except Exception:
        logger.debug("StockTwits request failed: %s", url, exc_info=True)
        return None


def _parse_messages(data: Dict[str, Any]) -> List[StocktwitsMessage]:
    """Parse messages array from a StockTwits stream response."""
    messages: List[StocktwitsMessage] = []
    for msg in data.get("messages", []):
        sentiment_obj = msg.get("entities", {}).get("sentiment")
        sentiment_label = None
        if sentiment_obj and isinstance(sentiment_obj, dict):
            sentiment_label = sentiment_obj.get("basic")  # "Bullish" or "Bearish"

        likes = 0
        likes_obj = msg.get("likes")
        if isinstance(likes_obj, dict):
            likes = likes_obj.get("total", 0)
        elif isinstance(likes_obj, (int, float)):
            likes = int(likes_obj)

        user = msg.get("user", {})
        username = user.get("username", "") if isinstance(user, dict) else ""

        messages.append(StocktwitsMessage(
            id=msg.get("id", 0),
            body=msg.get("body", ""),
            created_at=msg.get("created_at", ""),
            sentiment=sentiment_label,
            likes=likes,
            username=username,
        ))
    return messages


def _hours_ago(created_at: str) -> float:
    """Parse StockTwits timestamp and return hours elapsed."""
    # StockTwits format: "2026-03-01T14:30:00Z" or similar
    now = datetime.now(timezone.utc)
    try:
        # Try ISO format first
        dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        try:
            # Fallback: common StockTwits format
            dt = datetime.strptime(created_at, "%Y-%m-%dT%H:%M:%SZ").replace(
                tzinfo=timezone.utc
            )
        except (ValueError, AttributeError):
            return 24.0  # fallback — treat as 1 day old
    delta = (now - dt).total_seconds() / 3600.0
    return max(delta, 0.0)


def _score_ticker(messages: List[StocktwitsMessage]) -> Tuple[float, int, int, int]:
    """Score a ticker from its messages.

    Returns (score, bullish_count, bearish_count, untagged_count).

    Scoring:
    - Each tagged message contributes +1 (bullish) or -1 (bearish)
    - Weighted by recency: 0.5 ^ (hours / HALF_LIFE)
    - Weighted by likes: 1 + log1p(likes) to dampen viral outliers
    - Final score normalized to [-100, +100] range
    """
    bullish = 0
    bearish = 0
    untagged = 0

    weighted_sum = 0.0
    total_weight = 0.0

    for msg in messages:
        if msg.sentiment == "Bullish":
            bullish += 1
            direction = 1.0
        elif msg.sentiment == "Bearish":
            bearish += 1
            direction = -1.0
        else:
            untagged += 1
            continue  # untagged messages don't contribute to score

        hours = _hours_ago(msg.created_at)
        recency = math.pow(0.5, hours / RECENCY_HALF_LIFE)
        like_weight = 1.0 + math.log1p(msg.likes)

        weight = recency * like_weight
        weighted_sum += direction * weight
        total_weight += weight

    if total_weight == 0:
        return 0.0, bullish, bearish, untagged

    # Raw score in [-1, +1], scale to [-100, +100]
    raw = weighted_sum / total_weight
    score = round(raw * 100, 1)
    # Clamp just in case
    score = max(-100.0, min(100.0, score))

    return score, bullish, bearish, untagged


def _signal_label(score: float) -> str:
    if score > 15:
        return "bullish"
    if score < -15:
        return "bearish"
    return "neutral"


def _bullish_percent(bullish: int, bearish: int) -> Optional[float]:
    total = bullish + bearish
    if total == 0:
        return None
    return round(bullish / total * 100, 1)


async def fetch_trending_sentiment() -> StocktwitsResponse:
    """Fetch trending tickers and their sentiment from StockTwits."""
    async with httpx.AsyncClient() as client:
        # 1. Get trending symbols
        trending_data = await _get_json(client, f"{BASE_URL}/trending/symbols.json")

        if trending_data is None:
            return StocktwitsResponse(tickers=[], trending_count=0)

        symbols = trending_data.get("symbols", [])
        if not symbols:
            return StocktwitsResponse(tickers=[], trending_count=0)

        # Extract ticker strings
        ticker_list = []
        for sym in symbols[:MAX_TRENDING]:
            t = sym.get("symbol", "") if isinstance(sym, dict) else str(sym)
            if t:
                ticker_list.append(t.upper())

        # 2. Fetch messages for each ticker with rate-limit delay
        summaries: List[StocktwitsTickerSummary] = []

        for rank, ticker in enumerate(ticker_list, start=1):
            if rank > 1:
                await asyncio.sleep(REQUEST_DELAY)

            stream_data = await _get_json(
                client,
                f"{BASE_URL}/streams/symbol/{ticker}.json",
            )
            if stream_data is None:
                continue

            messages = _parse_messages(stream_data)
            if not messages:
                continue

            score, bull, bear, untagged = _score_ticker(messages)

            summaries.append(StocktwitsTickerSummary(
                ticker=ticker,
                score=score,
                signal=_signal_label(score),
                total_messages=len(messages),
                bullish_count=bull,
                bearish_count=bear,
                bullish_percent=_bullish_percent(bull, bear),
                volume_rank=rank,
            ))

        # Sort by message volume descending
        summaries.sort(key=lambda s: s.total_messages, reverse=True)

        return StocktwitsResponse(
            tickers=summaries,
            trending_count=len(ticker_list),
        )


async def fetch_mentions_as_raw() -> list:
    """Fetch StockTwits trending tickers and convert messages to RawMention objects.

    This allows StockTwits data to be merged with Reddit/Twitter mentions
    in the combined sentiment endpoint.
    """
    from services.sentiment_scorer import RawMention

    mentions: list[RawMention] = []

    async with httpx.AsyncClient() as client:
        # 1. Get trending symbols
        trending_data = await _get_json(client, f"{BASE_URL}/trending/symbols.json")
        if trending_data is None:
            return []

        symbols = trending_data.get("symbols", [])
        if not symbols:
            return []

        ticker_list = []
        for sym in symbols[:MAX_TRENDING]:
            t = sym.get("symbol", "") if isinstance(sym, dict) else str(sym)
            if t:
                ticker_list.append(t.upper())

        # 2. Fetch messages for each ticker
        for i, ticker in enumerate(ticker_list):
            if i > 0:
                await asyncio.sleep(REQUEST_DELAY)

            stream_data = await _get_json(
                client,
                f"{BASE_URL}/streams/symbol/{ticker}.json",
            )
            if stream_data is None:
                continue

            messages = _parse_messages(stream_data)
            for msg in messages:
                if msg.sentiment == "Bullish":
                    sentiment_val = 0.7
                elif msg.sentiment == "Bearish":
                    sentiment_val = -0.7
                else:
                    sentiment_val = 0.0

                hours = _hours_ago(msg.created_at)
                ts = datetime.now(timezone.utc).timestamp() - (hours * 3600)

                mentions.append(RawMention(
                    ticker=ticker,
                    platform="stocktwits",
                    score=msg.likes,
                    engagement=1,  # each message counts as 1 engagement unit
                    upvote_ratio=0.5,
                    title=msg.body[:120],
                    url=f"https://stocktwits.com/symbol/{ticker}",
                    timestamp=ts,
                    comment_sentiment=sentiment_val,
                ))

    return mentions


async def fetch_ticker_detail(ticker: str) -> StocktwitsDetailResponse:
    """Fetch detailed StockTwits data for a single ticker."""
    async with httpx.AsyncClient() as client:
        stream_data = await _get_json(
            client,
            f"{BASE_URL}/streams/symbol/{ticker.upper()}.json",
        )

        if stream_data is None:
            # Return an empty detail rather than erroring
            return StocktwitsDetailResponse(
                ticker=StocktwitsTickerDetail(
                    ticker=ticker.upper(),
                    score=0.0,
                    signal="neutral",
                    total_messages=0,
                    bullish_count=0,
                    bearish_count=0,
                    untagged_count=0,
                    bullish_percent=None,
                    volume_rank=None,
                    messages=[],
                )
            )

        messages = _parse_messages(stream_data)
        score, bull, bear, untagged = _score_ticker(messages)

        return StocktwitsDetailResponse(
            ticker=StocktwitsTickerDetail(
                ticker=ticker.upper(),
                score=score,
                signal=_signal_label(score),
                total_messages=len(messages),
                bullish_count=bull,
                bearish_count=bear,
                untagged_count=untagged,
                bullish_percent=_bullish_percent(bull, bear),
                volume_rank=None,
                messages=messages,
            )
        )
