import re

# Common words that look like tickers but aren't
BLACKLIST = {
    "DD", "IV", "ATH", "CEO", "CFO", "COO", "CTO", "IPO", "ETF", "GDP",
    "FBI", "SEC", "USA", "USD", "EUR", "GBP", "IMO", "YOLO", "FOMO",
    "LOL", "WTF", "OMG", "FYI", "TIL", "PSA", "EPS", "PE", "PB",
    "ROI", "ROE", "RSI", "MACD", "EMA", "SMA", "OTM", "ITM", "ATM",
    "DTE", "FD", "FDS", "LEAP", "LEAPS", "PT", "TA", "FA", "DD",
    "HODL", "BTFD", "API", "ALL", "FOR", "THE", "ARE", "NOT", "HAS",
    "ITS", "ANY", "NEW", "NOW", "OLD", "BIG", "LOW", "HIGH", "UP",
    "DOWN", "LONG", "SHORT", "BUY", "SELL", "HOLD", "CALL", "PUT",
    "PUTS", "CALLS", "RIP", "PUMP", "DUMP", "DIP", "GAP", "RUN",
    "TOP", "BOT", "MAX", "MIN", "AVG", "NET", "TAX", "FED", "GDP",
    "CPI", "PPI", "PMI", "NFP", "FOMC", "QE", "QT", "YTD", "MTD",
    "WOW", "MOM", "YOY", "QOQ", "HOD", "LOD", "EOD", "AH", "PM",
    "PRE", "POST", "OI", "VOL", "IV", "HV", "EDIT", "UPDATE", "TL",
    "DR", "TLDR", "LMAO", "LMFAO", "STFU", "GTFO", "SMH", "IMO",
    "IMHO", "AFAIK", "TBH", "NFA", "DYOR", "CEO",
}

# ~100 commonly discussed tickers on Reddit/fintwit
KNOWN_TICKERS = {
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "TSLA", "NVDA", "META",
    "NFLX", "AMD", "INTC", "CRM", "ORCL", "ADBE", "PYPL", "SQ",
    "SHOP", "SPOT", "UBER", "LYFT", "SNAP", "PINS", "TWLO", "ZM",
    "PLTR", "SOFI", "HOOD", "COIN", "MARA", "RIOT", "BITO",
    "SPY", "QQQ", "IWM", "DIA", "VTI", "VOO", "ARKK", "ARKG",
    "XLF", "XLE", "XLK", "XLV", "XLI", "XLU", "GLD", "SLV",
    "JPM", "BAC", "GS", "MS", "WFC", "C", "V", "MA", "AXP",
    "UNH", "JNJ", "PFE", "MRNA", "ABBV", "LLY", "BMY",
    "DIS", "CMCSA", "T", "VZ", "TMUS",
    "BA", "LMT", "RTX", "NOC", "GD",
    "XOM", "CVX", "COP", "OXY", "SLB",
    "WMT", "TGT", "COST", "HD", "LOW",
    "F", "GM", "RIVN", "LCID", "NIO", "LI", "XPEV",
    "BABA", "JD", "PDD", "TSM", "ASML",
    "BRK", "BERKB", "AVGO", "MU", "QCOM", "TXN",
    "ABNB", "DASH", "RBLX", "U", "CRWD", "NET", "DDOG",
    "GME", "AMC", "BBBY", "BB", "NOK", "WISH", "CLOV",
    "SMCI", "ARM", "MSTR",
}

_CASHTAG_RE = re.compile(r"\$([A-Z]{1,5})\b")
_BARE_TICKER_RE = re.compile(r"\b([A-Z]{1,5})\b")


def extract_tickers(text: str) -> list[str]:
    """Extract ticker symbols from text. Returns deduplicated list."""
    tickers: set[str] = set()

    # Pass 1: explicit $CASHTAG mentions (always trusted)
    for match in _CASHTAG_RE.finditer(text):
        symbol = match.group(1)
        if symbol not in BLACKLIST:
            tickers.add(symbol)

    # Pass 2: bare uppercase words matched against known tickers
    for match in _BARE_TICKER_RE.finditer(text):
        symbol = match.group(1)
        if symbol in KNOWN_TICKERS and symbol not in BLACKLIST:
            tickers.add(symbol)

    return list(tickers)
