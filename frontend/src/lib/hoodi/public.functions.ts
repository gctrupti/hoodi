import { createServerFn } from "@tanstack/react-start";

/**
 * Public server function used by the landing page to show a live preview of
 * recent open help requests. Returns sanitized fields only — no locations,
 * no requester identity, no personal info. Safe for unauthenticated visitors.
 */
export const listRecentOpenPreview = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("help_requests")
    .select("id, title, category, urgency, is_paid, estimated_fare, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(6);
  if (error) return [] as Array<never>;
  return data ?? [];
});

export const publicStats = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [openCount, completedCount, neighborCount] = await Promise.all([
    supabaseAdmin.from("help_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabaseAdmin.from("help_requests").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
  ]);
  return {
    open: openCount.count ?? 0,
    completed: completedCount.count ?? 0,
    neighbors: neighborCount.count ?? 0,
  };
});