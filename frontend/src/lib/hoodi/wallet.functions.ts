import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyWallet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("wallets")
      .select("id, user_id, balance, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { id: null, user_id: context.userId, balance: 0, updated_at: null };
  });

export const requestPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ amount: z.number().positive() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: wallet, error: wErr } = await context.supabase
      .from("wallets")
      .select("id, balance")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!wallet) throw new Error("No wallet yet — complete a paid request first.");
    if (Number(wallet.balance) < data.amount) throw new Error("Insufficient wallet balance.");

    const { data: row, error } = await context.supabase
      .from("payouts")
      .insert({ wallet_id: wallet.id, amount: data.amount })
      .select("id, wallet_id, amount, status, requested_at, processed_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyPayouts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("payouts")
      .select("id, wallet_id, amount, status, requested_at, processed_at, wallets!inner(user_id)")
      .eq("wallets.user_id", context.userId)
      .order("requested_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listMyEarnings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("help_requests")
      .select("id, title, category, final_fare, commission_amount, updated_at")
      .eq("helper_id", context.userId)
      .eq("is_paid", true)
      .not("final_fare", "is", null)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const help = (data ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      source: "help" as const,
      completed_at: r.updated_at,
      gross: Number(r.final_fare ?? 0),
      commission: Number(r.commission_amount ?? 0),
      net: Number(r.final_fare ?? 0) - Number(r.commission_amount ?? 0),
    }));

    const { data: bookingRows } = await context.supabase
      .from("skill_bookings")
      .select("id, price, commission_amount, completed_at, updated_at, skill_offerings!inner(title, category)")
      .eq("teacher_id", context.userId)
      .eq("status", "completed")
      .not("commission_amount", "is", null)
      .order("completed_at", { ascending: false })
      .limit(50);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skills = (bookingRows ?? []).map((b: any) => ({
      id: b.id as string,
      title: b.skill_offerings?.title ?? "Session",
      category: b.skill_offerings?.category ?? "other",
      source: "skills" as const,
      completed_at: (b.completed_at ?? b.updated_at) as string,
      gross: Number(b.price ?? 0),
      commission: Number(b.commission_amount ?? 0),
      net: Number(b.price ?? 0) - Number(b.commission_amount ?? 0),
    }));

    return [...help, ...skills].sort(
      (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime(),
    );
  });

/** Balance split into withdrawable (settled) and pending (held payments awaiting release). */
export const getWalletSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: wallet } = await context.supabase
      .from("wallets")
      .select("id, balance, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    const balance = Number(wallet?.balance ?? 0);

    // Money owed to me but still held: bookings I teach + help tasks I accepted, unpaid out.
    const { data: pendingBookings } = await context.supabase
      .from("skill_bookings")
      .select("price, commission_amount, status, payment_id")
      .eq("teacher_id", context.userId)
      .in("status", ["requested", "confirmed", "in_progress", "completed"])
      .not("payment_id", "is", null);

    const paymentIds = (pendingBookings ?? []).map((b) => b.payment_id).filter(Boolean) as string[];
    const { data: payments } = paymentIds.length
      ? await context.supabase.from("payments").select("id, status").in("id", paymentIds)
      : { data: [] };
    const heldIds = new Set(
      (payments ?? []).filter((p) => p.status !== "released" && p.status !== "refunded").map((p) => p.id),
    );

    const pending = (pendingBookings ?? [])
      .filter((b) => b.payment_id && heldIds.has(b.payment_id))
      .reduce((sum, b) => sum + Number(b.price ?? 0), 0);

    const { data: payouts } = await context.supabase
      .from("payouts")
      .select("amount, status, wallets!inner(user_id)")
      .eq("wallets.user_id", context.userId)
      .in("status", ["requested", "approved"]);
    const inPayout = (payouts ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);

    return {
      balance,
      pending: Math.round(pending * 100) / 100,
      in_payout: Math.round(inPayout * 100) / 100,
      withdrawable: Math.round(Math.max(balance - inPayout, 0) * 100) / 100,
      updated_at: wallet?.updated_at ?? null,
    };
  });