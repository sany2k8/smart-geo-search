"""Filter and sort clauses.

Filters live in the `filter` context, which means ES skips scoring for them and
can reuse the cached bitsets — the reason a heavily filtered search is no slower
than an unfiltered one.
"""

from datetime import datetime, timezone

from app.schemas import SearchParams

BOOL_FILTERS = (
    "wifi",
    "parking",
    "delivery",
    "takeaway",
    "pet_friendly",
    "wheelchair_accessible",
    "outdoor_seating",
    "reservation",
)


def build_filters(p: SearchParams) -> list[dict]:
    clauses: list[dict] = []

    if p.category:
        clauses.append({"terms": {"category": p.category}})
    if p.city:
        clauses.append({"term": {"city": p.city}})
    if p.min_rating is not None:
        clauses.append({"range": {"rating": {"gte": p.min_rating}}})
    if p.max_price is not None:
        clauses.append({"range": {"price_level": {"lte": p.max_price}}})

    for name in BOOL_FILTERS:
        if getattr(p, name, False):
            clauses.append({"term": {name: True}})

    if p.open_now:
        clauses.append(_open_now_clause())

    # Radius search: ES does the geo filtering so paging stays correct.
    if p.lat is not None and p.lon is not None and p.radius_km:
        clauses.append(
            {
                "geo_distance": {
                    "distance": f"{p.radius_km}km",
                    "location": {"lat": p.lat, "lon": p.lon},
                }
            }
        )

    # Map viewport search.
    if None not in (p.min_lat, p.min_lon, p.max_lat, p.max_lon):
        clauses.append(
            {
                "geo_bounding_box": {
                    "location": {
                        "top_left": {"lat": p.max_lat, "lon": p.min_lon},
                        "bottom_right": {"lat": p.min_lat, "lon": p.max_lon},
                    }
                }
            }
        )

    return clauses


def _open_now_clause() -> dict:
    hour = datetime.now(timezone.utc).hour
    return {
        "bool": {
            "should": [
                {"term": {"open_24h": True}},
                {
                    "bool": {
                        "must": [
                            {"range": {"opens_at": {"lte": hour}}},
                            {"range": {"closes_at": {"gt": hour}}},
                        ]
                    }
                },
            ],
            "minimum_should_match": 1,
        }
    }


def build_sort(p: SearchParams) -> list:
    if p.sort == "distance":
        if p.lat is None or p.lon is None:
            return ["_score"]  # no origin to sort against; fall back to relevance
        return [
            {
                "_geo_distance": {
                    "location": {"lat": p.lat, "lon": p.lon},
                    "order": "asc",
                    "unit": "m",
                }
            }
        ]
    return {
        "relevance": ["_score", {"rating": "desc"}],
        "rating": [{"rating": "desc"}, {"review_count": "desc"}],
        "popularity": [{"popularity": "desc"}, "_score"],
        "most_reviewed": [{"review_count": "desc"}],
        "price_asc": [{"price_level": "asc"}, "_score"],
        "price_desc": [{"price_level": "desc"}, "_score"],
    }.get(p.sort, ["_score"])
