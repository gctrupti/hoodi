import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Module = z.enum(["help", "skills"]);

/** Approved community categories for a module, plus the caller's pending ones. */
export const listCategorySuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ module: Module }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("category_suggestions")
      .select("id, module, name, note, status, suggested_by, created_at")
      .eq("module", data.module)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return {
      approved: (rows ?? []).filter((r) => r.status === "approved"),
      mine: (rows ?? []).filter((r) => r.suggested_by === context.userId && r.status !== "approved"),
    };
  });

export const suggestCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        module: Module,
        name: z.string().trim().min(2).max(60),
        note: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("category_suggestions")
      .insert({
        module: data.module,
        name: data.name,
        note: data.note ?? null,
        suggested_by: context.userId,
      })
      .select("id, name, status")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const adminListCategorySuggestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", context.userId)
      .maybeSingle();
    if (!prof?.is_admin) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("category_suggestions")
      .select("id, module, name, note, status, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminDecideCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["approved", "rejected"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", context.userId)
      .maybeSingle();
    if (!prof?.is_admin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("category_suggestions")
      .update({ status: data.status, reviewed_by: context.userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });