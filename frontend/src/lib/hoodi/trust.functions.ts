import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TrustSummary = {
  email_verified: boolean;
  phone_verified: boolean;
  id_verified: boolean;
  selfie_verified: boolean;
  is_verified: boolean;
  helps_completed: number;
  sessions_taught: number;
  avg_score: number | null;
  rating_count: number;
  badges: string[];
};

const EMPTY_TRUST: TrustSummary = {
  email_verified: false,
  phone_verified: false,
  id_verified: false,
  selfie_verified: false,
  is_verified: false,
  helps_completed: 0,
  sessions_taught: 0,
  avg_score: null,
  rating_count: 0,
  badges: [],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toTrust(row: any): TrustSummary {
  if (!row) return EMPTY_TRUST;
  return {
    email_verified: Boolean(row.email_verified),
    phone_verified: Boolean(row.phone_verified),
    id_verified: Boolean(row.id_verified),
    selfie_verified: Boolean(row.selfie_verified),
    is_verified: Boolean(row.is_verified),
    helps_completed: Number(row.helps_completed ?? 0),
    sessions_taught: Number(row.sessions_taught ?? 0),
    avg_score: row.avg_score == null ? null : Number(row.avg_score),
    rating_count: Number(row.rating_count ?? 0),
    badges: (row.badges ?? []) as string[],
  };
}

/** Verification state + earned badges for one person (defaults to the caller). */
export const getTrust = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const uid = data.userId ?? context.userId;
    const { data: row } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc("user_trust" as any, { _user_id: uid } as any)
      .single();
    return toTrust(row);
  });

/** Badges for many people at once — used by feeds and card lists. */
export const getTrustBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userIds: z.array(z.string().uuid()).max(60) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const ids = [...new Set(data.userIds)];
    const entries = await Promise.all(
      ids.map(async (id) => {
        const { data: row } = await context.supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .rpc("user_trust" as any, { _user_id: id } as any)
          .single();
        return [id, toTrust(row)] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<string, TrustSummary>;
  });

/**
 * Phone number of the other party, revealed by the database only after a help
 * request is accepted or a booking is confirmed. Returns null before that.
 */
export const getCounterpartyPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: phone, error } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc("counterparty_phone" as any, { _other_id: data.userId } as any);
    if (error) throw new Error(error.message);
    return { phone: (phone as string | null) ?? null };
  });

export const listMyVerifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_verifications")
      .select("id, kind, status, submitted_value, review_note, reviewed_at, created_at")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const SubmitInput = z.object({
  kind: z.enum(["email", "phone", "government_id", "selfie"]),
  documentPath: z.string().max(400).nullable().optional(),
  submittedValue: z.string().max(200).nullable().optional(),
});

/** Submit (or re-submit) a verification. Always lands as pending for admin review. */
export const submitVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.kind === "government_id" && !data.documentPath) {
      throw new Error("Upload a document image before submitting ID verification.");
    }
    const { data: row, error } = await context.supabase
      .from("user_verifications")
      .upsert(
        {
          user_id: context.userId,
          kind: data.kind,
          status: "pending" as const,
          document_path: data.documentPath ?? null,
          submitted_value: data.submittedValue ?? null,
          review_note: null,
          reviewed_by: null,
          reviewed_at: null,
        },
        { onConflict: "user_id,kind" },
      )
      .select("id, kind, status, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/* ---------------- reports & blocks ---------------- */

export const REPORT_REASONS = [
  "fake_profile",
  "abuse",
  "spam",
  "harassment",
  "scam",
  "unsafe_behaviour",
  "other",
] as const;

const ReportInput = z.object({
  targetUserId: z.string().uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
  contextType: z.enum(["help_request", "skill_booking", "chat", "profile"]).optional(),
  contextId: z.string().uuid().optional(),
});

export const reportUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReportInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.targetUserId === context.userId) throw new Error("You cannot report yourself.");
    const { error } = await context.supabase.from("user_reports").insert({
      reporter_id: context.userId,
      target_user_id: data.targetUserId,
      reason: data.reason,
      details: data.details ?? null,
      context_type: data.contextType ?? null,
      context_id: data.contextId ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const blockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ targetUserId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.targetUserId === context.userId) throw new Error("You cannot block yourself.");
    const { error } = await context.supabase
      .from("user_blocks")
      .insert({ blocker_id: context.userId, blocked_id: data.targetUserId });
    if (error && !error.message.toLowerCase().includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });

export const unblockUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ targetUserId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", context.userId)
      .eq("blocked_id", data.targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listMyBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("user_blocks")
      .select("blocked_id, created_at")
      .eq("blocker_id", context.userId);
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.blocked_id);
    if (!ids.length) return [];
    const { data: people } = await context.supabase
      .from("profiles")
      .select("id, name, profile_photo_url")
      .in("id", ids);
    const byId = new Map((people ?? []).map((p) => [p.id, p]));
    return (rows ?? []).map((r) => ({
      blocked_id: r.blocked_id,
      created_at: r.created_at,
      name: byId.get(r.blocked_id)?.name ?? "Neighbor",
      photo: byId.get(r.blocked_id)?.profile_photo_url ?? null,
    }));
  });

/* ---------------- admin review ---------------- */

async function assertAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
) {
  const { data } = await supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle();
  if (!data?.is_admin) throw new Error("Forbidden");
}

export const adminListVerifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("user_verifications")
      .select("id, user_id, kind, status, document_path, submitted_value, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
    const { data: people } = ids.length
      ? await context.supabase.from("profiles").select("id, name").in("id", ids)
      : { data: [] };
    const byId = new Map((people ?? []).map((p) => [p.id, p.name]));
    return (rows ?? []).map((r) => ({ ...r, name: byId.get(r.user_id) ?? "Neighbor" }));
  });

/** Short-lived signed link to a submitted ID document — admins only. */
export const adminVerificationDocUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("user_verifications")
      .select("document_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!row?.document_path) return { url: null as string | null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("verification-docs")
      .createSignedUrl(row.document_path, 300);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl ?? null };
  });

export const adminDecideVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["verified", "rejected"]),
        note: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("user_verifications")
      .update({
        status: data.status,
        review_note: data.note ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select("id, user_id, kind, status")
      .single();
    if (error) throw new Error(error.message);
    if (row?.kind === "phone" && data.status === "verified") {
      await context.supabase.from("profiles").update({ phone_verified: true }).eq("id", row.user_id);
    }
    return row;
  });

export const adminListReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("user_reports")
      .select("id, reporter_id, target_user_id, reason, details, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = [...new Set((rows ?? []).flatMap((r) => [r.reporter_id, r.target_user_id]))];
    const { data: people } = ids.length
      ? await context.supabase.from("profiles").select("id, name").in("id", ids)
      : { data: [] };
    const byId = new Map((people ?? []).map((p) => [p.id, p.name]));
    return (rows ?? []).map((r) => ({
      ...r,
      reporter_name: byId.get(r.reporter_id) ?? "Neighbor",
      target_name: byId.get(r.target_user_id) ?? "Neighbor",
    }));
  });

export const adminResolveReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["reviewing", "actioned", "dismissed"]),
        note: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("user_reports")
      .update({
        status: data.status,
        resolution_note: data.note ?? null,
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });