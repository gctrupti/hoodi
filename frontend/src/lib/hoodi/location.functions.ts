import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GeoPlace } from "@/lib/hoodi/geoapify.server";

export type { GeoPlace };

const Coords = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

/** Coordinates -> readable address. Used by every Hoodi module. */
export const reverseGeocodeLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Coords.parse(input))
  .handler(async ({ data }): Promise<GeoPlace | null> => {
    const { reverseGeocode } = await import("@/lib/hoodi/geoapify.server");
    return reverseGeocode(data.lat, data.lng);
  });

/** Address autocomplete: city, area, street, landmark or pincode. */
export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        text: z.string().min(2).max(160),
        lat: z.number().optional(),
        lng: z.number().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<GeoPlace[]> => {
    const { autocompletePlaces } = await import("@/lib/hoodi/geoapify.server");
    return autocompletePlaces(
      data.text,
      data.lat != null && data.lng != null ? { lat: data.lat, lng: data.lng } : undefined,
    );
  });

const PlaceInput = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  formatted_address: z.string().max(400).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  state: z.string().max(120).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
});

/** Business / POI search — shops, pharmacies, supermarkets, restaurants near a point. */
export const searchBusinessPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        text: z.string().min(2).max(160),
        lat: z.number().gte(-90).lte(90),
        lng: z.number().gte(-180).lte(180),
        radius_m: z.number().int().min(500).max(50000).optional().default(15000),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<GeoPlace[]> => {
    const { searchBusinesses } = await import("@/lib/hoodi/geoapify.server");
    return searchBusinesses(data.text, { lat: data.lat, lng: data.lng }, data.radius_m);
  });

export type SavedLocation = {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  formatted_address: string | null;
  location_updated_at?: string | null;
};

const LOCATION_COLS = "latitude, longitude, city, state, country, formatted_address, location_updated_at";

export const getMyLocation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SavedLocation | null> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(LOCATION_COLS)
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as SavedLocation | null;
  });

/**
 * Persist the signed-in user's location. When only coordinates are supplied the
 * address is resolved server-side so we never store bare numbers.
 */
export const saveMyLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PlaceInput.parse(input))
  .handler(async ({ data, context }): Promise<SavedLocation> => {
    let patch = { ...data };
    if (!patch.formatted_address) {
      const { reverseGeocode } = await import("@/lib/hoodi/geoapify.server");
      const place = await reverseGeocode(data.latitude, data.longitude);
      if (place) {
        patch = {
          latitude: place.latitude,
          longitude: place.longitude,
          formatted_address: place.formatted_address,
          city: place.city,
          state: place.state,
          country: place.country,
        };
      }
    }
    const { data: row, error } = await context.supabase
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update(patch as any)
      .eq("id", context.userId)
      .select(LOCATION_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row as SavedLocation;
  });

/** Where a mentor teaches (Hoodi Skills). Falls back to the personal profile location. */
export const saveTeachingLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    PlaceInput.partial()
      .extend({ teaching_mode: z.enum(["online", "offline", "both"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { teaching_mode, ...place } = data;
    let patch: Record<string, unknown> = { teaching_mode };
    if (teaching_mode !== "online" && place.latitude != null && place.longitude != null) {
      let resolved = place;
      if (!place.formatted_address) {
        const { reverseGeocode } = await import("@/lib/hoodi/geoapify.server");
        const p = await reverseGeocode(place.latitude, place.longitude);
        if (p) {
          resolved = {
            latitude: p.latitude,
            longitude: p.longitude,
            formatted_address: p.formatted_address,
            city: p.city,
            state: p.state,
            country: p.country,
          };
        }
      }
      patch = { ...patch, ...resolved };
    }
    const { data: row, error } = await context.supabase
      .from("teacher_profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert({ user_id: context.userId, ...patch } as any, { onConflict: "user_id" })
      .select("user_id, teaching_mode, latitude, longitude, city, state, country, formatted_address")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });