from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.cache import cache_drop
from app.config import TOPIC_PLACE_EVENTS, settings
from app.db import get_db
from app.events import publish
from app.models import Category, Place, User
from app.schemas import CategoryOut, PlaceHit, PlaceIn, PlaceOut
from app.search import es
from app.search import build_similar
from app.security import admin_user

router = APIRouter(tags=["places"])


async def load_place(db: AsyncSession, place_id: int) -> Place:
    result = await db.execute(
        select(Place).options(selectinload(Place.category)).where(Place.id == place_id)
    )
    place = result.scalar_one_or_none()
    if place is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")
    return place


async def load_places(db: AsyncSession, ids: list[int]) -> dict[int, Place]:
    """Batch-load the rows behind a set of search hits — one query, no N+1."""
    if not ids:
        return {}
    result = await db.execute(
        select(Place).options(selectinload(Place.category)).where(Place.id.in_(ids))
    )
    return {p.id: p for p in result.scalars()}


@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).order_by(Category.name))
    return list(result.scalars())


@router.get("/places/nearby", response_model=list[PlaceHit])
async def nearby(
    lat: float = Query(ge=-90, le=90),
    lon: float = Query(ge=-180, le=180),
    radius_km: float = Query(2.0, gt=0, le=200),
    limit: int = Query(20, ge=1, le=100),
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Nearest-neighbour search served by PostGIS rather than Elasticsearch.

    ST_DWithin uses the GiST index to prune candidates, and ordering by the
    `<->` operator turns the sort into an index scan instead of a full distance
    computation over the whole table.
    """
    origin = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326).cast(Place.location.type)
    distance = func.ST_Distance(Place.location, origin).label("distance_m")

    stmt = (
        select(Place, distance)
        .options(selectinload(Place.category))
        .where(func.ST_DWithin(Place.location, origin, radius_km * 1000))
        .order_by(Place.location.op("<->")(origin))
        .limit(limit)
    )
    if category:
        stmt = stmt.join(Category).where(Category.slug == category)

    rows = (await db.execute(stmt)).all()
    return [
        PlaceHit(**PlaceOut.model_validate(place).model_dump(), distance_m=float(dist))
        for place, dist in rows
    ]


@router.get("/places/{place_id}", response_model=PlaceOut)
async def get_place(place_id: int, db: AsyncSession = Depends(get_db)):
    return await load_place(db, place_id)


@router.get("/places/{place_id}/similar", response_model=list[PlaceOut])
async def similar_places(
    place_id: int, limit: int = Query(6, ge=1, le=20), db: AsyncSession = Depends(get_db)
):
    """'More like this' over the indexed text — the cheap, honest version of
    'AI similar places'. No embeddings, no model to keep warm."""
    await load_place(db, place_id)
    hits = await es.search(index=settings.places_index, body=build_similar(str(place_id), limit))

    ids = [int(h["_id"]) for h in hits["hits"]["hits"]]
    by_id = await load_places(db, ids)
    return [by_id[i] for i in ids if i in by_id]


@router.post("/places", response_model=PlaceOut, status_code=status.HTTP_201_CREATED)
async def create_place(
    payload: PlaceIn,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(admin_user),
):
    if not await db.get(Category, payload.category_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unknown category")

    data = payload.model_dump(exclude={"lat", "lon"})
    place = Place(**data)
    place.set_point(payload.lat, payload.lon)
    db.add(place)
    await db.commit()

    await publish(TOPIC_PLACE_EVENTS, {"op": "upsert", "place_id": place.id}, key=str(place.id))
    await cache_drop("search:*")
    return await load_place(db, place.id)


@router.put("/places/{place_id}", response_model=PlaceOut)
async def update_place(
    place_id: int,
    payload: PlaceIn,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(admin_user),
):
    place = await load_place(db, place_id)
    for field, value in payload.model_dump(exclude={"lat", "lon"}).items():
        setattr(place, field, value)
    place.set_point(payload.lat, payload.lon)
    await db.commit()

    await publish(TOPIC_PLACE_EVENTS, {"op": "upsert", "place_id": place_id}, key=str(place_id))
    await cache_drop("search:*")
    return await load_place(db, place_id)


@router.delete("/places/{place_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_place(
    place_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(admin_user),
):
    place = await load_place(db, place_id)
    await db.delete(place)
    await db.commit()

    await publish(TOPIC_PLACE_EVENTS, {"op": "delete", "place_id": place_id}, key=str(place_id))
    await cache_drop("search:*")
