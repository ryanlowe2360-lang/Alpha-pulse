"""Keyword-based comment sentiment scoring.

Uses bullish/bearish word lists to produce a [-1, +1] score from a list of
comment bodies. Lightweight alternative to an ML model — fast enough to run
inline during scraping.
"""

BULLISH_WORDS = {
    "bull", "bullish", "calls", "moon", "mooning", "rocket", "buy", "buying",
    "long", "undervalued", "breakout", "rip", "squeeze", "gap up", "tendies",
    "print", "printing", "green", "rally", "upside", "cheap", "discount",
    "accumulate", "load", "loaded", "strong", "beat", "beats", "crushed",
    "smashed", "soar", "soaring", "surge", "surging", "upgrade", "upgraded",
    "outperform", "above", "support", "bounce", "recovery",
}

BEARISH_WORDS = {
    "bear", "bearish", "puts", "drill", "drilling", "sell", "selling", "short",
    "overvalued", "breakdown", "dump", "dumping", "crash", "crashing", "red",
    "dead", "bag", "bagholder", "bagholding", "loss", "losses", "tank",
    "tanking", "fade", "fading", "downside", "expensive", "overbought",
    "rug", "rugpull", "scam", "fraud", "downgrade", "downgraded",
    "underperform", "below", "resistance", "reject", "rejected",
}


def score_comments(comments: list[str]) -> float:
    """Return a sentiment score in [-1, +1] from comment text.

    Each comment contributes +1 or -1 based on keyword hits. The final
    score is normalized by total comment count so a single outlier doesn't
    dominate.
    """
    if not comments:
        return 0.0

    bullish_hits = 0
    bearish_hits = 0

    for body in comments:
        lower = body.lower()
        b = sum(1 for w in BULLISH_WORDS if w in lower)
        s = sum(1 for w in BEARISH_WORDS if w in lower)
        bullish_hits += b
        bearish_hits += s

    total = bullish_hits + bearish_hits
    if total == 0:
        return 0.0

    # Range [-1, +1]
    return (bullish_hits - bearish_hits) / total
