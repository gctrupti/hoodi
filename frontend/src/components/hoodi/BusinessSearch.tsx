import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Store } from "lucide-react";
import { searchBusinessPlaces, type GeoPlace } from "@/lib/hoodi/location.functions";
import { formatDistance } from "@/lib/hoodi/location";
import type { Coords } from "@/lib/hoodi/location";

const QUICK = ["Flower shop", "Pharmacy", "Supermarket", "Restaurant", "Electronics"];

/**
 * Business / Point-of-Interest search (Geoapify Places).
 * Deliberately separate from LocationSearch, which resolves addresses.
 */
export function BusinessSearch({
  near,
  onSelect,
  placeholder = "Search a shop, pharmacy, supermarket…",
}: {
  near: Coords | null;
  onSelect: (place: GeoPlace) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(text.trim()), 350);
    return () => clearTimeout(t);
  }, [text]);

  const results = useQuery({
    queryKey: ["business-search", debounced, near?.lat, near?.lng],
    enabled: debounced.length >= 2 && !!near,
    queryFn: () =>
      searchBusinessPlaces({
        data: { text: debounced, lat: near!.lat, lng: near!.lng },
      }),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <Store className="h-4 w-4 shrink-0 text-clay" />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/70"
          aria-label="Search for a business"
        />
        {results.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-soft" />}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => {
              setText(q);
              setOpen(true);
            }}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:bg-sand"
          >
            {q}
          </button>
        ))}
      </div>

      {!near && (
        <p className="mt-2 text-xs text-muted-foreground">
          Set your location first so we can find shops around you.
        </p>
      )}

      {open && near && debounced.length >= 2 && (
        <ul className="absolute z-[1000] mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
          {results.isError && (
            <li className="px-3 py-2 text-xs text-urgency-emergency">
              Business search is unavailable right now.
            </li>
          )}
          {!results.isFetching && (results.data ?? []).length === 0 && !results.isError && (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              No businesses found nearby. Try a different name.
            </li>
          )}
          {(results.data ?? []).map((p, i) => (
            <li key={`${p.place_id ?? i}`}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p);
                  setText("");
                  setDebounced("");
                  setOpen(false);
                }}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-sand"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {p.name || p.short_label}
                  </span>
                  <span className="block truncate text-xs text-ink-soft">{p.formatted_address}</span>
                </span>
                {p.distance_m != null && (
                  <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                    {formatDistance(p.distance_m)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
