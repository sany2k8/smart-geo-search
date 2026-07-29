import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { categoryStyle } from "../lib/categories";
import type { Suggestion } from "../lib/types";
import type { Origin } from "../lib/useGeoSearch";

/** Debounce so a fast typist fires one request per pause, not per keystroke. */
function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export default function SearchBar({
  value,
  onSearch,
  onPickSuggestion,
  origin,
  signedIn,
}: {
  value: string;
  onSearch: (q: string) => void;
  onPickSuggestion: (s: Suggestion) => void;
  origin: Origin | null;
  signedIn: boolean;
}) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounced(text, 120);

  useEffect(() => setText(value), [value]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // "/" focuses search from anywhere — the shortcut every search UI has.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { data: suggestions = [], isFetching } = useQuery({
    queryKey: ["autocomplete", debounced, origin],
    queryFn: () => api.autocomplete(debounced, origin),
    enabled: debounced.trim().length > 0,
    staleTime: 60_000,
  });

  const { data: trending = [] } = useQuery({
    queryKey: ["trending"],
    queryFn: api.trending,
    staleTime: 30_000,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["history"],
    queryFn: api.history,
    enabled: signedIn,
    staleTime: 30_000,
  });

  const showSuggestions = debounced.trim().length > 0 && suggestions.length > 0;
  const showIdle = !text.trim() && (trending.length > 0 || history.length > 0);

  function submit(q: string) {
    setOpen(false);
    setCursor(-1);
    inputRef.current?.blur();
    onSearch(q);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!showSuggestions) {
      if (e.key === "Enter") submit(text);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, -1));
    } else if (e.key === "Enter") {
      if (cursor >= 0) {
        const picked = suggestions[cursor];
        setText(picked.name);
        setOpen(false);
        setCursor(-1);
        onPickSuggestion(picked);
      } else {
        submit(text);
      }
    }
  }

  return (
    <div className="relative flex-1 max-w-2xl" ref={boxRef}>
      <div
        className="flex items-center gap-2 bg-ink-900 border border-white/10 rounded-xl px-3
                   focus-within:border-accent/60 focus-within:shadow-glow transition-all duration-200"
      >
        <span className="text-slate-500 text-sm">🔍</span>
        <input
          ref={inputRef}
          className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-slate-600 min-w-0"
          placeholder="Search places, categories or cities…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setCursor(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {isFetching && text && (
          <span className="w-3 h-3 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
        )}
        {text ? (
          <button
            className="text-slate-600 hover:text-slate-300 transition-colors text-sm"
            onClick={() => {
              setText("");
              submit("");
            }}
            title="Clear"
          >
            ✕
          </button>
        ) : (
          <kbd className="kbd hidden sm:grid">/</kbd>
        )}
      </div>

      {open && (showSuggestions || showIdle) && (
        <div className="absolute z-[2000] mt-2 w-full panel shadow-pop overflow-hidden animate-fade-up">
          {showSuggestions && (
            <ul>
              {suggestions.map((s, i) => {
                const style = categoryStyle(s.category);
                return (
                  <li key={s.id}>
                    <button
                      className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                        i === cursor ? "bg-accent/10" : "hover:bg-white/[0.04]"
                      }`}
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => {
                        setText(s.name);
                        setOpen(false);
                        onPickSuggestion(s);
                      }}
                    >
                      <span
                        className={`grid place-items-center w-7 h-7 rounded-lg border text-xs shrink-0 ${style.badge}`}
                      >
                        {style.glyph}
                      </span>
                      <span className="text-sm text-slate-200 truncate">{s.name}</span>
                      <span className="text-[11px] text-slate-600 ml-auto shrink-0 capitalize">
                        {s.category} · {s.city}
                      </span>
                    </button>
                  </li>
                );
              })}
              <li className="px-3 py-1.5 border-t border-white/[0.06] flex items-center gap-3 text-[10px] text-slate-600">
                <span>
                  <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> navigate
                </span>
                <span>
                  <kbd className="kbd">↵</kbd> select
                </span>
                <span>
                  <kbd className="kbd">esc</kbd> close
                </span>
              </li>
            </ul>
          )}

          {showIdle && (
            <div className="p-3 space-y-3">
              {history.length > 0 && (
                <div>
                  <p className="section-label mb-1.5">Recent</p>
                  <div className="flex flex-wrap gap-1.5">
                    {history.slice(0, 6).map((h) => (
                      <span key={h.query} className="chip" onClick={() => submit(h.query)}>
                        ↺ {h.query}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {trending.length > 0 && (
                <div>
                  <p className="section-label mb-1.5">Trending</p>
                  <div className="flex flex-wrap gap-1.5">
                    {trending.map((t) => (
                      <span key={t.query} className="chip" onClick={() => submit(t.query)}>
                        🔥 {t.query}
                        <span className="chip-count">{t.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
