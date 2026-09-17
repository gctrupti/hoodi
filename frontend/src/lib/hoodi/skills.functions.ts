import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TEACHER_COLS =
  "user_id, headline, bio, experience_years, hourly_rate, availability, availability_slots, is_published, teaching_mode, meeting_provider, meeting_link, languages, latitude, longitude, city, state, country, formatted_address, created_at, updated_at";
const OFFERING_COLS =
  "id, teacher_id, title, description, category, price_per_session, duration_minutes, is_published, created_at, updated_at";

/* ------------------------------- Teacher profile ------------------------------- */

export const getMyTeacherProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("teacher_profiles")
      .select(TEACHER_COLS)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

const TeacherProfileInput = z.object({
  headline: z.string().max(160).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  experience_years: z.number().int().min(0).max(80).optional(),
  hourly_rate: z.number().min(0).max(1000000).optional(),
  availability: z.string().max(1000).nullable().optional(),
  teaching_mode: z.enum(["online", "offline", "both"]).optional(),
  meeting_provider: z.enum(["google_meet", "zoom", "teams"]).nullable().optional(),
  meeting_link: z.string().url().max(500).nullable().optional(),
  languages: z.array(z.string().min(1).max(40)).max(10).optional(),
  availability_slots: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        start: z.string().regex(/^\d{2}:\d{2}$/),
        end: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .max(200)
    .optional(),
  is_published: z.boolean().optional(),
});

/** Create-or-update: one call covers both "create teacher profile" and "update". */
export const upsertMyTeacherProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TeacherProfileInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("teacher_profiles")
      .upsert({ user_id: context.userId, ...data }, { onConflict: "user_id" })
      .select(TEACHER_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/* --------------------------------- Offerings --------------------------------- */

export const listMyOfferings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("skill_offerings")
      .select(OFFERING_COLS)
      .eq("teacher_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const OfferingInput = z.object({
  title: z.string().min(2).max(120),
  description: z.string().max(2000).nullable().optional(),
  category: z.string().min(1).max(64),
  price_per_session: z.number().min(0).max(1000000),
  duration_minutes: z.number().int().min(15).max(480),
  is_published: z.boolean().optional(),
});

