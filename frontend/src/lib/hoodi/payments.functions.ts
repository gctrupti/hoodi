import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Simulates the Razorpay `payment.captured` webhook by calling the same atomic
 * `capture_payment` RPC the real webhook would call. Swap this for the webhook
 * without changing any money logic.
 */
const SimulateInput = z.object({ requestId: z.string().uuid() });

export const simulateCapturePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SimulateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: req, error: reqErr } = await context.supabase
      .from("help_requests")
      .select("id, requester_id, helper_id, is_paid, payment_id, status")
      .eq("id", data.requestId)
      .single();
    if (reqErr) throw new Error(reqErr.message);
    if (!req.is_paid) throw new Error("This request is free — no payment to capture.");
    if (!req.payment_id) throw new Error("No payment attached to this request.");
    if (req.requester_id !== context.userId && req.helper_id !== context.userId) {
      throw new Error("Forbidden");
    }

    const fakePaymentId = `sim_pay_${crypto.randomUUID()}`;
    // capture_payment is privileged (wallet/commission math); only the admin
    // client has EXECUTE on it. Authorization is enforced above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc("capture_payment" as any, {
        _payment_id: req.payment_id,
        _razorpay_payment_id: fakePaymentId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = Array.isArray(rows) ? (rows[0] as any) : (rows as any);
    return {
      payment_id: result?.payment_id as string,
      request_id: result?.request_id as string,
      amount: Number(result?.amount ?? 0),
      commission: Number(result?.commission ?? 0),
      helper_credit: Number(result?.helper_credit ?? 0),
      helper_id: result?.helper_id as string,
      wallet_balance: Number(result?.wallet_balance ?? 0),
    };
  });

export const listMyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("payments")
      .select("id, request_id, payer_id, razorpay_order_id, razorpay_payment_id, amount, status, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });