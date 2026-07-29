from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_db
from app.models import Favorite, Place, User
from app.schemas import PlaceOut
from app.security import current_user

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("", response_model=list[PlaceOut])
async def list_favorites(
    db: AsyncSession = Depends(get_db), user: User = Depends(current_user)
):
    result = await db.execute(
        select(Place)
        .options(selectinload(Place.category))
        .join(Favorite, Favorite.place_id == Place.id)
        .where(Favorite.user_id == user.id)
        .order_by(Favorite.created_at.desc())
    )
    return list(result.scalars())


@router.put("/{place_id}", status_code=status.HTTP_204_NO_CONTENT)
async def add_favorite(
    place_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(current_user)
):
    place = await db.get(Place, place_id)
    if place is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")

    existing = await db.execute(
        select(Favorite).where(Favorite.user_id == user.id, Favorite.place_id == place_id)
    )
    if existing.scalar_one_or_none():
        return  # idempotent

    db.add(Favorite(user_id=user.id, place_id=place_id))
    place.popularity += 1
    await db.commit()


@router.delete("/{place_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    place_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(current_user)
):
    result = await db.execute(
        select(Favorite).where(Favorite.user_id == user.id, Favorite.place_id == place_id)
    )
    favorite = result.scalar_one_or_none()
    if favorite:
        await db.delete(favorite)
        await db.commit()
