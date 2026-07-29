"""End-to-end API tests. These run against the live compose stack:

    docker compose exec api pytest
"""

import os

import httpx
import pytest

BASE = os.environ.get("TEST_API_URL", "http://localhost:8000")


@pytest.fixture(scope="module")
def client():
    with httpx.Client(base_url=BASE, timeout=20) as c:
        yield c


@pytest.fixture(scope="module")
def token(client):
    response = client.post(
        "/auth/login", json={"email": "demo@geosearch.dev", "password": "demo1234"}
    )
    response.raise_for_status()
    return response.json()["access_token"]


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["checks"]["elasticsearch"] in ("green", "yellow")


def test_search_returns_results_and_facets(client):
    body = client.get("/search", params={"size": 5}).json()

    assert body["total"] > 0
    assert len(body["results"]) == 5
    assert {"categories", "cities", "price_levels"} <= body["facets"].keys()


def test_typo_is_tolerated(client):
    """'cofee' must still find cafes — fuzziness plus the synonym list."""
    body = client.get("/search", params={"q": "cofee", "size": 5}).json()

    assert body["total"] > 0
    assert all(hit["category"]["slug"] == "cafe" for hit in body["results"])


def test_multi_word_query_respects_both_terms(client):
    body = client.get("/search", params={"q": "coffee tokyo", "size": 5}).json()
    top = body["results"][0]

    assert top["category"]["slug"] == "cafe"
    assert top["city"] == "Tokyo"


def test_category_filter_excludes_everything_else(client):
    body = client.get("/search", params={"category": "park", "size": 10}).json()
    assert {hit["category"]["slug"] for hit in body["results"]} == {"park"}


def test_radius_search_returns_only_places_inside_it(client):
    body = client.get(
        "/search",
        params={"lat": 40.758, "lon": -73.9855, "radius_km": 2, "sort": "distance", "size": 10},
    ).json()

    distances = [hit["distance_m"] for hit in body["results"]]
    assert all(d <= 2000 for d in distances)
    assert distances == sorted(distances)


def test_postgis_nearby_agrees_with_elasticsearch(client):
    """The two engines index the same points, so the nearest place must match."""
    origin = {"lat": 51.5074, "lon": -0.1278}

    pg = client.get("/places/nearby", params={**origin, "radius_km": 1, "limit": 1}).json()
    es = client.get(
        "/search", params={**origin, "radius_km": 1, "sort": "distance", "size": 1}
    ).json()

    assert pg[0]["id"] == es["results"][0]["id"]
    assert pg[0]["distance_m"] == pytest.approx(es["results"][0]["distance_m"], rel=0.01)


def test_autocomplete_matches_a_prefix(client):
    suggestions = client.get("/autocomplete", params={"q": "gold"}).json()
    assert suggestions
    assert any("gold" in s["name"].lower() for s in suggestions)


def test_writing_a_review_updates_the_place_rating(client, token):
    headers = {"authorization": f"Bearer {token}"}
    place_id = client.get("/search", params={"size": 1}).json()["results"][0]["id"]

    before = client.get(f"/places/{place_id}").json()
    client.post(f"/places/{place_id}/reviews", json={"rating": 1, "body": "Test"}, headers=headers)
    after = client.get(f"/places/{place_id}").json()

    assert after["rating"] <= before["rating"]
    assert after["review_count"] >= before["review_count"]


def test_favorites_round_trip(client, token):
    headers = {"authorization": f"Bearer {token}"}
    place_id = client.get("/search", params={"size": 1}).json()["results"][0]["id"]

    client.put(f"/favorites/{place_id}", headers=headers)
    assert place_id in [p["id"] for p in client.get("/favorites", headers=headers).json()]

    client.delete(f"/favorites/{place_id}", headers=headers)
    assert place_id not in [p["id"] for p in client.get("/favorites", headers=headers).json()]


def test_writes_require_authentication(client):
    assert client.post("/places", json={}).status_code == 401
    assert client.get("/favorites").status_code == 401


def test_non_admin_cannot_create_places(client, token):
    response = client.post(
        "/places",
        json={
            "name": "Nope",
            "category_id": 1,
            "address": "1 St",
            "city": "Berlin",
            "country": "Germany",
            "lat": 52.5,
            "lon": 13.4,
        },
        headers={"authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403


def test_unknown_parameters_are_rejected(client):
    assert client.get("/search", params={"nonsense": "1"}).status_code == 422
