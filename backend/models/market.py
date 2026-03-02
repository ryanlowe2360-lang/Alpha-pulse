from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


class MovingAverages(BaseModel):
    sma_50: Optional[float]
    sma_200: Optional[float]


class OptionsContract(BaseModel):
    strike: float
    expiration: str
    type: str  # "call" | "put"
    volume: int
    open_interest: int
    implied_volatility: Optional[float]


class OptionsData(BaseModel):
    put_call_ratio: Optional[float]
    total_call_volume: int
    total_put_volume: int
    expirations: list[str]
    unusual_activity: list[OptionsContract]


class MarketDataResponse(BaseModel):
    ticker: str
    price: Optional[float]
    change_percent: Optional[float]
    volume: Optional[int]
    moving_averages: MovingAverages
    rsi: Optional[float]
    sparkline: List[float] = []
    options: Optional[OptionsData]
    cached: bool = False
