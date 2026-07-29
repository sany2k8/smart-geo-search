"""Autocomplete and 'similar places' request bodies."""

from app.config import settings


def build_autocomplete(q: str, lat: float | None, lon: float | None, size: int) -> dict:
    body: dict = {
        "query": {
            "bool": {
                "should": [
                    # Edge n-grams: matches after the second character typed.
                    {"match": {"name.autocomplete": {"query": q, "boost": 3}}},
                    # Fuzzy fallback so a typo still suggests something.
                    {"match": {"name": {"query": q, "fuzziness": "AUTO", "prefix_length": 1}}},
                    {"match": {"category_name": {"query": q}}},
                ],
                "minimum_should_match": 1,
            }
        },
        "size": size,
        "_source": ["name", "category", "city", "location", "rating"],
    }
    # Prefer suggestions the user could actually walk to.
    if lat is not None and lon is not None:
        body["sort"] = [
            "_score",
            {"_geo_distance": {"location": {"lat": lat, "lon": lon}, "order": "asc"}},
        ]
    return body


def build_similar(doc_id: str, size: int) -> dict:
    """'More like this' over the indexed text — real relevance, no embeddings."""
    return {
        "query": {
            "bool": {
                "must": [
                    {
                        "more_like_this": {
                            "fields": ["name", "description", "category_name"],
                            "like": [{"_index": settings.places_index, "_id": doc_id}],
                            "min_term_freq": 1,
                            "min_doc_freq": 1,
                            "max_query_terms": 25,
                        }
                    }
                ],
                "must_not": [{"ids": {"values": [doc_id]}}],
            }
        },
        "size": size,
    }
