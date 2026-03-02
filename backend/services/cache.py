from __future__ import annotations

import asyncio
import time
from typing import Any, Optional

from config import settings


class TTLCache:
    def __init__(self, ttl: int = settings.cache_ttl):
        self._store: dict[str, tuple[float, Any]] = {}
        self._lock = asyncio.Lock()
        self._ttl = ttl

    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            expires_at, value = entry
            if time.monotonic() > expires_at:
                del self._store[key]
                return None
            return value

    async def set(self, key: str, value: Any) -> None:
        async with self._lock:
            self._store[key] = (time.monotonic() + self._ttl, value)

    async def clear(self) -> None:
        async with self._lock:
            self._store.clear()


sentiment_cache = TTLCache()
market_cache = TTLCache()
news_cache = TTLCache()
