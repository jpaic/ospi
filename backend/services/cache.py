import time
import logging
from typing import Any

logger = logging.getLogger(__name__)


class AppCache:
    """TTL-based cache with prefix-scoped invalidation."""

    def __init__(self, ttl_seconds: int = 300):
        self._data: dict[str, tuple[Any, float]] = {}
        self._ttl = ttl_seconds

    def get(self, key: str):
        if key in self._data:
            val, ts = self._data[key]
            if time.time() - ts < self._ttl:
                return val
            del self._data[key]
        return None

    def set(self, key: str, value: Any):
        self._data[key] = (value, time.time())

    def invalidate(self, key: str | None = None):
        if key:
            self._data.pop(key, None)
        else:
            self._data.clear()

    def invalidate_prefix(self, prefix: str):
        hit_keys = [k for k in self._data if k.startswith(prefix)]
        for k in hit_keys:
            del self._data[k]
        if hit_keys:
            logger.info("Invalidated %d cache entries with prefix '%s'", len(hit_keys), prefix)


_cache = AppCache(ttl_seconds=300)


def get_cache() -> AppCache:
    return _cache
