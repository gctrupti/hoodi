/**
 * Client-safe location helpers shared by every Hoodi module.
 * (Hoodi Help, Hoodi Skills — and future Rescue / Medic / Jobs.)
 */

export type Coords = { lat: number; lng: number };

export const RADIUS_OPTIONS = [1000, 2000, 5000, 10000, 20000] as const;
export const DEFAULT_RADIUS_M = 5000;

const CACHE_KEY = "hoodi.location.v1";

export type CachedLocation = {
  latitude: number;
  longitude: number;
  formatted_address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  savedAt: number;
};

export function readCachedLocation(): CachedLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedLocation;
    if (typeof parsed?.latitude !== "number" || typeof parsed?.longitude !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedLocation(loc: Omit<CachedLocation, "savedAt">) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ...loc, savedAt: Date.now() }));
  } catch {
    /* storage unavailable — non-fatal */
  }
}

export function clearCachedLocation() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/** Ask the device for coordinates. Rejects with a human message. */
export function getDeviceCoords(timeoutMs = 10000): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This device can't share its location. Search for your area instead."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. You can search for your area instead."
            : err.code === err.TIMEOUT
              ? "Timed out getting your location. Try again or search manually."
              : "We couldn't determine your location. Try searching manually.";
        reject(new Error(msg));
      },
      { timeout: timeoutMs, enableHighAccuracy: true, maximumAge: 60_000 },
    );
  });
}

/** "0.8 km" / "240 m" — never raw coordinates. */
export function formatDistance(meters: number | null | undefined): string | null {
  if (meters == null || !Number.isFinite(meters)) return null;
  if (meters < 950) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatRadius(m: number): string {
  return m >= 1000 ? `${m / 1000} km` : `${m} m`;
}

/** Short readable label: "Koramangala, Bengaluru". */
export function shortAddress(loc: {
  formatted_address?: string | null;
  city?: string | null;
  state?: string | null;
} | null | undefined): string | null {
  if (!loc) return null;
  const formatted = loc.formatted_address?.trim();
  if (formatted) {
    const parts = formatted.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 2) return parts.join(", ");
    const city = loc.city?.trim();
    const area = parts.find((p) => p !== city) ?? parts[0];
    return city && area !== city ? `${area}, ${city}` : parts.slice(0, 2).join(", ");
  }
  return [loc.city, loc.state].filter(Boolean).join(", ") || null;
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function googleDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function calculateHaversineDistance(c1: Coords, c2: Coords): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLng = ((c2.lng - c1.lng) * Math.PI) / 180;
  const lat1 = (c1.lat * Math.PI) / 180;
  const lat2 = (c2.lat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export type TravelTimeEstimate = {
  walkingMins: number;
  bikeMins: number;
  carMins: number;
};

export function estimateTravelTimes(distanceMeters: number): TravelTimeEstimate {
  const km = distanceMeters / 1000;
  const walkingMins = Math.max(1, Math.round((km / 4.5) * 60));
  const bikeMins = Math.max(1, Math.round((km / 25) * 60));
  const carMins = Math.max(2, Math.round((km / 18) * 60));
  return { walkingMins, bikeMins, carMins };
}

export function formatTravelBadge(distanceMeters: number): string {
  const dist = formatDistance(distanceMeters);
  const { walkingMins, bikeMins } = estimateTravelTimes(distanceMeters);
  if (distanceMeters <= 1200) {
    return `${dist} · 🚶 ${walkingMins}m · 🛵 ${bikeMins}m`;
  }
  return `${dist} · 🛵 ~${bikeMins}m away`;
}