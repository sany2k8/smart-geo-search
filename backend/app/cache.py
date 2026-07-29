import hashlib
import json
from typing import Any

import redis.asyncio as aioredis
from fastapi import HTTPException, Request, status

from app.config import settings

redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)


def cache_key(prefix: str, payload: dict) -> str:
    blob = json.dumps(payload, sort_keys=True, default=str)
    return f"{prefix}:{hashlib.sha1(blob.encode()).hexdigest()}"


async def cache_get(key: str) -> Any | None:
    raw = await redis_client.get(key)
    return json.loads(raw) if raw else None


async def cache_set(key: str, value: Any, ttl: int | None = None) -> None:
    await redis_client.setex(key, ttl or settings.search_cache_ttl, json.dumps(value, default=str))


async def cache_drop(pattern: str) -> None:
    """Invalidate a prefix. scan_iter keeps this off the KEYS command."""
    async for key in redis_client.scan_iter(match=pattern, count=500):
        await redis_client.delete(key)


async def rate_limit(request: Request) -> None:
    """Fixed-window limiter keyed on client IP. One INCR per request."""
    ip = request.client.host if request.client else "anonymous"
    key = f"rl:{ip}:{request.url.path}"
    hits = await redis_client.incr(key)
    if hits == 1:
        await redis_client.expire(key, 60)
    if hits > settings.rate_limit_per_minute:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Rate limit exceeded, try again in a minute",
        )


# Trending searches live in a Redis sorted set, incremented by the Kafka
# consumer and read straight off the sorted set by the API.
TRENDING_KEY = "trending:searches"


async def bump_trending(query: str) -> None:
    await redis_client.zincrby(TRENDING_KEY, 1, query.lower().strip())


async def top_trending(limit: int = 10) -> list[tuple[str, int]]:
    rows = await redis_client.zrevrange(TRENDING_KEY, 0, limit - 1, withscores=True)
    return [(q, int(score)) for q, score in rows]
