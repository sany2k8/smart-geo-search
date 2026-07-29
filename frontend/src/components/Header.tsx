import type { Suggestion, User } from "../lib/types";
import type { Origin } from "../lib/useGeoSearch";
import SearchBar from "./SearchBar";

export default function Header({
  q,
  origin,
  user,
  signedIn,
  busy,
  onSearch,
  onPickSuggestion,
  onUseMyLocation,
  onClearOrigin,
  onSignIn,
  onSignOut,
}: {
  q: string;
  origin: Origin | null;
  user: User | undefined;
  signedIn: boolean;
  busy: boolean;
  onSearch: (q: string) => void;
  onPickSuggestion: (s: Suggestion) => void;
  onUseMyLocation: () => void;
  onClearOrigin: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  // Solid background, not backdrop-blur: a backdrop-filter on the header creates
  // a stacking context that traps the search suggestions dropdown (z-[2000])
  // beneath <main>, so the results list bleeds through it. Without its own
  // stacking context the dropdown floats above the page in the root context.
  return (
    <header className="relative shrink-0 border-b border-white/[0.07] bg-ink-900">
      {/* Indeterminate bar: shows the app is working without shifting layout. */}
      {busy && (
        <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden">
          <div className="h-full w-full bg-accent/80 animate-indeterminate" />
        </div>
      )}

      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex items-center gap-2 shrink-0">
          <span className="grid place-items-center w-7 h-7 rounded-lg bg-accent/15 border border-accent/30 text-sm">
            🌐
          </span>
          <span className="font-semibold tracking-tight hidden sm:block">GeoSearch</span>
        </div>

        <SearchBar
          value={q}
          onSearch={onSearch}
          onPickSuggestion={onPickSuggestion}
          origin={origin}
          signedIn={signedIn}
        />

        {/* Below md these controls live in the list toolbar, where there's room. */}
        <button
          className={`btn-ghost text-xs whitespace-nowrap shrink-0 hidden md:inline-flex ${
            origin ? "text-accent" : ""
          }`}
          onClick={onUseMyLocation}
          title="Sort by distance from your location"
        >
          📍 <span className="hidden lg:inline">Near me</span>
        </button>

        {origin && (
          <button
            className="hidden xl:flex items-center gap-1 text-[11px] text-slate-500 hover:text-accent
                       px-2 py-1 rounded-md border border-white/10 transition-colors shrink-0 tnum"
            onClick={onClearOrigin}
            title="Clear location"
          >
            {origin.lat.toFixed(2)}, {origin.lon.toFixed(2)} ✕
          </button>
        )}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {signedIn ? (
            <>
              <span className="hidden sm:grid place-items-center w-7 h-7 rounded-full bg-accent/15 border border-accent/30 text-[11px] font-medium text-accent-soft">
                {user?.display_name?.charAt(0) ?? "…"}
              </span>
              <button className="btn-ghost text-xs" onClick={onSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <button className="btn text-xs" onClick={onSignIn}>
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
