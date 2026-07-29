"""Generates and loads sample data: categories, ~400 places across six cities,
users, reviews and favourites — then bulk-indexes everything into Elasticsearch.

Deterministic (fixed RNG seed) so runs are reproducible.

    docker compose exec api python -m seed.seed
"""

import asyncio
import json
import random
from pathlib import Path

from elasticsearch.helpers import async_bulk
from sqlalchemy import delete, func, select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db import SessionLocal, init_db
from app.models import Category, Favorite, Place, Review, SearchLog, User
from app.search import es, recreate_index, to_document
from app.security import hash_password

RNG = random.Random(20240724)

CITIES = [
    # name, country, centre lat/lon, spread in degrees, street names
    ("New York", "United States", 40.7580, -73.9855, 0.055, ["Broadway", "5th Ave", "Bleecker St", "Canal St", "W 42nd St"]),
    ("San Francisco", "United States", 37.7749, -122.4194, 0.040, ["Market St", "Valencia St", "Haight St", "Mission St", "Polk St"]),
    ("London", "United Kingdom", 51.5074, -0.1278, 0.050, ["Oxford St", "Brick Lane", "Baker St", "Shoreditch High St", "Kings Rd"]),
    ("Paris", "France", 48.8566, 2.3522, 0.040, ["Rue de Rivoli", "Boulevard Saint-Germain", "Rue Montorgueil", "Avenue Kleber"]),
    ("Berlin", "Germany", 52.5200, 13.4050, 0.050, ["Torstrasse", "Kastanienallee", "Karl-Marx-Allee", "Bergmannstrasse"]),
    ("Tokyo", "Japan", 35.6762, 139.6503, 0.045, ["Omotesando", "Nakameguro St", "Shinjuku Dori", "Yanaka Ginza"]),
]

CATEGORIES = [
    ("restaurant", "Restaurant", "utensils"),
    ("cafe", "Cafe", "coffee"),
    ("bar", "Bar", "beer"),
    ("hotel", "Hotel", "bed"),
    ("park", "Park", "tree"),
    ("museum", "Museum", "landmark"),
    ("gym", "Gym", "dumbbell"),
    ("pharmacy", "Pharmacy", "pill"),
    ("supermarket", "Supermarket", "shopping-cart"),
    ("hospital", "Hospital", "stethoscope"),
]

NAME_PARTS = {
    "restaurant": (["Golden", "Rustic", "Blue", "Little", "Old", "Green", "Silver", "Hidden"],
                   ["Spoon", "Table", "Kitchen", "Garden", "Fork", "Plate", "House", "Bistro"]),
    "cafe": (["Daily", "Morning", "Third", "Slow", "Bright", "Corner", "Velvet", "Iron"],
             ["Bean", "Roasters", "Grind", "Brew", "Cup", "Press", "Drip", "Espresso Bar"]),
    "bar": (["Crooked", "Neon", "Dusty", "Electric", "Copper", "Midnight", "Rusty"],
            ["Anchor", "Lantern", "Barrel", "Owl", "Tap Room", "Cellar", "Fox"]),
    "hotel": (["Grand", "Central", "Park", "Royal", "Harbour", "Metro", "Union"],
              ["Hotel", "Inn", "Residence", "Lodge", "Suites", "House"]),
    "park": (["Riverside", "Sunset", "Old Oak", "Cedar", "Lakeside", "Meadow", "Kingsway"],
             ["Park", "Gardens", "Green", "Commons", "Reserve", "Square"]),
    "museum": (["City", "Modern", "National", "Maritime", "Natural History", "Design"],
               ["Museum", "Gallery", "Collection", "Archive", "Exhibition Hall"]),
    "gym": (["Iron", "Pulse", "Summit", "Forge", "Apex", "Kinetic"],
            ["Fitness", "Gym", "Strength Club", "Athletics", "Training Lab"]),
    "pharmacy": (["Central", "Green Cross", "City", "Wellness", "Care"],
                 ["Pharmacy", "Chemist", "Drugstore", "Dispensary"]),
    "supermarket": (["Fresh", "Daily", "Corner", "Value", "Harvest", "Market"],
                    ["Market", "Grocer", "Supermarket", "Foods", "Provisions"]),
    "hospital": (["St. Mary's", "Riverside", "Central", "University", "Northside"],
                 ["Hospital", "Medical Centre", "Clinic", "Health Centre"]),
}

