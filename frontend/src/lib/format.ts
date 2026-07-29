import type { Place } from "./types";

export function formatDistance(metres?: number | null) {
  if (metres == null) return null;
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`;
  return `${(metres / 1000).toFixed(metres < 10_000 ? 1 : 0)} km`;
}

export function formatHours(place: Pick<Place, "open_24h" | "opens_at" | "closes_at">) {
  if (place.open_24h) return "Open 24 hours";
  const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return `${pad(place.opens_at)} – ${pad(place.closes_at % 24)}`;
}

/** Local-clock open/closed, matching the `open_now` filter's UTC-hour rule. */
export function isOpenNow(place: Pick<Place, "open_24h" | "opens_at" | "closes_at">) {
  if (place.open_24h) return true;
  const hour = new Date().getUTCHours();
  return hour >= place.opens_at && hour < place.closes_at;
}

export const priceLabel = (level: number) => "$".repeat(Math.max(1, level));
