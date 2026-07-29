import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { categoryStyle } from "../lib/categories";
import {
  AMENITIES,
  EMPTY_FILTERS,
  type Amenity,
  type Filters,
  type SearchResponse,
} from "../lib/types";

const SORTS: { key: Filters["sort"]; label: string }[] = [
  { key: "relevance", label: "Relevance" },
  { key: "distance", label: "Distance" },
  { key: "rating", label: "Rating" },
  { key: "popularity", label: "Popular" },
  { key: "most_reviewed", label: "Reviewed" },
  { key: "price_asc", label: "Price ↑" },
  { key: "price_desc", label: "Price ↓" },
];

/** Collapsible group. Sections with an active filter stay open. */
function Section({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-white/[0.05] pb-3.5">
      <button
        className="w-full flex items-center gap-2 py-1.5 group"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="section-label group-hover:text-slate-400 transition-colors">{title}</span>
        {count ? (
          <span className="grid place-items-center min-w-[16px] h-4 px-1 rounded-full bg-accent/20 text-accent-soft text-[10px] tnum">
            {count}
          </span>
        ) : null}
        <span
          className={`ml-auto text-slate-600 text-[10px] transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
        >
          ▶
        </span>
      </button>
      {open && <div className="mt-2 animate-fade-up">{children}</div>}
    </section>
  );
}

export default function FilterPanel({
  filters,
  onChange,
  facets,
  hasOrigin,
  activeCount,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  facets: SearchResponse["facets"] | undefined;
  hasOrigin: boolean;
  activeCount: number;
}) {
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: api.categories,
    staleTime: Infinity,
  });

  // Reset to page 1 on any filter change — a filtered page 4 is meaningless.
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch, page: 1 });

  const counts = new Map(facets?.categories?.map((f) => [String(f.key), f.count]) ?? []);
  const cityFacets = facets?.cities ?? [];

  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <aside className="w-56 lg:w-60 shrink-0 overflow-y-auto border-r border-white/[0.06] bg-ink-900/30">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-ink-900/80 backdrop-blur border-b border-white/[0.06]">
        <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          Filters
          {activeCount > 0 && (
            <span className="grid place-items-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-ink-950 text-[10px] font-bold tnum">
              {activeCount}
            </span>
          )}
        </h2>
        {activeCount > 0 && (
          <button
            className="text-[11px] text-slate-500 hover:text-accent transition-colors"
            onClick={() => onChange({ ...EMPTY_FILTERS, q: filters.q, sort: filters.sort })}
          >
            Clear all
          </button>
        )}
      </div>

      <div className="px-4 pb-6 space-y-1">
        <Section title="Sort by">
          <div className="flex flex-wrap gap-1.5">
            {SORTS.map((s) => {
              const disabled = s.key === "distance" && !hasOrigin;
              return (
                <span
                  key={s.key}
                  title={disabled ? "Set a location first" : undefined}
                  className={`chip ${filters.sort === s.key ? "chip-on" : ""} ${
                    disabled ? "opacity-30 pointer-events-none" : ""
                  }`}
                  onClick={() => !disabled && set({ sort: s.key })}
                >
                  {s.label}
                </span>
              );
            })}
          </div>
        </Section>

        <Section title="Category" count={filters.category.length}>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <span
                key={c.slug}
                className={`chip ${filters.category.includes(c.slug) ? "chip-on" : ""}`}
                onClick={() => set({ category: toggle(filters.category, c.slug) })}
              >
                <span className="text-[11px]">{categoryStyle(c.slug).glyph}</span>
                {c.name}
                {counts.has(c.slug) && <span className="chip-count">{counts.get(c.slug)}</span>}
              </span>
            ))}
          </div>
        </Section>

        {cityFacets.length > 1 && (
          <Section title="City" count={filters.city ? 1 : 0}>
            <div className="flex flex-wrap gap-1.5">
              {cityFacets.map((c) => (
                <span
                  key={String(c.key)}
                  className={`chip ${filters.city === c.key ? "chip-on" : ""}`}
                  onClick={() => set({ city: filters.city === c.key ? null : String(c.key) })}
                >
                  {c.key}
                  <span className="chip-count">{c.count}</span>
                </span>
              ))}
            </div>
          </Section>
        )}

        <Section title="Rating" count={filters.min_rating ? 1 : 0}>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={filters.min_rating ?? 0}
              onChange={(e) => set({ min_rating: Number(e.target.value) || null })}
            />
            <span className="text-xs text-slate-400 tnum w-12 shrink-0">
              {filters.min_rating ? `${filters.min_rating.toFixed(1)}★+` : "Any"}
            </span>
          </div>
        </Section>

        <Section title="Price" count={filters.max_price ? 1 : 0}>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((p) => (
              <span
                key={p}
                className={`chip flex-1 justify-center ${filters.max_price === p ? "chip-on" : ""}`}
                onClick={() => set({ max_price: filters.max_price === p ? null : p })}
              >
                {"$".repeat(p)}
              </span>
            ))}
          </div>
        </Section>

        {hasOrigin && (
          <Section title="Distance" count={filters.radius_km ? 1 : 0}>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 5, 10, 25].map((km) => (
                <span
                  key={km}
                  className={`chip ${filters.radius_km === km ? "chip-on" : ""}`}
                  onClick={() => set({ radius_km: filters.radius_km === km ? null : km })}
                >
                  {km} km
                </span>
              ))}
            </div>
          </Section>
        )}

        <Section title="Amenities" count={filters.amenities.length + (filters.open_now ? 1 : 0)}>
          <div className="flex flex-wrap gap-1.5">
            <span
              className={`chip ${filters.open_now ? "chip-on" : ""}`}
              onClick={() => set({ open_now: !filters.open_now })}
            >
              🕒 Open now
            </span>
            {AMENITIES.map(([key, label]) => (
              <span
                key={key}
                className={`chip ${filters.amenities.includes(key) ? "chip-on" : ""}`}
                onClick={() => set({ amenities: toggle(filters.amenities, key as Amenity) })}
              >
                {label}
              </span>
            ))}
          </div>
        </Section>
      </div>
    </aside>
  );
}