DESCRIPTIONS = {
    "restaurant": "Seasonal menu with a short wine list and an open kitchen. Popular for dinner; book ahead on weekends.",
    "cafe": "Single-origin espresso, house-baked pastries and plenty of laptop-friendly seating.",
    "bar": "Cocktail bar with a rotating draught list and live music on weekends.",
    "hotel": "Quiet rooms a short walk from the centre, with a lobby bar and 24-hour reception.",
    "park": "Open green space with walking paths, a playground and shaded picnic lawns.",
    "museum": "Permanent collection plus a rotating programme of temporary exhibitions.",
    "gym": "Free weights, functional training area and a full class timetable from early morning.",
    "pharmacy": "Prescriptions, over-the-counter medicine and travel vaccinations.",
    "supermarket": "Full grocery range with a fresh produce counter and in-store bakery.",
    "hospital": "Emergency department and outpatient clinics, open around the clock.",
}

REVIEW_BODIES = [
    "Exactly what I was looking for. Staff were friendly and it wasn't crowded.",
    "Good, not great. Fine if you're already nearby but I wouldn't cross town for it.",
    "Been coming here for years. Consistent every single time.",
    "Lovely spot, though it gets very busy after 6pm.",
    "Slow service on my last visit, but the quality made up for it.",
    "Easy to find, clean, and reasonably priced. Would come back.",
    "Overpriced for what it is. The location is the main draw.",
    "Hidden gem. Ask for a table near the window.",
]

TARGET_PLACES = 400


def build_places() -> list[dict]:
    places: list[dict] = []
    per_city = TARGET_PLACES // len(CITIES)

    for city, country, clat, clon, spread, streets in CITIES:
        for _ in range(per_city):
            slug, cat_name, _icon = RNG.choice(CATEGORIES)
            first, second = NAME_PARTS[slug]
            name = f"{RNG.choice(first)} {RNG.choice(second)}"
            if RNG.random() < 0.35:  # some places carry the city in the name
                name = f"{name} {city}"

            # Cluster around the centre rather than spreading uniformly, so
            # radius search returns believable results.
            lat = clat + RNG.gauss(0, spread / 2)
            lon = clon + RNG.gauss(0, spread / 2)

            open_24h = slug in ("hospital", "pharmacy") and RNG.random() < 0.5
            # A latent "true" quality for this place. Reviews are sampled around
            # it and the stored rating is then derived from those reviews, so
            # rating and review_count are never inconsistent.
            quality = min(5.0, max(2.5, RNG.gauss(4.0, 0.5)))

            places.append(
                {
                    "name": name,
                    "description": DESCRIPTIONS[slug],
                    "category": slug,
                    "address": f"{RNG.randint(1, 400)} {RNG.choice(streets)}",
                    "city": city,
                    "country": country,
                    "lat": round(lat, 6),
                    "lon": round(lon, 6),
                    "phone": f"+1-555-{RNG.randint(1000, 9999)}",
                    "website": f"https://example.com/{name.lower().replace(' ', '-').replace('.', '')}",
                    "price_level": RNG.choices([1, 2, 3, 4], weights=[25, 45, 22, 8])[0],
                    "quality": round(quality, 2),
                    "popularity": RNG.randint(0, 5000),
                    "opens_at": 0 if open_24h else RNG.choice([6, 7, 8, 9, 10, 11]),
                    "closes_at": 24 if open_24h else RNG.choice([17, 19, 21, 22, 23]),
                    "open_24h": open_24h,
                    "wifi": RNG.random() < 0.6,
                    "parking": RNG.random() < 0.45,
                    "delivery": slug in ("restaurant", "cafe", "supermarket") and RNG.random() < 0.6,
                    "takeaway": slug in ("restaurant", "cafe", "bar") and RNG.random() < 0.7,
                    "pet_friendly": RNG.random() < 0.35,
                    "wheelchair_accessible": RNG.random() < 0.7,
                    "outdoor_seating": slug in ("restaurant", "cafe", "bar") and RNG.random() < 0.5,
                    "reservation": slug in ("restaurant", "hotel") and RNG.random() < 0.8,
                }
            )
    return places


