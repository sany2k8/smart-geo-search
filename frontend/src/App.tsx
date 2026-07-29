import { useEffect, useState } from "react";
import ActiveFilters from "./components/ActiveFilters";
import AuthDialog from "./components/AuthDialog";
import FilterPanel from "./components/FilterPanel";
import Header from "./components/Header";
import MapView from "./components/MapView";
import PlaceDetail from "./components/PlaceDetail";
import ResultList from "./components/ResultList";
import Toaster from "./components/Toaster";
import { toast } from "./lib/toast";
import { EMPTY_FILTERS } from "./lib/types";
import { useGeoSearch } from "./lib/useGeoSearch";

export default function App() {
  const geo = useGeoSearch();
  const [showAuth, setShowAuth] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Favouriting is the one action that needs an account, so it doubles as the
  // prompt to sign in.
  const toggleFavorite = async (id: number) => {
    if (!(await geo.toggleFavorite(id))) {
      setShowAuth(true);
      toast("Sign in to save places");
    }
  };

  // Escape backs out one level: dialog, then detail pane.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showAuth) setShowAuth(false);
      else if (geo.selectedId) geo.setSelectedId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showAuth, geo]);

  const listPane = geo.selectedId ? (
    <PlaceDetail
      placeId={geo.selectedId}
      onClose={() => geo.setSelectedId(null)}
      onSelect={geo.setSelectedId}
      signedIn={geo.signedIn}
      isFavorite={geo.favoriteIds.has(geo.selectedId)}
      onToggleFavorite={() => toggleFavorite(geo.selectedId!)}
    />
  ) : (
    <ResultList
      data={geo.results.data}
      isLoading={geo.results.isLoading}
      selectedId={geo.selectedId}
      hoveredId={geo.hoveredId}
      onSelect={geo.setSelectedId}
      onHover={geo.setHoveredId}
      onPage={(page) => geo.setFilters({ ...geo.filters, page })}
      onReset={() => geo.setFilters({ ...EMPTY_FILTERS, q: geo.filters.q })}
      favorites={geo.favoriteIds}
      onToggleFavorite={toggleFavorite}
    />
  );

  return (
    <div className="h-full flex flex-col bg-ink-950">
      <Header
        q={geo.filters.q}
        origin={geo.origin}
        user={geo.user}
        signedIn={geo.signedIn}
        busy={geo.results.isFetching}
        onSearch={geo.search}
        onPickSuggestion={geo.pickSuggestion}
        onUseMyLocation={geo.useMyLocation}
        onClearOrigin={geo.clearOrigin}
        onSignIn={() => setShowAuth(true)}
        onSignOut={geo.signOut}
      />

      {/* Toolbar for the controls the header has no room for below md. Lives
          outside <main> so the view switch stays reachable in map view. */}
      <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-ink-900/40">
        <button className="btn-ghost text-xs" onClick={() => setShowFilters((s) => !s)}>
          ⚙ Filters
          {geo.activeFilterCount > 0 && (
            <span className="grid place-items-center min-w-[16px] h-4 px-1 rounded-full bg-accent text-ink-950 text-[10px] font-bold tnum">
              {geo.activeFilterCount}
            </span>
          )}
        </button>
        <button
          className={`btn-ghost text-xs ${geo.origin ? "text-accent" : ""}`}
          onClick={geo.useMyLocation}
        >
          📍 Near me
        </button>
        <div className="ml-auto flex rounded-lg border border-white/10 overflow-hidden">
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              onClick={() => geo.setView(v)}
              className={`px-2.5 py-1.5 text-xs capitalize transition-colors ${
                geo.view === v
                  ? "bg-accent/20 text-accent-soft"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 flex min-h-0 relative">
        {/* Sidebar is a slide-over drawer below md, a fixed column above it. */}
        <div
          className={`md:flex ${showFilters ? "flex absolute inset-y-0 left-0 z-[2500] bg-ink-900 shadow-pop" : "hidden"}`}
        >
          <FilterPanel
            filters={geo.filters}
            onChange={(f) => {
              geo.setFilters(f);
              setShowFilters(false);
            }}
            facets={geo.results.data?.facets}
            hasOrigin={Boolean(geo.origin)}
            activeCount={geo.activeFilterCount}
          />
        </div>

        <section
          className={`flex-col min-h-0 w-full md:w-[340px] lg:w-[380px] md:shrink-0 border-r border-white/[0.06]
                      ${geo.view === "list" ? "flex" : "hidden md:flex"}`}
        >
          {!geo.selectedId && (
            <ActiveFilters
              filters={geo.filters}
              origin={geo.origin}
              onChange={geo.setFilters}
              onClearOrigin={geo.clearOrigin}
            />
          )}

          <div className="flex-1 min-h-0">{listPane}</div>
        </section>

        <section className={`flex-1 min-w-0 ${geo.view === "map" ? "block" : "hidden md:block"}`}>
          <MapView
            places={geo.results.data?.results ?? []}
            selected={geo.selected}
            selectedId={geo.selectedId}
            hoveredId={geo.hoveredId}
            onSelect={geo.setSelectedId}
            onHover={geo.setHoveredId}
            onSearchArea={geo.searchArea}
          />
        </section>
      </main>

      {showAuth && (
        <AuthDialog
          onClose={() => setShowAuth(false)}
          onDone={() => {
            setShowAuth(false);
            geo.signIn();
          }}
        />
      )}

      <Toaster />
    </div>
  );
}
