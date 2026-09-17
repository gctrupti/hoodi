import { useState } from "react";
import { Crosshair, Loader2, MapPin, Move, Store } from "lucide-react";
import { HoodiMap } from "@/components/hoodi/HoodiMap";
import { LocationSearch } from "@/components/hoodi/LocationSearch";
import { BusinessSearch } from "@/components/hoodi/BusinessSearch";
import type { Coords } from "@/lib/hoodi/location";
import { shortAddress } from "@/lib/hoodi/location";

export type PlacePick = {
  lat: number;
  lng: number;
  address: string | null;
  name: string | null;
};

/**
 * One location slot on the Hoodi Help request form.
 * `business` switches the search from addresses to real Points of Interest.
 */
export function LocationField({
  label,
  hint,
  business = false,
  value,
  onChange,
  bias,
  onUseMyLocation,
  describe,
  busy = false,
  accent = "primary",
}: {
  label: string;
  hint: string;
  business?: boolean;
  value: PlacePick | null;
  onChange: (p: PlacePick | null) => void;
  bias: Coords | null;
  onUseMyLocation?: () => void | Promise<void>;
  describe: (c: Coords) => Promise<{ formatted_address?: string | null; city?: string | null } | null>;
  busy?: boolean;
  accent?: "primary" | "clay";
}) {
  const [movePin, setMovePin] = useState(false);
  const [resolving, setResolving] = useState(false);

  async function pinMoved(c: Coords) {
    setResolving(true);
    onChange({ lat: c.lat, lng: c.lng, address: value?.address ?? null, name: value?.name ?? null });
    try {
      const place = await describe(c);
      onChange({ lat: c.lat, lng: c.lng, address: shortAddress(place), name: null });
    } catch {
      /* keep coordinates, address stays as-is */
    } finally {
      setResolving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-soft">
          {business ? (
            <Store className={accent === "clay" ? "h-3.5 w-3.5 text-clay" : "h-3.5 w-3.5 text-primary"} />
          ) : (
            <MapPin className={accent === "clay" ? "h-3.5 w-3.5 text-clay" : "h-3.5 w-3.5 text-primary"} />
          )}
          {label}
        </span>
        <div className="flex items-center gap-2">
          {onUseMyLocation && (
            <button
              type="button"
              onClick={() => onUseMyLocation()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-background hover:bg-primary disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
              Use my location
            </button>
          )}
          {value && (
            <button
              type="button"
              onClick={() => setMovePin((m) => !m)}
              className={
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition " +
                (movePin
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-ink-soft hover:bg-sand")
              }
            >
              <Move className="h-3.5 w-3.5" />
              {movePin ? "Done" : "Move pin"}
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>

      <div className="mt-3">
        {business ? (
          <BusinessSearch
            near={bias}
            onSelect={(p) =>
              onChange({
                lat: p.latitude,
                lng: p.longitude,
                address: p.formatted_address,
                name: p.name ?? p.short_label,
              })
            }
          />
        ) : (
          <LocationSearch
            bias={bias}
            onSelect={(p) =>
              onChange({
                lat: p.latitude,
                lng: p.longitude,
                address: p.formatted_address || shortAddress(p),
                name: null,
              })
            }
          />
        )}
      </div>

      {value && (
        <div className="mt-3">
          <HoodiMap
            center={{ lat: value.lat, lng: value.lng }}
            zoom={16}
            height={200}
            draggableCenter={movePin}
            onCenterDragEnd={pinMoved}
          />
          <div className="mt-2 text-xs">
            {value.name && <div className="font-semibold text-ink">{value.name}</div>}
            <div className="text-ink-soft">
              {resolving ? "Resolving address…" : (value.address ?? "Pin set")}
            </div>
          </div>
        </div>
      )}
      {!value && <p className="mt-2 text-xs text-muted-foreground">Required</p>}
    </div>
  );
}
