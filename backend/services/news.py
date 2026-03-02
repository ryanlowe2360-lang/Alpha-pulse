from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import httpx

from config import settings
from models.news import NewsArticle, NewsResponse

logger = logging.getLogger(__name__)

FINNHUB_BASE = "https://finnhub.io/api/v1"


async def fetch_news(ticker: str) -> NewsResponse:
    """Fetch the latest 10 news articles for a ticker from Finnhub."""
    url = "{}/company-news".format(FINNHUB_BASE)

    # Finnhub requires a date range — use last 7 days
    now = datetime.now(timezone.utc)
    to_date = now.strftime("%Y-%m-%d")
    from_date = (now - timedelta(days=7)).strftime("%Y-%m-%d")

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params={
            "symbol": ticker.upper(),
            "from": from_date,
            "to": to_date,
            "token": settings.finnhub_api_key,
        })
        resp.raise_for_status()
        data = resp.json()

    articles: list[NewsArticle] = []
    for item in data[:10]:
        published_ts = item.get("datetime", 0)
        published_at = datetime.fromtimestamp(
            published_ts, tz=timezone.utc
        ).isoformat() if published_ts else ""

        articles.append(NewsArticle(
            headline=item.get("headline", ""),
            source=item.get("source", ""),
            url=item.get("url", ""),
            summary=item.get("summary", "")[:500],
            image=item.get("image") or None,
            published_at=published_at,
        ))

    return NewsResponse(ticker=ticker.upper(), articles=articles)
