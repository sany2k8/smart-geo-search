"""Index definition: analyzers, synonyms and field types.

Separated from the client so the mapping can be read (and diffed) on its own —
it is the single most important piece of configuration in the search stack.
"""

SYNONYMS = [
    "coffee, cafe, coffeehouse, espresso",
    "restaurant, diner, eatery, bistro",
    "bar, pub, tavern",
    "gym, fitness, workout",
    "pharmacy, chemist, drugstore",
    "hotel, inn, lodging",
    "supermarket, grocery, market",
    "hospital, clinic, medical centre, medical center",
    "park, garden, green space",
    "museum, gallery, exhibition",
]

INDEX_SETTINGS = {
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
        "analysis": {
            "filter": {
                "geo_synonyms": {"type": "synonym_graph", "synonyms": SYNONYMS},
                "english_stems": {"type": "stemmer", "language": "english"},
                # Edge n-grams power the "search as you type" path.
                "autocomplete_edge": {"type": "edge_ngram", "min_gram": 2, "max_gram": 20},
            },
            "analyzer": {
                # Index side: no synonyms, so the graph is only expanded at query time.
                "text_index": {
                    "tokenizer": "standard",
                    "filter": ["lowercase", "asciifolding", "english_stems"],
                },
                "text_query": {
                    "tokenizer": "standard",
                    "filter": ["lowercase", "asciifolding", "geo_synonyms", "english_stems"],
                },
                "autocomplete_index": {
                    "tokenizer": "standard",
                    "filter": ["lowercase", "asciifolding", "autocomplete_edge"],
                },
                "autocomplete_query": {
                    "tokenizer": "standard",
                    "filter": ["lowercase", "asciifolding"],
                },
            },
        },
    },
    "mappings": {
        "properties": {
            "name": {
                "type": "text",
                "analyzer": "text_index",
                "search_analyzer": "text_query",
                "fields": {
                    "raw": {"type": "keyword"},
                    "autocomplete": {
                        "type": "text",
                        "analyzer": "autocomplete_index",
                        "search_analyzer": "autocomplete_query",
                    },
                },
            },
            "description": {
                "type": "text",
                "analyzer": "text_index",
                "search_analyzer": "text_query",
            },
            "category": {"type": "keyword"},
            "category_name": {
                "type": "text",
                "analyzer": "text_index",
                "search_analyzer": "text_query",
            },
            "address": {"type": "text", "analyzer": "text_index"},
            "city": {
                "type": "keyword",
                "fields": {"text": {"type": "text", "analyzer": "text_index"}},
            },
            "country": {"type": "keyword"},
            "location": {"type": "geo_point"},
            "rating": {"type": "float"},
            "review_count": {"type": "integer"},
            "popularity": {"type": "integer"},
            "price_level": {"type": "byte"},
            "opens_at": {"type": "byte"},
            "closes_at": {"type": "byte"},
            "open_24h": {"type": "boolean"},
            "wifi": {"type": "boolean"},
            "parking": {"type": "boolean"},
            "delivery": {"type": "boolean"},
            "takeaway": {"type": "boolean"},
            "pet_friendly": {"type": "boolean"},
            "wheelchair_accessible": {"type": "boolean"},
            "outdoor_seating": {"type": "boolean"},
            "reservation": {"type": "boolean"},
        }
    },
}
