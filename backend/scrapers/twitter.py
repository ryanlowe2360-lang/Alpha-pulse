from __future__ import annotations

import logging
import time
from typing import Optional

import httpx
import tweepy
from bs4 import BeautifulSoup

from config import settings
from scrapers.base import BaseScraper
from services.sentiment_scorer import RawMention
from services.ticker_extractor import extract_tickers

logger = logging.getLogger(__name__)

# Cashtag search queries
SEARCH_QUERIES = [
    "$SPY OR $QQQ OR $AAPL OR $TSLA OR $NVDA",
    "$AMD OR $AMZN OR $MSFT OR $META OR $GOOGL",
    "$GME OR $AMC OR $PLTR OR $SOFI OR $COIN",
]

# Fintwit accounts to pull recent tweets from
FINTWIT_ACCOUNTS = [
    "unusual_whales",
    "DeItaone",
    "zabornadya",
    "OptionsHawk",
    "Fxhedgers",
    "WallStJesus",
    "jimcramer",
    "SqueezeMetrics",
]

# Max tweets to pull per fintwit account
FINTWIT_TWEET_LIMIT = 20


class TwitterScraper(BaseScraper):
    def __init__(self) -> None:
        self._client: Optional[tweepy.Client] = None

    def is_configured(self) -> bool:
        return settings.twitter_configured

    def _get_client(self) -> tweepy.Client:
        if self._client is None:
            self._client = tweepy.Client(
                bearer_token=settings.twitter_bearer_token,
                consumer_key=settings.twitter_api_key,
                consumer_secret=settings.twitter_api_secret,
                wait_on_rate_limit=False,
            )
        return self._client

    async def fetch_mentions(self) -> list[RawMention]:
        """Try Tweepy API first, fall back to Nitter scraping."""
        try:
            return await self._fetch_tweepy()
        except Exception:
            logger.warning("Tweepy API failed, falling back to web scraping")
            try:
                return await self._fetch_nitter()
            except Exception:
                logger.exception("Web scraping fallback also failed")
                return []

    async def _fetch_tweepy(self) -> list[RawMention]:
        client = self._get_client()
        mentions: list[RawMention] = []

        # 1) Cashtag searches
        for query in SEARCH_QUERIES:
            mentions.extend(self._search_tweets(client, query))

        # 2) Recent tweets from fintwit accounts
        for username in FINTWIT_ACCOUNTS:
            try:
                user_resp = client.get_user(username=username)
                if not user_resp.data:
                    continue
                user_id = user_resp.data.id
                tweets_resp = client.get_users_tweets(
                    id=user_id,
                    max_results=FINTWIT_TWEET_LIMIT,
                    tweet_fields=["created_at", "public_metrics"],
                )
                if not tweets_resp.data:
                    continue
                for tweet in tweets_resp.data:
                    mention = self._tweet_to_mentions(tweet)
                    mentions.extend(mention)
            except tweepy.TooManyRequests:
                logger.warning("Rate limit hit fetching @%s, stopping fintwit pulls", username)
                break
            except Exception:
                logger.exception("Failed to fetch tweets from @%s", username)

        return mentions

    def _search_tweets(
        self, client: tweepy.Client, query: str
    ) -> list[RawMention]:
        """Run a single search query and return mentions."""
        results: list[RawMention] = []
        try:
            response = client.search_recent_tweets(
                query=query,
                max_results=50,
                tweet_fields=["created_at", "public_metrics", "author_id"],
            )
            if not response.data:
                return results
            for tweet in response.data:
                results.extend(self._tweet_to_mentions(tweet))
        except tweepy.TooManyRequests:
            logger.warning("Twitter rate limit hit on query: %s", query)
            raise
        except Exception:
            logger.exception("Tweepy search failed for query: %s", query)
        return results

    @staticmethod
    def _tweet_to_mentions(tweet: tweepy.Tweet) -> list[RawMention]:
        """Convert a single tweet into RawMention entries (one per ticker found)."""
        tickers = extract_tickers(tweet.text)
        if not tickers:
            return []

        metrics = tweet.public_metrics or {}
        likes = metrics.get("like_count", 0)
        retweets = metrics.get("retweet_count", 0)
        replies = metrics.get("reply_count", 0)

        created_at = tweet.created_at
        ts = created_at.timestamp() if created_at else time.time()

        return [
            RawMention(
                ticker=ticker,
                platform="twitter",
                score=likes,
                engagement=retweets + replies,
                upvote_ratio=0.5,
                title=tweet.text[:120],
                url="https://twitter.com/i/status/{}".format(tweet.id),
                timestamp=ts,
            )
            for ticker in tickers
        ]

    async def _fetch_nitter(self) -> list[RawMention]:
        """Fallback: scrape Nitter for cashtag mentions + fintwit timelines."""
        mentions: list[RawMention] = []
        nitter_base = "https://nitter.net"

        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            # Cashtag search
            for cashtag in ["SPY", "TSLA", "NVDA", "AAPL", "AMD", "QQQ", "MSFT", "META"]:
                results = await self._scrape_nitter_search(
                    client, nitter_base, "${}".format(cashtag)
                )
                mentions.extend(results)

            # Fintwit account timelines
            for username in FINTWIT_ACCOUNTS:
                results = await self._scrape_nitter_timeline(
                    client, nitter_base, username
                )
                mentions.extend(results)

        return mentions

    async def _scrape_nitter_search(
        self,
        client: httpx.AsyncClient,
        base_url: str,
        query: str,
    ) -> list[RawMention]:
        """Scrape a single Nitter search page."""
        try:
            resp = await client.get(
                "{}/search".format(base_url), params={"q": query}
            )
            if resp.status_code != 200:
                return []
            return self._parse_nitter_timeline(resp.text)
        except Exception:
            logger.exception("Nitter search failed for %s", query)
            return []

    async def _scrape_nitter_timeline(
        self,
        client: httpx.AsyncClient,
        base_url: str,
        username: str,
    ) -> list[RawMention]:
        """Scrape a single Nitter user timeline."""
        try:
            resp = await client.get("{}/{}".format(base_url, username))
            if resp.status_code != 200:
                return []
            return self._parse_nitter_timeline(resp.text)
        except Exception:
            logger.exception("Nitter timeline failed for @%s", username)
            return []

    @staticmethod
    def _parse_nitter_timeline(html: str) -> list[RawMention]:
        """Parse tweets from a Nitter HTML page."""
        mentions: list[RawMention] = []
        soup = BeautifulSoup(html, "html.parser")

        for item in soup.select(".timeline-item")[:20]:
            content_el = item.select_one(".tweet-content")
            stats_el = item.select_one(".tweet-stats")
            link_el = item.select_one(".tweet-link")

            if not content_el:
                continue

            text = content_el.get_text(strip=True)
            tickers = extract_tickers(text)
            if not tickers:
                continue

            likes = 0
            retweets = 0
            if stats_el:
                for stat in stats_el.select(".tweet-stat"):
                    val_el = stat.select_one(".tweet-stat-value")
                    if not val_el:
                        continue
                    val = _parse_stat_value(val_el.get_text(strip=True))
                    icon = stat.select_one(".icon-container")
                    if icon:
                        icon_class = " ".join(icon.get("class", []))
                        if "heart" in icon_class or "like" in icon_class:
                            likes = val
                        elif "retweet" in icon_class:
                            retweets = val

            url = ""
            if link_el and link_el.get("href"):
                url = "https://twitter.com{}".format(link_el["href"])

            for ticker in tickers:
                mentions.append(
                    RawMention(
                        ticker=ticker,
                        platform="twitter",
                        score=likes,
                        engagement=retweets,
                        upvote_ratio=0.5,
                        title=text[:120],
                        url=url,
                        timestamp=time.time(),
                    )
                )

        return mentions


def _parse_stat_value(text: str) -> int:
    """Parse '1.2K' style numbers."""
    text = text.strip().replace(",", "")
    if not text:
        return 0
    try:
        if text.endswith("K"):
            return int(float(text[:-1]) * 1000)
        if text.endswith("M"):
            return int(float(text[:-1]) * 1_000_000)
        return int(text)
    except ValueError:
        return 0


twitter_scraper = TwitterScraper()
