from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.cache import cache_drop
from app.config import TOPIC_PLACE_EVENTS
from app.db import get_db
from app.events import publish
from app.models import Place, Review, User
from app.schemas import ReviewIn, ReviewOut
from app.security import current_user

router = APIRouter(prefix="/places/{place_id}/reviews", tags=["reviews"])


async def recalculate_rating(db: AsyncSession, place_id: int) -> None:
    """Keep the denormalised aggregates on `places` correct. They are what both
    the rating filter and the relevance boost read, so they must not drift."""
    row = (
        await db.execute(
            select(func.avg(Review.rating), func.count(Review.id)).where(
                Review.place_id == place_id
            )
        )
    ).one()
    place = await db.get(Place, place_id)
    place.rating = round(float(row[0] or 0), 2)
    place.review_count = int(row[1])


@router.get("", response_model=list[ReviewOut])
async def list_reviews(
    place_id: int,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Review)
        .options(selectinload(Review.user))
        .where(Review.place_id == place_id)
        .order_by(Review.helpful_count.desc(), Review.created_at.desc())
        .limit(limit)
    )
    return [
        ReviewOut(
            id=r.id,
            place_id=r.place_id,
            rating=r.rating,
            body=r.body,
            helpful_count=r.helpful_count,
            created_at=r.created_at,
            author=r.user.display_name,
        )
        for r in result.scalars()
    ]


@router.post("", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
async def create_review(
    place_id: int,
    payload: ReviewIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    if not await db.get(Place, place_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Place not found")

    existing = await db.execute(
        select(Review).where(Review.place_id == place_id, Review.user_id == user.id)
    )
    review = existing.scalar_one_or_none()
    if review:  # one review per user per place — update instead of duplicating
        review.rating = payload.rating
        review.body = payload.body
    else:
        review = Review(
            place_id=place_id, user_id=user.id, rating=payload.rating, body=payload.body
        )
        db.add(review)

    await db.flush()
    await recalculate_rating(db, place_id)
    await db.commit()
    await db.refresh(review)

    # The rating changed, so the ES document is stale — republish.
    await publish(TOPIC_PLACE_EVENTS, {"op": "upsert", "place_id": place_id}, key=str(place_id))
    await cache_drop("search:*")

    return ReviewOut(
        id=review.id,
        place_id=place_id,
        rating=review.rating,
        body=review.body,
        helpful_count=review.helpful_count,
        created_at=review.created_at,
        author=user.display_name,
    )


@router.post("/{review_id}/helpful", response_model=ReviewOut)
async def mark_helpful(
    place_id: int,
    review_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    result = await db.execute(
        select(Review)
        .options(selectinload(Review.user))
        .where(Review.id == review_id, Review.place_id == place_id)
    )
    review = result.scalar_one_or_none()
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Review not found")

    review.helpful_count += 1
    await db.commit()
    return ReviewOut(
        id=review.id,
        place_id=review.place_id,
        rating=review.rating,
        body=review.body,
        helpful_count=review.helpful_count,
        created_at=review.created_at,
        author=review.user.display_name,
    )
