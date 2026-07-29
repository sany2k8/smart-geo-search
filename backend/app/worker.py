"""Kafka consumer.

Two jobs, both deliberately kept off the request path:

  place.events   -> reindex (or drop) the Elasticsearch document for a place
  search.events  -> persist the search log and bump the trending counter

Running this as a separate process is the point of the Kafka hop: a slow
Elasticsearch or a burst of analytics can never make a user's write time out.
"""

import asyncio
import json
import logging

from aiokafka import AIOKafkaConsumer
from elasticsearch import NotFoundError
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.cache import bump_trending, redis_client
from app.config import TOPIC_PLACE_EVENTS, TOPIC_SEARCH_EVENTS, settings
from app.db import SessionLocal, init_db
from app.models import Place, SearchLog
from app.search import ensure_index, es, to_document

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s worker %(message)s")
log = logging.getLogger("worker")


async def handle_place_event(event: dict) -> None:
    place_id = event["place_id"]

    if event["op"] == "delete":
        try:
            await es.delete(index=settings.places_index, id=str(place_id))
        except NotFoundError:
            pass
        log.info("removed place %s from index", place_id)
        return

    async with SessionLocal() as db:
        result = await db.execute(
            select(Place).options(selectinload(Place.category)).where(Place.id == place_id)
        )
        place = result.scalar_one_or_none()

    if place is None:
        log.warning("place %s vanished before indexing", place_id)
        return

    await es.index(
        index=settings.places_index,
        id=str(place.id),
        document=to_document(place, place.category.slug, place.category.name),
    )
    log.info("indexed place %s (%s)", place.id, place.name)


async def handle_search_event(event: dict) -> None:
    async with SessionLocal() as db:
        db.add(
            SearchLog(
                user_id=event.get("user_id"),
                query=event["query"][:255],
                result_count=event.get("result_count", 0),
                took_ms=event.get("took_ms", 0),
            )
        )
        await db.commit()
    await bump_trending(event["query"])


HANDLERS = {
    TOPIC_PLACE_EVENTS: handle_place_event,
    TOPIC_SEARCH_EVENTS: handle_search_event,
}


async def main() -> None:
    await init_db()
    await ensure_index()

    consumer = AIOKafkaConsumer(
        *HANDLERS,
        bootstrap_servers=settings.kafka_bootstrap,
        group_id="geosearch-worker",
        value_deserializer=lambda v: json.loads(v.decode()),
        auto_offset_reset="earliest",
        enable_auto_commit=True,
    )
    await consumer.start()
    log.info("consuming %s", ", ".join(HANDLERS))

    try:
        async for message in consumer:
            try:
                await HANDLERS[message.topic](message.value)
            except Exception:  # noqa: BLE001 - one poison message must not stop the loop
                log.exception("failed handling %s: %s", message.topic, message.value)
    finally:
        await consumer.stop()
        await es.close()
        await redis_client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
