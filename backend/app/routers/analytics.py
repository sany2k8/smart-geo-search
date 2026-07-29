from fastapi import APIRouter, Depends, Query
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models import SearchLog, User
from app.security import admin_user, current_user

router = APIRouter(tags=["analytics"])


@router.get("/me/history")
async def my_history(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    """Recent searches. Deduplicated to the most recent occurrence of each query."""
    result = await db.execute(
        select(SearchLog.query, func.max(SearchLog.created_at).label("last_used"))
        .where(SearchLog.user_id == user.id)
        .group_by(SearchLog.query)
        .order_by(func.max(SearchLog.created_at).desc())
        .limit(limit)
    )
    return [{"query": q, "last_used": ts} for q, ts in result.all()]


@router.get("/admin/analytics")
async def search_analytics(
    days: int = Query(7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(admin_user),
):
    """What people searched for, and what failed them — the two questions a
    search team actually asks of its logs."""
    since = func.now() - func.make_interval(0, 0, 0, days)

    totals = (
        await db.execute(
            select(
                func.count(SearchLog.id),
                func.count(distinct(SearchLog.query)),
                func.avg(SearchLog.took_ms),
            ).where(SearchLog.created_at >= since)
        )
    ).one()

    top = (
        await db.execute(
            select(SearchLog.query, func.count(SearchLog.id).label("n"))
            .where(SearchLog.created_at >= since)
            .group_by(SearchLog.query)
            .order_by(func.count(SearchLog.id).desc())
            .limit(10)
        )
    ).all()

    zero = (
        await db.execute(
            select(SearchLog.query, func.count(SearchLog.id).label("n"))
            .where(SearchLog.created_at >= since, SearchLog.result_count == 0)
            .group_by(SearchLog.query)
            .order_by(func.count(SearchLog.id).desc())
            .limit(10)
        )
    ).all()

    return {
        "window_days": days,
        "total_searches": totals[0],
        "unique_queries": totals[1],
        "avg_took_ms": round(float(totals[2] or 0), 1),
        "top_queries": [{"query": q, "count": n} for q, n in top],
        "zero_result_queries": [{"query": q, "count": n} for q, n in zero],
    }
