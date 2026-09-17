import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Monitor, MapPin, Globe2 } from "lucide-react";
import { toast } from "sonner";
import { adminListTeachers, adminSetUserFlags } from "@/lib/hoodi/admin.functions";
import { AdminButton, AdminCard, AdminTable } from "@/components/hoodi/AdminShell";
import { useSessionReady } from "@/hooks/use-session-ready";

export const Route = createFileRoute("/admin/teachers")({
  head: () => ({
    meta: [
      { title: "Teacher management — Hoodi admin" },
      { name: "description", content: "Review Hoodi Skills mentors, their sessions and earnings." },
      { property: "og:title", content: "Teacher management — Hoodi admin" },
      { property: "og:description", content: "Review Hoodi Skills mentors, their sessions and earnings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeachersPage,
});

const MODE_ICON = { online: Monitor, offline: MapPin, both: Globe2 } as const;

function TeachersPage() {
  const ready = useSessionReady();
  const qc = useQueryClient();
  const teachers = useQuery({
    queryKey: ["admin-teachers"],
    queryFn: () => adminListTeachers(),
    enabled: ready,
  });
  const update = useMutation({
    mutationFn: (v: { userId: string; is_active: boolean }) => adminSetUserFlags({ data: v }),
    onSuccess: () => {
      toast.success("Teacher updated.");
      qc.invalidateQueries({ queryKey: ["admin-teachers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Teachers</h1>
        <p className="mt-1 text-sm text-background/55">Every mentor on Hoodi Skills, ranked by delivery.</p>
      </header>

      <AdminCard>
        {teachers.isLoading ? (
          <div className="grid place-items-center py-12 text-background/50">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <AdminTable head={["Teacher", "Mode", "Rate", "Sessions", "Earned", "Live", "Actions"]}>
            {(teachers.data ?? []).map((t) => {
              const Icon = MODE_ICON[(t.teaching_mode ?? "online") as keyof typeof MODE_ICON] ?? Monitor;
              return (
                <tr key={t.user_id}>
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{t.name}</span>
                    <span className="block text-xs text-background/45">{t.headline ?? "—"}</span>
                  </td>
                  <td className="px-3 py-2.5 text-background/60">
                    <span className="inline-flex items-center gap-1.5 capitalize">
                      <Icon className="h-3.5 w-3.5" />
                      {t.teaching_mode ?? "online"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-background/60">₹{Number(t.hourly_rate ?? 0)}</td>
                  <td className="px-3 py-2.5 text-background/60">{t.sessions}</td>
                  <td className="px-3 py-2.5 text-background/60">₹{Math.round(t.earned)}</td>
                  <td className="px-3 py-2.5 text-background/60">{t.is_published ? "Published" : "Draft"}</td>
                  <td className="px-3 py-2.5">
                    <AdminButton
                      tone={t.is_active ? "danger" : "primary"}
                      disabled={update.isPending}
                      onClick={() => update.mutate({ userId: t.user_id, is_active: !t.is_active })}
                    >
                      {t.is_active ? "Suspend" : "Reinstate"}
                    </AdminButton>
                  </td>
                </tr>
              );
            })}
          </AdminTable>
        )}
      </AdminCard>
    </div>
  );
}
