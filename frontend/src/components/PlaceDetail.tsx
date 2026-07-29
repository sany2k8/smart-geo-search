import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api";
import { categoryStyle } from "../lib/categories";
import { formatHours, isOpenNow, priceLabel } from "../lib/format";
import { toast } from "../lib/toast";
import { AMENITIES, type Place, type Review } from "../lib/types";
import { DetailSkeleton } from "./Skeletons";
import Stars from "./Stars";

/** Rating histogram — the shape of the reviews, not just their average. */
function RatingBreakdown({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) return null;
  const counts = [5, 4, 3, 2, 1].map((n) => ({
    n,
    count: reviews.filter((r) => r.rating === n).length,
  }));
  const max = Math.max(...counts.map((c) => c.count), 1);

  return (
    <div className="space-y-1">
      {counts.map(({ n, count }) => (
        <div key={n} className="flex items-center gap-2 text-[11px]">
          <span className="w-3 text-slate-500 tnum">{n}</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400/70 transition-all duration-500"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="w-4 text-right text-slate-600 tnum">{count}</span>
        </div>
      ))}
    </div>
  );
}

function ReviewForm({ placeId, onPosted }: { placeId: number; onPosted: () => void }) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");

  const post = useMutation({
    mutationFn: () => api.addReview(placeId, rating, body),
    onSuccess: () => {
      setBody("");
      toast("Review posted", "success");
      onPosted();
    },
    onError: () => toast("Could not post review", "error"),
  });

  return (
    <div className="panel p-3 space-y-2.5">
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onClick={() => setRating(n)}
            className={`text-lg leading-none transition-all duration-100 hover:scale-125
              ${n <= (hover || rating) ? "text-amber-400" : "text-white/15"}`}
          >
            ★
          </button>
        ))}
        <span className="text-[11px] text-slate-500 ml-1.5">{hover || rating} of 5</span>
      </div>

      <textarea
        className="field resize-none text-xs"
        rows={2}
        placeholder="Share what this place is like…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <button className="btn w-full text-xs" disabled={post.isPending} onClick={() => post.mutate()}>
        {post.isPending ? "Posting…" : "Post review"}
      </button>
    </div>
  );
}

