export interface Category {
  id: number;
  slug: string;
  name: string;
  icon: string;
}

export interface Place {
  id: number;
  name: string;
  description: string;
  category: Category;
  address: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  phone: string;
  website: string;
  price_level: number;
  rating: number;
  review_count: number;
  popularity: number;
  opens_at: number;
  closes_at: number;
  open_24h: boolean;
  wifi: boolean;
  parking: boolean;
  delivery: boolean;
  takeaway: boolean;
  pet_friendly: boolean;
  wheelchair_accessible: boolean;
  outdoor_seating: boolean;
  reservation: boolean;
  score?: number;
  distance_m?: number | null;
  highlight?: Record<string, string[]>;
}

export interface SearchResponse {
  total: number;
  page: number;
  size: number;
  took_ms: number;
  results: Place[];
  facets: Record<string, { key: string | number; count: number }[]>;
}

export interface Suggestion {
  id: number;
  name: string;
  category: string;
  city: string;
  lat: number;
  lon: number;
}

export interface Review {
  id: number;
  place_id: number;
  rating: number;
  body: string;
  helpful_count: number;
  created_at: string;
  author: string;
}

export interface User {
  id: number;
  email: string;
  display_name: string;
  is_admin: boolean;
}

export type SortKey =
  | "relevance"
  | "distance"
  | "rating"
  | "popularity"
  | "most_reviewed"
  | "price_asc"
  | "price_desc";

export const AMENITIES = [
  ["wifi", "WiFi"],
  ["parking", "Parking"],
  ["delivery", "Delivery"],
  ["takeaway", "Takeaway"],
  ["pet_friendly", "Pet friendly"],
  ["wheelchair_accessible", "Accessible"],
  ["outdoor_seating", "Outdoor"],
  ["reservation", "Reservations"],
] as const;

export type Amenity = (typeof AMENITIES)[number][0];

export interface Filters {
  q: string;
  category: string[];
  city: string | null;
  min_rating: number | null;
  max_price: number | null;
  open_now: boolean;
  amenities: Amenity[];
  sort: SortKey;
  radius_km: number | null;
  page: number;
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  category: [],
  city: null,
  min_rating: null,
  max_price: null,
  open_now: false,
  amenities: [],
  sort: "relevance",
  radius_km: null,
  page: 1,
};
