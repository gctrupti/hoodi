import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BOOKING_COLS =
  "id, offering_id, teacher_id, learner_id, scheduled_at, duration_minutes, price, commission_amount, status, notes, payment_id, cancelled_by, cancelled_at, completed_at, created_at, updated_at";

type NotifyType =
  | "booking_requested"
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_completed"
  | "session_reminder";

async function notifyBooking(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  type: NotifyType,
  bookingId: string,
  message: string,
) {
  await supabase.rpc("insert_booking_notification", {
    _user_id: userId,
    _type: type,
    _booking_id: bookingId,
    _message: message,
  });
}

/* ---------------------------------- Booking ---------------------------------- */

const BookInput = z.object({
  offeringId: z.string().uuid(),
  scheduledAt: z.string().min(4),
  // Local-time slot the learner tapped (server runs in UTC, so it cannot derive these).
  slotDay: z.number().int().min(0).max(6).optional(),
  slotStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  notes: z.string().max(1000).optional(),
});

export const bookSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BookInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: offering, error: oErr } = await context.supabase
      .from("skill_offerings")
      .select("id, teacher_id, title, price_per_session, duration_minutes, is_published")
      .eq("id", data.offeringId)
      .maybeSingle();
    if (oErr) throw new Error(oErr.message);
    if (!offering || !offering.is_published) throw new Error("This skill is no longer available.");
    if (offering.teacher_id === context.userId) throw new Error("You cannot book your own skill.");

    const when = new Date(data.scheduledAt);
    if (Number.isNaN(when.getTime())) throw new Error("Pick a valid date and time.");
    if (when.getTime() < Date.now()) throw new Error("Pick a time in the future.");

    // Structured availability: when the teacher published slots, the request must match one.
    const { data: tp } = await context.supabase
      .from("teacher_profiles")
      .select("availability_slots")
      .eq("user_id", offering.teacher_id)
      .maybeSingle();
    const slots = (Array.isArray(tp?.availability_slots) ? tp!.availability_slots : []) as {
      day: number;
      start: string;
      end: string;
    }[];
    if (slots.length > 0 && data.slotDay != null && data.slotStart) {
      const match = slots.some((s) => s.day === data.slotDay && s.start === data.slotStart);
      if (!match) throw new Error("That time isn't in this teacher's availability.");
    }

    // One booking per teacher time slot.
    const { data: clash } = await context.supabase
      .from("skill_bookings")
      .select("id")
      .eq("teacher_id", offering.teacher_id)
      .eq("scheduled_at", when.toISOString())
      .in("status", ["requested", "confirmed", "in_progress"])
      .maybeSingle();
    if (clash) throw new Error("That slot has just been taken. Please pick another time.");

    const { data: booking, error } = await context.supabase
      .from("skill_bookings")
      .insert({
        offering_id: offering.id,
        teacher_id: offering.teacher_id,
        learner_id: context.userId,
        scheduled_at: when.toISOString(),
        duration_minutes: offering.duration_minutes,
        price: offering.price_per_session,
        notes: data.notes ?? null,
      })
      .select(BOOKING_COLS)
      .single();
    if (error) throw new Error(error.message);

    // Shared chat thread, same tables as Hoodi Help.
    await context.supabase.from("chat_threads").insert({ booking_id: booking.id });

    // Payment is held until the session is completed (same model as Help).
    if (Number(offering.price_per_session) > 0) {
      // payments is write-protected by RLS; create the held row through the privileged
      // client after the booking above has been authorised as this learner.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: payment } = await supabaseAdmin
        .from("payments")
        .insert({
          booking_id: booking.id,
          payer_id: context.userId,
          amount: offering.price_per_session,
          razorpay_order_id: `sim_order_${crypto.randomUUID()}`,
        })
        .select("id")
        .single();
      if (payment) {
        await context.supabase
          .from("skill_bookings")
          .update({ payment_id: payment.id })
          .eq("id", booking.id);
        booking.payment_id = payment.id;
      }
    }

    await notifyBooking(
      context.supabase,
      offering.teacher_id,
      "booking_requested",
      booking.id,
      `New session request for "${offering.title}"`,
    );
    return booking;
  });

const StatusInput = z.object({ bookingId: z.string().uuid() });

export const confirmBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("skill_bookings")
      .update({ status: "confirmed" })
      .eq("id", data.bookingId)
      .eq("teacher_id", context.userId)
      .eq("status", "requested")
      .select(BOOKING_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Only the teacher can confirm a pending request.");
    await notifyBooking(
      context.supabase,
      row.learner_id,
      "booking_confirmed",
      row.id,
      "Your session was confirmed.",
    );
    return row;
  });

