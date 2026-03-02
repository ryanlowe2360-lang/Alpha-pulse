from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class StocktwitsMessage(BaseModel):
    id: int
    body: str
    created_at: str
    sentiment: Optional[str]  # "Bullish" | "Bearish" | None (untagged)
    likes: int
    username: str


class StocktwitsTickerDetail(BaseModel):
    ticker: str
    score: float  # -100 to +100
    signal: str  # "bullish" | "bearish" | "neutral"
    total_messages: int
    bullish_count: int
    bearish_count: int
    untagged_count: int
    bullish_percent: Optional[float]
    volume_rank: Optional[int]  # position in trending list, if present
    messages: List[StocktwitsMessage]


class StocktwitsTickerSummary(BaseModel):
    ticker: str
    score: float
    signal: str
    total_messages: int
    bullish_count: int
    bearish_count: int
    bullish_percent: Optional[float]
    volume_rank: Optional[int]


class StocktwitsResponse(BaseModel):
    tickers: List[StocktwitsTickerSummary]
    trending_count: int
    cached: bool = False


class StocktwitsDetailResponse(BaseModel):
    ticker: StocktwitsTickerDetail
    cached: bool = False
