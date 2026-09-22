import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  listMyRequests,
  listAvailableCommunityRequests,
  acceptRequest,
} from "@/lib/hoodi/requests.functions";
import { getMyProfile } from "@/lib/hoodi/profiles.functions";
import { RequestCard } from "@/components/hoodi/RequestCard";
import {
  PlusCircle,
  Loader2,
  Compass,
  CheckCircle2,
  Sparkles,
  History,
  Wallet,
  Star,
  FileText,
  Clock,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { inr, formatRelative } from "@/lib/hoodi/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/help/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const list = useQuery({ queryKey: ["my-requests"], queryFn: () => listMyRequests(), refetchInterval: 8_000 });
  const openList = useQuery({
    queryKey: ["open-community-requests"],
    queryFn: () => listAvailableCommunityRequests(),
    refetchInterval: 8_000,
  });

  const [tab, setTab] = useState<"available" | "mine" | "accepted" | "history">("available");
  const [historyFilter, setHistoryFilter] = useState<"all" | "completed" | "cancelled" | "active">("all");

  // Subscribe to real-time changes on help_requests
  useEffect(() => {
    const channel = supabase
      .channel("help_requests_dashboard")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "help_requests" },
        () => {
          qc.invalidateQueries({ queryKey: ["my-requests"] });
          qc.invalidateQueries({ queryKey: ["open-community-requests"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) => acceptRequest({ data: { requestId } }),
    onSuccess: (_, requestId) => {
      toast.success("Task accepted! Opening task details...");
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      qc.invalidateQueries({ queryKey: ["open-community-requests"] });
      navigate({ to: "/help/requests/$id", params: { id: requestId } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const myId = me.data?.id ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = list.data ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openRows: any[] = openList.data ?? [];

  const available = openRows.filter((r) => r.status === "open");
  const mine = rows.filter((r) => r.requester_id === myId && r.status !== "completed" && r.status !== "cancelled");
  const accepted = rows.filter((r) => r.helper_id === myId && (r.status === "accepted" || r.status === "in_progress"));

  // Completed errands for history & earnings calculation
  const helperCompleted = rows.filter((r) => r.helper_id === myId && r.status === "completed");
  const totalHelperEarnings = helperCompleted.reduce((acc, r) => {
    const gross = r.final_fare ?? r.estimated_fare ?? 0;
    return acc + Math.round(gross * 0.85); // 85% net to helper
  }, 0);

  // History records (both requested & helped)
  const historyRecords = rows.filter((r) => {
    if (historyFilter === "completed") return r.status === "completed";
    if (historyFilter === "cancelled") return r.status === "cancelled";
    if (historyFilter === "active") return r.status === "open" || r.status === "accepted" || r.status === "in_progress";
    return true; // all
  });

  const current = tab === "available" ? available : tab === "mine" ? mine : accepted;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-bold text-ink">Helper & Community Hub</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3 w-3" /> Live
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Browse requests from neighbors, manage tasks you accepted, or track earnings & history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/help/nearby"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-ink hover:bg-sand transition"
          >
            <Compass className="h-4 w-4 text-primary" /> Map view
          </Link>
          <Link
            to="/help/ask"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
          >
            <PlusCircle className="h-4 w-4" /> Ask for help
          </Link>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="inline-flex flex-wrap gap-1 rounded-full border border-border bg-card p-1 text-sm">
        <TabButton
          active={tab === "available"}
          onClick={() => setTab("available")}
          label="Available near you"
          count={available.length}
        />
        <TabButton
          active={tab === "mine"}
          onClick={() => setTab("mine")}
          label="My open requests"
          count={mine.length}
        />
        <TabButton
          active={tab === "accepted"}
          onClick={() => setTab("accepted")}
          label="Accepted tasks"
          count={accepted.length}
        />
        <TabButton
          active={tab === "history"}
          onClick={() => setTab("history")}
          label="History & Earnings"
          count={rows.length}
        />
      </div>

      {/* HISTORY TAB VIEW */}
      {tab === "history" ? (
        <div className="space-y-6">
          {/* Earnings summary banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-3xl border border-primary/30 bg-primary/5 p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Helper Earnings</span>
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <div className="mt-2 font-display text-3xl font-extrabold text-primary">{inr(totalHelperEarnings)}</div>
              <div className="mt-1 text-xs text-ink-soft">
                Credited across {helperCompleted.length} completed tasks
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Completed Errands</span>
                <CheckCircle2 className="h-4 w-4 text-urgency-normal" />
              </div>
              <div className="mt-2 font-display text-3xl font-bold text-ink">{helperCompleted.length}</div>
              <div className="mt-1 text-xs text-ink-soft">100% mutual aid satisfaction</div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-5 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-soft uppercase tracking-wider">Total Interactions</span>
                <History className="h-4 w-4 text-clay" />
              </div>
              <div className="mt-2 font-display text-3xl font-bold text-ink">{rows.length}</div>
              <div className="mt-1 text-xs text-ink-soft">Combined requests & helper jobs</div>
            </div>
          </div>

          {/* History filter chips */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-ink-soft mr-1">Filter by:</span>
              {[
                { id: "all", label: "All Records" },
                { id: "completed", label: "Completed" },
                { id: "active", label: "Active" },
                { id: "cancelled", label: "Cancelled" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setHistoryFilter(f.id as any)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition cursor-pointer",
                    historyFilter === f.id
                      ? "border-primary bg-primary text-primary-foreground font-semibold"
                      : "border-border bg-card text-ink-soft hover:bg-sand",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* History table */}
          {historyRecords.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center text-ink-soft">
              No records found for the selected filter.
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-sand/60 border-b border-border text-ink-soft">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Task</th>
                    <th className="px-5 py-3.5 font-semibold">Role</th>
                    <th className="px-5 py-3.5 font-semibold">Status</th>
                    <th className="px-5 py-3.5 font-semibold">Amount</th>
                    <th className="px-5 py-3.5 font-semibold">Date</th>
                    <th className="px-5 py-3.5 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {historyRecords.map((item) => {
                    const amRequester = item.requester_id === myId;
                    const fareAmt = item.final_fare ?? item.estimated_fare ?? 0;
                    return (
                      <tr key={item.id} className="hover:bg-sand/30 transition">
                        <td className="px-5 py-3.5">
                          <Link
                            to="/help/requests/$id"
                            params={{ id: item.id }}
                            className="font-semibold text-ink hover:text-primary hover:underline transition"
                          >
                            {item.title}
                          </Link>
                          {item.address_text && (
                            <div className="text-[11px] text-ink-soft truncate max-w-xs">{item.address_text}</div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                              amRequester ? "bg-primary/10 text-primary" : "bg-clay-soft text-clay",
                            )}
                          >
                            {amRequester ? "Requester" : "Helper"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                              item.status === "completed" && "border-primary/40 bg-primary/10 text-primary",
                              item.status === "cancelled" && "border-urgency-emergency/40 bg-urgency-emergency-soft text-urgency-emergency",
                              item.status === "in_progress" && "border-urgency-normal/40 bg-urgency-normal-soft text-urgency-normal",
                              item.status === "accepted" && "border-urgency-today/40 bg-urgency-today-soft text-urgency-today",
                              item.status === "open" && "border-border bg-sand text-ink",
                            )}
                          >
                            {item.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-ink">
                          {item.is_paid === false ? "Free" : inr(fareAmt)}
                        </td>
                        <td className="px-5 py-3.5 text-ink-soft">{formatRelative(item.created_at)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            to="/help/requests/$id"
                            params={{ id: item.id }}
                            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-ink hover:bg-sand transition"
                          >
                            Details <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : list.isLoading && openList.isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : current.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center shadow-xs">
          <p className="font-display text-xl text-ink">
            {tab === "available"
              ? "No pending requests in your neighborhood right now."
              : tab === "mine"
                ? "You have no active open requests."
                : "You have no accepted active tasks right now."}
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            {tab === "available" ? (
              <>
                When a neighbor posts an errand or emergency, it will show up here instantly.
                <br />
                You can also{" "}
                <Link to="/help/ask" className="font-semibold text-primary underline underline-offset-4">
                  post an errand request
                </Link>{" "}
                to get started!
              </>
            ) : tab === "mine" ? (
              <>
                Tap{" "}
                <Link to="/help/ask" className="font-semibold text-primary underline underline-offset-4">
                  Ask for help
                </Link>{" "}
                to request chores, medicine, or grocery delivery.
              </>
            ) : (
              <>
                Check{" "}
                <button
                  onClick={() => setTab("available")}
                  className="font-semibold text-primary underline underline-offset-4 cursor-pointer"
                >
                  Available near you
                </button>{" "}
                to accept tasks from neighbors.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {current.map((r) => (
            <div key={r.id} className="relative flex flex-col justify-between">
              <RequestCard
                to="link"
                req={{
                  id: r.id,
                  title: r.title,
                  description: r.description,
                  category: r.category,
                  urgency: r.urgency,
                  is_paid: r.is_paid,
                  estimated_fare: r.estimated_fare,
                  final_fare: r.final_fare,
                  status: r.status,
                  created_at: r.created_at,
                }}
              />
              {tab === "available" && r.status === "open" && (
                <div className="mt-2">
                  {r.requester_id === myId ? (
                    <div className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 py-2.5 text-xs font-semibold text-primary">
                      Your Request · Waiting for helper
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={acceptMutation.isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        acceptMutation.mutate(r.id);
                      }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-semibold text-white transition hover:bg-primary/90 disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      {acceptMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      Accept & Help Neighbor
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-semibold transition cursor-pointer text-xs",
        active ? "bg-ink text-background shadow-xs" : "text-ink-soft hover:bg-sand",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[11px] font-bold",
          active ? "bg-background/20 text-background" : "bg-sand text-ink-soft",
        )}
      >
        {count}
      </span>
    </button>
  );
}