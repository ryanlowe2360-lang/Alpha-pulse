from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routers.accuracy import router as accuracy_router
from routers.market import router as market_router
from routers.news import router as news_router
from routers.sentiment import router as sentiment_router
from routers.signals import router as signals_router
from routers.stocktwits import router as stocktwits_router

app = FastAPI(title="Alpha Pulse API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sentiment_router)
app.include_router(stocktwits_router)
app.include_router(market_router)
app.include_router(news_router)
app.include_router(signals_router)
app.include_router(accuracy_router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/api/sources/status")
async def sources_status():
    from config import settings

    return {
        "sources": {
            "reddit": {"configured": settings.reddit_configured, "label": "Reddit"},
            "twitter": {"configured": settings.twitter_configured, "label": "X / Twitter"},
            "stocktwits": {"configured": True, "label": "StockTwits"},
            "finnhub": {"configured": settings.finnhub_configured, "label": "Finnhub"},
            "claude": {"configured": bool(settings.anthropic_api_key), "label": "Claude AI"},
        }
    }
