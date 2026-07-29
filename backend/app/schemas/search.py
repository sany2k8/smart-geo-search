from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.place import PlaceOut

SortKey = Literal[
    "relevance", "distance", "rating", "popularity", "most_reviewed", "price_asc", "price_desc"
]


class SearchParams(BaseModel):
    """Every knob the search endpoint accepts, as query parameters."""

    model_config = ConfigDict(extra="forbid")

    q: str = ""
    category: list[str] = Field(default_factory=list)
    city: str | None = None
    min_rating: float | None = Field(default=None, ge=0, le=5)
    max_price: int | None = Field(default=None, ge=1, le=4)
    open_now: bool = False

    wifi: bool = False
    parking: bool = False
    delivery: bool = False
    takeaway: bool = False
    pet_friendly: bool = False
    wheelchair_accessible: bool = False
    outdoor_seating: bool = False
    reservation: bool = False

    # Origin for radius search and distance output.
    lat: float | None = Field(default=None, ge=-90, le=90)
    lon: float | None = Field(default=None, ge=-180, le=180)
    radius_km: float | None = Field(default=None, gt=0, le=500)

    # Map viewport (bounding box).
    min_lat: float | None = None
    min_lon: float | None = None
    max_lat: float | None = None
    max_lon: float | None = None

    sort: SortKey = "relevance"
    page: int = Field(default=1, ge=1, le=100)
    size: int = Field(default=20, ge=1, le=100)


class PlaceHit(PlaceOut):
    score: float = 0.0
    distance_m: float | None = None
    highlight: dict[str, list[str]] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    total: int
    page: int
    size: int
    took_ms: int
    results: list[PlaceHit]
    facets: dict[str, list[dict]] = Field(default_factory=dict)


class Suggestion(BaseModel):
    id: int
    name: str
    category: str
    city: str
    lat: float
    lon: float


class TrendingItem(BaseModel):
    query: str
    count: int
