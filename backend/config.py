from __future__ import annotations

from dataclasses import dataclass, field
import os
from typing import List


@dataclass
class Settings:
    # Reddit
    reddit_client_id: str = field(default_factory=lambda: os.getenv("REDDIT_CLIENT_ID", ""))
    reddit_client_secret: str = field(default_factory=lambda: os.getenv("REDDIT_CLIENT_SECRET", ""))
    reddit_user_agent: str = field(
        default_factory=lambda: os.getenv("REDDIT_USER_AGENT", "alpha-pulse/0.1")
    )

    # Twitter
    twitter_api_key: str = field(default_factory=lambda: os.getenv("TWITTER_API_KEY", ""))
    twitter_api_secret: str = field(default_factory=lambda: os.getenv("TWITTER_API_SECRET", ""))
    twitter_bearer_token: str = field(default_factory=lambda: os.getenv("TWITTER_BEARER_TOKEN", ""))

    # Finnhub
    finnhub_api_key: str = field(default_factory=lambda: os.getenv("FINNHUB_API_KEY", ""))

    # Anthropic
    anthropic_api_key: str = field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""))

    # Subreddits to scrape
    reddit_subreddits: List[str] = field(
        default_factory=lambda: ["wallstreetbets", "options", "stocks"]
    )
    reddit_post_limit: int = 100

    # Cache TTL in seconds
    cache_ttl: int = 300  # 5 minutes

    @property
    def reddit_configured(self) -> bool:
        return bool(self.reddit_client_id and self.reddit_client_secret)

    @property
    def twitter_configured(self) -> bool:
        return bool(self.twitter_bearer_token or self.twitter_api_key)

    @property
    def finnhub_configured(self) -> bool:
        return bool(self.finnhub_api_key)


settings = Settings()
