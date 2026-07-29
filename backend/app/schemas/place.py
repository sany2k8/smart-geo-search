from pydantic import BaseModel, ConfigDict, Field


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    icon: str


class PlaceIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    category_id: int
    address: str
    city: str
    country: str
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    phone: str = ""
    website: str = ""
    price_level: int = Field(default=2, ge=1, le=4)
    opens_at: int = Field(default=9, ge=0, le=23)
    closes_at: int = Field(default=22, ge=0, le=24)
    open_24h: bool = False
    wifi: bool = False
    parking: bool = False
    delivery: bool = False
    takeaway: bool = False
    pet_friendly: bool = False
    wheelchair_accessible: bool = False
    outdoor_seating: bool = False
    reservation: bool = False


class PlaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str
    category: CategoryOut
    address: str
    city: str
    country: str
    lat: float
    lon: float
    phone: str
    website: str
    price_level: int
    rating: float
    review_count: int
    popularity: int
    opens_at: int
    closes_at: int
    open_24h: bool
    wifi: bool
    parking: bool
    delivery: bool
    takeaway: bool
    pet_friendly: bool
    wheelchair_accessible: bool
    outdoor_seating: bool
    reservation: bool
