import { useState } from "react";
import { Crosshair, Loader2, MapPin, X } from "lucide-react";
import { useHoodiLocation } from "@/hooks/use-hoodi-location";
import { LocationSearch } from "./LocationSearch";

/**
 * First-run location prompt. Shown once the user is signed in and has no
 * stored location. Permission denial falls back to manual search.
 */
export function LocationGate() {
  const loc = useHoodiLocation();
  const [dismissed, setDismissed] = useState(false);
  const [manual, setManual] = useState(false);

  if (dismissed || loc.isLoading || !loc.isMissing) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[26rem] sm:p-0">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-bold text-ink">Set your neighborhood</h2>
              <p className="text-xs text-ink-soft">
                Hoodi uses it to show requests and mentors near you.
              </p>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} aria-label="Dismiss" className="text-ink-soft hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <button
            onClick={async () => {
              const saved = await loc.useDeviceLocation();
              if (!saved) setManual(true);
            }}
            disabled={loc.isSaving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
          >
            {loc.isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
            {loc.isSaving ? "Locating you…" : "Allow location access"}
          </button>

          {loc.error && <p className="text-xs text-urgency-emergency">{loc.error}</p>}

          {manual || loc.error ? (
            <LocationSearch
              onSelect={(p) =>
                loc.saveLocation({
                  latitude: p.latitude,
                  longitude: p.longitude,
                  formatted_address: p.formatted_address,
                  city: p.city,
                  state: p.state,
                  country: p.country,
                })
              }
            />
          ) : (
            <button
              onClick={() => setManual(true)}
              className="w-full text-center text-xs font-semibold text-ink-soft hover:text-ink"
            >
              Or search for your area instead
            </button>
          )}
        </div>
      </div>
    </div>
  );
}