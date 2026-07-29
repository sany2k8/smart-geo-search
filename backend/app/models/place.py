from datetime import datetime
from typing import TYPE_CHECKING

from geoalchemy2 import Geography
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.review import Review


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    icon: Mapped[str] = mapped_column(String(16), default="pin")

    places: Mapped[list["Place"]] = relationship(back_populates="category")


class Place(Base):
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)

    address: Mapped[str] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(120), index=True)
    country: Mapped[str] = mapped_column(String(120))
    # lat/lon are the source of truth for reads (cheap to serialise); `location`
    # is the PostGIS geography derived from them and is what the GiST index and
    # every spatial query actually use. Keep them in sync via Place.set_point().
    lat: Mapped[float] = mapped_column(Float)
    lon: Mapped[float] = mapped_column(Float)
    location: Mapped[str] = mapped_column(Geography("POINT", srid=4326))

    phone: Mapped[str] = mapped_column(String(40), default="")
    website: Mapped[str] = mapped_column(String(255), default="")
    price_level: Mapped[int] = mapped_column(SmallInteger, default=2)  # 1..4

    # Denormalised review aggregates, recalculated on write.
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    popularity: Mapped[int] = mapped_column(Integer, default=0)

    opens_at: Mapped[int] = mapped_column(SmallInteger, default=9)  # local hour
    closes_at: Mapped[int] = mapped_column(SmallInteger, default=22)
    open_24h: Mapped[bool] = mapped_column(Boolean, default=False)

    wifi: Mapped[bool] = mapped_column(Boolean, default=False)
    parking: Mapped[bool] = mapped_column(Boolean, default=False)
    delivery: Mapped[bool] = mapped_column(Boolean, default=False)
    takeaway: Mapped[bool] = mapped_column(Boolean, default=False)
    pet_friendly: Mapped[bool] = mapped_column(Boolean, default=False)
    wheelchair_accessible: Mapped[bool] = mapped_column(Boolean, default=False)
    outdoor_seating: Mapped[bool] = mapped_column(Boolean, default=False)
    reservation: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    category: Mapped[Category] = relationship(back_populates="places")
    reviews: Mapped[list["Review"]] = relationship(
        back_populates="place", cascade="all, delete-orphan"
    )

    def set_point(self, lat: float, lon: float) -> None:
        self.lat = lat
        self.lon = lon
        self.location = f"SRID=4326;POINT({lon} {lat})"


# GiST index — the workhorse for radius / bbox / nearest-neighbour queries.
Index("ix_places_location", Place.location, postgresql_using="gist")
