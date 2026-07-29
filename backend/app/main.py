import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.cache import rate_limit, redis_client
from app.db import init_db
from app.events import start_producer, stop_producer
from app.routers import analytics, auth, favorites, places, reviews, search
from app.search import ensure_index, es

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("geosearch")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await ensure_index()
    await start_producer()
    log.info("geosearch api ready")
    yield
    await stop_producer()
    await es.close()
    await redis_client.aclose()


app = FastAPI(
    title="GeoSearch API",
    description="Map-based place search over PostGIS + Elasticsearch.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev only
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting is applied to the whole API surface, backed by Redis.
api_deps = [Depends(rate_limit)]

app.include_router(auth.router, dependencies=api_deps)
app.include_router(places.router, dependencies=api_deps)
app.include_router(search.router, dependencies=api_deps)
app.include_router(reviews.router, dependencies=api_deps)
app.include_router(favorites.router, dependencies=api_deps)
app.include_router(analytics.router, dependencies=api_deps)


@app.get("/health", tags=["ops"])
async def health():
    checks = {}
    try:
        checks["elasticsearch"] = (await es.cluster.health())["status"]
    except Exception as exc:  # noqa: BLE001
        checks["elasticsearch"] = f"error: {exc}"
    try:
        checks["redis"] = "ok" if await redis_client.ping() else "down"
    except Exception as exc:  # noqa: BLE001
        checks["redis"] = f"error: {exc}"
    return {"status": "ok", "checks": checks}
