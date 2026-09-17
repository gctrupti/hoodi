import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listMyRequests } from "@/lib/hoodi/requests.functions";
import { getMyProfile } from "@/lib/hoodi/profiles.functions";
import { RequestCard } from "@/components/hoodi/RequestCard";
import { PlusCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/help/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const list = useQuery({ queryKey: ["my-requests"], queryFn: () => listMyRequests(), refetchInterval: 20_000 });
  const [tab, setTab] = useState<"mine" | "accepted">("mine");

  const myId = me.data?.id ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = list.data ?? [];
  const mine = rows.filter((r) => r.requester_id === myId);
  const accepted = rows.filter((r) => r.helper_id === myId);
  const current = tab === "mine" ? mine : accepted;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Home</h1>
          <p className="text-sm text-ink-soft">Everything you've posted or accepted, in one place.</p>
        </div>
        <Link
          to="/help/ask"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <PlusCircle className="h-4 w-4" /> New request
        </Link>
      </div>

      <div className="inline-flex rounded-full border border-border bg-card p-1 text-sm">
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")} label="My requests" count={mine.length} />
        <TabButton active={tab === "accepted"} onClick={() => setTab("accepted")} label="Accepted tasks" count={accepted.length} />
      </div>

      {list.isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-ink-soft" />
        </div>
      ) : current.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <p className="font-display text-xl text-ink">
            {tab === "mine" ? "You haven't posted anything yet." : "No accepted tasks yet."}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {tab === "mine" ? (
              <>
                Tap <span className="font-semibold text-ink">New request</span> to ask your street.
              </>
            ) : (
              <>
                <Link to="/help/nearby" className="font-semibold text-ink underline underline-offset-4">
                  Browse nearby
                </Link>{" "}
                and accept one.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {current.map((r) => (
            <RequestCard
              key={r.id}
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
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-semibold transition",
        active ? "bg-ink text-background" : "text-ink-soft hover:bg-sand",
      )}
    >
      {label}
      <span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-background/20 text-background" : "bg-sand text-ink-soft")}>
        {count}
      </span>
    </button>
  );
}