import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { api, auth, searchQuery } from "./api";
import { toast } from "./toast";
import { EMPTY_FILTERS, type Filters, type Suggestion } from "./types";

export interface Origin {
  lat: number;
  lon: number;
}

/** Which pane is showing on narrow screens, where they can't sit side by side. */
export type ViewMode = "list" | "map";

/**
 * All the search state and the queries that hang off it.
 *
 * Extracted from App so the component is only composition: every piece of
 * state here is read by more than one child, which is what makes it shared
 * state rather than component state.
 */
export function useGeoSearch() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Hover is shared so the list and the map can highlight each other.
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [view, setView] = useState<ViewMode>("list");
  const [signedIn, setSignedIn] = useState(Boolean(auth.token));

  const query = useMemo(() => searchQuery(filters, origin), [filters, origin]);

  const results = useQuery({
    queryKey: ["search", query],
    queryFn: () => api.search(query),
    // Keep the previous page on screen while the next one loads.
    placeholderData: (previous) => previous,
  });

  const me = useQuery({ queryKey: ["me"], queryFn: api.me, enabled: signedIn, retry: false });

  const favorites = useQuery({
    queryKey: ["favorites"],
    queryFn: api.favorites,
    enabled: signedIn,
  });
  const favoriteIds = useMemo(
    () => new Set((favorites.data ?? []).map((f) => f.id)),
    [favorites.data],
  );

  const selected = useMemo(
    () => results.data?.results.find((p) => p.id === selectedId) ?? null,
    [results.data, selectedId],
  );

  const search = useCallback(
    (q: string) => {
      setFilters((f) => ({ ...f, q, page: 1 }));
      setSelectedId(null);
      // Trending is fed by the searches themselves — refresh once the Kafka
      // consumer has had a moment to record this one.
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["trending"] }), 1200);
    },
    [queryClient],
  );

  const pickSuggestion = useCallback((s: Suggestion) => {
    setOrigin({ lat: s.lat, lon: s.lon });
    setFilters((f) => ({ ...f, q: s.name, page: 1 }));
    setSelectedId(s.id);
  }, []);

  const searchArea = useCallback((lat: number, lon: number, km: number) => {
    setOrigin({ lat, lon });
    setFilters((f) => ({ ...f, radius_km: km, page: 1 }));
    setSelectedId(null);
    toast(`Searching within ${km} km of the map centre`);
  }, []);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return toast("This browser has no location support", "error");

    toast("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setFilters((f) => ({ ...f, sort: "distance", radius_km: f.radius_km ?? 5, page: 1 }));
        toast("Sorting by distance from you", "success");
      },
      () => toast("Location denied — try “Search this area” on the map", "error"),
    );
  }, []);

  const clearOrigin = useCallback(() => {
    setOrigin(null);
    setFilters((f) => ({
      ...f,
      radius_km: null,
      sort: f.sort === "distance" ? "relevance" : f.sort,
    }));
  }, []);

  const toggleFavorite = useCallback(
    async (id: number) => {
      if (!signedIn) return false;
      const saved = favoriteIds.has(id);
      try {
        if (saved) await api.removeFavorite(id);
        else await api.addFavorite(id);
        queryClient.invalidateQueries({ queryKey: ["favorites"] });
        toast(saved ? "Removed from saved places" : "Saved", "success");
      } catch {
        toast("Could not update saved places", "error");
      }
      return true;
    },
    [signedIn, favoriteIds, queryClient],
  );

  const signIn = useCallback(() => {
    setSignedIn(true);
    queryClient.invalidateQueries();
    toast("Signed in", "success");
  }, [queryClient]);

  const signOut = useCallback(() => {
    auth.clear();
    setSignedIn(false);
    queryClient.clear();
    toast("Signed out");
  }, [queryClient]);

  /** How many filters are narrowing the results right now. */
  const activeFilterCount =
    filters.category.length +
    filters.amenities.length +
    (filters.city ? 1 : 0) +
    (filters.min_rating ? 1 : 0) +
    (filters.max_price ? 1 : 0) +
    (filters.open_now ? 1 : 0) +
    (filters.radius_km ? 1 : 0);

  return {
    filters,
    setFilters,
    activeFilterCount,
    origin,
    clearOrigin,
    selected,
    selectedId,
    setSelectedId,
    hoveredId,
    setHoveredId,
    view,
    setView,
    results,
    user: me.data,
    signedIn,
    signIn,
    signOut,
    favoriteIds,
    toggleFavorite,
    search,
    pickSuggestion,
    searchArea,
    useMyLocation,
  };
}
