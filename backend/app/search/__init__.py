"""Elasticsearch layer.

    mapping.py    index settings, analyzers, synonyms
    client.py     the client instance and index lifecycle
    documents.py  Place row -> ES document
    filters.py    filter and sort clauses
    queries.py    the /search request body and ranking
    suggest.py    autocomplete and more-like-this
"""

from app.search.client import ensure_index, es, recreate_index
from app.search.documents import to_document
from app.search.queries import build_search
from app.search.suggest import build_autocomplete, build_similar

__all__ = [
    "build_autocomplete",
    "build_search",
    "build_similar",
    "ensure_index",
    "es",
    "recreate_index",
    "to_document",
]
