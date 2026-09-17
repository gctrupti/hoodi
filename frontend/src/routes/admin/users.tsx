import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminListUsers, adminSetUserFlags } from "@/lib/hoodi/admin.functions";
import { AdminButton, AdminCard, AdminTable } from "@/components/hoodi/AdminShell";
import { useSessionReady } from "@/hooks/use-session-ready";
import { formatRelative } from "@/lib/hoodi/format";

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "User management — Hoodi admin" },
      { name: "description", content: "Search, suspend, verify and promote Hoodi members." },
      { property: "og:title", content: "User management — Hoodi admin" },
      { property: "og:description", content: "Search, suspend, verify and promote Hoodi members." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const ready = useSessionReady();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const users = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => adminListUsers({ data: { search: search || undefined } }),
    enabled: ready,
  });

  const update = useMutation({
    mutationFn: (v: { userId: string; is_active?: boolean; is_admin?: boolean; phone_verified?: boolean }) =>
      adminSetUserFlags({ data: v }),
    onSuccess: () => {
      toast.success("Member updated.");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-background/55">Suspend, reinstate, verify or promote members.</p>
      </header>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name…"
        className="w-full max-w-sm rounded-xl border border-background/15 bg-background/5 px-3 py-2 text-sm outline-none placeholder:text-background/35 focus:border-background/40"
      />

      <AdminCard>
        {users.isLoading ? (
          <div className="grid place-items-center py-12 text-background/50">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <AdminTable head={["Member", "City", "Joined", "Status", "Actions"]}>
            {(users.data ?? []).map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2.5">
                  <span className="font-medium">{u.name ?? "Member"}</span>
                  {u.is_admin && (
                    <span className="ml-2 rounded-full bg-background/15 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                      admin
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-background/55">{u.city ?? "—"}</td>
                <td className="px-3 py-2.5 text-background/55">{formatRelative(u.created_at)}</td>
                <td className="px-3 py-2.5 text-background/55">
                  {u.is_active ? "Active" : "Suspended"}
                  {u.phone_verified ? " · phone ✓" : ""}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    <AdminButton
                      tone={u.is_active ? "danger" : "primary"}
                      disabled={update.isPending}
                      onClick={() => update.mutate({ userId: u.id, is_active: !u.is_active })}
                    >
                      {u.is_active ? "Suspend" : "Reinstate"}
                    </AdminButton>
                    <AdminButton
                      disabled={update.isPending || u.phone_verified}
                      onClick={() => update.mutate({ userId: u.id, phone_verified: true })}
                    >
                      Verify phone
                    </AdminButton>
                    <AdminButton
                      disabled={update.isPending}
                      onClick={() => update.mutate({ userId: u.id, is_admin: !u.is_admin })}
                    >
                      {u.is_admin ? "Revoke admin" : "Make admin"}
                    </AdminButton>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCard>
    </div>
  );
}
