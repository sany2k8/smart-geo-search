"""Request/response schemas, grouped by the resource they describe."""

from app.schemas.auth import LoginIn, RegisterIn, TokenOut, UserOut
from app.schemas.place import CategoryOut, PlaceIn, PlaceOut
from app.schemas.review import ReviewIn, ReviewOut
from app.schemas.search import (
    PlaceHit,
    SearchParams,
    SearchResponse,
    SortKey,
    Suggestion,
    TrendingItem,
)

__all__ = [
    "CategoryOut",
    "LoginIn",
    "PlaceHit",
    "PlaceIn",
    "PlaceOut",
    "RegisterIn",
    "ReviewIn",
    "ReviewOut",
    "SearchParams",
    "SearchResponse",
    "SortKey",
    "Suggestion",
    "TokenOut",
    "TrendingItem",
    "UserOut",
]