export const createOffering = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => OfferingInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("skill_offerings")
      .insert({ ...data, teacher_id: context.userId })
      .select(OFFERING_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateOffering = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    OfferingInput.partial().extend({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("skill_offerings")
      .update(patch)
      .eq("id", id)
      .eq("teacher_id", context.userId)
      .select(OFFERING_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteOffering = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("skill_offerings")
      .delete()
      .eq("id", data.id)
      .eq("teacher_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------- Browse / search ------------------------------- */

const BrowseInput = z.object({
  q: z.string().max(120).optional(),
  category: z.string().max(64).optional(),
  maxPrice: z.number().min(0).optional(),
  minRating: z.number().min(0).max(5).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  radiusM: z.number().int().min(500).max(200000).optional(),
});

export type TeacherCard = {
  teacher_id: string;
  name: string | null;
  profile_photo_url: string | null;
  headline: string | null;
  bio: string | null;
  experience_years: number;
  hourly_rate: number;
  availability: string | null;
  distance_m: number | null;
  teaching_mode: "online" | "offline" | "both";
  city: string | null;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
  avg_score: number | null;
  rating_count: number;
  min_price: number | null;
  offering_count: number;
  availability_slots: { day: number; start: string; end: string }[];
  offerings: {
    id: string;
    title: string;
    category: string;
    price_per_session: number;
    duration_minutes: number;
  }[];
};

export const browseTeachers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BrowseInput.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<TeacherCard[]> => {
    const useLocation = data.lat != null && data.lng != null;

    let teachers: Record<string, unknown>[] = [];
    if (useLocation) {
      const { data: rows, error } = await context.supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .rpc("nearby_teachers" as any, {
          _lat: data.lat,
          _lng: data.lng,
          _radius_m: data.radiusM ?? 5000,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      if (error) throw new Error(error.message);
      teachers = (rows ?? []) as Record<string, unknown>[];
    } else {
      const { data: rows, error } = await context.supabase
        .from("teacher_profiles")
        .select(`${TEACHER_COLS}, profiles!inner(id, name, profile_photo_url, is_active)`)
        .eq("is_published", true);
      if (error) throw new Error(error.message);
      teachers = (rows ?? []).map((r) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = (r as any).profiles;
        return {
          teacher_id: (r as { user_id: string }).user_id,
          name: p?.name ?? null,
          profile_photo_url: p?.profile_photo_url ?? null,
          headline: (r as { headline: string | null }).headline,
          bio: (r as { bio: string | null }).bio,
          experience_years: (r as { experience_years: number }).experience_years,
          hourly_rate: (r as { hourly_rate: number }).hourly_rate,
          availability: (r as { availability: string | null }).availability,
          distance_m: null,
          teaching_mode: ((r as { teaching_mode?: string }).teaching_mode ?? "both") as
            | "online"
            | "offline"
            | "both",
          city: (r as { city: string | null }).city ?? p?.city ?? null,
          formatted_address:
            (r as { formatted_address: string | null }).formatted_address ?? p?.formatted_address ?? null,
          latitude: (r as { latitude: number | null }).latitude ?? p?.latitude ?? null,
          longitude: (r as { longitude: number | null }).longitude ?? p?.longitude ?? null,
          avg_score: null,
          rating_count: 0,
          min_price: null,
          offering_count: 0,
        };
      });
    }

    const ids = teachers.map((t) => t.teacher_id as string);
    if (ids.length === 0) return [];

    const { data: offerings } = await context.supabase
      .from("skill_offerings")
      .select("id, teacher_id, title, category, price_per_session, duration_minutes")
      .in("teacher_id", ids)
      .eq("is_published", true);

    const { data: ratings } = await context.supabase
      .from("ratings")
      .select("ratee_id, score")
      .in("ratee_id", ids);

    const { data: slotRows } = await context.supabase
      .from("teacher_profiles")
      .select("user_id, availability_slots")
      .in("user_id", ids);
    const slotMap = new Map(
      (slotRows ?? []).map((r) => [
        r.user_id as string,
        (Array.isArray(r.availability_slots) ? r.availability_slots : []) as {
          day: number;
          start: string;
          end: string;
        }[],
      ]),
    );

    const ratingMap = new Map<string, { sum: number; count: number }>();
    for (const r of ratings ?? []) {
      const cur = ratingMap.get(r.ratee_id) ?? { sum: 0, count: 0 };
      cur.sum += r.score;
      cur.count += 1;
      ratingMap.set(r.ratee_id, cur);
    }

    const q = data.q?.trim().toLowerCase();

    const cards: TeacherCard[] = teachers.map((t) => {
      const tid = t.teacher_id as string;
      const own = (offerings ?? [])
        .filter((o) => o.teacher_id === tid)
        .map((o) => ({
          id: o.id,
          title: o.title,
          category: o.category,
          price_per_session: Number(o.price_per_session),
          duration_minutes: o.duration_minutes,
        }));
      const agg = ratingMap.get(tid);
      return {
        teacher_id: tid,
        name: (t.name as string) ?? null,
        profile_photo_url: (t.profile_photo_url as string) ?? null,
        headline: (t.headline as string) ?? null,
        bio: (t.bio as string) ?? null,
        experience_years: Number(t.experience_years ?? 0),
        hourly_rate: Number(t.hourly_rate ?? 0),
        availability: (t.availability as string) ?? null,
        distance_m: t.distance_m == null ? null : Number(t.distance_m),
        teaching_mode: ((t.teaching_mode as string) ?? "both") as "online" | "offline" | "both",
        city: (t.city as string) ?? null,
        formatted_address: (t.formatted_address as string) ?? null,
        latitude: t.latitude == null ? null : Number(t.latitude),
        longitude: t.longitude == null ? null : Number(t.longitude),
        avg_score: agg ? Math.round((agg.sum / agg.count) * 100) / 100 : null,
        rating_count: agg?.count ?? 0,
        min_price: own.length ? Math.min(...own.map((o) => o.price_per_session)) : null,
        offering_count: own.length,
        availability_slots: slotMap.get(tid) ?? [],
        offerings: own,
      };
    });

    return cards
      .filter((c) => c.offering_count > 0)
      .filter((c) =>
        !data.category ? true : c.offerings.some((o) => o.category === data.category),
      )
      .filter((c) =>
        !q
          ? true
          : [c.name, c.headline, c.bio, ...c.offerings.map((o) => `${o.title} ${o.category}`)]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(q),
      )
      .filter((c) => (data.maxPrice == null ? true : (c.min_price ?? 0) <= data.maxPrice))
      .filter((c) => (data.minRating == null ? true : (c.avg_score ?? 0) >= data.minRating))
      // Distance first, then rating, then price.
      .sort((a, b) => {
        const da = a.distance_m ?? Infinity;
        const db = b.distance_m ?? Infinity;
        // Bucket by 500 m so near-equal distances fall back to quality/price.
        const ba = Math.floor(da / 500);
        const bb = Math.floor(db / 500);
        if (ba !== bb) return ba - bb;
        const ra = a.avg_score ?? 0;
        const rb = b.avg_score ?? 0;
        if (rb !== ra) return rb - ra;
        return (a.min_price ?? Infinity) - (b.min_price ?? Infinity);
      });
  });

export const getTeacherDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ teacherId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: teacher } = await context.supabase
      .from("teacher_profiles")
      .select(TEACHER_COLS)
      .eq("user_id", data.teacherId)
      .maybeSingle();
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id, name, bio, profile_photo_url, created_at")
      .eq("id", data.teacherId)
      .maybeSingle();
    const { data: offerings } = await context.supabase
      .from("skill_offerings")
      .select(OFFERING_COLS)
      .eq("teacher_id", data.teacherId)
      .eq("is_published", true)
      .order("price_per_session", { ascending: true });
    const { data: rating } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc("user_rating_summary" as any, { _user_id: data.teacherId } as any)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = rating as any;
    return {
      teacher,
      profile,
      offerings: offerings ?? [],
      rating: {
        avg_score: r?.avg_score == null ? null : Number(r.avg_score),
        rating_count: Number(r?.rating_count ?? 0),
      },
    };
  });

/* ---------------------------- Public teacher profile ---------------------------- */

export type TeacherReview = {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  reviewer_name: string | null;
};

export const getTeacherPublicProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ teacherId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { teacherId } = data;

    const [{ data: teacher }, { data: profile }, { data: offerings }] = await Promise.all([
      context.supabase.from("teacher_profiles").select(TEACHER_COLS).eq("user_id", teacherId).maybeSingle(),
      context.supabase
        .from("profiles")
        .select("id, name, bio, profile_photo_url, created_at")
        .eq("id", teacherId)
        .maybeSingle(),
      context.supabase
        .from("skill_offerings")
        .select(OFFERING_COLS)
        .eq("teacher_id", teacherId)
        .eq("is_published", true)
        .order("price_per_session", { ascending: true }),
    ]);

    const { data: reviewRows } = await context.supabase
      .from("ratings")
      .select("id, score, comment, created_at, rater_id")
      .eq("ratee_id", teacherId)
      .order("created_at", { ascending: false })
      .limit(30);

    const raterIds = [...new Set((reviewRows ?? []).map((r) => r.rater_id as string))];
    const { data: raters } = raterIds.length
      ? await context.supabase.from("profiles").select("id, name").in("id", raterIds)
      : { data: [] };
    const nameMap = new Map((raters ?? []).map((p) => [p.id as string, p.name as string | null]));

    const reviews: TeacherReview[] = (reviewRows ?? []).map((r) => ({
      id: r.id as string,
      score: Number(r.score),
      comment: (r.comment as string | null) ?? null,
      created_at: r.created_at as string,
      reviewer_name: nameMap.get(r.rater_id as string) ?? null,
    }));

    const scores = reviews.map((r) => r.score);
    const avg = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : null;

    const { count: sessionsCompleted } = await context.supabase
      .from("skill_bookings")
      .select("id", { count: "exact", head: true })
      .eq("teacher_id", teacherId)
      .eq("status", "completed");

    return {
      teacher,
      profile,
      offerings: offerings ?? [],
      reviews,
      rating: { avg_score: avg, rating_count: reviews.length },
      sessions_completed: sessionsCompleted ?? 0,
      is_me: teacherId === context.userId,
    };
  });

