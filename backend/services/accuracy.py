from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Tuple

import yfinance as yf

from models.accuracy import (
    AccuracyPoint,
    AccuracyResponse,
    AggregateStats,
    SignalOutcome,
)
from models.signals import SignalReport, TickerSignal
from services.database import get_latest_reports

logger = logging.getLogger(__name__)

# How many trading days after a signal to measure the outcome
EVALUATION_DAYS = 5

# Direction thresholds: >+1% bullish, <-1% bearish, else neutral
DIRECTION_THRESHOLD = 1.0


def _conviction_to_direction(conviction: str) -> str:
    """Map conviction label to predicted direction."""
    if conviction in ("Strong Buy", "Buy"):
        return "bullish"
    if conviction in ("Strong Sell", "Sell"):
        return "bearish"
    return "neutral"


def _return_to_direction(ret: float) -> str:
    if ret > DIRECTION_THRESHOLD:
        return "bullish"
    if ret < -DIRECTION_THRESHOLD:
        return "bearish"
    return "neutral"


def _is_correct(predicted: str, actual: str) -> Optional[bool]:
    """Check if prediction matches actual movement. Neutral predictions
    are correct if the stock didn't move much (actual is also neutral)."""
    if predicted == "neutral":
        return actual == "neutral"
    return predicted == actual


def _fetch_price_at(ticker: str, target_date: datetime, days_after: int) -> Tuple[Optional[float], Optional[float]]:
    """Fetch the closing price on target_date and days_after trading days later.
    Returns (entry_price, exit_price). Synchronous — run in executor."""
    try:
        # Fetch a window wide enough to cover weekends/holidays
        start = target_date - timedelta(days=1)
        end = target_date + timedelta(days=days_after + 10)
        stock = yf.Ticker(ticker.upper())
        hist = stock.history(start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"))

        if hist.empty:
            return None, None

        closes = hist["Close"].tolist()
        dates = hist.index.tolist()

        # Entry: first available close on or after signal date
        entry_price = None
        entry_idx = None
        for i, d in enumerate(dates):
            dt = d.to_pydatetime().replace(tzinfo=None)
            if dt.date() >= target_date.date():
                entry_price = round(closes[i], 2)
                entry_idx = i
                break

        if entry_price is None or entry_idx is None:
            return None, None

        # Exit: EVALUATION_DAYS trading days after entry
        exit_idx = min(entry_idx + days_after, len(closes) - 1)
        if exit_idx <= entry_idx:
            return entry_price, None

        exit_price = round(closes[exit_idx], 2)
        return entry_price, exit_price

    except Exception:
        logger.debug("Failed to fetch prices for %s around %s", ticker, target_date)
        return None, None


def _evaluate_signal(
    signal: TickerSignal,
    report_id: Optional[int],
    generated_at: str,
) -> SignalOutcome:
    """Evaluate a single signal against actual price movement. Synchronous."""
    predicted = _conviction_to_direction(signal.conviction)

    signal_date = datetime.fromisoformat(generated_at.replace("Z", "+00:00")).replace(tzinfo=None)

    entry_price, exit_price = _fetch_price_at(signal.ticker, signal_date, EVALUATION_DAYS)

    return_percent = None
    actual = "neutral"
    correct = None

    if entry_price is not None and exit_price is not None and entry_price != 0:
        return_percent = round((exit_price - entry_price) / entry_price * 100, 2)
        actual = _return_to_direction(return_percent)
        correct = _is_correct(predicted, actual)

    return SignalOutcome(
        report_id=report_id,
        generated_at=generated_at,
        ticker=signal.ticker,
        conviction=signal.conviction,
        predicted_direction=predicted,
        actual_direction=actual,
        entry_price=entry_price,
        exit_price=exit_price,
        return_percent=return_percent,
        correct=correct,
    )


def _compute_accuracy_sync(limit: int) -> AccuracyResponse:
    """Synchronous accuracy computation. Run in executor."""
    import sqlite3
    import json
    import os

    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "signals.db")
    if not os.path.exists(db_path):
        return _empty_response()

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            "SELECT * FROM signal_reports ORDER BY generated_at ASC LIMIT ?",
            (limit,),
        ).fetchall()
    finally:
        conn.close()

    if not rows:
        return _empty_response()

    # Evaluate every signal from every report
    outcomes: List[SignalOutcome] = []
    for row in rows:
        signals_data = json.loads(row["signals_json"])
        for s_data in signals_data:
            signal = TickerSignal(**s_data)
            outcome = _evaluate_signal(signal, row["id"], row["generated_at"])
            outcomes.append(outcome)

    # Build aggregate stats
    evaluated = [o for o in outcomes if o.correct is not None]
    correct_list = [o for o in evaluated if o.correct]
    returns = [o.return_percent for o in evaluated if o.return_percent is not None]

    buy_signals = [o for o in evaluated if o.predicted_direction == "bullish"]
    sell_signals = [o for o in evaluated if o.predicted_direction == "bearish"]
    buy_correct = [o for o in buy_signals if o.correct]
    sell_correct = [o for o in sell_signals if o.correct]

    best = max(evaluated, key=lambda o: o.return_percent or -9999, default=None)
    worst = min(evaluated, key=lambda o: o.return_percent or 9999, default=None)

    stats = AggregateStats(
        total_signals=len(outcomes),
        evaluated_signals=len(evaluated),
        correct_signals=len(correct_list),
        accuracy_percent=round(len(correct_list) / len(evaluated) * 100, 1) if evaluated else None,
        avg_return_percent=round(sum(returns) / len(returns), 2) if returns else None,
        best_ticker=best.ticker if best else None,
        best_return_percent=best.return_percent if best else None,
        worst_ticker=worst.ticker if worst else None,
        worst_return_percent=worst.return_percent if worst else None,
        buy_accuracy=round(len(buy_correct) / len(buy_signals) * 100, 1) if buy_signals else None,
        sell_accuracy=round(len(sell_correct) / len(sell_signals) * 100, 1) if sell_signals else None,
    )

    # Build cumulative accuracy chart — one point per report date
    chart: List[AccuracyPoint] = []
    running_correct = 0
    running_total = 0
    running_return = 0.0

    # Group outcomes by report date, chronologically
    by_date: dict[str, list[SignalOutcome]] = {}
    for o in outcomes:
        date_key = o.generated_at[:10]
        by_date.setdefault(date_key, []).append(o)

    for date_key in sorted(by_date.keys()):
        date_outcomes = by_date[date_key]
        for o in date_outcomes:
            if o.correct is not None:
                running_total += 1
                if o.correct:
                    running_correct += 1
                if o.return_percent is not None:
                    running_return += o.return_percent
        if running_total > 0:
            chart.append(AccuracyPoint(
                date=date_key,
                accuracy=round(running_correct / running_total * 100, 1),
                cumulative_return=round(running_return, 2),
                signal_count=running_total,
            ))

    # Return outcomes newest-first for the table
    outcomes.reverse()

    return AccuracyResponse(stats=stats, chart=chart, outcomes=outcomes)


def _empty_response() -> AccuracyResponse:
    return AccuracyResponse(
        stats=AggregateStats(
            total_signals=0,
            evaluated_signals=0,
            correct_signals=0,
            accuracy_percent=None,
            avg_return_percent=None,
            best_ticker=None,
            best_return_percent=None,
            worst_ticker=None,
            worst_return_percent=None,
            buy_accuracy=None,
            sell_accuracy=None,
        ),
        chart=[],
        outcomes=[],
    )


async def compute_accuracy(limit: int = 100) -> AccuracyResponse:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _compute_accuracy_sync, limit)
