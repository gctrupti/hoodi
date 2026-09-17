import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RateInput = z.object({
  requestId: z.string().uuid(),
  rateeId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const submitRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ratings")
      .insert({
        request_id: data.requestId,
        rater_id: context.userId,
        ratee_id: data.rateeId,
        score: data.score,
        comment: data.comment ?? null,
      })
      .select("id, request_id, rater_id, ratee_id, score, comment, created_at")
      .single();
    if (error) {
      if (error.message.toLowerCase().includes("duplicate")) {
        throw new Error("You have already rated this request.");
      }
      throw new Error(error.message);
    }
    return row;
  });

export const getUserRatingSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .rpc("user_rating_summary" as any, { _user_id: data.userId } as any)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = row as any;
    return {
      avg_score: r?.avg_score == null ? null : Number(r.avg_score),
      rating_count: Number(r?.rating_count ?? 0),
    };
  });