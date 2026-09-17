import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin.server";

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc("admin_overview" as any);
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data as any;
  });

export const adminAmIAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("id, name, is_admin")
      .eq("id", context.userId)
      .maybeSingle();
    return { isAdmin: Boolean(data?.is_admin), name: data?.name ?? null };
  });

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ search: z.string().trim().max(80).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("profiles")
      .select("id, name, phone_verified, is_admin, is_active, city, created_at, profile_photo_url")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.search) q = q.ilike("name", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminSetUserFlags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        is_active: z.boolean().optional(),
        is_admin: z.boolean().optional(),
        phone_verified: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, boolean> = {};
    if (data.is_active !== undefined) patch.is_active = data.is_active;
    if (data.is_admin !== undefined) patch.is_admin = data.is_admin;
    if (data.phone_verified !== undefined) patch.phone_verified = data.phone_verified;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.from("profiles").update(patch as never).eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListTeachers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: teachers, error }, { data: bookings }] = await Promise.all([
      supabaseAdmin
        .from("teacher_profiles")
        .select("user_id, headline, hourly_rate, teaching_mode, city, is_published, experience_years, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("skill_bookings").select("teacher_id, status, price"),
    ]);
    if (error) throw new Error(error.message);
    const ids = (teachers ?? []).map((t) => t.user_id);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, is_active, profile_photo_url")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
    return (teachers ?? []).map((t) => {
      const mine = (bookings ?? []).filter((b) => b.teacher_id === t.user_id);
      return {
        ...t,
        name: pmap.get(t.user_id)?.name ?? "Member",
        photo: pmap.get(t.user_id)?.profile_photo_url ?? null,
        is_active: pmap.get(t.user_id)?.is_active ?? true,
        sessions: mine.filter((b) => b.status === "completed").length,
        earned: mine
          .filter((b) => b.status === "completed")
          .reduce((s, b) => s + Number(b.price ?? 0), 0),
      };
    });
  });

export const adminListHelpers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("help_requests")
      .select("helper_id, status, final_fare")
      .not("helper_id", "is", null)
      .limit(2000);
    if (error) throw new Error(error.message);
    const byHelper = new Map<string, { tasks: number; completed: number; earned: number }>();
    for (const r of rows ?? []) {
      const id = r.helper_id as string;
      const cur = byHelper.get(id) ?? { tasks: 0, completed: 0, earned: 0 };
      cur.tasks += 1;
      if (r.status === "completed") {
        cur.completed += 1;
        cur.earned += Number(r.final_fare ?? 0);
      }
      byHelper.set(id, cur);
    }
    const ids = [...byHelper.keys()];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name, is_active, city, profile_photo_url")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    return (profiles ?? [])
      .map((p) => ({ ...p, ...(byHelper.get(p.id) ?? { tasks: 0, completed: 0, earned: 0 }) }))
      .sort((a, b) => b.completed - a.completed);
  });

/* ------------------------------------------------------------------ */
/* Operations                                                          */
/* ------------------------------------------------------------------ */

export const adminListRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: z.enum(["open", "accepted", "in_progress", "completed", "cancelled"]).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("help_requests")
      .select(
        "id, requester_id, helper_id, title, category, urgency, status, is_paid, estimated_fare, final_fare, commission_amount, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminListBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("skill_bookings")
      .select("id, teacher_id, learner_id, status, price, commission_amount, scheduled_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/* ------------------------------------------------------------------ */
/* Finance                                                             */
/* ------------------------------------------------------------------ */

export const adminFinance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [payments, payouts, wallets] = await Promise.all([
      supabaseAdmin
        .from("payments")
        .select("id, payer_id, amount, status, request_id, booking_id, razorpay_order_id, created_at")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("payouts")
        .select("id, wallet_id, amount, status, requested_at, processed_at")
        .order("requested_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("wallets")
        .select("id, user_id, balance, updated_at")
        .order("balance", { ascending: false })
        .limit(200),
    ]);
    if (payments.error) throw new Error(payments.error.message);
    const walletOwner = new Map((wallets.data ?? []).map((w) => [w.id, w.user_id]));
    const ids = [...new Set((wallets.data ?? []).map((w) => w.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, name")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    const nameOf = new Map((profiles ?? []).map((p) => [p.id, p.name ?? "Member"]));
    return {
      payments: payments.data ?? [],
      payouts: (payouts.data ?? []).map((p) => ({
        ...p,
        user_id: walletOwner.get(p.wallet_id) ?? null,
        name: nameOf.get(walletOwner.get(p.wallet_id) ?? "") ?? "Member",
      })),
      wallets: (wallets.data ?? []).map((w) => ({ ...w, name: nameOf.get(w.user_id) ?? "Member" })),
    };
  });

export const adminSetPayoutStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        payoutId: z.string().uuid(),
        newStatus: z.enum(["requested", "approved", "rejected", "paid"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc("admin_set_payout_status" as any, {
        _payout_id: data.payoutId,
        _new_status: data.newStatus,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    if (error) throw new Error(error.message);
    return row;
  });

/* ------------------------------------------------------------------ */
/* Settings, pricing, announcements                                    */
/* ------------------------------------------------------------------ */

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [settings, pricing, announcements] = await Promise.all([
      supabaseAdmin.from("platform_settings").select("key, value, updated_at"),
      supabaseAdmin.from("pricing_rules").select("id, category, base_fee, rate_per_km, commission_rate").order("category"),
      supabaseAdmin
        .from("announcements")
        .select("id, title, body, audience, is_active, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    return {
      settings: settings.data ?? [],
      pricing: pricing.data ?? [],
      announcements: announcements.data ?? [],
    };
  });

export const adminSetSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ key: z.string().min(1).max(60), value: z.record(z.string(), z.unknown()) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("platform_settings")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .upsert({ key: data.key, value: data.value as any }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminUpdatePricingRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        base_fee: z.number().min(0).max(100000),
        rate_per_km: z.number().min(0).max(10000),
        commission_rate: z.number().min(0).max(0.5),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("pricing_rules")
      .update({
        base_fee: data.base_fee,
        rate_per_km: data.rate_per_km,
        commission_rate: data.commission_rate,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSaveAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        title: z.string().trim().min(2).max(120),
        body: z.string().trim().min(2).max(1000),
        audience: z.enum(["all", "help", "skills"]).default("all"),
        is_active: z.boolean().default(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      title: data.title,
      body: data.body,
      audience: data.audience,
      is_active: data.is_active,
      created_by: context.userId,
    };
    const { error } = data.id
      ? await supabaseAdmin.from("announcements").update(payload).eq("id", data.id)
      : await supabaseAdmin.from("announcements").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
