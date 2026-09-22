import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listNearbyRequests } from "@/lib/hoodi/requests.functions";
import { listNearbyHelpers } from "@/lib/hoodi/location.functions";
import { RequestCard } from "@/components/hoodi/RequestCard";
import { HoodiMap } from "@/components/hoodi/HoodiMap";
import { LocationSearch } from "@/components/hoodi/LocationSearch";
import { useHoodiLocation } from "@/hooks/use-hoodi-location";
import {
  DEFAULT_RADIUS_M,
  RADIUS_OPTIONS,
  formatRadius,
  formatDistance,
  formatTravelBadge,
  shortAddress,
} from "@/lib/hoodi/location";
import { FindClosestHelperModal } from "@/components/hoodi/FindClosestHelperModal";
import {
  Crosshair,
  Loader2,
  MapPin,
  RefreshCw,
  Zap,
  Users,
  Compass,
  Layers,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/help/nearby")({
  head: () => ({
    meta: [
      { title: "Hyperlocal Map & Nearby Discovery — Hoodi Help" },
      {
        name: "description",
        content: "Interactive neighborhood map with requests, helpers, dynamic radius filtering, and smart matching.",
      },
    ],
  }),
  component: NearbyPage,
});

// Quick Bengaluru neighborhood hotspots
const NEIGHBORHOOD_JUMPS = [
  { name: "Indiranagar", lat: 12.973, lng: 77.602, area: "100ft Rd, Indiranagar" },
  { name: "Koramangala", lat: 12.935, lng: 77.625, area: "4th Block, Koramangala" },
  { name: "HSR Layout", lat: 12.912, lng: 77.644, area: "Sector 1, HSR" },
  { name: "MG Road / CBD", lat: 12.975, lng: 77.609, area: "MG Road, Bengaluru" },
  { name: "Whitefield", lat: 12.969, lng: 77.749, area: "ITPL Main Rd, Whitefield" },
];

