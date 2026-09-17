import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminFinance, adminSetPayoutStatus } from "@/lib/hoodi/admin.functions";
import { AdminButton, AdminCard, AdminTable, Stat } from "@/components/hoodi/AdminShell";
import { useSessionReady } from "@/hooks/use-session-ready";
import { formatRelative, inr } from "@/lib/hoodi/format";

export const Route = createFileRoute("/admin/finance")({
  head: () => ({
    meta: [
      { title: "Finance — Hoodi admin" },
      { name: "description", content: "Payments, payouts, wallet balances and platform commission." },
      { property: "og:title", content: "Finance — Hoodi admin" },
      { property: "og:description", content: "Payments, payouts, wallet balances and platform commission." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FinancePage,
});

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

function download(name: string, rows: Record<string, unknown>[]) {
  const csv = toCsv(rows);
  if (!csv) return toast.info("Nothing to export.");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function FinancePage() {
  const ready = useSessionReady();
  const qc = useQueryClient();
  const finance = useQuery({
    queryKey: ["admin-finance"],
    queryFn: () => adminFinance(),
    enabled: ready,
  });

  const setStatus = useMutation({
    mutationFn: (v: { payoutId: string; newStatus: "approved" | "rejected" | "paid" }) =>
      adminSetPayoutStatus({ data: v }),
    onSuccess: () => {
      toast.success("Payout updated.");
      qc.invalidateQueries({ queryKey: ["admin-finance"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const payments = finance.data?.payments ?? [];
  const payouts = finance.data?.payouts ?? [];
  const wallets = finance.data?.wallets ?? [];

  const released = payments.filter((p) => p.status === "released");
  const grossReleased = released.reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const held = payments
    .filter((p) => p.status === "held" || p.status === "pending")
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const walletTotal = wallets.reduce((s, w) => s + Number(w.balance ?? 0), 0);
  const pendingPayouts = payouts
    .filter((p) => p.status === "requested")
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const commission = Math.max(grossReleased - walletTotal, 0);

  if (finance.isLoading) {
    return (
      <div className="grid place-items-center py-24 text-background/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Finance</h1>
          <p className="mt-1 text-sm text-background/55">Money in, money out, and what the platform keeps.</p>
        </div>
        <AdminButton onClick={() => download("hoodi-payments.csv", payments as never)}>
          <span className="inline-flex items-center gap-1.5">
            <Download className="h-3.5 w-3.5" /> Export payments
          </span>
        </AdminButton>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Released volume" value={inr(grossReleased)} />
        <Stat label="Platform commission" value={inr(commission)} hint="released minus wallet credits" />
        <Stat label="In escrow" value={inr(held)} />
        <Stat label="Wallet liability" value={inr(walletTotal)} />
        <Stat label="Pending withdrawals" value={inr(pendingPayouts)} />
      </div>

      <AdminCard title="Withdrawal requests">
        {payouts.length === 0 ? (
          <p className="py-6 text-center text-sm text-background/45">No withdrawals yet.</p>
        ) : (
          <AdminTable head={["Member", "Amount", "Requested", "Status", "Actions"]}>
            {payouts.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2.5 font-medium">{p.name}</td>
                <td className="px-3 py-2.5 text-background/60">{inr(p.amount)}</td>
                <td className="px-3 py-2.5 text-background/55">{formatRelative(p.requested_at)}</td>
                <td className="px-3 py-2.5 capitalize text-background/55">{p.status}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    <AdminButton
                      tone="primary"
                      disabled={setStatus.isPending || p.status !== "requested"}
                      onClick={() => setStatus.mutate({ payoutId: p.id, newStatus: "approved" })}
                    >
                      Approve
                    </AdminButton>
                    <AdminButton
                      disabled={setStatus.isPending || p.status === "paid"}
                      onClick={() => setStatus.mutate({ payoutId: p.id, newStatus: "paid" })}
                    >
                      Mark paid
                    </AdminButton>
                    <AdminButton
                      tone="danger"
                      disabled={setStatus.isPending || p.status !== "requested"}
                      onClick={() => setStatus.mutate({ payoutId: p.id, newStatus: "rejected" })}
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

      <AdminCard title="Payment history">
        <AdminTable head={["Reference", "Type", "Amount", "Status", "When"]}>
          {payments.slice(0, 50).map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2.5 font-mono text-xs text-background/55">
                {p.razorpay_order_id ?? p.id.slice(0, 8)}
              </td>
              <td className="px-3 py-2.5 text-background/55">{p.booking_id ? "Skills" : "Help"}</td>
              <td className="px-3 py-2.5 text-background/60">{inr(p.amount)}</td>
              <td className="px-3 py-2.5 capitalize text-background/55">{p.status}</td>
              <td className="px-3 py-2.5 text-background/55">{formatRelative(p.created_at)}</td>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>

      <AdminCard
        title="Wallet balances"
        action={
          <AdminButton onClick={() => download("hoodi-wallets.csv", wallets as never)}>
            <span className="inline-flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </span>
          </AdminButton>
        }
      >
        <AdminTable head={["Member", "Balance", "Updated"]}>
          {wallets.slice(0, 50).map((w) => (
            <tr key={w.id}>
              <td className="px-3 py-2.5 font-medium">{w.name}</td>
              <td className="px-3 py-2.5 text-background/60">{inr(w.balance)}</td>
              <td className="px-3 py-2.5 text-background/55">{formatRelative(w.updated_at)}</td>
            </tr>
          ))}
        </AdminTable>
      </AdminCard>
    </div>
  );
}
