/**
 * Rating display. Renders a clipped overlay rather than rounding to whole
 * stars, so 4.4 and 4.8 don't look identical.
 */
export default function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));

  return (
    <span
      className="relative inline-block leading-none select-none align-middle"
      style={{ fontSize: size }}
      aria-label={`${rating.toFixed(1)} out of 5`}
    >
      <span className="text-white/15">★★★★★</span>
      <span
        className="absolute inset-0 overflow-hidden text-amber-400"
        style={{ width: `${pct}%` }}
      >
        ★★★★★
      </span>
    </span>
  );
}
