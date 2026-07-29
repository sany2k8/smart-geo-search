"""Kafka producer. Writes are published as events; the worker consumes them and
keeps Elasticsearch and the analytics tables in step with PostgreSQL."""

import json
import logging

from aiokafka import AIOKafkaProducer

from app.config import settings

log = logging.getLogger(__name__)
_producer: AIOKafkaProducer | None = None


async def start_producer() -> None:
    global _producer
    _producer = AIOKafkaProducer(
        bootstrap_servers=settings.kafka_bootstrap,
        value_serializer=lambda v: json.dumps(v).encode(),
        linger_ms=20,
    )
    await _producer.start()


async def stop_producer() -> None:
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None


async def publish(topic: str, event: dict, key: str | None = None) -> None:
    """Fire-and-forget. A dropped analytics event must never fail a user's
    request, so failures are logged rather than raised."""
    if _producer is None:
        log.warning("kafka producer not started; dropping %s event", topic)
        return
    try:
        await _producer.send(topic, event, key=key.encode() if key else None)
    except Exception:  # noqa: BLE001 - deliberately non-fatal
        log.exception("failed to publish %s event", topic)