export default function PlaceDetail({
  placeId,
  onClose,
  onSelect,
  signedIn,
  isFavorite,
  onToggleFavorite,
}: {
  placeId: number;
  onClose: () => void;
  onSelect: (id: number) => void;
  signedIn: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: place } = useQuery({ queryKey: ["place", placeId], queryFn: () => api.place(placeId) });
  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", placeId],
    queryFn: () => api.reviews(placeId),
  });
  const { data: similar = [] } = useQuery({
    queryKey: ["similar", placeId],
    queryFn: () => api.similar(placeId),
  });

  const helpful = useMutation({
    mutationFn: (reviewId: number) => api.markHelpful(placeId, reviewId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reviews", placeId] }),
  });

  if (!place) return <DetailSkeleton />;

  const style = categoryStyle(place.category.slug);
  const amenities = AMENITIES.filter(([key]) => place[key as keyof Place]);
  const open = isOpenNow(place);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["reviews", placeId] });
    queryClient.invalidateQueries({ queryKey: ["place", placeId] });
    queryClient.invalidateQueries({ queryKey: ["search"] });
  };

  return (
    <div className="h-full overflow-y-auto animate-slide-in">
      <div className="sticky top-0 z-10 bg-ink-800/90 backdrop-blur-md px-3 py-2.5 border-b border-white/[0.07] flex items-center gap-1">
        <button className="btn-icon" onClick={onClose} title="Back to results">
          ←
        </button>
        <h2 className="text-sm font-semibold truncate flex-1 px-1">{place.name}</h2>
        <button
          className={`btn-icon text-base ${isFavorite ? "text-rose-400" : "text-white/20 hover:text-rose-400"}`}
          onClick={onToggleFavorite}
          title={isFavorite ? "Remove from saved" : "Save place"}
        >
          ♥
        </button>
      </div>

      {/* Hero: the category's colour carries through from the list badge. */}
      <div
        className="px-4 py-5 border-b border-white/[0.07]"
        style={{ background: `linear-gradient(135deg, ${style.hex}1f, transparent 65%)` }}
      >
        <div className="flex items-start gap-3">
          <div className={`grid place-items-center w-12 h-12 rounded-xl border text-xl shrink-0 ${style.badge}`}>
            {style.glyph}
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-50 leading-tight">{place.name}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {place.category.name} · {place.city}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3.5 text-sm">
          <span className="flex items-center gap-1.5">
            <Stars rating={place.rating} size={13} />
            <span className="text-slate-200 tnum font-medium">{place.rating.toFixed(1)}</span>
          </span>
          <span className="text-slate-600">·</span>
          <span className="text-xs text-slate-400 tnum">{place.review_count} reviews</span>
          <span className="text-emerald-400 text-xs">{priceLabel(place.price_level)}</span>
          <span
            className={`ml-auto text-[11px] px-2 py-0.5 rounded-full border ${
              open
                ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/10"
                : "text-slate-400 border-white/10 bg-white/5"
            }`}
          >
            {open ? "Open now" : "Closed"}
          </span>
        </div>

        {/* Actions that leave the app — the things a real listing page offers. */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <a
            className="btn text-xs py-1.5"
            href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=17/${place.lat}/${place.lon}`}
            target="_blank"
            rel="noreferrer"
          >
            ↗ Directions
          </a>
          <a
            className="btn-ghost text-xs py-1.5 justify-center border border-white/10"
            href={place.website || "#"}
            target="_blank"
            rel="noreferrer"
          >
            🌐 Website
          </a>
          <a
            className="btn-ghost text-xs py-1.5 justify-center border border-white/10"
            href={`tel:${place.phone}`}
          >
            ☎ Call
          </a>
        </div>
      </div>

      <div className="p-4 space-y-5">
        <p className="text-sm text-slate-400 leading-relaxed">{place.description}</p>

        <dl className="text-xs space-y-2">
          {[
            ["Address", `${place.address}, ${place.city}, ${place.country}`],
            ["Hours", formatHours(place)],
            ["Phone", place.phone],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-3">
              <dt className="w-16 shrink-0 text-slate-600">{label}</dt>
              <dd className="text-slate-300">{value}</dd>
            </div>
          ))}
        </dl>

        {amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {amenities.map(([, label]) => (
              <span key={label} className="chip chip-on cursor-default pointer-events-none">
                ✓ {label}
              </span>
            ))}
          </div>
        )}

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="section-label">Reviews ({reviews.length})</h3>
          </div>

          <RatingBreakdown reviews={reviews} />

          {signedIn ? (
            <ReviewForm placeId={placeId} onPosted={refresh} />
          ) : (
            <p className="text-xs text-slate-500 py-1">Sign in to leave a review.</p>
          )}

          <ul className="space-y-2.5">
            {reviews.map((review, i) => (
              <li
                key={review.id}
                style={{ animationDelay: `${i * 25}ms` }}
                className="animate-fade-up panel p-3 bg-white/[0.02]"
              >
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="grid place-items-center w-5 h-5 rounded-full bg-accent/15 text-accent-soft text-[10px] font-medium">
                    {review.author.charAt(0)}
                  </span>
                  <span className="text-slate-300">{review.author}</span>
                  <Stars rating={review.rating} size={10} />
                  <button
                    className="ml-auto text-slate-600 hover:text-accent transition-colors"
                    onClick={() => helpful.mutate(review.id)}
                    title="Mark helpful"
                  >
                    👍 <span className="tnum">{review.helpful_count}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{review.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {similar.length > 0 && (
          <section>
            <h3 className="section-label mb-2">Similar places</h3>
            <ul className="space-y-1">
              {similar.map((s) => {
                const sStyle = categoryStyle(s.category.slug);
                return (
                  <li key={s.id}>
                    <button
                      className="w-full flex items-center gap-2.5 text-left px-2 py-2 rounded-lg
                                 hover:bg-white/5 active:scale-[0.99] transition-all group"
                      onClick={() => onSelect(s.id)}
                    >
                      <span className={`grid place-items-center w-7 h-7 rounded-lg border text-xs shrink-0 ${sStyle.badge}`}>
                        {sStyle.glyph}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-slate-200 truncate">{s.name}</span>
                        <span className="block text-[11px] text-slate-600 truncate">
                          {s.category.name} · {s.city}
                        </span>
                      </span>
                      <span className="text-[11px] text-slate-500 tnum shrink-0">
                        {s.rating.toFixed(1)}★
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
