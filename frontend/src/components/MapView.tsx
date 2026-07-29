import L from "leaflet";
import "leaflet.markercluster";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { categoryStyle } from "../lib/categories";
import type { Place } from "../lib/types";

const DEFAULT_CENTRE: [number, number] = [40.758, -73.9855];

function pinIcon(place: Place, state: "idle" | "hover" | "active") {
  const style = categoryStyle(place.category.slug);
  const modifier = state === "active" ? "geo-pin-active" : state === "hover" ? "geo-pin-hover" : "";
  const border = state === "idle" ? `border-color:${style.hex}66` : "";

  return L.divIcon({
    html: `<div class="geo-pin ${modifier}" style="${border}">${style.glyph}</div>`,
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

/**
 * Marker layer, managed imperatively — leaflet.markercluster is a Leaflet
 * plugin with no React bindings.
 *
 * The group is rebuilt only when the result set changes. Hover and selection
 * swap a single marker's icon through the id -> marker index, because
 * rebuilding hundreds of markers on mousemove would drop frames.
 */
function Markers({
  places,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: {
  places: Place[];
  selectedId: number | null;
  hoveredId: number | null;
  onSelect: (id: number) => void;
  onHover: (id: number | null) => void;
}) {
  const map = useMap();
  const markers = useRef(new Map<number, L.Marker>());
  const key = places.map((p) => p.id).join(",");

  useEffect(() => {
    const group = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 55,
      iconCreateFunction: (cluster) =>
        L.divIcon({
          html: `<div class="geo-cluster">${cluster.getChildCount()}</div>`,
          className: "",
          iconSize: [38, 38],
        }),
    });

    markers.current.clear();
    for (const place of places) {
      const marker = L.marker([place.lat, place.lon], { icon: pinIcon(place, "idle") })
        .on("click", () => onSelect(place.id))
        .on("mouseover", () => onHover(place.id))
        .on("mouseout", () => onHover(null));

      markers.current.set(place.id, marker);
      group.addLayer(marker);
    }

    group.addTo(map);
    return () => {
      group.remove();
      markers.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);

  // Repaint only the markers whose state actually changed.
  useEffect(() => {
    for (const place of places) {
      const marker = markers.current.get(place.id);
      if (!marker) continue;
      const state =
        place.id === selectedId ? "active" : place.id === hoveredId ? "hover" : "idle";
      marker.setIcon(pinIcon(place, state));
      if (state !== "idle") marker.setZIndexOffset(1000);
      else marker.setZIndexOffset(0);
    }
  }, [places, selectedId, hoveredId]);

  return null;
}

/**
 * Leaflet caches its container size at init. On narrow screens the map starts
 * inside a `display: none` pane, so it measures 0x0 and renders a single broken
 * strip of tiles once shown. A ResizeObserver catches every case that changes
 * the container — the view switch, the filter drawer, a window resize — without
 * threading layout state down into the map.
 */
function KeepSizeInSync({ places }: { places: Place[] }) {
  const map = useMap();
  const hasHadSize = useRef(false);
  // Read through a ref so the observer never needs re-subscribing.
  const latest = useRef(places);
  latest.current = places;

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const visible = entry.contentRect.width > 0 && entry.contentRect.height > 0;
      suppressMoves(400);
      map.invalidateSize({ animate: false });

      // Any fit that ran while the map was 0x0 was meaningless, so redo it the
      // first time the container actually has a size.
      if (visible && !hasHadSize.current) {
        hasHadSize.current = true;
        fitTopCity(map, latest.current, false);
      }
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}

/** Pans to the selected place without fighting the user's own panning. */
function FocusOn({ place }: { place: Place | null }) {
  const map = useMap();
  useEffect(() => {
    if (!place) return;
    moveCamera(() =>
      map.flyTo([place.lat, place.lon], Math.max(map.getZoom(), 15), { duration: 0.6 }),
    );
  }, [map, place]);
  return null;
}

/**
 * Leaflet reports a programmatic `flyTo`/`fitBounds` with the same events as a
 * user pan, so the app's own camera moves would light up "Search this area" as
 * if the user had moved the map. Every programmatic move is wrapped so the
 * controls can tell the two apart.
 */
let programmaticMoves = 0;
const isProgrammaticMove = () => programmaticMoves > 0;

/** Ignore map-move events for `ms`. Also used for resizes, which move the
 *  viewport without the user having panned anywhere. */
function suppressMoves(ms = 900) {
  programmaticMoves += 1;
  setTimeout(() => {
    programmaticMoves = Math.max(0, programmaticMoves - 1);
  }, ms);
}

function moveCamera(fn: () => void) {
  // Released after the longest animation we start (flyTo, 0.6s).
  suppressMoves();
  fn();
}

function fit(map: L.Map, places: Place[], animate = true) {
  if (!places.length) return;
  const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lon] as [number, number]));
  // A single point (or several at the same spot) makes a zero-area bounds that
  // fitBounds would zoom to maximum.
  if (places.length === 1 || !bounds.isValid() || bounds.getNorth() === bounds.getSouth()) {
    moveCamera(() => map.setView([places[0].lat, places[0].lon], 14, { animate }));
    return;
  }
  moveCamera(() => map.fitBounds(bounds.pad(0.15), { animate }));
}

/**
 * Frames the results in the top result's city.
 *
 * Fitting to *every* hit sounds right and looks terrible: one relevant match in
 * San Francisco alongside twenty in Tokyo forces a whole-world view where
 * nothing is legible. The best answer is almost always near the best result, so
 * that city frames the view. Every marker is still on the map, and the ⤢ control
 * fits all of them for anyone who wants the global picture.
 */
function fitTopCity(map: L.Map, places: Place[], animate = true) {
  if (!places.length) return;
  const inTopCity = places.filter((p) => p.city === places[0].city);
  fit(map, inTopCity.length >= 2 ? inTopCity : places, animate);
}

/**
 * Re-frames the map whenever the result set changes.
 *
 * Keyed on *which* places are shown, not on the array reference: any refetch
 * (posting a review, a window refocus) hands back a fresh array of the same
 * places, and re-fitting on that would yank the map out from under the user.
 */
function FitResults({ places }: { places: Place[] }) {
  const map = useMap();
  const key = places.map((p) => p.id).join(",");

  useEffect(() => {
    fitTopCity(map, places);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/**
 * Map controls. "Search this area" only appears once the user has moved the
 * map — offering to re-search a view they haven't changed is noise.
 */
function Controls({
  onSearchArea,
  onReset,
}: {
  onSearchArea: (lat: number, lon: number, km: number) => void;
  onReset: () => void;
}) {
  const [moved, setMoved] = useState(false);
  const map = useMapEvents({
    // `moveend` covers panning and zooming alike; the guard filters out the
    // app's own camera moves and layout resizes.
    moveend: () => {
      if (!isProgrammaticMove()) setMoved(true);
    },
    resize: () => suppressMoves(400),
  });

  const searchArea = () => {
    const centre = map.getCenter();
    // Radius = half the viewport diagonal, so the circle covers what you see.
    const km = centre.distanceTo(map.getBounds().getNorthEast()) / 1000;
    onSearchArea(centre.lat, centre.lng, Math.max(0.5, Math.round(km * 10) / 10));
    setMoved(false);
  };

  return (
    <>
      {moved && (
        <button
          onClick={searchArea}
          className="absolute z-[1000] left-1/2 -translate-x-1/2 top-4 animate-fade-up
                     px-4 py-2 rounded-full text-sm font-medium bg-ink-800/95 backdrop-blur
                     border border-accent/50 text-accent-soft shadow-pop
                     hover:bg-ink-700 hover:border-accent active:scale-95 transition-all"
        >
          ⟳ Search this area
        </button>
      )}

      <div className="absolute z-[1000] right-4 top-4 flex flex-col gap-1.5">
        {[
          { label: "+", title: "Zoom in", onClick: () => map.zoomIn() },
          { label: "−", title: "Zoom out", onClick: () => map.zoomOut() },
          {
            label: "⤢",
            title: "Fit all results",
            onClick: () => {
              onReset();
              setMoved(false);
            },
          },
        ].map((btn) => (
          <button
            key={btn.title}
            title={btn.title}
            onClick={btn.onClick}
            className="grid place-items-center w-9 h-9 rounded-lg bg-ink-800/95 backdrop-blur
                       border border-white/10 text-slate-300 shadow-panel
                       hover:bg-ink-700 hover:text-white active:scale-90 transition-all"
          >
            {btn.label}
          </button>
        ))}
      </div>
    </>
  );
}

/** Imperative handle for "fit all results", triggered from the controls. */
function FitTrigger({ places, token }: { places: Place[]; token: number }) {
  const map = useMap();
  useEffect(() => {
    if (token === 0) return;
    fit(map, places);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  return null;
}

export default function MapView({
  places,
  selected,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  onSearchArea,
}: {
  places: Place[];
  selected: Place | null;
  selectedId: number | null;
  hoveredId: number | null;
  onSelect: (id: number) => void;
  onHover: (id: number | null) => void;
  onSearchArea: (lat: number, lon: number, km: number) => void;
}) {
  const [fitToken, setFitToken] = useState(0);
  const centre = useMemo<[number, number]>(
    () => (places.length ? [places[0].lat, places[0].lon] : DEFAULT_CENTRE),
    // Initial render only; FitResults takes over from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="relative h-full w-full">
      <MapContainer center={centre} zoom={13} className="h-full w-full" zoomControl={false}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <Markers
          places={places}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={onSelect}
          onHover={onHover}
        />
        <KeepSizeInSync places={places} />
        <FocusOn place={selected} />
        <FitResults places={places} />
        <FitTrigger places={places} token={fitToken} />
        <Controls onSearchArea={onSearchArea} onReset={() => setFitToken((t) => t + 1)} />
      </MapContainer>

      {/* Legend doubles as a hint that the two panes are linked. */}
      <div
        className="absolute z-[1000] left-4 bottom-6 px-3 py-2 rounded-lg text-[11px]
                   bg-ink-900/85 backdrop-blur border border-white/10 text-slate-500 shadow-panel
                   hidden sm:block"
      >
        Hover a result to locate it · click a pin for details
      </div>
    </div>
  );
}
