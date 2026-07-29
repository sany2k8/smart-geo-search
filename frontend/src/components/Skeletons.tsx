/** Placeholders that mirror the real layout, so nothing shifts when data lands. */

export function ResultSkeleton() {
  return (
    <ul className="divide-y divide-white/[0.05]">
      {Array.from({ length: 7 }).map((_, i) => (
        <li key={i} className="p-4 flex gap-3" style={{ opacity: 1 - i * 0.11 }}>
          <div className="skeleton w-9 h-9 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-2/5" />
            <div className="skeleton h-2.5 w-4/5" />
            <div className="skeleton h-2.5 w-1/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DetailSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="skeleton h-24 w-full rounded-xl" />
      <div className="skeleton h-3 w-1/3" />
      <div className="space-y-2">
        <div className="skeleton h-2.5 w-full" />
        <div className="skeleton h-2.5 w-5/6" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-8 flex-1 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