/* --------------------------------- Dashboards --------------------------------- */

export const getTeacherDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("skill_bookings")
      .select(
        "id, status, scheduled_at, price, commission_amount, completed_at, learner_id, offering_id, skill_offerings!inner(title)",
      )
      .eq("teacher_id", context.userId)
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);

    const bookings = rows ?? [];
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const isSame = (d: string, from: Date, to: Date) => {
      const t = new Date(d).getTime();
      return t >= from.getTime() && t < to.getTime();
    };

    const completed = bookings.filter((b) => b.status === "completed");
    const monthlyEarnings = completed
      .filter((b) => b.completed_at && new Date(b.completed_at) >= monthStart)
      .reduce((sum, b) => sum + (Number(b.price) - Number(b.commission_amount ?? 0)), 0);

    const { data: ratings } = await context.supabase
      .from("ratings")
      .select("score")
      .eq("ratee_id", context.userId);
    const scores = (ratings ?? []).map((r) => Number(r.score));

    return {
      today_sessions: bookings.filter(
        (b) =>
          ["confirmed", "requested"].includes(b.status) &&
          isSame(b.scheduled_at, startOfDay, endOfDay),
      ).length,
      upcoming_sessions: bookings.filter(
        (b) => ["confirmed", "requested"].includes(b.status) && new Date(b.scheduled_at) >= now,
      ).length,
      pending_requests: bookings.filter((b) => b.status === "requested").length,
      completed_sessions: completed.length,
      monthly_earnings: Math.round(monthlyEarnings * 100) / 100,
      total_students: new Set(completed.map((b) => b.learner_id as string)).size,
      avg_rating: scores.length
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
        : null,
      rating_count: scores.length,
    };
  });

