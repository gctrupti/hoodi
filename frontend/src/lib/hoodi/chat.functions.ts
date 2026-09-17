import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SendInput = z.object({
  threadId: z.string().uuid(),
  content: z.string().min(1).max(4000),
});

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SendInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: msg, error } = await context.supabase
      .from("chat_messages")
      .insert({
        thread_id: data.threadId,
        sender_id: context.userId,
        content: data.content,
      })
      .select("id, thread_id, sender_id, content, read_at, created_at")
      .single();
    if (error) throw new Error(error.message);

    const { data: thread } = await context.supabase
      .from("chat_threads")
      .select("request_id, booking_id")
      .eq("id", data.threadId)
      .single();
    if (thread?.booking_id) {
      const { data: bk } = await context.supabase
        .from("skill_bookings")
        .select("learner_id, teacher_id")
        .eq("id", thread.booking_id)
        .single();
      const otherId = bk && (bk.learner_id === context.userId ? bk.teacher_id : bk.learner_id);
      if (otherId) {
        await context.supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .rpc("insert_booking_notification" as any, {
            _user_id: otherId,
            _type: "new_message",
            _booking_id: thread.booking_id,
            _message: "New message about your skill session",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
      }
    } else if (thread?.request_id) {
      const { data: req } = await context.supabase
        .from("help_requests")
        .select("requester_id, helper_id, title")
        .eq("id", thread.request_id)
        .single();
      const otherId =
        req && (req.requester_id === context.userId ? req.helper_id : req.requester_id);
      if (otherId) {
        await context.supabase
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .rpc("insert_notification" as any, {
            _user_id: otherId,
            _type: "new_message",
            _request_id: thread.request_id,
            _message: `New message on "${req?.title ?? "your request"}"`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any);
      }
    }
    return msg;
  });

const ListInput = z.object({
  threadId: z.string().uuid(),
  limit: z.number().int().min(1).max(200).optional().default(100),
});

export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("chat_messages")
      .select("id, thread_id, sender_id, content, read_at, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getThreadForRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ requestId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("chat_threads")
      .select("id, request_id, created_at")
      .eq("request_id", data.requestId)
      .maybeSingle();
    return row;
  });

/** Shared chat, reused for skill bookings: returns (and lazily creates) the booking thread. */
export const getThreadForBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bookingId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("chat_threads")
      .select("id, booking_id, created_at")
      .eq("booking_id", data.bookingId)
      .maybeSingle();
    if (existing) return existing;

    const { data: created, error } = await context.supabase
      .from("chat_threads")
      .insert({ booking_id: data.bookingId })
      .select("id, booking_id, created_at")
      .single();
    if (error) throw new Error(error.message);
    return created;
  });