import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROFILE_COLUMNS =
  "id, name, phone_verified, bio, profile_photo_url, cover_image_url, is_admin, is_active, created_at, updated_at";

// phone_number is column-revoked at the database level so nobody can read
// another member's number through the Data API. Own number comes from my_phone().
async function withOwnPhone<T extends object>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  row: T | null,
): Promise<(T & { phone_number: string | null }) | null> {
  if (!row) return null;
  const { data: phone } = await supabase.rpc("my_phone");
  return { ...row, phone_number: (phone as string | null) ?? null };
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return await withOwnPhone(context.supabase, data);
  });

const UpdateProfileInput = z.object({
  name: z.string().min(1).max(120).optional(),
  bio: z.string().max(1000).nullable().optional(),
  profile_photo_url: z.string().url().nullable().optional(),
  cover_image_url: z.string().url().nullable().optional(),
  phone_number: z.string().min(6).max(32).nullable().optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("profiles")
      .update(data)
      .eq("id", context.userId)
      .select(PROFILE_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return await withOwnPhone(context.supabase, row);
  });

const LocationInput = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

export const updateMyLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => LocationInput.parse(input))
  .handler(async ({ data, context }) => {
    // PostGIS geography accepts WKT via server-side cast
    const wkt = `SRID=4326;POINT(${data.lng} ${data.lat})`;
    const { error } = await context.supabase
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ location: wkt as any })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true, lat: data.lat, lng: data.lng };
  });

const TagInput = z.object({ tag: z.string().min(1).max(64) });

export const addOfferTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TagInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("user_offer_tags")
      .insert({ user_id: context.userId, tag: data.tag })
      .select()
      .single();
    if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
    return row;
  });

export const removeOfferTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TagInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_offer_tags")
      .delete()
      .eq("user_id", context.userId)
      .eq("tag", data.tag);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPublicProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id, name, bio, profile_photo_url, is_active, created_at")
      .eq("id", data.userId)
      .maybeSingle();
    const { data: tags } = await context.supabase
      .from("user_offer_tags")
      .select("tag")
      .eq("user_id", data.userId);
    const { data: rating } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc("user_rating_summary" as any, { _user_id: data.userId } as any)
      .single();
    return {
      profile,
      tags: (tags ?? []).map((t) => t.tag),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rating: (rating as any) ?? { avg_score: null, rating_count: 0 },
    };
  });
export const getProfileStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const uid = data.userId ?? context.userId;
    const { data: row } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc("profile_stats" as any, { _user_id: uid } as any)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = (row ?? {}) as any;
    return {
      helps_completed: Number(r.helps_completed ?? 0),
      requests_posted: Number(r.requests_posted ?? 0),
      sessions_taught: Number(r.sessions_taught ?? 0),
      sessions_learned: Number(r.sessions_learned ?? 0),
      avg_score: r.avg_score == null ? null : Number(r.avg_score),
      rating_count: Number(r.rating_count ?? 0),
      member_since: (r.member_since as string | null) ?? null,
    };
  });

export const listReviewsForUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const uid = data.userId ?? context.userId;
    const { data: rows, error } = await context.supabase
      .from("ratings")
      .select("id, score, comment, created_at, rater_id")
      .eq("ratee_id", uid)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    const raterIds = [...new Set((rows ?? []).map((r) => r.rater_id))];
    const authors: Record<string, { name: string | null; photo: string | null }> = {};
    if (raterIds.length) {
      const { data: people } = await context.supabase
        .from("profiles")
        .select("id, name, profile_photo_url")
        .in("id", raterIds);
      for (const p of people ?? []) authors[p.id] = { name: p.name, photo: p.profile_photo_url };
    }
    return (rows ?? []).map((r) => ({
      id: r.id,
      score: r.score,
      comment: r.comment,
      created_at: r.created_at,
      author_name: authors[r.rater_id]?.name ?? "A neighbor",
      author_photo: authors[r.rater_id]?.photo ?? null,
    }));
  });
