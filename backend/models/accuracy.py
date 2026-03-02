from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class SignalOutcome(BaseModel):
    report_id: Optional[int]
    generated_at: str
    ticker: str
    conviction: str  # "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell"
    predicted_direction: str  # "bullish" | "bearish" | "neutral"
    actual_direction: str  # "bullish" | "bearish" | "neutral"
    entry_price: Optional[float]
    exit_price: Optional[float]
    return_percent: Optional[float]
    correct: Optional[bool]  # None when outcome can't be determined


class AggregateStats(BaseModel):
    total_signals: int
    evaluated_signals: int  # signals with enough data to judge
    correct_signals: int
    accuracy_percent: Optional[float]
    avg_return_percent: Optional[float]
    best_ticker: Optional[str]
    best_return_percent: Optional[float]
    worst_ticker: Optional[str]
    worst_return_percent: Optional[float]
    buy_accuracy: Optional[float]
    sell_accuracy: Optional[float]


class AccuracyPoint(BaseModel):
    """One point on the cumulative accuracy chart."""
    date: str
    accuracy: float  # rolling accuracy as percentage 0–100
    cumulative_return: float  # cumulative return %
    signal_count: int  # total signals evaluated up to this point


class AccuracyResponse(BaseModel):
    stats: AggregateStats
    chart: List[AccuracyPoint]
    outcomes: List[SignalOutcome]
