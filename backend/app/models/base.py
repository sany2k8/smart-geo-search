from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Shared declarative base. Every model module imports it from here so
    there is exactly one metadata registry."""
