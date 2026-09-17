import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminListHelpers, adminSetUserFlags } from "@/lib/hoodi/admin.functions";
import { AdminButton, AdminCard, AdminTable } from "@/components/hoodi/AdminShell";
import { useSessionReady } from "@/hooks/use-session-ready";

export const Route = createFileRoute("/admin/helpers")({
  head: () => ({
    meta: [
      { title: "Helper management — Hoodi admin" },
      { name: "description", content: "Track Hoodi Help volunteers, completions and earnings." },
      { property: "og:title", content: "Helper management — Hoodi admin" },
      { property: "og:description", content: "Track Hoodi Help volunteers, completions and earnings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HelpersPage,
});

function HelpersPage() {
  const ready = useSessionReady();
  const qc = useQueryClient();
  const helpers = useQuery({
    queryKey: ["admin-helpers"],
    queryFn: () => adminListHelpers(),
    enabled: ready,
  });
  const update = useMutation({
    mutationFn: (v: { userId: string; is_active: boolean }) => adminSetUserFlags({ data: v }),
    onSuccess: () => {
      toast.success("Helper updated.");
      qc.invalidateQueries({ queryKey: ["admin-helpers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Helpers</h1>
        <p className="mt-1 text-sm text-background/55">Members who have accepted at least one help request.</p>
      </header>

      <AdminCard>
        {helpers.isLoading ? (
          <div className="grid place-items-center py-12 text-background/50">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <AdminTable head={["Helper", "City", "Accepted", "Completed", "Earned", "Actions"]}>
            {(helpers.data ?? []).map((h) => (
              <tr key={h.id}>
                <td className="px-3 py-2.5 font-medium">{h.name ?? "Member"}</td>
                <td className="px-3 py-2.5 text-background/55">{h.city ?? "—"}</td>
                <td className="px-3 py-2.5 text-background/55">{h.tasks}</td>
                <td className="px-3 py-2.5 text-background/55">{h.completed}</td>
                <td className="px-3 py-2.5 text-background/55">₹{Math.round(h.earned)}</td>
                <td className="px-3 py-2.5">
                  <AdminButton
                    tone={h.is_active ? "danger" : "primary"}
                    disabled={update.isPending}
                    onClick={() => update.mutate({ userId: h.id, is_active: !h.is_active })}
                  >
                    {h.is_active ? "Suspend" : "Reinstate"}
                  </AdminButton>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCard>
    </div>
  );
}
