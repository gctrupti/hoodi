/** Server-only helpers shared by the admin portal's server functions. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.is_admin) throw new Error("Forbidden");
}

/** Great-circle distance in metres. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Rough city-traffic ETA (22 km/h average) in whole minutes. */
export function etaMinutes(distanceMeters: number) {
  return Math.max(1, Math.round((distanceMeters / 1000 / 22) * 60));
}
