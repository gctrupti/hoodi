import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listNearbyRequests } from "@/lib/hoodi/requests.functions";
import { RequestCard } from "@/components/hoodi/RequestCard";
import { HoodiMap } from "@/components/hoodi/HoodiMap";
import { LocationSearch } from "@/components/hoodi/LocationSearch";
import { useHoodiLocation } from "@/hooks/use-hoodi-location";
import {
  DEFAULT_RADIUS_M,
  RADIUS_OPTIONS,
  formatRadius,
  shortAddress,
} from "@/lib/hoodi/location";
import { Crosshair, Loader2, MapPin, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/help/nearby")({
  head: () => ({
    meta: [
      { title: "Nearby requests — Hoodi Help" },
      {
        name: "description",
        content: "See real open help requests around you, sorted by distance from your saved location.",
      },
      { property: "og:title", content: "Nearby requests — Hoodi Help" },
      {
        property: "og:description",
        content: "Real-time, location-aware help requests from neighbors within your chosen radius.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NearbyPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Req = any;

function NearbyPage() {
  const loc = useHoodiLocation();
  const coords = loc.coords;
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const [urgencyFilter, setUrgencyFilter] = useState<string | null>(null);

  const nearby = useQuery({
    queryKey: ["nearby", coords?.lat, coords?.lng, radiusM, urgencyFilter],
    enabled: !!coords,
    queryFn: () =>
      listNearbyRequests({
        data: {
          lat: coords!.lat,
          lng: coords!.lng,
          radius_m: radiusM,
          urgency: (urgencyFilter as "normal" | "today" | "emergency" | null) ?? null,
        },
      }),
    refetchInterval: 20_000,
  });

  const items = useMemo(
    () =>
      ((nearby.data as Req[] | undefined) ?? [])
        .slice()
        .sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity)),
    [nearby.data],
  );

  const markers = useMemo(
    () =>
      items
        .filter((r) => r.latitude != null && r.longitude != null)
        .map((r) => ({
          id: r.id as string,
          lat: Number(r.latitude),
          lng: Number(r.longitude),
          label: `<strong>${String(r.title).replace(/[<>]/g, "")}</strong>`,
          tone: (r.urgency === "emergency"
            ? "emergency"
            : r.urgency === "today"
              ? "today"
              : "normal") as "emergency" | "today" | "normal",
        })),
    [items],
  );

  const placeLabel = shortAddress(loc.location);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Nearby</h1>
          <p className="flex items-center gap-1.5 text-sm text-ink-soft">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            {placeLabel
              ? `Open requests within ${formatRadius(radiusM)} of ${placeLabel}`
              : "Set your location to see requests around you"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => nearby.refetch()}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-semibold text-ink-soft hover:bg-sand"
          >
            <RefreshCw className={"h-3.5 w-3.5 " + (nearby.isFetching ? "animate-spin" : "")} />
            Refresh
          </button>
          <button
            disabled={loc.isSaving}
            onClick={() => loc.useDeviceLocation()}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 font-semibold text-background disabled:opacity-50"
          >
            {loc.isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Crosshair className="h-3.5 w-3.5" />
            )}
            Use current location
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <LocationSearch
          bias={coords}
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
          placeholder="Search another area to browse from…"
        />
        {loc.error && <p className="mt-2 text-xs text-urgency-emergency">{loc.error}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Urgency</div>
        <div className="flex flex-wrap gap-1.5">
          {[null, "emergency", "today", "normal"].map((u) => (
            <button
              key={u ?? "all"}
              onClick={() => setUrgencyFilter(u)}
              className={
                "rounded-full border px-3 py-1 text-xs font-semibold transition " +
                (urgencyFilter === u
                  ? "border-ink bg-ink text-background"
                  : "border-border bg-card text-ink-soft hover:bg-sand")
              }
            >
              {u ? u : "All"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-ink-soft">
          Radius
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRadiusM(r)}
              className={
                "rounded-full border px-3 py-1 font-semibold transition " +
                (radiusM === r
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-ink-soft hover:bg-sand")
              }
            >
              {formatRadius(r)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {!coords && !loc.isLoading && (
            <div className="col-span-full rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
              <p className="font-display text-xl text-ink">Where are you?</p>
              <p className="mt-1 text-sm text-ink-soft">
                Share your location or search for your area to see real requests near you.
              </p>
            </div>
          )}
          {(nearby.isLoading || loc.isLoading) && !!coords && (
            <div className="col-span-full grid place-items-center rounded-2xl border border-dashed border-border bg-card py-16 text-ink-soft">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {!!coords && !nearby.isLoading && items.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
              <p className="font-display text-xl text-ink">Quiet street.</p>
              <p className="mt-1 text-sm text-ink-soft">
                No open requests within {formatRadius(radiusM)}. Try widening the radius.
              </p>
            </div>
          )}
          {items.map((r) => (
            <RequestCard
              key={r.id}
              to="link"
              req={{
                id: r.id,
                title: r.title,
                description: r.description,
                category: r.category,
                urgency: r.urgency,
                is_paid: r.is_paid,
                estimated_fare: r.estimated_fare,
                final_fare: r.final_fare,
                distance_m: r.distance_m,
                created_at: r.created_at,
              }}
            />
          ))}
        </div>

        <aside className="md:sticky md:top-24 md:self-start">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                Around you
              </div>
              <div className="text-[10px] text-muted-foreground">{formatRadius(radiusM)}</div>
            </div>
            {coords ? (
              <HoodiMap
                center={coords}
                radiusM={radiusM}
                markers={markers}
                height={300}
              />
            ) : (
              <div className="grid h-[300px] place-items-center rounded-2xl border border-dashed border-border text-xs text-ink-soft">
                No location set
              </div>
            )}
            {loc.location?.formatted_address && (
              <p className="mt-3 text-xs text-ink-soft">{loc.location.formatted_address}</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}