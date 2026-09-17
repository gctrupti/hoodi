import { useEffect, useState } from "react";
import { Crosshair, Loader2, MapPin, Move, Save } from "lucide-react";
import { toast } from "sonner";
import { HoodiMap } from "./HoodiMap";
import { LocationSearch } from "./LocationSearch";
import { useHoodiLocation } from "@/hooks/use-hoodi-location";
import { shortAddress } from "@/lib/hoodi/location";
import type { GeoPlace } from "@/lib/hoodi/location.functions";

type Draft = {
  latitude: number;
  longitude: number;
  formatted_address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

/**
 * Full location editor: current location, manual search, draggable pin.
 * Shared across Hoodi modules.
 */
export function LocationPicker({ height = 300 }: { height?: number }) {
  const loc = useHoodiLocation();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [moveMode, setMoveMode] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (loc.location?.latitude != null && loc.location.longitude != null && !draft) {
      setDraft({
        latitude: loc.location.latitude,
        longitude: loc.location.longitude,
        formatted_address: loc.location.formatted_address,
        city: loc.location.city,
        state: loc.location.state,
        country: loc.location.country,
      });
    }
  }, [loc.location, draft]);

  const dirty =
    !!draft &&
    (draft.latitude !== loc.location?.latitude || draft.longitude !== loc.location?.longitude);

  async function pinMoved(c: { lat: number; lng: number }) {
    setResolving(true);
    setDraft((d) => ({
      latitude: c.lat,
      longitude: c.lng,
      formatted_address: d?.formatted_address ?? null,
      city: d?.city ?? null,
      state: d?.state ?? null,
      country: d?.country ?? null,
    }));
    try {
      const place = await loc.describe(c);
      if (place) {
        setDraft({
          latitude: c.lat,
          longitude: c.lng,
          formatted_address: place.formatted_address,
          city: place.city,
          state: place.state,
          country: place.country,
        });
      }
    } catch {
      toast.error("Couldn't read the address for that spot.");
    } finally {
      setResolving(false);
    }
  }

  function pickPlace(p: GeoPlace) {
    setDraft({
      latitude: p.latitude,
      longitude: p.longitude,
      formatted_address: p.formatted_address,
      city: p.city,
      state: p.state,
      country: p.country,
    });
  }

  async function save() {
    if (!draft) return;
    await loc.saveLocation(draft);
    toast.success("Location saved.");
  }

  const label = shortAddress(draft) ?? shortAddress(loc.location);

  return (
    <div className="space-y-3">
      <LocationSearch onSelect={pickPlace} bias={loc.coords} />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={async () => {
            const saved = await loc.useDeviceLocation();
            if (saved) {
              setDraft({
                latitude: saved.latitude!,
                longitude: saved.longitude!,
                formatted_address: saved.formatted_address,
                city: saved.city,
                state: saved.state,
                country: saved.country,
              });
              toast.success("Location updated from your device.");
            }
          }}
          disabled={loc.isSaving}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-60"
        >
          {loc.isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
          Use current location
        </button>
        <button
          onClick={() => setMoveMode((m) => !m)}
          className={
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition " +
            (moveMode ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-ink-soft hover:bg-sand")
          }
        >
          <Move className="h-3.5 w-3.5" />
          {moveMode ? "Pin is movable — drag or tap the map" : "Move pin"}
        </button>
        {dirty && (
          <button
            onClick={save}
            disabled={loc.isSaving}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" /> Save this spot
          </button>
        )}
      </div>

      {loc.error && <p className="text-xs text-urgency-emergency">{loc.error}</p>}

      {loc.isLoading && !draft ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card" style={{ height }}>
          <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
        </div>
      ) : draft ? (
        <>
          <HoodiMap
            center={{ lat: draft.latitude, lng: draft.longitude }}
            zoom={15}
            draggableCenter={moveMode}
            onCenterDragEnd={pinMoved}
            height={height}
          />
          <p className="flex items-start gap-1.5 text-sm text-ink">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              <span className="font-semibold">{resolving ? "Reading address…" : label ?? "Unknown area"}</span>
              {draft.formatted_address && (
                <span className="block text-xs text-ink-soft">{draft.formatted_address}</span>
              )}
            </span>
          </p>
        </>
      ) : (
        <div
          className="grid place-items-center rounded-2xl border border-dashed border-border bg-card px-6 text-center text-sm text-ink-soft"
          style={{ height }}
        >
          No location set yet. Use your current location or search for your area.
        </div>
      )}
    </div>
  );
}