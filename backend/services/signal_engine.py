from __future__ import annotations

import asyncio
import json
import logging
import re
from datetime import datetime, timezone
from typing import List, Optional, Tuple

import anthropic

from config import settings
from models.market import MarketDataResponse
from models.news import NewsResponse
from models.sentiment import SentimentResponse, TickerSentiment
from models.signals import KeyDataPoint, SignalReport, TickerSignal
from services.database import save_report
from services.market_data import fetch_market_data
from services.news import fetch_news

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"


def _build_system_prompt(active_sources: list[str]) -> str:
    """Build system prompt dynamically based on which data sources are active."""
    source_names = {
        "reddit": "Reddit (r/wallstreetbets, r/options, r/stocks)",
        "twitter": "X/Twitter ($cashtag mentions, fintwit accounts)",
        "stocktwits": "StockTwits (message volume, bullish/bearish ratios, trending status)",
    }

    if active_sources:
        sources_str = ", ".join(source_names.get(s, s) for s in active_sources)
    else:
        sources_str = "Reddit and X/Twitter social sentiment"

    valid_sources = ["reddit", "twitter", "stocktwits", "news", "market_data", "options"]

    return (
        "You are an institutional-grade equity research analyst. Analyze the following "
        "alternative data from social sentiment, news flow, and market data. "
        "Produce a structured signal report.\n\n"
        "Active sentiment data sources: {sources}\n\n"
        "For each ticker, provide:\n"
        "- a conviction rating (Strong Buy/Buy/Neutral/Sell/Strong Sell)\n"
        "- a 2-sentence thesis\n"
        "- the key data points driving your signal — always note which specific platform "
        "(Reddit, Twitter, StockTwits) the sentiment is coming from\n"
        "- suggested entry/exit zones\n\n"
        "When StockTwits data is available, factor in the message volume, "
        "bullish/bearish ratio, and trending status. Cross-reference StockTwits "
        "sentiment with Reddit/Twitter sentiment — note agreement or divergence "
        "between platforms.\n\n"
        "You MUST respond with ONLY valid JSON matching this exact schema — no markdown "
        "fences, no commentary outside the JSON:\n"
        "{{\n"
        '  "signals": [\n'
        "    {{\n"
        '      "ticker": "AAPL",\n'
        '      "conviction": "Buy",\n'
        '      "thesis": "Two sentences explaining the signal.",\n'
        '      "key_data_points": [\n'
        '        {{"point": "description of data point", "source": "reddit"}}\n'
        "      ],\n"
        '      "entry_zone": "$170-175",\n'
        '      "exit_zone": "$190-195"\n'
        "    }}\n"
        "  ]\n"
        "}}\n\n"
        "Valid sources: {valid_sources}"
    ).format(
        sources=sources_str,
        valid_sources=", ".join('"{}"'.format(s) for s in valid_sources),
    )


async def _gather_ticker_data(
    ticker: str,
) -> Tuple[str, Optional[MarketDataResponse], Optional[NewsResponse]]:
    """Fetch market data and news for a single ticker, tolerating failures."""
    market: Optional[MarketDataResponse] = None
    news: Optional[NewsResponse] = None

    async def _get_market() -> None:
        nonlocal market
        try:
            market = await fetch_market_data(ticker)
        except Exception:
            logger.warning("Market data fetch failed for %s", ticker)

    async def _get_news() -> None:
        nonlocal news
        if not settings.finnhub_configured:
            return
        try:
            news = await fetch_news(ticker)
        except Exception:
            logger.warning("News fetch failed for %s", ticker)

    await asyncio.gather(_get_market(), _get_news())
    return ticker, market, news


