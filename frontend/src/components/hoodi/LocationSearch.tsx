import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { searchPlaces, type GeoPlace } from "@/lib/hoodi/location.functions";
import type { Coords } from "@/lib/hoodi/location";

/** Geoapify autocomplete: city, area, street, landmark or pincode. */
export function LocationSearch({
  onSelect,
  bias,
  placeholder = "Search city, area, street, landmark or pincode…",
}: {
  onSelect: (place: GeoPlace) => void;
  bias?: Coords | null;
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
    queryKey: ["place-search", debounced, bias?.lat, bias?.lng],
    enabled: debounced.length >= 2,
    queryFn: () =>
      searchPlaces({ data: { text: debounced, lat: bias?.lat, lng: bias?.lng } }),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-ink-soft" />
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/70"
          aria-label="Search for a location"
        />
        {results.isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-soft" />}
      </div>

      {open && debounced.length >= 2 && (
        <ul className="absolute z-[1000] mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-lg">
          {results.isError && (
            <li className="px-3 py-2 text-xs text-urgency-emergency">
              Location search is unavailable right now.
            </li>
          )}
          {!results.isFetching && (results.data ?? []).length === 0 && !results.isError && (
            <li className="px-3 py-2 text-xs text-muted-foreground">No places found.</li>
          )}
          {(results.data ?? []).map((p, i) => (
            <li key={`${p.place_id ?? i}`}>
              <button
                onClick={() => {
                  onSelect(p);
                  setText("");
                  setDebounced("");
                  setOpen(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-sand"
              >
                <span className="block font-medium">{p.short_label || p.formatted_address}</span>
                <span className="block truncate text-xs text-ink-soft">{p.formatted_address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}