async def run() -> None:
    await init_db()
    raw_places = build_places()

    dataset = Path(__file__).parent / "places.json"
    dataset.write_text(json.dumps(raw_places, indent=2))
    print(f"wrote {len(raw_places)} places to {dataset}")

    async with SessionLocal() as db:
        # Clean slate, children first.
        for model in (SearchLog, Favorite, Review, Place, Category, User):
            await db.execute(delete(model))
        await db.commit()

        categories = {
            slug: Category(slug=slug, name=name, icon=icon) for slug, name, icon in CATEGORIES
        }
        db.add_all(categories.values())
        await db.flush()

        users = [
            User(
                email="admin@geosearch.dev",
                display_name="Admin",
                hashed_password=hash_password("admin1234"),
                is_admin=True,
            ),
            User(
                email="demo@geosearch.dev",
                display_name="Demo User",
                hashed_password=hash_password("demo1234"),
            ),
        ] + [
            User(
                email=f"reviewer{i}@geosearch.dev",
                display_name=f"Reviewer {i}",
                hashed_password=hash_password("password123"),
            )
            for i in range(1, 13)
        ]
        db.add_all(users)
        await db.flush()

        places = []
        quality_by_index = []
        for row in raw_places:
            data = {k: v for k, v in row.items() if k not in ("lat", "lon", "category", "quality")}
            place = Place(category_id=categories[row["category"]].id, **data)
            place.set_point(row["lat"], row["lon"])
            places.append(place)
            quality_by_index.append(row["quality"])
        db.add_all(places)
        await db.flush()

        # Every place gets at least one review, so no place ever displays a
        # rating it did not earn.
        reviewers = users[1:]
        review_count = 0
        for place, quality in zip(places, quality_by_index):
            for reviewer in RNG.sample(reviewers, RNG.randint(1, 6)):
                db.add(
                    Review(
                        place_id=place.id,
                        user_id=reviewer.id,
                        rating=max(1, min(5, round(RNG.gauss(quality, 0.8)))),
                        body=RNG.choice(REVIEW_BODIES),
                        helpful_count=RNG.randint(0, 40),
                    )
                )
                review_count += 1
        await db.flush()

        aggregates = (
            await db.execute(
                select(Review.place_id, func.avg(Review.rating), func.count(Review.id)).group_by(
                    Review.place_id
                )
            )
        ).all()
        by_id = {p.id: p for p in places}
        for place_id, avg, count in aggregates:
            by_id[place_id].rating = round(float(avg), 2)
            by_id[place_id].review_count = int(count)

        demo = users[1]
        for place in RNG.sample(places, 12):
            db.add(Favorite(user_id=demo.id, place_id=place.id))

        await db.commit()
        print(f"seeded {len(places)} places, {len(users)} users, {review_count} reviews")

        # Bulk index. Load the categories with the places so the document
        # builder does not fire a query per row.
        result = await db.execute(select(Place).options(selectinload(Place.category)))
        rows = list(result.scalars())

    await recreate_index()
    actions = (
        {
            "_index": settings.places_index,
            "_id": str(p.id),
            "_source": to_document(p, p.category.slug, p.category.name),
        }
        for p in rows
    )
    indexed, _ = await async_bulk(es, actions, chunk_size=500)
    await es.indices.refresh(index=settings.places_index)
    print(f"indexed {indexed} documents into Elasticsearch")
    await es.close()


if __name__ == "__main__":
    asyncio.run(run())
