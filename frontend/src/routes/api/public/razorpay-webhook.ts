import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Razorpay webhook — DORMANT.
 *
 * The money logic (payment release, commission calc, wallet credit) lives in
 * the `capture_payment` database RPC. This route verifies Razorpay's signature
 * and calls that RPC. To go live: add `RAZORPAY_WEBHOOK_SECRET`,
 * `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET` as project secrets and point the
 * Razorpay dashboard webhook here. No money math changes.
 */
function verifySignature(body: string, signatureHeader: string, secret: string): boolean {
  try {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const sig = Buffer.from(signatureHeader);
    const exp = Buffer.from(expected);
    return sig.length === exp.length && timingSafeEqual(sig, exp);
  } catch {
    return false;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findOrderId(payload: any): string | null {
  return (
    payload?.payload?.payment?.entity?.order_id ??
    payload?.payload?.order?.entity?.id ??
    null
  );
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findPaymentId(payload: any): string | null {
  return payload?.payload?.payment?.entity?.id ?? null;
}

export const Route = createFileRoute("/api/public/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) {
          return new Response(
            JSON.stringify({ ok: false, error: "razorpay_webhook_not_configured" }),
            { status: 503, headers: { "Content-Type": "application/json" } },
          );
        }

        const rawBody = await request.text();
        const signature = request.headers.get("x-razorpay-signature") ?? "";
        if (!signature || !verifySignature(rawBody, signature, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const event: string = payload?.event ?? "";
        if (event !== "payment.captured") {
          return new Response(JSON.stringify({ ok: true, ignored: event }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const orderId = findOrderId(payload);
        const razorpayPaymentId = findPaymentId(payload);
        if (!orderId) return new Response("Missing order_id", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: pay } = await supabaseAdmin
          .from("payments")
          .select("id")
          .eq("razorpay_order_id", orderId)
          .maybeSingle();
        if (!pay) return new Response("Payment not found", { status: 404 });

        const { error } = await supabaseAdmin
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .rpc("capture_payment" as any, {
            _payment_id: pay.id,
            _razorpay_payment_id: razorpayPaymentId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
        if (error) {
          console.error("[razorpay-webhook] capture_payment failed:", error);
          return new Response("Capture failed", { status: 500 });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});