import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/hoodi/AdminShell";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (location.pathname.startsWith("/admin/login")) return;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/admin/login" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!profile?.is_admin) throw redirect({ to: "/admin/login", search: { denied: "1" } });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = Route.useMatch().pathname;
  if (pathname.startsWith("/admin/login")) return <Outlet />;
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}
