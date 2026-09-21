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
import { PlusCircle, Loader2, Compass, CheckCircle2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/help/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const list = useQuery({ queryKey: ["my-requests"], queryFn: () => listMyRequests(), refetchInterval: 10_000 });
  const openList = useQuery({
    queryKey: ["open-community-requests"],
    queryFn: () => listAvailableCommunityRequests(),
    refetchInterval: 10_000,
  });

  const [tab, setTab] = useState<"available" | "mine" | "accepted">("available");

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
  const mine = rows.filter((r) => r.requester_id === myId);
  const accepted = rows.filter((r) => r.helper_id === myId);

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
            See requests from your neighbors, manage tasks you accepted, or ask for a hand.
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
          label="My requests"
          count={mine.length}
        />
        <TabButton
          active={tab === "accepted"}
          onClick={() => setTab("accepted")}
          label="Accepted tasks"
          count={accepted.length}
        />
      </div>

      {list.isLoading && openList.isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : current.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <p className="font-display text-xl text-ink">
            {tab === "available"
              ? "No pending requests in your neighborhood right now."
              : tab === "mine"
                ? "You haven't posted any requests yet."
                : "You haven't accepted any tasks yet."}
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            {tab === "available" ? (
              <>
                When a neighbor posts an errand or emergency, it will show up here instantly.
                <br />
                You can also{" "}
                <Link to="/help/ask" className="font-semibold text-primary underline underline-offset-4">
                  post a test request
                </Link>{" "}
                to try it out!
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
        "inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-semibold transition cursor-pointer",
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