from abc import ABC, abstractmethod

from services.sentiment_scorer import RawMention


class BaseScraper(ABC):
    @abstractmethod
    async def fetch_mentions(self) -> list[RawMention]:
        """Fetch raw mentions from the platform."""
        ...

    @abstractmethod
    def is_configured(self) -> bool:
        """Return True if required API keys are set."""
        ...
