from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class KeyDataPoint(BaseModel):
    point: str
    source: str  # "reddit", "twitter", "news", "market_data", "options"


class TickerSignal(BaseModel):
    ticker: str
    conviction: str  # "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell"
    thesis: str
    key_data_points: List[KeyDataPoint]
    entry_zone: Optional[str]
    exit_zone: Optional[str]
    current_price: Optional[float]
    sentiment_score: Optional[float]
    mention_count: Optional[int]


class SignalReport(BaseModel):
    id: Optional[int] = None
    generated_at: str  # ISO 8601
    tickers_analyzed: int
    signals: List[TickerSignal]
    model_used: str


class SignalHistoryResponse(BaseModel):
    reports: List[SignalReport]
