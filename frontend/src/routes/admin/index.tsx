import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { adminOverview } from "@/lib/hoodi/admin.functions";
import { AdminCard, AdminTable, Stat } from "@/components/hoodi/AdminShell";
import { useSessionReady } from "@/hooks/use-session-ready";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Platform dashboard — Hoodi admin" },
      { name: "description", content: "Revenue, growth and activity analytics for the Hoodi platform." },
      { property: "og:title", content: "Platform dashboard — Hoodi admin" },
      { property: "og:description", content: "Revenue, growth and activity analytics for the Hoodi platform." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

const money = (v: unknown) => `₹${Number(v ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function AdminDashboard() {
  const ready = useSessionReady();
  const q = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => adminOverview(),
    enabled: ready,
    refetchInterval: 30_000,
  });

  if (!ready || q.isLoading) {
    return (
      <div className="grid place-items-center py-24 text-background/50">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (q.error) return <p className="text-sm text-destructive">{String(q.error)}</p>;

  const d = q.data ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (k: string) => (d as any)[k] ?? {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (k: string): any[] => ((d as any)[k] ?? []) as any[];

  const growth = list("growth").map((r) => ({
    ...r,
    label: new Date(r.day).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    revenue: Number(r.revenue ?? 0),
  }));

  const activity = list("activity");
  const heat = new Map(activity.map((a) => [`${a.dow}-${a.hour}`, Number(a.total)]));
  const heatMax = Math.max(1, ...activity.map((a) => Number(a.total)));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Platform dashboard</h1>
        <p className="mt-1 text-sm text-background/55">Live figures across Hoodi Help and Hoodi Skills.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Revenue today" value={money(g("revenue").today)} />
        <Stat label="This week" value={money(g("revenue").week)} />
        <Stat label="This month" value={money(g("revenue").month)} />
        <Stat label="This year" value={money(g("revenue").year)} hint={`All time ${money(g("revenue").all_time)}`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Platform commission"
          value={money(Number(g("commission").help ?? 0) + Number(g("commission").skills ?? 0))}
          hint={`Help ${money(g("commission").help)} · Skills ${money(g("commission").skills)}`}
        />
        <Stat label="Wallet balances" value={money(g("wallets").balance)} hint={`${g("wallets").count ?? 0} wallets`} />
        <Stat
          label="Pending withdrawals"
          value={money(g("payouts").pending_amount)}
          hint={`${g("payouts").pending_count ?? 0} requests`}
        />
        <Stat
          label="Awaiting review"
          value={
            Number(g("pending").verifications ?? 0) +
            Number(g("pending").reports ?? 0) +
            Number(g("pending").categories ?? 0)
          }
          hint={`${g("pending").verifications ?? 0} IDs · ${g("pending").reports ?? 0} reports · ${g("pending").categories ?? 0} categories`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total users" value={g("users").total ?? 0} hint={`${g("users").active ?? 0} active`} />
        <Stat label="New users" value={g("users").new_today ?? 0} hint={`${g("users").new_week ?? 0} in 7 days`} />
        <Stat
          label="Help requests"
          value={g("requests").total ?? 0}
          hint={`${g("requests").today ?? 0} today · ${g("requests").completed ?? 0} done · ${g("requests").cancelled ?? 0} cancelled`}
        />
        <Stat
          label="Skill sessions"
          value={g("bookings").total ?? 0}
          hint={`${g("bookings").today ?? 0} today · ${g("bookings").completed ?? 0} done · ${g("bookings").cancelled ?? 0} cancelled`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="Revenue · last 30 days">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growth}>
                <CartesianGrid strokeOpacity={0.1} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }} interval={6} />
                <YAxis tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }} width={44} />
                <Tooltip
                  contentStyle={{ background: "#1b1712", border: "none", borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => money(v)}
                />
                <Area type="monotone" dataKey="revenue" stroke="currentColor" fill="currentColor" fillOpacity={0.18} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>

        <AdminCard title="Growth · users, requests, sessions">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={growth}>
                <CartesianGrid strokeOpacity={0.1} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }} interval={6} />
                <YAxis tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }} width={30} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1b1712", border: "none", borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="users" stroke="var(--color-clay)" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="requests" stroke="var(--color-urgency-today)" dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="bookings" stroke="var(--color-urgency-normal)" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>

        <AdminCard title="Most requested help categories">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={list("top_help_categories")}>
                <CartesianGrid strokeOpacity={0.1} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }} />
                <YAxis tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }} width={30} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1b1712", border: "none", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="total" fill="var(--color-clay)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>

        <AdminCard title="Most popular skills">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={list("top_skills")}>
                <CartesianGrid strokeOpacity={0.1} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "currentColor", opacity: 0.5 }} />
                <YAxis tick={{ fontSize: 11, fill: "currentColor", opacity: 0.5 }} width={30} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1b1712", border: "none", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="total" fill="var(--color-urgency-normal)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AdminCard>
      </div>

      <AdminCard title="Activity heatmap · help requests, last 60 days">
        <div className="overflow-x-auto">
          <div className="min-w-[640px] space-y-1">
            {DOW.map((day, dow) => (
              <div key={day} className="flex items-center gap-1">
                <span className="w-9 text-[10px] uppercase tracking-wide text-background/45">{day}</span>
                {Array.from({ length: 24 }, (_, hour) => {
                  const v = heat.get(`${dow}-${hour}`) ?? 0;
                  return (
                    <span
                      key={hour}
                      title={`${day} ${hour}:00 · ${v} requests`}
                      className="h-4 flex-1 rounded-[3px] bg-background"
                      style={{ opacity: v === 0 ? 0.06 : 0.2 + (v / heatMax) * 0.8 }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </AdminCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminCard title="Top cities">
          <AdminTable head={["City", "Users"]}>
            {list("top_cities").map((c) => (
              <tr key={c.city}>
                <td className="px-3 py-2">{c.city}</td>
                <td className="px-3 py-2 text-background/60">{c.users}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
        <AdminCard title="Top teachers">
          <AdminTable head={["Teacher", "Sessions", "Earned"]}>
            {list("top_teachers").map((t) => (
              <tr key={t.user_id}>
                <td className="px-3 py-2">{t.name ?? "Member"}</td>
                <td className="px-3 py-2 text-background/60">{t.sessions}</td>
                <td className="px-3 py-2 text-background/60">{money(t.earned)}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
        <AdminCard title="Top helpers">
          <AdminTable head={["Helper", "Tasks", "Earned"]}>
            {list("top_helpers").map((t) => (
              <tr key={t.user_id}>
                <td className="px-3 py-2">{t.name ?? "Member"}</td>
                <td className="px-3 py-2 text-background/60">{t.tasks}</td>
                <td className="px-3 py-2 text-background/60">{money(t.earned)}</td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      </div>
    </div>
  );
}
