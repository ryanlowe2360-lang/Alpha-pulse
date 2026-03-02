import math
import time
from collections import defaultdict
from dataclasses import dataclass, field

from models.sentiment import (
    PlatformBreakdown,
    PostInfo,
    SentimentResponse,
    TickerSentiment,
)


@dataclass
class RawMention:
    ticker: str
    platform: str  # "reddit" | "twitter" | "stocktwits"
    score: int  # upvotes or likes
    engagement: int  # comments or retweets+replies
    upvote_ratio: float  # reddit only, default 0.5 for twitter
    title: str
    url: str
    timestamp: float  # unix epoch
    comment_sentiment: float = 0.0  # [-1, +1] from comment tone analysis


@dataclass
class TickerAccumulator:
    mentions: list[RawMention] = field(default_factory=list)

    def add(self, mention: RawMention) -> None:
        self.mentions.append(mention)


def _base_sentiment(mention: RawMention) -> float:
    if mention.platform == "reddit":
        # Blend upvote ratio (60%) with comment tone (40%)
        vote_signal = (mention.upvote_ratio - 0.5) * 2
        return vote_signal * 0.6 + mention.comment_sentiment * 0.4
    if mention.platform == "stocktwits":
        # StockTwits: use pre-computed comment_sentiment from Bullish/Bearish tags
        return mention.comment_sentiment
    # Twitter: likes / total engagement
    total = mention.score + mention.engagement
    if total == 0:
        return 0.0
    return (mention.score / total - 0.5) * 2


def _engagement_weight(mention: RawMention) -> float:
    return math.log1p(mention.score + mention.engagement)


def _recency_weight(mention: RawMention) -> float:
    age_hours = (time.time() - mention.timestamp) / 3600
    return 0.5 ** (age_hours / 6)  # 6-hour half-life


def _score_platform(mentions: list[RawMention]) -> tuple[float, list[PostInfo]]:
    if not mentions:
        return 0.0, []

    weighted_sum = 0.0
    total_weight = 0.0

    for m in mentions:
        base = _base_sentiment(m)
        w = _engagement_weight(m) * _recency_weight(m)
        weighted_sum += base * w
        total_weight += w

    score = weighted_sum / total_weight if total_weight > 0 else 0.0

    # Top posts by engagement
    sorted_mentions = sorted(mentions, key=lambda m: m.score + m.engagement, reverse=True)
    top_posts = [
        PostInfo(
            title=m.title[:120],
            url=m.url,
            score=m.score,
            platform=m.platform,
        )
        for m in sorted_mentions[:3]
    ]

    return score, top_posts


def _signal_label(score: float) -> str:
    if score > 0.15:
        return "bullish"
    if score < -0.15:
        return "bearish"
    return "neutral"


def score_tickers(
    mentions: list[RawMention],
    source: str = "combined",
) -> SentimentResponse:
    # Group by ticker
    by_ticker: dict[str, TickerAccumulator] = defaultdict(TickerAccumulator)
    for m in mentions:
        by_ticker[m.ticker].add(m)

    tickers: list[TickerSentiment] = []

    for ticker, acc in by_ticker.items():
        # Split by platform
        platform_mentions: dict[str, list[RawMention]] = defaultdict(list)
        for m in acc.mentions:
            platform_mentions[m.platform].append(m)

        platforms: dict[str, PlatformBreakdown] = {}
        platform_scores: list[tuple[float, int, str]] = []  # (score, mentions, platform)

        for platform, p_mentions in platform_mentions.items():
            p_score, top_posts = _score_platform(p_mentions)
            platforms[platform] = PlatformBreakdown(
                score=round(p_score, 4),
                mentions=len(p_mentions),
                top_posts=top_posts,
            )
            platform_scores.append((p_score, len(p_mentions), platform))

        # Combine platform scores with weights
        # When all 3 active: reddit 0.40, twitter 0.35, stocktwits 0.25
        # When only 2 or 1, weights are renormalized automatically
        platform_weights = {"reddit": 0.40, "twitter": 0.35, "stocktwits": 0.25}
        weighted_sum = 0.0
        total_weight = 0.0
        for p_score, p_count, platform in platform_scores:
            w = platform_weights.get(platform, 0.33) * p_count
            weighted_sum += p_score * w
            total_weight += w

        combined_score = weighted_sum / total_weight if total_weight > 0 else 0.0

        tickers.append(
            TickerSentiment(
                ticker=ticker,
                mentions=len(acc.mentions),
                score=round(combined_score, 4),
                signal=_signal_label(combined_score),
                platforms=platforms,
            )
        )

    # Sort by mention count descending
    tickers.sort(key=lambda t: t.mentions, reverse=True)

    return SentimentResponse(tickers=tickers, source=source)
