import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  adminDeleteAnnouncement,
  adminGetSettings,
  adminSaveAnnouncement,
  adminSetSetting,
  adminUpdatePricingRule,
} from "@/lib/hoodi/admin.functions";
import { AdminButton, AdminCard, AdminTable } from "@/components/hoodi/AdminShell";
import { useSessionReady } from "@/hooks/use-session-ready";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({
    meta: [
      { title: "System settings — Hoodi admin" },
      { name: "description", content: "Maintenance mode, pricing rules, commission and announcements." },
      { property: "og:title", content: "System settings — Hoodi admin" },
      { property: "og:description", content: "Maintenance mode, pricing rules, commission and announcements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

const inputCls =
  "w-full rounded-lg border border-background/15 bg-background/5 px-2.5 py-1.5 text-sm outline-none placeholder:text-background/35 focus:border-background/40";

function SettingsPage() {
  const ready = useSessionReady();
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminGetSettings(),
    enabled: ready,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-settings"] });
  const onError = (e: unknown) => toast.error(e instanceof Error ? e.message : String(e));

  const setSetting = useMutation({
    mutationFn: (v: { key: string; value: Record<string, unknown> }) => adminSetSetting({ data: v }),
    onSuccess: () => {
      toast.success("Setting saved.");
      invalidate();
    },
    onError,
  });

  const savePricing = useMutation({
    mutationFn: (v: { id: string; base_fee: number; rate_per_km: number; commission_rate: number }) =>
      adminUpdatePricingRule({ data: v }),
    onSuccess: () => {
      toast.success("Pricing updated.");
      invalidate();
    },
    onError,
  });

  const saveAnn = useMutation({
    mutationFn: (v: { title: string; body: string; audience: "all" | "help" | "skills" }) =>
      adminSaveAnnouncement({ data: { ...v, is_active: true } }),
    onSuccess: () => {
      toast.success("Announcement published.");
      setDraft({ title: "", body: "", audience: "all" });
      invalidate();
    },
    onError,
  });

  const delAnn = useMutation({
    mutationFn: (id: string) => adminDeleteAnnouncement({ data: { id } }),
    onSuccess: () => {
      toast.success("Announcement removed.");
      invalidate();
    },
    onError,
  });

  const [draft, setDraft] = useState<{ title: string; body: string; audience: "all" | "help" | "skills" }>({
    title: "",
    body: "",
    audience: "all",
  });

  const maintenance = Boolean(
    (settings.data?.settings.find((s) => s.key === "maintenance_mode")?.value as { enabled?: boolean } | null)
      ?.enabled,
  );

  if (settings.isLoading) {
    return (
      <div className="grid place-items-center py-24 text-background/50">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">System settings</h1>
        <p className="mt-1 text-sm text-background/55">Platform-wide controls, pricing and announcements.</p>
      </header>

      <AdminCard title="Platform">
        <div className="flex flex-wrap items-center justify-between gap-3 py-1">
          <div>
            <p className="font-medium">Maintenance mode</p>
            <p className="text-xs text-background/50">
              Shows a maintenance notice across Hoodi Help and Hoodi Skills.
            </p>
          </div>
          <AdminButton
            tone={maintenance ? "danger" : "primary"}
            disabled={setSetting.isPending}
            onClick={() => setSetting.mutate({ key: "maintenance_mode", value: { enabled: !maintenance } })}
          >
            {maintenance ? "Turn off" : "Turn on"}
          </AdminButton>
        </div>
      </AdminCard>

      <AdminCard title="Pricing rules & commission">
        <AdminTable head={["Category", "Base fee ₹", "Per km ₹", "Commission %", ""]}>
          {(settings.data?.pricing ?? []).map((rule) => (
            <PricingRow
              key={rule.id}
              rule={rule}
              pending={savePricing.isPending}
              onSave={(v) => savePricing.mutate({ id: rule.id, ...v })}
            />
          ))}
        </AdminTable>
      </AdminCard>

      <AdminCard title="Announcements">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-2">
            <input
              className={inputCls}
              placeholder="Title"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
            <textarea
              className={`${inputCls} min-h-20`}
              placeholder="Message shown to members"
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            />
            <select
              className={inputCls}
              value={draft.audience}
              onChange={(e) =>
                setDraft((d) => ({ ...d, audience: e.target.value as "all" | "help" | "skills" }))
              }
            >
              <option value="all">Everyone</option>
              <option value="help">Hoodi Help</option>
              <option value="skills">Hoodi Skills</option>
            </select>
          </div>
          <div className="flex items-end">
            <AdminButton
              tone="primary"
              disabled={saveAnn.isPending || draft.title.trim().length < 2 || draft.body.trim().length < 2}
              onClick={() => saveAnn.mutate(draft)}
            >
              Publish
            </AdminButton>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {(settings.data?.announcements ?? []).map((a) => (
            <div
              key={a.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-background/10 bg-background/5 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium">{a.title}</p>
                <p className="text-xs text-background/55">{a.body}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wide text-background/35">
                  {a.audience} · {a.is_active ? "active" : "hidden"}
                </p>
              </div>
              <AdminButton tone="danger" disabled={delAnn.isPending} onClick={() => delAnn.mutate(a.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </AdminButton>
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}

function PricingRow({
  rule,
  pending,
  onSave,
}: {
  rule: { id: string; category: string; base_fee: number; rate_per_km: number; commission_rate: number };
  pending: boolean;
  onSave: (v: { base_fee: number; rate_per_km: number; commission_rate: number }) => void;
}) {
  const [base, setBase] = useState(String(rule.base_fee));
  const [perKm, setPerKm] = useState(String(rule.rate_per_km));
  const [pct, setPct] = useState(String(Math.round(Number(rule.commission_rate) * 100)));

  useEffect(() => {
    setBase(String(rule.base_fee));
    setPerKm(String(rule.rate_per_km));
    setPct(String(Math.round(Number(rule.commission_rate) * 100)));
  }, [rule.base_fee, rule.rate_per_km, rule.commission_rate]);

  return (
    <tr>
      <td className="px-3 py-2.5 capitalize font-medium">{String(rule.category).replace(/_/g, " ")}</td>
      <td className="px-3 py-2.5">
        <input className={inputCls} value={base} onChange={(e) => setBase(e.target.value)} inputMode="decimal" />
      </td>
      <td className="px-3 py-2.5">
        <input className={inputCls} value={perKm} onChange={(e) => setPerKm(e.target.value)} inputMode="decimal" />
      </td>
      <td className="px-3 py-2.5">
        <input className={inputCls} value={pct} onChange={(e) => setPct(e.target.value)} inputMode="decimal" />
      </td>
      <td className="px-3 py-2.5">
        <AdminButton
          tone="primary"
          disabled={pending}
          onClick={() =>
            onSave({
              base_fee: Number(base) || 0,
              rate_per_km: Number(perKm) || 0,
              commission_rate: Math.min(Math.max((Number(pct) || 0) / 100, 0), 0.5),
            })
          }
        >
          Save
        </AdminButton>
      </td>
    </tr>
  );
}
