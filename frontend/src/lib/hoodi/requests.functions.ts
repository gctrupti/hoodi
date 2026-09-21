import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CATEGORIES = ["grocery", "elderly_care", "transportation", "errand", "first_aid", "other"] as const;
const URGENCIES = ["normal", "today", "emergency"] as const;
const CATEGORY_ENUM = z.enum(CATEGORIES);
const URGENCY_ENUM = z.enum(URGENCIES);

type Category = (typeof CATEGORIES)[number];
type Urgency = (typeof URGENCIES)[number];

const REQUEST_COLUMNS =
  "id, requester_id, helper_id, title, description, category, urgency, status, request_type, pickup_name, pickup_address, pickup_lat, pickup_lng, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, ai_suggested_category, ai_suggested_urgency, ai_confidence, is_paid, estimated_fare, final_fare, commission_amount, payment_id, photo_url, address_text, accepted_at, completed_at, cancelled_at, created_at, updated_at";

const REQUEST_TYPES = [
  "pickup_delivery",
  "home_assistance",
  "transportation",
  "elder_care",
  "custom",
] as const;

const CreateRequestInput = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional().default(""),
  category: CATEGORY_ENUM.optional(),
  urgency: URGENCY_ENUM.optional(),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  address_text: z.string().max(500).optional(),
  photo_url: z.string().url().optional(),
  request_type: z.enum(REQUEST_TYPES).optional().default("custom"),
  pickup_name: z.string().max(200).nullable().optional(),
  pickup_address: z.string().max(500).nullable().optional(),
  pickup_lat: z.number().gte(-90).lte(90).nullable().optional(),
  pickup_lng: z.number().gte(-180).lte(180).nullable().optional(),
  dropoff_name: z.string().max(200).nullable().optional(),
  dropoff_address: z.string().max(500).nullable().optional(),
  dropoff_lat: z.number().gte(-90).lte(90).nullable().optional(),
  dropoff_lng: z.number().gte(-180).lte(180).nullable().optional(),
});

async function classifyRequest(title: string, description: string): Promise<{
  category: Category;
  urgency: Urgency;
  confidence: number;
}> {
  try {
    const { getAiModel } = await import("@/lib/ai-provider.server");
    const model = getAiModel();
    if (!model) return { category: "other", urgency: "normal", confidence: 0 };
    const schema = z.object({
      category: CATEGORY_ENUM,
      urgency: URGENCY_ENUM,
      confidence: z.number().min(0).max(1),
    });
    const { output } = await generateText({
      model,
      output: Output.object({ schema }),
      prompt:
        "Classify this hyperlocal help request into a category and urgency.\n" +
        `Title: ${title}\nDescription: ${description || "(none)"}\n\n` +
        `Valid categories: ${CATEGORIES.join(", ")}.\n` +
        `Valid urgency levels: ${URGENCIES.join(", ")}. ` +
        `Use "emergency" only for life/safety-critical situations (medical, injury, fire). ` +
        `Use "today" if it must be done today. Otherwise use "normal". ` +
        `Return confidence 0..1.`,
    });
    return output;
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      console.warn("AI classification failed, falling back:", err.message);
    } else {
      console.warn("AI classification error:", err);
    }
    return { category: "other", urgency: "normal", confidence: 0 };
  }
}

