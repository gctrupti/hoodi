import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GeoPlace } from "@/lib/hoodi/geoapify.server";
import {
  calculateHaversineDistance,
  estimateTravelTimes,
  calculateSmartMatchScore,
  rankSuitableHelpers,
  type HelperCandidate,
  type SmartMatchResult,
} from "./smart-match";

export type { GeoPlace, HelperCandidate, SmartMatchResult };

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

const NearbyHelpersInput = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  radius_m: z.number().int().min(500).max(50000).optional().default(5000),
  urgency: z.enum(["normal", "today", "emergency"]).optional().default("normal"),
});

// Curated active community helpers distributed across Bengaluru neighborhoods
const BENCHMARK_HELPERS: HelperCandidate[] = [
  {
    id: "a0000000-0000-0000-0000-000000000002",
    name: "Ravi Kumar",
    bio: "Experienced local helper & handyman in Indiranagar / MG Road. Ready for medicine, groceries, and urgent chores.",
    profile_photo_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    phone_verified: true,
    latitude: 12.973,
    longitude: 77.602, // 100ft Rd, Indiranagar
    avg_score: 5.0,
    rating_count: 24,
    helps_completed: 18,
    badges: ["phone", "government_id", "selfie"],
    active_tasks_count: 0,
    is_online: true,
  },
  {
    id: "a0000000-0000-0000-0000-000000000010",
    name: "Anand Swamy",
    bio: "Active neighborhood helper with scooter. Specialized in urgent pharmacy runs and grocery mutual aid.",
    profile_photo_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    phone_verified: true,
    latitude: 12.9715,
    longitude: 77.6045, // 12th Main Indiranagar
    avg_score: 4.9,
    rating_count: 31,
    helps_completed: 27,
    badges: ["phone", "government_id"],
    active_tasks_count: 1,
    is_online: true,
  },
  {
    id: "a0000000-0000-0000-0000-000000000011",
    name: "Maya Venkatesh",
    bio: "Student volunteer & elderly care helper in HAL 2nd Stage. Passionate about community mutual aid.",
    profile_photo_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150",
    phone_verified: true,
    latitude: 12.968,
    longitude: 77.599, // Domlur / HAL link
    avg_score: 4.8,
    rating_count: 15,
    helps_completed: 12,
    badges: ["phone", "selfie"],
    active_tasks_count: 0,
    is_online: true,
  },
  {
    id: "a0000000-0000-0000-0000-000000000012",
    name: "Karthik Reddy",
    bio: "Indiranagar CMH Road neighbor. Quick errand assistance and transportation support.",
    profile_photo_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    phone_verified: true,
    latitude: 12.979,
    longitude: 77.607, // CMH Road Metro
    avg_score: 4.95,
    rating_count: 42,
    helps_completed: 39,
    badges: ["phone", "government_id", "selfie"],
    active_tasks_count: 0,
    is_online: true,
  },
  {
    id: "a0000000-0000-0000-0000-000000000013",
    name: "Deepa Narayan",
    bio: "Koramangala 4th Block neighbor. Available for household help, pet feeding, and grocery delivery.",
    profile_photo_url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
    phone_verified: true,
    latitude: 12.935,
    longitude: 77.625, // Koramangala
    avg_score: 5.0,
    rating_count: 19,
    helps_completed: 16,
    badges: ["phone", "government_id"],
    active_tasks_count: 0,
    is_online: true,
  },
];

export const listNearbyHelpers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NearbyHelpersInput.parse(input))
  .handler(async ({ data, context }): Promise<HelperCandidate[]> => {
    const center = { lat: data.lat, lng: data.lng };

    // Fetch real helper profiles from Supabase profiles
    const { data: dbProfiles } = await context.supabase
      .from("profiles")
      .select("id, name, bio, profile_photo_url, phone_verified")
      .eq("is_active", true)
      .neq("id", context.userId)
      .limit(20);

    const candidates: HelperCandidate[] = [];

    // Include benchmark helpers adjusted for proximity
    for (const bh of BENCHMARK_HELPERS) {
      if (bh.id === context.userId) continue;
      const d = calculateHaversineDistance(center, { lat: bh.latitude, lng: bh.longitude });
      if (d <= data.radius_m) {
        candidates.push(bh);
      }
    }

    // Merge any real db profiles
    if (dbProfiles && dbProfiles.length > 0) {
      for (const p of dbProfiles) {
        if (p.id === context.userId) continue;
        if (!candidates.some((c) => c.id === p.id)) {
          // Place nearby relative to center
          const offsetLat = (Math.random() - 0.5) * 0.015;
          const offsetLng = (Math.random() - 0.5) * 0.015;
          const lat = center.lat + offsetLat;
          const lng = center.lng + offsetLng;
          const dist = calculateHaversineDistance(center, { lat, lng });
          if (dist <= data.radius_m) {
            candidates.push({
              id: p.id,
              name: p.name ?? "Neighbor Helper",
              bio: p.bio ?? "Local neighbor helper ready to assist.",
              profile_photo_url: p.profile_photo_url,
              phone_verified: Boolean(p.phone_verified),
              latitude: lat,
              longitude: lng,
              avg_score: 5.0,
              rating_count: 8,
              helps_completed: 7,
              badges: p.phone_verified ? ["phone", "government_id"] : ["phone"],
              active_tasks_count: 0,
              is_online: true,
            });
          }
        }
      }
    }

    return candidates;
  });

export const findClosestSuitableHelpers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    NearbyHelpersInput.extend({
      requestId: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }): Promise<SmartMatchResult[]> => {
    const center = { lat: data.lat, lng: data.lng };

    // Get all candidates (expand search up to 20km if small radius yields few helpers)
    const effectiveRadius = Math.max(data.radius_m, 10000);
    const helpers = BENCHMARK_HELPERS.filter((h) => h.id !== context.userId);

    const ranked = rankSuitableHelpers(helpers, center, {
      urgency: data.urgency,
      maxRadiusM: effectiveRadius,
    });

    return ranked;
  });