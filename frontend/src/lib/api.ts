import type { Category, Filters, Place, Review, SearchResponse, Suggestion, User } from "./types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8300";

const TOKEN_KEY = "geosearch.token";

export const auth = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
  },
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (auth.token) headers.set("authorization", `Bearer ${auth.token}`);

  const response = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({ detail: response.statusText }));
    throw new Error(typeof detail.detail === "string" ? detail.detail : "Request failed");
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

/** Turns the filter state into the query string the /search endpoint expects. */
export function searchQuery(filters: Filters, origin: { lat: number; lon: number } | null) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  filters.category.forEach((c) => params.append("category", c));
  if (filters.city) params.set("city", filters.city);
  if (filters.min_rating != null) params.set("min_rating", String(filters.min_rating));
  if (filters.max_price != null) params.set("max_price", String(filters.max_price));
  if (filters.open_now) params.set("open_now", "true");
  filters.amenities.forEach((a) => params.set(a, "true"));
  params.set("sort", filters.sort);
  params.set("page", String(filters.page));
  params.set("size", "20");

  if (origin) {
    params.set("lat", String(origin.lat));
    params.set("lon", String(origin.lon));
    if (filters.radius_km) params.set("radius_km", String(filters.radius_km));
  }
  return params.toString();
}

export const api = {
  search: (query: string) => request<SearchResponse>(`/search?${query}`),
  autocomplete: (q: string, origin: { lat: number; lon: number } | null) => {
    const params = new URLSearchParams({ q });
    if (origin) {
      params.set("lat", String(origin.lat));
      params.set("lon", String(origin.lon));
    }
    return request<Suggestion[]>(`/autocomplete?${params}`);
  },
  categories: () => request<Category[]>("/categories"),
  place: (id: number) => request<Place>(`/places/${id}`),
  similar: (id: number) => request<Place[]>(`/places/${id}/similar`),
  reviews: (id: number) => request<Review[]>(`/places/${id}/reviews`),
  addReview: (id: number, rating: number, body: string) =>
    request<Review>(`/places/${id}/reviews`, {
      method: "POST",
      body: JSON.stringify({ rating, body }),
    }),
  markHelpful: (placeId: number, reviewId: number) =>
    request<Review>(`/places/${placeId}/reviews/${reviewId}/helpful`, { method: "POST" }),
  trending: () => request<{ query: string; count: number }[]>("/trending?limit=6"),
  history: () => request<{ query: string; last_used: string }[]>("/me/history"),
  favorites: () => request<Place[]>("/favorites"),
  addFavorite: (id: number) => request<void>(`/favorites/${id}`, { method: "PUT" }),
  removeFavorite: (id: number) => request<void>(`/favorites/${id}`, { method: "DELETE" }),
  me: () => request<User>("/auth/me"),
  login: (email: string, password: string) =>
    request<{ access_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, display_name: string) =>
    request<{ access_token: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name }),
    }),
};
