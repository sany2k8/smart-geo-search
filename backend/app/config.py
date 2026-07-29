from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://geo:geo@localhost:5434/geosearch"
    elasticsearch_url: str = "http://localhost:9202"
    redis_url: str = "redis://localhost:6381/0"
    kafka_bootstrap: str = "localhost:29094"

    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24

    places_index: str = "places"
    search_cache_ttl: int = 60
    rate_limit_per_minute: int = 120


settings = Settings()

TOPIC_PLACE_EVENTS = "place.events"
TOPIC_SEARCH_EVENTS = "search.events"
