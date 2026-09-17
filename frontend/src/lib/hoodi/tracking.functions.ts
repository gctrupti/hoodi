import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { etaMinutes, haversineMeters } from "./admin.server";
import { DELIVERY_STAGES, STAGE_LABELS, type DeliveryStage } from "./tracking";

/** Helper pushes their current position; we derive ETA to the active waypoint. */
export const pushHelperLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        latitude: z.number().gte(-90).lte(90),
        longitude: z.number().gte(-180).lte(180),
        heading: z.number().nullable().optional(),
        speed: z.number().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: req, error: readErr } = await context.supabase
      .from("help_requests")
      .select(
        "id, helper_id, status, delivery_stage, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng",
      )
      .eq("id", data.requestId)
      .single();
    if (readErr) throw new Error(readErr.message);
    if (req.helper_id !== context.userId) throw new Error("Only the assigned helper can share location.");

    const stage = (req.delivery_stage ?? "accepted") as DeliveryStage;
    const wantsPickup = stage === "accepted" || stage === "to_pickup";
    const target =
      wantsPickup && req.pickup_lat != null && req.pickup_lng != null
        ? { lat: Number(req.pickup_lat), lng: Number(req.pickup_lng) }
        : req.dropoff_lat != null && req.dropoff_lng != null
          ? { lat: Number(req.dropoff_lat), lng: Number(req.dropoff_lng) }
          : req.pickup_lat != null && req.pickup_lng != null
            ? { lat: Number(req.pickup_lat), lng: Number(req.pickup_lng) }
            : null;

    const distance = target
      ? haversineMeters({ lat: data.latitude, lng: data.longitude }, target)
      : null;

    const { data: row, error } = await context.supabase
      .from("request_tracking")
      .upsert(
        {
          request_id: data.requestId,
          helper_id: context.userId,
          latitude: data.latitude,
          longitude: data.longitude,
          heading: data.heading ?? null,
          speed: data.speed ?? null,
          distance_meters: distance,
          eta_minutes: distance == null ? null : etaMinutes(distance),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "request_id" },
      )
      .select("request_id, latitude, longitude, heading, eta_minutes, distance_meters, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const getRequestTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("request_tracking")
      .select("request_id, helper_id, latitude, longitude, heading, eta_minutes, distance_meters, updated_at")
      .eq("request_id", data.requestId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

/** Advance the Swiggy-style delivery timeline. Helper-only. */
export const setDeliveryStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ requestId: z.string().uuid(), stage: z.enum(DELIVERY_STAGES) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: req, error: readErr } = await context.supabase
      .from("help_requests")
      .select("id, helper_id, requester_id, title, status")
      .eq("id", data.requestId)
      .single();
    if (readErr) throw new Error(readErr.message);
    if (req.helper_id !== context.userId) throw new Error("Only the assigned helper can update the trip.");

    const patch: Record<string, unknown> = { delivery_stage: data.stage };
    if (data.stage !== "accepted" && req.status === "accepted") patch.status = "in_progress";

    const { error } = await context.supabase
      .from("help_requests")
      .update(patch as never)
      .eq("id", data.requestId);
    if (error) throw new Error(error.message);

    await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc("insert_notification" as any, {
        _user_id: req.requester_id,
        _type: "status_changed",
        _request_id: data.requestId,
        _message: `${req.title}: ${STAGE_LABELS[data.stage]}.`,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

    return { ok: true, stage: data.stage };
  });
