import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminDecideVerification,
  adminListReports,
  adminListVerifications,
  adminResolveReport,
  adminVerificationDocUrl,
} from "@/lib/hoodi/trust.functions";
import { AdminButton, AdminCard, AdminTable } from "@/components/hoodi/AdminShell";
import { useSessionReady } from "@/hooks/use-session-ready";
import { formatRelative } from "@/lib/hoodi/format";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({
    meta: [
      { title: "Trust & reports — Hoodi admin" },
      { name: "description", content: "Review member verifications, abuse reports and fake profile claims." },
      { property: "og:title", content: "Trust & reports — Hoodi admin" },
      { property: "og:description", content: "Review member verifications, abuse reports and fake profile claims." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const ready = useSessionReady();
  const qc = useQueryClient();

  const verifications = useQuery({
    queryKey: ["admin-verifications"],
    queryFn: () => adminListVerifications(),
    enabled: ready,
  });
  const reports = useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => adminListReports(),
    enabled: ready,
  });

  const decide = useMutation({
    mutationFn: (v: { id: string; status: "verified" | "rejected" }) => adminDecideVerification({ data: v }),
    onSuccess: () => {
      toast.success("Decision saved.");
      qc.invalidateQueries({ queryKey: ["admin-verifications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const resolve = useMutation({
    mutationFn: (v: { id: string; status: "reviewing" | "actioned" | "dismissed" }) =>
      adminResolveReport({ data: v }),
    onSuccess: () => {
      toast.success("Report updated.");
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  async function openDoc(id: string) {
    try {
      const { url } = await adminVerificationDocUrl({ data: { id } });
      if (!url) return toast.info("No document attached.");
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Trust &amp; reports</h1>
        <p className="mt-1 text-sm text-background/55">Verification queue, abuse reports and fake profile claims.</p>
      </header>

      <AdminCard title="ID & phone verifications">
        {verifications.isLoading ? (
          <div className="grid place-items-center py-10 text-background/50">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (verifications.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-background/45">Nothing waiting.</p>
        ) : (
          <AdminTable head={["Member", "Kind", "Submitted", "Status", "Actions"]}>
            {(verifications.data ?? []).map((v) => (
              <tr key={v.id}>
                <td className="px-3 py-2.5 font-medium">{v.name}</td>
                <td className="px-3 py-2.5 capitalize text-background/55">
                  {String(v.kind).replace(/_/g, " ")}
                </td>
                <td className="px-3 py-2.5 text-background/55">
                  {v.submitted_value ?? "—"} · {formatRelative(v.created_at)}
                </td>
                <td className="px-3 py-2.5 capitalize text-background/55">{v.status}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {v.document_path && (
                      <AdminButton onClick={() => openDoc(v.id)}>
                        <span className="inline-flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Document
                        </span>
                      </AdminButton>
                    )}
                    <AdminButton
                      tone="primary"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: v.id, status: "verified" })}
                    >
                      Approve
                    </AdminButton>
                    <AdminButton
                      tone="danger"
                      disabled={decide.isPending}
                      onClick={() => decide.mutate({ id: v.id, status: "rejected" })}
                    >
                      Reject
                    </AdminButton>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCard>

      <AdminCard title="Member reports">
        {reports.isLoading ? (
          <div className="grid place-items-center py-10 text-background/50">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (reports.data ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-background/45">No reports filed.</p>
        ) : (
          <AdminTable head={["Reported", "Reason", "Reporter", "Status", "Actions"]}>
            {(reports.data ?? []).map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2.5 font-medium">{r.target_name}</td>
                <td className="px-3 py-2.5 text-background/55">
                  <span className="capitalize">{String(r.reason).replace(/_/g, " ")}</span>
                  {r.details && <span className="block text-xs text-background/40">{r.details}</span>}
                </td>
                <td className="px-3 py-2.5 text-background/55">
                  {r.reporter_name} · {formatRelative(r.created_at)}
                </td>
                <td className="px-3 py-2.5 capitalize text-background/55">{r.status}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    <AdminButton
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ id: r.id, status: "reviewing" })}
                    >
                      Reviewing
                    </AdminButton>
                    <AdminButton
                      tone="danger"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ id: r.id, status: "actioned" })}
                    >
                      Action
                    </AdminButton>
                    <AdminButton
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ id: r.id, status: "dismissed" })}
                    >
                      Dismiss
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
