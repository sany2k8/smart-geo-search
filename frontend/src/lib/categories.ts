/**
 * One source of truth for how a category looks. The map pin, the result badge
 * and the detail header all read from here, so a category can never be teal in
 * the list and grey on the map.
 */
export interface CategoryStyle {
  glyph: string;
  /** Tailwind classes for a tinted badge. */
  badge: string;
  /** Hex, for the map pin border where Tailwind classes cannot reach. */
  hex: string;
}

const FALLBACK: CategoryStyle = {
  glyph: "📍",
  badge: "bg-slate-500/15 text-slate-300 border-slate-400/30",
  hex: "#94a3b8",
};

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  restaurant: {
    glyph: "🍽",
    badge: "bg-orange-500/15 text-orange-300 border-orange-400/30",
    hex: "#fb923c",
  },
  cafe: { glyph: "☕", badge: "bg-amber-500/15 text-amber-300 border-amber-400/30", hex: "#fbbf24" },
  bar: { glyph: "🍺", badge: "bg-violet-500/15 text-violet-300 border-violet-400/30", hex: "#a78bfa" },
  hotel: { glyph: "🛏", badge: "bg-sky-500/15 text-sky-300 border-sky-400/30", hex: "#38bdf8" },
  park: {
    glyph: "🌳",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    hex: "#34d399",
  },
  museum: { glyph: "🏛", badge: "bg-rose-500/15 text-rose-300 border-rose-400/30", hex: "#fb7185" },
  gym: { glyph: "🏋", badge: "bg-lime-500/15 text-lime-300 border-lime-400/30", hex: "#a3e635" },
  pharmacy: { glyph: "💊", badge: "bg-teal-500/15 text-teal-300 border-teal-400/30", hex: "#2dd4bf" },
  supermarket: {
    glyph: "🛒",
    badge: "bg-yellow-500/15 text-yellow-300 border-yellow-400/30",
    hex: "#facc15",
  },
  hospital: { glyph: "🏥", badge: "bg-red-500/15 text-red-300 border-red-400/30", hex: "#f87171" },
};

export const categoryStyle = (slug: string): CategoryStyle => CATEGORY_STYLES[slug] ?? FALLBACK;