def _build_prompt(
    sentiment: SentimentResponse,
    market_data: dict[str, Optional[MarketDataResponse]],
    news_data: dict[str, Optional[NewsResponse]],
) -> str:
    """Build the user prompt with all gathered data for Claude."""
    sections: list[str] = []

    for ts in sentiment.tickers:
        parts: list[str] = []
        parts.append("## {}".format(ts.ticker))

        # Sentiment
        parts.append("### Social Sentiment")
        parts.append("Combined mentions: {}, Score: {} ({})".format(
            ts.mentions, ts.score, ts.signal
        ))
        parts.append("Platforms reporting: {}".format(
            ", ".join(p.capitalize() for p in ts.platforms.keys())
        ))
        for platform, bd in ts.platforms.items():
            if platform == "stocktwits":
                # StockTwits-specific: show message volume and bullish/bearish breakdown
                parts.append("  StockTwits: {} messages, score {}".format(
                    bd.mentions, bd.score
                ))
                if bd.mentions > 0:
                    # Estimate bullish ratio from score (-1 to +1 → percentage)
                    bullish_pct = round((bd.score + 1) / 2 * 100, 1)
                    parts.append("    Bullish/Bearish ratio: ~{}% bullish".format(
                        bullish_pct
                    ))
                for post in bd.top_posts[:2]:
                    parts.append('    - "{}" (likes: {})'.format(post.title, post.score))
            else:
                parts.append("  {}: {} mentions, score {}".format(
                    platform.capitalize(), bd.mentions, bd.score
                ))
                for post in bd.top_posts[:2]:
                    parts.append('    - "{}" (score: {})'.format(post.title, post.score))

        # Market data
        md = market_data.get(ts.ticker)
        if md and md.price is not None:
            parts.append("### Market Data")
            parts.append("Price: ${}, Daily Change: {}%".format(md.price, md.change_percent))
            parts.append("Volume: {:,}".format(md.volume or 0))
            parts.append("SMA-50: {}, SMA-200: {}".format(
                md.moving_averages.sma_50, md.moving_averages.sma_200
            ))
            parts.append("RSI(14): {}".format(md.rsi))

            if md.options:
                parts.append("### Options Flow")
                parts.append("Put/Call Ratio: {}".format(md.options.put_call_ratio))
                parts.append("Call Volume: {:,}, Put Volume: {:,}".format(
                    md.options.total_call_volume, md.options.total_put_volume
                ))
                if md.options.unusual_activity:
                    parts.append("Unusual Activity:")
                    for ua in md.options.unusual_activity[:5]:
                        parts.append(
                            "  {} ${} exp {} — vol {:,} vs OI {:,} (IV: {})".format(
                                ua.type.upper(),
                                ua.strike,
                                ua.expiration,
                                ua.volume,
                                ua.open_interest,
                                ua.implied_volatility,
                            )
                        )

        # News
        nd = news_data.get(ts.ticker)
        if nd and nd.articles:
            parts.append("### Recent News")
            for article in nd.articles[:5]:
                parts.append('- "{}" ({}, {})'.format(
                    article.headline, article.source, article.published_at[:10]
                ))

        sections.append("\n".join(parts))

    return (
        "Analyze the following {} tickers and produce your signal report:\n\n".format(
            len(sentiment.tickers)
        )
        + "\n\n---\n\n".join(sections)
    )


def _parse_claude_response(
    raw_text: str,
    sentiment: SentimentResponse,
    market_data: dict[str, Optional[MarketDataResponse]],
) -> List[TickerSignal]:
    """Parse Claude's JSON response into TickerSignal objects."""
    # Strip markdown fences if present
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)

    data = json.loads(cleaned)

    signals_raw = data.get("signals", data if isinstance(data, list) else [])

    # Build lookup for enriching with our own data
    sentiment_lookup: dict[str, TickerSentiment] = {
        ts.ticker: ts for ts in sentiment.tickers
    }

    signals: List[TickerSignal] = []
    for item in signals_raw:
        ticker = item.get("ticker", "").upper()

        key_data_points = [
            KeyDataPoint(
                point=kd.get("point", ""),
                source=kd.get("source", "unknown"),
            )
            for kd in item.get("key_data_points", [])
        ]

        ts_data = sentiment_lookup.get(ticker)
        md = market_data.get(ticker)

        signals.append(TickerSignal(
            ticker=ticker,
            conviction=item.get("conviction", "Neutral"),
            thesis=item.get("thesis", ""),
            key_data_points=key_data_points,
            entry_zone=item.get("entry_zone"),
            exit_zone=item.get("exit_zone"),
            current_price=md.price if md else None,
            sentiment_score=ts_data.score if ts_data else None,
            mention_count=ts_data.mentions if ts_data else None,
        ))

    return signals


async def generate_signals(sentiment: SentimentResponse) -> SignalReport:
    """Full signal generation pipeline.

    1. Take top 10 tickers by mention count
    2. Fetch market data + news for each (in parallel)
    3. Build prompt and call Claude
    4. Parse response into structured signals
    5. Save to SQLite
    """
    # Step 1: top 10 by mentions
    top_tickers = sentiment.tickers[:10]
    # Replace the full list with just the top 10 for prompt building
    sentiment_trimmed = sentiment.copy(update={"tickers": top_tickers})

    # Step 2: parallel market data + news fetch
    tasks = [_gather_ticker_data(ts.ticker) for ts in top_tickers]
    results = await asyncio.gather(*tasks)

    market_data: dict[str, Optional[MarketDataResponse]] = {}
    news_data: dict[str, Optional[NewsResponse]] = {}
    for ticker, md, nd in results:
        market_data[ticker] = md
        news_data[ticker] = nd

    # Step 3: call Claude
    user_prompt = _build_prompt(sentiment_trimmed, market_data, news_data)
    system_prompt = _build_system_prompt(sentiment.active_sources)

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw_response = message.content[0].text

    # Step 4: parse response
    signals = _parse_claude_response(raw_response, sentiment_trimmed, market_data)

    # Step 5: build report and save
    report = SignalReport(
        generated_at=datetime.now(timezone.utc).isoformat(),
        tickers_analyzed=len(top_tickers),
        signals=signals,
        model_used=MODEL,
    )

    report_id = await save_report(report)
    report.id = report_id

    return report
