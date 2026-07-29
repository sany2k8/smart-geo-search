"""Query-builder tests.

These assert the shape of the Elasticsearch request rather than hitting a live
cluster, which keeps them fast and makes a ranking regression visible as a diff.
"""

from app.schemas import SearchParams
from app.search.filters import build_filters, build_sort
from app.search.queries import build_search, build_text_query
from app.search.suggest import build_autocomplete


def test_empty_query_matches_all():
    body = build_search(SearchParams())
    # match_all wrapped in the quality boost, so browsing is ordered by quality.
    assert body["query"]["function_score"]["query"]["bool"]["must"] == [{"match_all": {}}]


def test_filters_are_not_scored():
    params = SearchParams(q="cafe", category=["cafe"], city="Berlin", min_rating=4, wifi=True)
    filters = build_filters(params)

    assert {"terms": {"category": ["cafe"]}} in filters
    assert {"term": {"city": "Berlin"}} in filters
    assert {"range": {"rating": {"gte": 4.0}}} in filters
    assert {"term": {"wifi": True}} in filters


def test_unset_amenities_add_no_filter():
    assert build_filters(SearchParams(q="cafe")) == []


def test_radius_search_adds_geo_distance():
    params = SearchParams(q="cafe", lat=52.52, lon=13.405, radius_km=3)
    geo = [f for f in build_filters(params) if "geo_distance" in f]

    assert geo == [{"geo_distance": {"distance": "3.0km", "location": {"lat": 52.52, "lon": 13.405}}}]


def test_viewport_search_adds_bounding_box():
    params = SearchParams(min_lat=52.4, min_lon=13.3, max_lat=52.6, max_lon=13.5)
    box = [f for f in build_filters(params) if "geo_bounding_box" in f]

    assert box[0]["geo_bounding_box"]["location"]["top_left"] == {"lat": 52.6, "lon": 13.3}


def test_every_term_must_match_somewhere():
    """The clause that stops "coffee tokyo" from ranking every place in Tokyo."""
    clauses = build_text_query("coffee tokyo")["bool"]["should"]
    all_terms = next(c for c in clauses if "bool" in c and c["bool"].get("boost"))

    assert len(all_terms["bool"]["must"]) == 2
    assert all(m["multi_match"]["fuzziness"] == "AUTO" for m in all_terms["bool"]["must"])


def test_distance_sort_needs_an_origin():
    assert build_sort(SearchParams(sort="distance")) == ["_score"]

    sort = build_sort(SearchParams(sort="distance", lat=1.0, lon=2.0))
    assert sort[0]["_geo_distance"]["order"] == "asc"


def test_distance_is_returned_whenever_an_origin_is_given():
    body = build_search(SearchParams(q="cafe", lat=1.0, lon=2.0, sort="rating"))
    assert "distance_m" in body["script_fields"]

    assert "script_fields" not in build_search(SearchParams(q="cafe"))


def test_paging_is_translated_to_from_and_size():
    body = build_search(SearchParams(page=3, size=20))
    assert (body["from"], body["size"]) == (40, 20)


def test_autocomplete_prefers_nearby_when_an_origin_is_given():
    assert "sort" not in build_autocomplete("cof", None, None, 5)
    assert "sort" in build_autocomplete("cof", 1.0, 2.0, 5)