export const cancelBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    StatusInput.extend({ reason: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("skill_bookings")
      .update({
        status: "cancelled",
        cancelled_by: context.userId,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", data.bookingId)
      .in("status", ["requested", "confirmed"])
      .select(BOOKING_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("This session can no longer be cancelled.");

    if (row.payment_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("payments")
        .update({ status: "refunded" })
        .eq("id", row.payment_id);
    }

    const other = row.learner_id === context.userId ? row.teacher_id : row.learner_id;
    await notifyBooking(
      context.supabase,
      other,
      "booking_cancelled",
      row.id,
      data.reason ? `Session cancelled: ${data.reason}` : "A session was cancelled.",
    );
    return row;
  });

export const startSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("skill_bookings")
      .update({ status: "in_progress" })
      .eq("id", data.bookingId)
      .eq("status", "confirmed")
      .or(`learner_id.eq.${context.userId},teacher_id.eq.${context.userId}`)
      .select(BOOKING_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Only a confirmed session can be started.");
    return row;
  });

export const completeBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("skill_bookings")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", data.bookingId)
      .in("status", ["confirmed", "in_progress"])
      .select(BOOKING_COLS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Only a confirmed or in-progress session can be marked complete.");
    const other = row.learner_id === context.userId ? row.teacher_id : row.learner_id;
    await notifyBooking(
      context.supabase,
      other,
      "booking_completed",
      row.id,
      "A session was marked complete.",
    );
    return row;
  });

/** Releases the held session payment to the teacher's wallet, minus commission. */
export const releaseBookingPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: booking, error } = await context.supabase
      .from("skill_bookings")
      .select("id, learner_id, teacher_id, status, payment_id")
      .eq("id", data.bookingId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!booking) throw new Error("Session not found.");
    if (booking.learner_id !== context.userId && booking.teacher_id !== context.userId) {
      throw new Error("Forbidden");
    }
    if (booking.status !== "completed") throw new Error("Complete the session first.");
    if (!booking.payment_id) throw new Error("This session had no payment attached.");

    // Privileged wallet/commission math — admin client only, after the check above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error: rpcErr } = await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc("capture_booking_payment" as any, {
        _payment_id: booking.payment_id,
        _external_payment_id: `sim_pay_${crypto.randomUUID()}`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    if (rpcErr) throw new Error(rpcErr.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (Array.isArray(rows) ? rows[0] : rows) as any;
    return {
      payment_id: result?.payment_id as string,
      booking_id: result?.booking_id as string,
      amount: Number(result?.amount ?? 0),
      commission: Number(result?.commission ?? 0),
      teacher_credit: Number(result?.teacher_credit ?? 0),
      wallet_balance: Number(result?.wallet_balance ?? 0),
    };
  });

/* ----------------------------------- Lists ----------------------------------- */

export type BookingRow = {
  id: string;
  status: string;
  scheduled_at: string;
  duration_minutes: number;
  price: number;
  commission_amount: number | null;
  notes: string | null;
  payment_id: string | null;
  completed_at: string | null;
  role: "learner" | "teacher";
  counterparty_id: string;
  counterparty_name: string | null;
  offering_title: string;
  offering_category: string;
  payment_status: string | null;
  my_rating: number | null;
};

export const listMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BookingRow[]> => {
    const { data, error } = await context.supabase
      .from("skill_bookings")
      .select(
        `${BOOKING_COLS}, skill_offerings!inner(title, category), learner:profiles!skill_bookings_learner_id_fkey(id, name), teacher:profiles!skill_bookings_teacher_id_fkey(id, name)`,
      )
      .or(`learner_id.eq.${context.userId},teacher_id.eq.${context.userId}`)
      .order("scheduled_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const paymentIds = rows.map((r) => r.payment_id).filter(Boolean) as string[];
    const bookingIds = rows.map((r) => r.id);

    const { data: payments } = paymentIds.length
      ? await context.supabase.from("payments").select("id, status").in("id", paymentIds)
      : { data: [] };
    const { data: myRatings } = bookingIds.length
      ? await context.supabase
          .from("ratings")
          .select("booking_id, score")
          .eq("rater_id", context.userId)
          .in("booking_id", bookingIds)
      : { data: [] };

    const payMap = new Map((payments ?? []).map((p) => [p.id, p.status as string]));
    const rateMap = new Map((myRatings ?? []).map((r) => [r.booking_id as string, r.score]));

    return rows.map((r) => {
      const isLearner = r.learner_id === context.userId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = r as any;
      const counter = isLearner ? row.teacher : row.learner;
      return {
        id: r.id,
        status: r.status as string,
        scheduled_at: r.scheduled_at,
        duration_minutes: r.duration_minutes,
        price: Number(r.price),
        commission_amount: r.commission_amount == null ? null : Number(r.commission_amount),
        notes: r.notes,
        payment_id: r.payment_id,
        completed_at: r.completed_at,
        role: isLearner ? "learner" : "teacher",
        counterparty_id: isLearner ? r.teacher_id : r.learner_id,
        counterparty_name: counter?.name ?? null,
        offering_title: row.skill_offerings?.title ?? "Session",
        offering_category: row.skill_offerings?.category ?? "other",
        payment_status: r.payment_id ? (payMap.get(r.payment_id) ?? null) : null,
        my_rating: rateMap.get(r.id) ?? null,
      };
    });
  });

/** Shared ratings system, scoped to a completed session. */
export const rateSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        bookingId: z.string().uuid(),
        rateeId: z.string().uuid(),
        score: z.number().int().min(1).max(5),
        comment: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ratings")
      .insert({
        booking_id: data.bookingId,
        rater_id: context.userId,
        ratee_id: data.rateeId,
        score: data.score,
        comment: data.comment ?? null,
      })
      .select("id, booking_id, rater_id, ratee_id, score, comment, created_at")
      .single();
    if (error) {
      if (error.message.toLowerCase().includes("duplicate")) {
        throw new Error("You have already rated this session.");
      }
      throw new Error(error.message);
    }
    return row;
  });