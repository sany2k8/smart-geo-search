from elasticsearch import AsyncElasticsearch

from app.config import settings
from app.search.mapping import INDEX_SETTINGS

es = AsyncElasticsearch(settings.elasticsearch_url)


async def ensure_index() -> None:
    """Create the index if it is missing. Safe to call on every boot."""
    if not await es.indices.exists(index=settings.places_index):
        await es.indices.create(index=settings.places_index, body=INDEX_SETTINGS)


async def recreate_index() -> None:
    """Drop and rebuild. Used by the seeder — analyzers cannot be changed on a
    live index, so a mapping change means a reindex."""
    await es.indices.delete(index=settings.places_index, ignore_unavailable=True)
    await es.indices.create(index=settings.places_index, body=INDEX_SETTINGS)
