from app.models import Place


def to_document(place: Place, category_slug: str, category_name: str) -> dict:
    """Flatten a Place row (plus its joined category) into an ES document.

    The category is passed in rather than read off the relationship so callers
    are forced to have loaded it — otherwise this would fire a lazy query per
    document during a bulk index.
    """
    return {
        "name": place.name,
        "description": place.description,
        "category": category_slug,
        "category_name": category_name,
        "address": place.address,
        "city": place.city,
        "country": place.country,
        "location": {"lat": place.lat, "lon": place.lon},
        "rating": place.rating,
        "review_count": place.review_count,
        "popularity": place.popularity,
        "price_level": place.price_level,
        "opens_at": place.opens_at,
        "closes_at": place.closes_at,
        "open_24h": place.open_24h,
        "wifi": place.wifi,
        "parking": place.parking,
        "delivery": place.delivery,
        "takeaway": place.takeaway,
        "pet_friendly": place.pet_friendly,
        "wheelchair_accessible": place.wheelchair_accessible,
        "outdoor_seating": place.outdoor_seating,
        "reservation": place.reservation,
    }