export const createHelpRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateRequestInput.parse(input))
  .handler(async ({ data, context }) => {
    const ai = await classifyRequest(data.title, data.description);
    const category: Category = data.category ?? ai.category;
    const urgency: Urgency = data.urgency ?? ai.urgency;

    // Fare calc — server-side only.
    let isPaid = true;
    let estimatedFare: number | null = null;
    if (urgency === "emergency") {
      isPaid = false;
    } else {
      const { data: rule } = await context.supabase
        .from("pricing_rules")
        .select("base_fee")
        .eq("category", category)
        .maybeSingle();
      estimatedFare = rule ? Number(rule.base_fee) : 50;
    }

    const wkt = `SRID=4326;POINT(${data.lng} ${data.lat})`;
    const { data: row, error } = await context.supabase
      .from("help_requests")
      .insert({
        requester_id: context.userId,
        title: data.title,
        description: data.description,
        category,
        urgency,
        ai_suggested_category: ai.category,
        ai_suggested_urgency: ai.urgency,
        ai_confidence: ai.confidence,
        is_paid: isPaid,
        estimated_fare: estimatedFare,
        photo_url: data.photo_url ?? null,
        address_text: data.address_text ?? null,
        request_type: data.request_type,
        pickup_name: data.pickup_name ?? null,
        pickup_address: data.pickup_address ?? null,
        pickup_lat: data.pickup_lat ?? null,
        pickup_lng: data.pickup_lng ?? null,
        dropoff_name: data.dropoff_name ?? null,
        dropoff_address: data.dropoff_address ?? null,
        dropoff_lat: data.dropoff_lat ?? null,
        dropoff_lng: data.dropoff_lng ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        location: wkt as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select(REQUEST_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const NearbyInput = z.object({
  lat: z.number(),
  lng: z.number(),
  radius_m: z.number().int().min(100).max(50000).optional().default(5000),
  category: CATEGORY_ENUM.nullable().optional(),
  urgency: URGENCY_ENUM.nullable().optional(),
});

export const listNearbyRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => NearbyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc("nearby_open_requests" as any, {
        _lat: data.lat,
        _lng: data.lng,
        _radius_m: data.radius_m,
        _category: data.category ?? null,
        _urgency: data.urgency ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const acceptRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Generate the simulated Razorpay order id server-side.
    const simOrderId = `sim_order_${crypto.randomUUID()}`;
    const { data: rows, error } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc("accept_help_request" as any, { _request_id: data.requestId, _order_id: simOrderId } as any);
    if (error) {
      if (error.message.includes("request_not_available")) {
        throw new Error(
          "This request can't be accepted. It may already be accepted/closed, or you're signed in as the requester (you can't accept your own request — use the 'Seed second test user' button and sign in as that helper in another window).",
        );
      }
      if (error.message.includes("not_authenticated")) {
        throw new Error("Not signed in.");
      }
      throw new Error(error.message);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = Array.isArray(rows) ? (rows[0] as any) : (rows as any);
    return {
      request_id: result?.request_id as string,
      payment_id: (result?.payment_id ?? null) as string | null,
      chat_thread_id: result?.chat_thread_id as string,
      is_paid: Boolean(result?.is_paid),
      amount: result?.amount == null ? null : Number(result.amount),
    };
  });

const StatusInput = z.object({
  requestId: z.string().uuid(),
  newStatus: z.enum(["in_progress", "completed", "cancelled"]),
});

export const updateRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const patch: {
      status: "in_progress" | "completed" | "cancelled";
      completed_at?: string;
      cancelled_at?: string;
    } = { status: data.newStatus };
    if (data.newStatus === "completed") patch.completed_at = new Date().toISOString();
    if (data.newStatus === "cancelled") patch.cancelled_at = new Date().toISOString();

    // Load the request first to know parties and payment state.
    const { data: existing, error: readErr } = await context.supabase
      .from("help_requests")
      .select(
        "id, requester_id, helper_id, status, is_paid, payment_id, urgency, title",
      )
      .eq("id", data.requestId)
      .single();
    if (readErr) throw new Error(readErr.message);
    if (existing.requester_id !== context.userId && existing.helper_id !== context.userId) {
      throw new Error("Forbidden");
    }

    const { data: row, error } = await context.supabase
      .from("help_requests")
      .update(patch)
      .eq("id", data.requestId)
      .select(REQUEST_COLUMNS)
      .single();
    if (error) throw new Error(error.message);

    // Notify the counter-party.
    const otherId =
      context.userId === existing.requester_id ? existing.helper_id : existing.requester_id;
    if (otherId) {
      await context.supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .rpc("insert_notification" as any, {
          _user_id: otherId,
          _type: "status_changed",
          _request_id: data.requestId,
          _message: `Request "${existing.title}" is now ${data.newStatus}.`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
    }

    return {
      request: row,
      needsPaymentCapture:
        data.newStatus === "completed" &&
        Boolean(existing.is_paid) &&
        Boolean(existing.payment_id),
      paymentId: existing.payment_id as string | null,
    };
  });

export const deleteRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error, count } = await context.supabase
      .from("help_requests")
      .delete({ count: "exact" })
      .eq("id", data.requestId)
      .eq("requester_id", context.userId)
      .eq("status", "open");
    if (error) throw new Error(error.message);
    if (!count) throw new Error("Request cannot be deleted (not yours or not open).");
    return { ok: true };
  });

export const getRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("help_requests")
      .select(REQUEST_COLUMNS)
      .eq("id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const listMyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("help_requests")
      .select(REQUEST_COLUMNS)
      .or(`requester_id.eq.${context.userId},helper_id.eq.${context.userId}`)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listAvailableCommunityRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("help_requests")
      .select(REQUEST_COLUMNS)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });