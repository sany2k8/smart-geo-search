from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import cache_get, cache_key, cache_set, top_trending
from app.config import TOPIC_SEARCH_EVENTS, settings
from app.db import get_db
from app.events import publish
from app.models import User
from app.schemas import (
    PlaceHit,
    PlaceOut,
    SearchParams,
    SearchResponse,
    Suggestion,
    TrendingItem,
)
from app.search import es
from app.search import build_autocomplete, build_search
from app.security import optional_user
from app.routers.places import load_places

router = APIRouter(tags=["search"])


@router.get("/search", response_model=SearchResponse)
async def search(
    params: Annotated[SearchParams, Query()],
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(optional_user),
):
    """Elasticsearch ranks and filters; PostgreSQL supplies the canonical row.

    ES holds a denormalised copy tuned for retrieval, so it decides *which*
    places match and in what order. It returns ids, and Postgres fills in the
    authoritative record in a single batched query.
    """
    key = cache_key("search", params.model_dump())
    if (cached := await cache_get(key)) is not None:
        return SearchResponse(**cached)

    response = await es.search(index=settings.places_index, body=build_search(params))

    hits = response["hits"]["hits"]
    ids = [int(h["_id"]) for h in hits]
    by_id = await load_places(db, ids)

    results: list[PlaceHit] = []
    for hit in hits:
        place = by_id.get(int(hit["_id"]))
        if place is None:
            continue  # indexed but deleted from Postgres; the worker will catch up
        distance = hit.get("fields", {}).get("distance_m")
        if distance is None and hit.get("sort") and params.sort == "distance":
            distance = hit["sort"][0]
        results.append(
            PlaceHit(
                **PlaceOut.model_validate(place).model_dump(),
                score=hit.get("_score") or 0.0,
                distance_m=float(distance[0]) if isinstance(distance, list) else distance,
                highlight=hit.get("highlight", {}),
            )
        )

    payload = SearchResponse(
        total=response["hits"]["total"]["value"],
        page=params.page,
        size=params.size,
        took_ms=response["took"],
        results=results,
        facets={
            name: [
                {"key": b["key"], "count": b["doc_count"]}
                for b in response["aggregations"][name]["buckets"]
            ]
            for name in ("categories", "cities", "price_levels")
        },
    )

    await cache_set(key, payload.model_dump())

    if params.q.strip():
        await publish(
            TOPIC_SEARCH_EVENTS,
            {
                "query": params.q,
                "user_id": user.id if user else None,
                "result_count": payload.total,
                "took_ms": payload.took_ms,
            },
        )
    return payload


@router.get("/autocomplete", response_model=list[Suggestion])
async def autocomplete(
    q: str = Query(min_length=1, max_length=100),
    lat: float | None = None,
    lon: float | None = None,
    limit: int = Query(8, ge=1, le=20),
):
    """Served entirely from Elasticsearch — no Postgres round-trip, because
    every field a suggestion needs is already in the index."""
    key = cache_key("ac", {"q": q.lower(), "lat": lat, "lon": lon, "limit": limit})
    if (cached := await cache_get(key)) is not None:
        return cached

    response = await es.search(
        index=settings.places_index, body=build_autocomplete(q, lat, lon, limit)
    )
    suggestions = [
        {
            "id": int(hit["_id"]),
            "name": hit["_source"]["name"],
            "category": hit["_source"]["category"],
            "city": hit["_source"]["city"],
            "lat": hit["_source"]["location"]["lat"],
            "lon": hit["_source"]["location"]["lon"],
        }
        for hit in response["hits"]["hits"]
    ]
    await cache_set(key, suggestions, ttl=300)
    return suggestions


@router.get("/trending", response_model=list[TrendingItem])
async def trending(limit: int = Query(10, ge=1, le=25)):
    """Read straight off the Redis sorted set the Kafka consumer maintains."""
    return [TrendingItem(query=q, count=c) for q, c in await top_trending(limit)]
