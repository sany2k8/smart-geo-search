from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    body: str = ""


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    place_id: int
    rating: int
    body: str
    helpful_count: int
    created_at: datetime
    author: str
