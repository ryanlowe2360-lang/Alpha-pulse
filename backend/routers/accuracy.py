from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, Query

from models.accuracy import AccuracyResponse
from services.accuracy import compute_accuracy
from services.cache import TTLCache

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/signals", tags=["accuracy"])

# Accuracy is expensive (many yfinance calls) — cache for 15 minutes
_accuracy_cache = TTLCache(ttl=900)

CACHE_KEY = "accuracy"


@router.get("/accuracy", response_model=AccuracyResponse)
async def get_signal_accuracy(
    limit: int = Query(default=100, ge=1, le=500),
) -> AccuracyResponse:
    """Evaluate historical signal accuracy against actual price movements."""
    cached = await _accuracy_cache.get(CACHE_KEY)
    if cached is not None:
        return cached

    try:
        result = await compute_accuracy(limit=limit)
    except Exception:
        logger.exception("Accuracy computation failed")
        raise HTTPException(
            status_code=500,
            detail="Failed to compute signal accuracy.",
        )

    await _accuracy_cache.set(CACHE_KEY, result)
    return result
