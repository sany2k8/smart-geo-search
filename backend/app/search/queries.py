"""The main /search request body: text matching, ranking and aggregations."""

from app.schemas import SearchParams
from app.search.filters import build_filters, build_sort


SEARCH_FIELDS = ["name^4", "category_name^2", "description", "city.text", "address"]
MAX_TERMS = 8


def _all_terms_clause(q: str) -> dict:
    """Require every term to match *some* field, each one fuzzily.

    One fuzzy multi_match per term rather than `cross_fields`/`combined_fields`,
    because those two ignore fuzziness — which would exclude exactly the typo'd
    term this clause needs to tolerate ("cofee tokyo").
    """
    terms = q.split()[:MAX_TERMS]
    return {
        "bool": {
            "must": [
                {
                    "multi_match": {
                        "query": term,
                        "fields": SEARCH_FIELDS,
                        "fuzziness": "AUTO",
                        "prefix_length": 1,
                    }
                }
                for term in terms
            ],
            "boost": 4,
        }
    }


def build_text_query(q: str) -> dict:
    """Text matching, layered from loosest to strictest.

    The loose clause decides *what* is eligible; the stricter clauses decide
    *what wins*. Without the all-terms clause a query like "coffee tokyo" would
    treat every place in Tokyo as an equally good answer, because matching one
    of two terms is enough to qualify.

    Synonyms are expanded by the query analyzer on the mapping, and typos by
    `fuzziness: AUTO`, so neither needs handling here.
    """
    return {
        "bool": {
            "should": [
                # 1. Any term matches — the recall net.
                {
                    "multi_match": {
                        "query": q,
                        "fields": SEARCH_FIELDS,
                        "fuzziness": "AUTO",
                        "prefix_length": 1,
                        "operator": "or",
                        "minimum_should_match": "1",
                    }
                },
                # 2. Every term matches somewhere — the strongest ordinary signal.
                _all_terms_clause(q),
                # 3. Exact wording, then the exact name.
                {"match_phrase": {"name": {"query": q, "boost": 6}}},
                {"term": {"name.raw": {"value": q.lower(), "boost": 10}}},
            ],
            "minimum_should_match": 1,
        }
    }


def apply_quality_boost(query: dict) -> dict:
    """Nudge well-reviewed, popular places up the list.

    Deliberately gentle: the functions stay in roughly [0.5, 1.8] and are capped
    by max_boost, so a strong textual match still outranks a mediocre one that
    happens to be popular. Quality is a tie-breaker, not the ranking.
    """
    return {
        "function_score": {
            "query": query,
            "functions": [
                {"field_value_factor": {"field": "rating", "factor": 0.16, "missing": 3.0}},
                {
                    "field_value_factor": {
                        "field": "popularity",
                        "modifier": "log1p",
                        "factor": 0.002,
                        "missing": 0,
                    }
                },
            ],
            "score_mode": "sum",
            "boost_mode": "multiply",
            "max_boost": 2.0,
        }
    }


def build_search(p: SearchParams) -> dict:
    must = build_text_query(p.q) if p.q else {"match_all": {}}
    query: dict = {"bool": {"must": [must], "filter": build_filters(p)}}

    # Also applied to the empty query, where every doc scores 1.0 and the boost
    # alone decides the order — which is what you want for a browse-style list.
    if p.sort == "relevance":
        query = apply_quality_boost(query)

    body: dict = {
        "query": query,
        "from": (p.page - 1) * p.size,
        "size": p.size,
        "track_total_hits": True,
        "sort": build_sort(p),
        "highlight": {
            "fields": {"name": {}, "description": {}},
            "pre_tags": ["<mark>"],
            "post_tags": ["</mark>"],
        },
        "aggs": {
            "categories": {"terms": {"field": "category", "size": 20}},
            "cities": {"terms": {"field": "city", "size": 20}},
            "price_levels": {"terms": {"field": "price_level", "size": 4}},
        },
    }

    # Distance is returned for every hit when the caller gave us an origin, so
    # the UI can show "1.2 km away" regardless of the sort order.
    if p.lat is not None and p.lon is not None:
        body["script_fields"] = {
            "distance_m": {
                "script": {
                    "source": "doc['location'].arcDistance(params.lat, params.lon)",
                    "params": {"lat": p.lat, "lon": p.lon},
                }
            }
        }
        body["_source"] = True

    return body