export function NearbyPage() {
  const loc = useHoodiLocation();
  const [customCenter, setCustomCenter] = useState<{ lat: number; lng: number } | null>(null);
  const activeCoords = customCenter ?? loc.coords ?? { lat: 12.9716, lng: 77.5946 };

  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const [urgencyFilter, setUrgencyFilter] = useState<string | null>(null);
  const [showRequests, setShowRequests] = useState(true);
  const [showHelpers, setShowHelpers] = useState(true);
  const [closestHelperModalOpen, setClosestHelperModalOpen] = useState(false);

  // 1. Query nearby open requests
  const nearbyRequests = useQuery({
    queryKey: ["nearby-requests", activeCoords.lat, activeCoords.lng, radiusM, urgencyFilter],
    queryFn: () =>
      listNearbyRequests({
        data: {
          lat: activeCoords.lat,
          lng: activeCoords.lng,
          radius_m: radiusM,
          urgency: (urgencyFilter as "normal" | "today" | "emergency" | null) ?? null,
        },
      }),
    refetchInterval: 8_000,
  });

  // 2. Query nearby available helpers
  const nearbyHelpers = useQuery({
    queryKey: ["nearby-helpers", activeCoords.lat, activeCoords.lng, radiusM],
    queryFn: () =>
      listNearbyHelpers({
        data: {
          lat: activeCoords.lat,
          lng: activeCoords.lng,
          radius_m: radiusM,
        },
      }),
    refetchInterval: 12_000,
  });

  const requestItems = useMemo(
    () =>
      ((nearbyRequests.data as any[] | undefined) ?? [])
        .slice()
        .sort((a, b) => (a.distance_m ?? Infinity) - (b.distance_m ?? Infinity)),
    [nearbyRequests.data],
  );

  const helperItems = useMemo(
    () => nearbyHelpers.data ?? [],
    [nearbyHelpers.data],
  );

  // Construct Leaflet markers
  const markers = useMemo(() => {
    const list: any[] = [];

    if (showRequests) {
      for (const r of requestItems) {
        if (r.latitude != null && r.longitude != null) {
          list.push({
            id: `req_${r.id}`,
            type: "request",
            lat: Number(r.latitude),
            lng: Number(r.longitude),
            label: `
              <div style="font-family:sans-serif;padding:4px;min-width:160px;">
                <div style="font-size:10px;font-weight:bold;color:#c2410c;text-transform:uppercase;">${r.category ?? "Errand"} · ${r.urgency}</div>
                <div style="font-weight:bold;font-size:13px;color:#0f172a;margin-top:2px;">${String(r.title).replace(/[<>]/g, "")}</div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;">${formatTravelBadge(r.distance_m)}</div>
                <div style="margin-top:6px;display:flex;align-items:center;justify-content:space-between;">
                  <span style="font-weight:bold;color:#0f172a;">${r.is_paid === false ? "Free" : `₹${r.estimated_fare ?? 50}`}</span>
                  <a href="/help/requests/${r.id}" style="color:#c2410c;font-size:11px;font-weight:bold;text-decoration:none;">View Task →</a>
                </div>
              </div>
            `,
            tone: (r.urgency === "emergency" ? "emergency" : r.urgency === "today" ? "today" : "normal"),
            fare: r.estimated_fare,
          });
        }
      }
    }

    if (showHelpers) {
      for (const h of helperItems) {
        list.push({
          id: `helper_${h.id}`,
          type: "helper",
          lat: h.latitude,
          lng: h.longitude,
          name: h.name,
          rating: h.avg_score ?? 5.0,
          label: `
            <div style="font-family:sans-serif;padding:4px;min-width:160px;">
              <div style="font-size:10px;font-weight:bold;color:#0284c7;text-transform:uppercase;">Verified Helper</div>
              <div style="font-weight:bold;font-size:13px;color:#0f172a;margin-top:2px;">${h.name} ★ ${h.avg_score ?? 5.0}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">${h.helps_completed ?? 10}+ errands completed</div>
              <div style="margin-top:6px;">
                <span style="display:inline-block;padding:2px 8px;background:#0284c7;color:#fff;border-radius:999px;font-size:10px;font-weight:bold;">Available Now</span>
              </div>
            </div>
          `,
        });
      }
    }

    return list;
  }, [requestItems, helperItems, showRequests, showHelpers]);

  const placeLabel = shortAddress(loc.location);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold text-ink">Hyperlocal Map & Discovery</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Compass className="h-3.5 w-3.5" /> GPS Active
            </span>
          </div>
          <p className="flex items-center gap-1.5 text-sm text-ink-soft mt-1">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            {placeLabel
              ? `Live neighborhood radar within ${formatRadius(radiusM)} of ${placeLabel}`
              : "Discover real-time errands and helpers within your custom perimeter"}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setClosestHelperModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs cursor-pointer"
          >
            <Zap className="h-3.5 w-3.5 fill-current" /> Find Closest Helper
          </button>
          <button
            onClick={() => {
              nearbyRequests.refetch();
              nearbyHelpers.refetch();
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 font-semibold text-ink-soft hover:bg-sand transition cursor-pointer"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", nearbyRequests.isFetching && "animate-spin")} />
            Refresh
          </button>
          <button
            disabled={loc.isSaving}
            onClick={() => {
              setCustomCenter(null);
              loc.useDeviceLocation();
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 font-semibold text-background hover:bg-ink/90 transition cursor-pointer disabled:opacity-50"
          >
            {loc.isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
            My GPS Spot
          </button>
        </div>
      </div>

      {/* Neighborhood Quick Jumps */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap">
          Quick Jumps:
        </span>
        {NEIGHBORHOOD_JUMPS.map((nj) => (
          <button
            key={nj.name}
            onClick={() => {
              setCustomCenter({ lat: nj.lat, lng: nj.lng });
              loc.saveLocation({
                latitude: nj.lat,
                longitude: nj.lng,
                formatted_address: nj.area,
                city: "Bengaluru",
                state: "Karnataka",
                country: "India",
              });
            }}
            className="whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-ink hover:bg-sand hover:border-primary/40 transition cursor-pointer"
          >
            📍 {nj.name}
          </button>
        ))}
      </div>

      {/* Address Search Bar */}
      <div className="rounded-3xl border border-border bg-card p-4 shadow-xs">
        <LocationSearch
          bias={activeCoords}
          onSelect={(p) => {
            setCustomCenter({ lat: p.latitude, lng: p.longitude });
            loc.saveLocation({
              latitude: p.latitude,
              longitude: p.longitude,
              formatted_address: p.formatted_address,
              city: p.city,
              state: p.state,
              country: p.country,
            });
          }}
          placeholder="Search any neighborhood, market, or landmark to center map…"
        />
        {loc.error && <p className="mt-2 text-xs text-urgency-emergency">{loc.error}</p>}
      </div>

      {/* Filter & Radius Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 shadow-xs">
        {/* Urgency Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Urgency:</span>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: null, label: "All" },
              { id: "emergency", label: "🚨 Emergency" },
              { id: "today", label: "⚡ Today" },
              { id: "normal", label: "Normal" },
            ].map((u) => (
              <button
                key={u.id ?? "all"}
                onClick={() => setUrgencyFilter(u.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition cursor-pointer",
                  urgencyFilter === u.id
                    ? "border-ink bg-ink text-background shadow-xs"
                    : "border-border bg-sand/50 text-ink-soft hover:bg-sand",
                )}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Radius Selector: 1km, 2km, 5km, 10km, 20km */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Radius:</span>
          <div className="inline-flex rounded-full border border-border bg-sand/50 p-0.5">
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setRadiusM(r)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer",
                  radiusM === r
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                {formatRadius(r)}
              </button>
            ))}
          </div>
        </div>

        {/* Layer Toggles */}
        <div className="flex items-center gap-3 text-xs text-ink-soft">
          <label className="flex items-center gap-1.5 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={showRequests}
              onChange={(e) => setShowRequests(e.target.checked)}
              className="accent-primary rounded"
            />
            Tasks ({requestItems.length})
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={showHelpers}
              onChange={(e) => setShowHelpers(e.target.checked)}
              className="accent-sky-600 rounded"
            />
            Helpers ({helperItems.length})
          </label>
        </div>
      </div>

      {/* Main Map + Requests Split Layout */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Interactive Map View */}
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-border shadow-xs bg-card">
            <HoodiMap
              center={activeCoords}
              radiusM={radiusM}
              markers={markers}
              height={460}
            />

            {/* Map Legend Overlay */}
            <div className="absolute bottom-3 left-3 z-[400] flex flex-wrap items-center gap-2 rounded-2xl bg-card/90 backdrop-blur-md border border-border px-3 py-2 text-[11px] shadow-sm">
              <span className="flex items-center gap-1 text-ink font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> You (GPS)
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1 text-ink font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-urgency-emergency" /> Emergency
              </span>
              <span className="flex items-center gap-1 text-ink font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-urgency-today" /> Today
              </span>
              <span className="flex items-center gap-1 text-ink font-semibold">
                <span className="h-2.5 w-2.5 rounded-full bg-urgency-normal" /> Normal
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1 text-sky-700 font-bold">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-600" /> Helper
              </span>
            </div>
          </div>

          {/* Quick Helper Radar Bar */}
          <div className="rounded-3xl border border-border bg-card p-4 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/10 text-sky-600">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <div className="font-display text-sm font-bold text-ink">
                  {helperItems.length} Helpers Active Within {formatRadius(radiusM)}
                </div>
                <div className="text-xs text-ink-soft">
                  Verified neighbors ready for pickup runs, first aid, and deliveries.
                </div>
              </div>
            </div>
            <button
              onClick={() => setClosestHelperModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition cursor-pointer"
            >
              Smart Match <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Side Feed: Requests with Travel Badges */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
              <span>Nearby Requests</span>
              <span className="rounded-full bg-sand px-2 py-0.5 text-xs font-bold text-ink-soft">
                {requestItems.length}
              </span>
            </h3>
            <span className="text-xs text-ink-soft">Sorted by closest ETA</span>
          </div>

          {nearbyRequests.isLoading ? (
            <div className="grid place-items-center rounded-3xl border border-dashed border-border bg-card py-20 text-ink-soft">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="mt-2 text-xs">Scanning neighborhood radius…</p>
            </div>
          ) : requestItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-8 text-center text-ink-soft">
              <p className="font-display text-base font-bold text-ink">No requests within {formatRadius(radiusM)}</p>
              <p className="mt-1 text-xs">Try selecting a larger radius (5 km, 10 km, 20 km) or ask for help!</p>
              <Link
                to="/help/ask"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
              >
                Post an Errand
              </Link>
            </div>
          ) : (
            <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
              {requestItems.map((r) => (
                <div key={r.id} className="relative">
                  <RequestCard
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
                  {r.distance_m != null && (
                    <div className="absolute top-3 right-3 rounded-full bg-sand/90 backdrop-blur-xs border border-border px-2.5 py-0.5 text-[10px] font-bold text-ink">
                      {formatTravelBadge(r.distance_m)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Smart Closest Helper Matching Modal */}
      <FindClosestHelperModal
        open={closestHelperModalOpen}
        onOpenChange={setClosestHelperModalOpen}
        targetCoords={activeCoords}
        urgency={(urgencyFilter as any) ?? "normal"}
        radiusM={radiusM}
      />
    </div>
  );
}