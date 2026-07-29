import { useEffect, useRef } from "react";
import { categoryStyle } from "../lib/categories";
import { formatDistance, isOpenNow, priceLabel } from "../lib/format";
import type { Place, SearchResponse } from "../lib/types";
import { ResultSkeleton } from "./Skeletons";
import Stars from "./Stars";

function Highlighted({ place }: { place: Place }) {
  const html = place.highlight?.name?.[0];
  return html ? <span dangerouslySetInnerHTML={{ __html: html }} /> : <span>{place.name}</span>;
}

function ResultCard({
  place,
  index,
  isSelected,
  isHovered,
  isFavorite,
  onSelect,
  onHover,
  onToggleFavorite,
}: {
  place: Place;
  index: number;
  isSelected: boolean;
  isHovered: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onHover: (id: number | null) => void;
  onToggleFavorite: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const style = categoryStyle(place.category.slug);
  const open = isOpenNow(place);

  // Selecting a marker on the map has to bring its card into view, or the two
  // panes fall out of sync.
  useEffect(() => {
    if (isSelected) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isSelected]);

  return (
    <li
      ref={ref}
      onClick={onSelect}
      onMouseEnter={() => onHover(place.id)}
      onMouseLeave={() => onHover(null)}
      style={{ animationDelay: `${Math.min(index, 10) * 22}ms` }}
      className={`group relative p-3.5 cursor-pointer animate-fade-up transition-colors duration-150
        ${isSelected ? "bg-accent/[0.08]" : isHovered ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"}`}
    >
      {/* Accent rail marks the row the map is pointing at. */}
      <span
        className={`absolute left-0 top-0 bottom-0 w-[3px] bg-accent transition-all duration-200
          ${isSelected ? "opacity-100" : isHovered ? "opacity-40" : "opacity-0"}`}
      />

      <div className="flex gap-3">
        <div
          className={`grid place-items-center w-9 h-9 shrink-0 rounded-lg border text-base
                      transition-transform duration-200 group-hover:scale-105 ${style.badge}`}
        >
          {style.glyph}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="text-sm font-medium text-slate-100 truncate flex-1 leading-snug">
              <Highlighted place={place} />
            </h3>
            <button
              className={`shrink-0 text-base leading-none transition-all duration-150 active:scale-125
                ${
                  isFavorite
                    ? "text-rose-400 animate-pop-in"
                    : "text-white/15 hover:text-rose-400 hover:scale-110"
                }`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
              title={isFavorite ? "Remove from saved" : "Save place"}
            >
              ♥
            </button>
          </div>

          <p className="text-xs text-slate-500 truncate mt-0.5">
            {place.address}, {place.city}
          </p>

          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1.5 text-xs">
            <span className="flex items-center gap-1">
              <Stars rating={place.rating} />
              <span className="text-slate-300 tnum">{place.rating.toFixed(1)}</span>
              <span className="text-slate-600 tnum">({place.review_count})</span>
            </span>
            <span className="text-emerald-400/90">{priceLabel(place.price_level)}</span>
            {formatDistance(place.distance_m) && (
              <span className="text-accent tnum">{formatDistance(place.distance_m)}</span>
            )}
            <span className={open ? "text-emerald-400/80" : "text-slate-600"}>
              {place.open_24h ? "24h" : open ? "Open" : "Closed"}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="p-8 text-center animate-fade-up">
      <div className="text-4xl mb-3 opacity-40">🔍</div>
      <p className="text-sm text-slate-300 font-medium">No places matched</p>
      <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
        Try removing a filter, widening the radius,
        <br />
        or searching a different city.
      </p>
      <button className="btn mt-4 text-xs" onClick={onReset}>
        Clear filters
      </button>
    </div>
  );
}

export default function ResultList({
  data,
  isLoading,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onPage,
  onReset,
  favorites,
  onToggleFavorite,
}: {
  data: SearchResponse | undefined;
  isLoading: boolean;
  selectedId: number | null;
  hoveredId: number | null;
  onSelect: (id: number) => void;
  onHover: (id: number | null) => void;
  onPage: (page: number) => void;
  onReset: () => void;
  favorites: Set<number>;
  onToggleFavorite: (id: number) => void;
}) {
  if (isLoading && !data) return <ResultSkeleton />;
  if (!data || data.results.length === 0) return <EmptyState onReset={onReset} />;

  const pages = Math.min(Math.ceil(data.total / data.size), 100);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/[0.06] bg-ink-900/40">
        <span className="text-xs text-slate-400">
          <strong className="text-slate-100 tnum">{data.total.toLocaleString()}</strong> places
        </span>
        <span className="text-[11px] text-slate-600 tnum" title="Elasticsearch query time">
          {data.took_ms} ms
        </span>
      </div>

      <ul className="flex-1 overflow-y-auto divide-y divide-white/[0.05]" onMouseLeave={() => onHover(null)}>
        {data.results.map((place, i) => (
          <ResultCard
            key={place.id}
            place={place}
            index={i}
            isSelected={place.id === selectedId}
            isHovered={place.id === hoveredId}
            isFavorite={favorites.has(place.id)}
            onSelect={() => onSelect(place.id)}
            onHover={onHover}
            onToggleFavorite={() => onToggleFavorite(place.id)}
          />
        ))}
      </ul>

      {pages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.06] bg-ink-900/40">
          <button className="btn-ghost text-xs" disabled={data.page <= 1} onClick={() => onPage(data.page - 1)}>
            ← Prev
          </button>
          <span className="text-[11px] text-slate-500 tnum">
            {data.page} / {pages}
          </span>
          <button
            className="btn-ghost text-xs"
            disabled={data.page >= pages}
            onClick={() => onPage(data.page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
