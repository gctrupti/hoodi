import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  adminDecideVerification,
  adminListReports,
  adminListVerifications,
  adminResolveReport,
  adminVerificationDocUrl,
} from "@/lib/hoodi/trust.functions";
import { getMyProfile } from "@/lib/hoodi/profiles.functions";
import { useSessionReady } from "@/hooks/use-session-ready";
import { formatRelative } from "@/lib/hoodi/format";

export const Route = createFileRoute("/_authenticated/admin/trust")({
  head: () => ({
    meta: [
      { title: "Trust review — Hoodi admin" },
      { name: "description", content: "Review member verifications and safety reports on Hoodi." },
      { property: "og:title", content: "Trust review — Hoodi admin" },
      { property: "og:description", content: "Internal queue for verifications and safety reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrustAdminPage,
});

function TrustAdminPage() {
  const ready = useSessionReady();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile(), enabled: ready });
  const isAdmin = Boolean(me.data?.is_admin);

  const verifications = useQuery({
    queryKey: ["admin-verifications"],
    queryFn: () => adminListVerifications(),
    enabled: ready && isAdmin,
  });
  const reports = useQuery({
    queryKey: ["admin-reports"],
    queryFn: () => adminListReports(),
    enabled: ready && isAdmin,
  });

  const decide = useMutation({
    mutationFn: (v: { id: string; status: "verified" | "rejected" }) =>
      adminDecideVerification({ data: v }),
    onSuccess: () => {
      toast.success("Decision saved.");
      qc.invalidateQueries({ queryKey: ["admin-verifications"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const resolve = useMutation({
    mutationFn: (v: { id: string; status: "actioned" | "dismissed" }) => adminResolveReport({ data: v }),
    onSuccess: () => {
      toast.success("Report resolved.");
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

  if (me.isLoading || !ready) {
    return (
      <div className="grid place-items-center py-24 text-ink-soft">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-dashed border-border p-10 text-center text-ink-soft">
        This area is for Hoodi moderators.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Trust &amp; safety</h1>
        <p className="mt-1 text-sm text-ink-soft">Verification queue and member reports.</p>
      </header>

      <section>
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
          <ShieldCheck className="h-3.5 w-3.5" /> Verifications
        </h2>
        <div className="mt-3 space-y-2">
          {(verifications.data ?? []).length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
              Nothing waiting.
            </p>
          )}
          {(verifications.data ?? []).map((v) => (
            <article
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  {v.name} · {String(v.kind).replace(/_/g, " ")}
                </p>
                <p className="text-xs text-ink-soft">
                  {v.status} · {formatRelative(v.created_at)}
                  {v.submitted_value ? ` · ${v.submitted_value}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {v.document_path && (
                  <button
                    onClick={() => openDoc(v.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Document
                  </button>
                )}
                <button
                  onClick={() => decide.mutate({ id: v.id, status: "verified" })}
                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Approve
                </button>
                <button
                  onClick={() => decide.mutate({ id: v.id, status: "rejected" })}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft"
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
          <ShieldAlert className="h-3.5 w-3.5" /> Reports
        </h2>
        <div className="mt-3 space-y-2">
          {(reports.data ?? []).length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-ink-soft">
              No reports.
            </p>
          )}
          {(reports.data ?? []).map((r) => (
            <article key={r.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {r.reporter_name} → {r.target_name}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {String(r.reason).replace(/_/g, " ")} · {r.status} · {formatRelative(r.created_at)}
                  </p>
                  {r.details && <p className="mt-2 text-sm text-ink-soft">{r.details}</p>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => resolve.mutate({ id: r.id, status: "actioned" })}
                    className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-background"
                  >
                    Actioned
                  </button>
                  <button
                    onClick={() => resolve.mutate({ id: r.id, status: "dismissed" })}
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}