from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class NewsArticle(BaseModel):
    headline: str
    source: str
    url: str
    summary: str
    image: Optional[str]
    published_at: str  # ISO 8601


class NewsResponse(BaseModel):
    ticker: str
    articles: list[NewsArticle]
    cached: bool = False
