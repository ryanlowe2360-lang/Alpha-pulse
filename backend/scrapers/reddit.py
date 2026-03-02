from __future__ import annotations

import asyncio
import logging
from typing import Optional

import praw

from config import settings
from scrapers.base import BaseScraper
from services.comment_analyzer import score_comments
from services.sentiment_scorer import RawMention
from services.ticker_extractor import extract_tickers

logger = logging.getLogger(__name__)

# Max top-level comments to sample per post for tone analysis
COMMENT_SAMPLE_LIMIT = 10


class RedditScraper(BaseScraper):
    def __init__(self) -> None:
        self._reddit: Optional[praw.Reddit] = None

    def is_configured(self) -> bool:
        return settings.reddit_configured

    def _get_client(self) -> praw.Reddit:
        if self._reddit is None:
            self._reddit = praw.Reddit(
                client_id=settings.reddit_client_id,
                client_secret=settings.reddit_client_secret,
                user_agent=settings.reddit_user_agent,
            )
        return self._reddit

    def _sample_comment_bodies(self, post: praw.models.Submission) -> list[str]:
        """Pull the top N comment bodies from a post for tone analysis."""
        bodies: list[str] = []
        try:
            post.comment_sort = "top"
            post.comments.replace_more(limit=0)
            for comment in post.comments[:COMMENT_SAMPLE_LIMIT]:
                if hasattr(comment, "body") and comment.body:
                    bodies.append(comment.body)
        except Exception:
            logger.debug("Could not fetch comments for post %s", post.id)
        return bodies

    def _fetch_sync(self) -> list[RawMention]:
        """Synchronous PRAW fetch — runs in executor."""
        reddit = self._get_client()
        mentions: list[RawMention] = []

        for sub_name in settings.reddit_subreddits:
            try:
                subreddit = reddit.subreddit(sub_name)
                # Top posts from the last 24 hours
                for post in subreddit.top(
                    time_filter="day", limit=settings.reddit_post_limit
                ):
                    text = "{} {}".format(post.title, post.selftext or "")
                    tickers = extract_tickers(text)
                    if not tickers:
                        continue

                    # Sample top comments for sentiment tone
                    comment_bodies = self._sample_comment_bodies(post)
                    tone = score_comments(comment_bodies)

                    for ticker in tickers:
                        mentions.append(
                            RawMention(
                                ticker=ticker,
                                platform="reddit",
                                score=post.score,
                                engagement=post.num_comments,
                                upvote_ratio=post.upvote_ratio,
                                title=post.title[:120],
                                url="https://reddit.com{}".format(post.permalink),
                                timestamp=post.created_utc,
                                comment_sentiment=tone,
                            )
                        )
            except Exception:
                logger.exception("Failed to scrape r/%s", sub_name)

        return mentions

    async def fetch_mentions(self) -> list[RawMention]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._fetch_sync)


reddit_scraper = RedditScraper()
