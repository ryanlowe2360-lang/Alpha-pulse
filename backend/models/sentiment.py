from pydantic import BaseModel


class PostInfo(BaseModel):
    title: str
    url: str
    score: int
    platform: str


class PlatformBreakdown(BaseModel):
    score: float
    mentions: int
    top_posts: list[PostInfo]


class TickerSentiment(BaseModel):
    ticker: str
    mentions: int
    score: float
    signal: str  # "bullish" | "bearish" | "neutral"
    platforms: dict[str, PlatformBreakdown]


class SentimentResponse(BaseModel):
    tickers: list[TickerSentiment]
    source: str  # "combined" | "reddit" | "twitter" | "stocktwits"
    cached: bool = False
    active_sources: list[str] = []
