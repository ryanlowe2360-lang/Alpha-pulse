from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

from config import settings
from models.signals import SignalHistoryResponse, SignalReport
from services.database import get_latest_reports
from services.signal_engine import generate_signals

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/signals", tags=["signals"])


@router.post("/generate", response_model=SignalReport)
async def generate_signal_report() -> SignalReport:
    """Generate a new AI signal report from current sentiment, market, and news data."""
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=503,
            detail="Anthropic API key not configured.",
        )

    # Use the combined sentiment endpoint which includes Reddit + Twitter + StockTwits
    from routers.sentiment import get_combined_sentiment

    try:
        sentiment = await get_combined_sentiment()
    except HTTPException:
        sentiment = None

    if sentiment is None or not sentiment.tickers:
        raise HTTPException(
            status_code=503,
            detail="No sentiment data available. Check API credentials.",
        )

    try:
        report = await generate_signals(sentiment)
    except Exception:
        logger.exception("Signal generation failed")
        raise HTTPException(
            status_code=502,
            detail="Signal generation failed. Check logs for details.",
        )

    return report


@router.get("/latest", response_model=SignalHistoryResponse)
async def get_latest_signals(
    limit: int = Query(default=10, ge=1, le=50),
) -> SignalHistoryResponse:
    """Retrieve the most recent signal reports from the database."""
    try:
        reports = await get_latest_reports(limit=limit)
    except Exception:
        logger.exception("Failed to retrieve signal history")
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve signal history.",
        )

    return SignalHistoryResponse(reports=reports)
