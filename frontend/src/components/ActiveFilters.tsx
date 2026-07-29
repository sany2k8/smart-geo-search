import { AMENITIES, type Filters } from "../lib/types";
import type { Origin } from "../lib/useGeoSearch";

const AMENITY_LABELS = Object.fromEntries(AMENITIES) as Record<string, string>;

/**
 * Removable summary of everything narrowing the results.
 *
 * The sidebar shows what you *can* filter by; this shows what you *are*
 * filtering by, and lets you undo any one of them without hunting for the
 * control that set it.
 */
export default function ActiveFilters({
  filters,
  origin,
  onChange,
  onClearOrigin,
}: {
  filters: Filters;
  origin: Origin | null;
  onChange: (next: Filters) => void;
  onClearOrigin: () => void;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch, page: 1 });

  const pills: { key: string; label: string; onRemove: () => void }[] = [
    ...filters.category.map((c) => ({
      key: `cat-${c}`,
      label: c,
      onRemove: () => set({ category: filters.category.filter((x) => x !== c) }),
    })),
    ...filters.amenities.map((a) => ({
      key: `am-${a}`,
      label: AMENITY_LABELS[a] ?? a,
      onRemove: () => set({ amenities: filters.amenities.filter((x) => x !== a) }),
    })),
  ];

  if (filters.city) {
    pills.push({ key: "city", label: filters.city, onRemove: () => set({ city: null }) });
  }
  if (filters.min_rating) {
    pills.push({
      key: "rating",
      label: `${filters.min_rating.toFixed(1)}★ and up`,
      onRemove: () => set({ min_rating: null }),
    });
  }
  if (filters.max_price) {
    pills.push({
      key: "price",
      label: `up to ${"$".repeat(filters.max_price)}`,
      onRemove: () => set({ max_price: null }),
    });
  }
  if (filters.open_now) {
    pills.push({ key: "open", label: "Open now", onRemove: () => set({ open_now: false }) });
  }
  if (origin) {
    pills.push({
      key: "origin",
      label: filters.radius_km ? `within ${filters.radius_km} km` : "near a point",
      onRemove: onClearOrigin,
    });
  }

  if (!pills.length) return null;

  return (
    <div className="flex items-center gap-1.5 px-4 py-2 overflow-x-auto border-b border-white/[0.06] bg-ink-900/20">
      {pills.map((pill) => (
        <button
          key={pill.key}
          onClick={pill.onRemove}
          className="chip chip-on shrink-0 animate-fade-up group"
          title="Remove filter"
        >
          {pill.label}
          <span className="text-accent/50 group-hover:text-accent transition-colors">✕</span>
        </button>
      ))}
    </div>
  );
}
