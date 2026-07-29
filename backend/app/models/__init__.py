"""Model package.

Importing every module here matters: `Base.metadata.create_all` only knows
about tables whose classes have been imported, and the relationship strings
("Review", "Place") are resolved against this shared registry.
"""

from app.models.analytics import SearchLog
from app.models.base import Base
from app.models.place import Category, Place
from app.models.review import Favorite, Review
from app.models.user import User

__all__ = ["Base", "Category", "Favorite", "Place", "Review", "SearchLog", "User"]