export const getLearnerDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("skill_bookings")
      .select("id, status, scheduled_at, price, teacher_id, skill_offerings!inner(title, category)")
      .eq("learner_id", context.userId)
      .order("scheduled_at", { ascending: false });
    if (error) throw new Error(error.message);

    const bookings = rows ?? [];
    const now = new Date();
    const teacherIds = [...new Set(bookings.map((b) => b.teacher_id as string))].slice(0, 8);
    const { data: teachers } = teacherIds.length
      ? await context.supabase
          .from("profiles")
          .select("id, name, profile_photo_url")
          .in("id", teacherIds)
      : { data: [] };

    return {
      upcoming: bookings.filter(
        (b) => ["requested", "confirmed"].includes(b.status) && new Date(b.scheduled_at) >= now,
      ).length,
      completed: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled").length,
      recent_teachers: (teachers ?? []).map((t) => ({
        id: t.id as string,
        name: (t.name as string | null) ?? null,
        profile_photo_url: (t.profile_photo_url as string | null) ?? null,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      history: bookings.slice(0, 10).map((b: any) => ({
        id: b.id as string,
        status: b.status as string,
        scheduled_at: b.scheduled_at as string,
        price: Number(b.price),
        title: b.skill_offerings?.title ?? "Session",
        category: b.skill_offerings?.category ?? "other",
      })),
    };
  });