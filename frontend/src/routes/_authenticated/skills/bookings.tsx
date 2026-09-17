import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Loader2, MessageCircle, Star } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listMyBookings,
  confirmBooking,
  cancelBooking,
  completeBooking,
  releaseBookingPayment,
  rateSession,
  type BookingRow,
} from "@/lib/hoodi/bookings.functions";
import { getMyProfile } from "@/lib/hoodi/profiles.functions";
import { getLearnerDashboard } from "@/lib/hoodi/skills.functions";
import { SessionChat } from "@/components/hoodi/SessionChat";
import { inr } from "@/lib/hoodi/format";
import { EmptyState } from "./learn";
import { useTrust } from "@/hooks/use-trust";
import { TrustBadges } from "@/components/hoodi/TrustBadges";
import { ReportUserMenu } from "@/components/hoodi/ReportUserMenu";
import { ContactReveal } from "@/components/hoodi/ContactReveal";
import { cn } from "@/lib/utils";

function BookingTrust({ userId }: { userId: string }) {
  const trust = useTrust(userId);
  return <TrustBadges badges={trust.data?.badges} max={2} className="mt-1.5" />;
}

const TIMELINE = ["Requested", "Accepted", "Upcoming", "Completed", "Reviewed"] as const;

function BookingTimeline({ status, rated }: { status: string; rated: boolean }) {
  if (status === "cancelled") return null;
  const reached =
    status === "requested" ? 0 : status === "confirmed" ? 2 : status === "in_progress" ? 2 : rated ? 4 : 3;
  return (
    <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold uppercase tracking-wide">
      {TIMELINE.map((step, i) => (
        <li key={step} className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5",
              i <= reached ? "bg-primary/15 text-primary" : "bg-sand text-ink-soft/70",
            )}
          >
            {step}
          </span>
          {i < TIMELINE.length - 1 && <span className="text-ink-soft/40">→</span>}
        </li>
      ))}
    </ol>
  );
}

export const Route = createFileRoute("/_authenticated/skills/bookings")({
  head: () => ({
    meta: [
      { title: "My Bookings — Hoodi Skills" },
      { name: "description", content: "Track your upcoming and past skill sessions." },
    ],
  }),
  component: BookingsPage,
});

const UPCOMING = ["requested", "confirmed"];

function BookingsPage() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const bookings = useQuery({ queryKey: ["my-bookings"], queryFn: () => listMyBookings() });
  const learner = useQuery({ queryKey: ["learner-dashboard"], queryFn: () => getLearnerDashboard() });
  const [chatFor, setChatFor] = useState<string | null>(null);
  const [rateFor, setRateFor] = useState<BookingRow | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["my-bookings"] });
    qc.invalidateQueries({ queryKey: ["wallet"] });
    qc.invalidateQueries({ queryKey: ["wallet-summary"] });
    qc.invalidateQueries({ queryKey: ["learner-dashboard"] });
    qc.invalidateQueries({ queryKey: ["teacher-dashboard"] });
  };
  const onErr = (e: unknown) => toast.error(e instanceof Error ? e.message : String(e));

  const confirmM = useMutation({
    mutationFn: (id: string) => confirmBooking({ data: { bookingId: id } }),
    onSuccess: () => {
      toast.success("Session confirmed.");
      invalidate();
    },
    onError: onErr,
  });
  const cancelM = useMutation({
    mutationFn: (id: string) => cancelBooking({ data: { bookingId: id } }),
    onSuccess: () => {
      toast.success("Session cancelled.");
      invalidate();
    },
    onError: onErr,
  });
  const completeM = useMutation({
    mutationFn: (id: string) => completeBooking({ data: { bookingId: id } }),
    onSuccess: () => {
      toast.success("Session marked complete.");
      invalidate();
    },
    onError: onErr,
  });
  const releaseM = useMutation({
    mutationFn: (id: string) => releaseBookingPayment({ data: { bookingId: id } }),
    onSuccess: (r) => {
      toast.success(`Payment released — ${inr(r.teacher_credit)} credited to the teacher's wallet.`);
      invalidate();
    },
    onError: onErr,
  });

  const rows = bookings.data ?? [];
  const asLearner = rows.filter((b) => b.role === "learner");
  const asTeacher = rows.filter((b) => b.role === "teacher");
  const upcomingLearner = asLearner.filter((b) => UPCOMING.includes(b.status)).length;
  const upcomingTeacher = asTeacher.filter((b) => UPCOMING.includes(b.status)).length;

  return (
    <div className="mx-auto max-w-4xl">
      <header>
        <span className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
          Hoodi Skills
        </span>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          My bookings
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-soft">
          Upcoming sessions you've booked as a learner, and sessions others have booked with you.
        </p>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "As a learner", count: upcomingLearner },
          { label: "As a teacher", count: upcomingTeacher },
          { label: "Completed", count: learner.data?.completed ?? 0 },
          { label: "Cancelled", count: learner.data?.cancelled ?? 0 },
          { label: "Upcoming", count: learner.data?.upcoming ?? 0 },
        ].map(({ label, count }) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-background p-4 text-center shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">{label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-ink">{count}</p>
            <p className="text-xs text-ink-soft">sessions</p>
          </div>
        ))}
      </div>

      {bookings.isLoading ? (
        <div className="flex h-40 items-center justify-center text-ink-soft">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="h-6 w-6" />}
          title="No bookings yet"
          body="Browse mentors in Learn and request your first session — it'll show up here for both of you."
        />
      ) : (
        <div className="mt-8 space-y-8">
          <BookingGroup
            title="Sessions you booked"
            rows={asLearner}
            actions={{ cancelM, completeM, releaseM, confirmM }}
            onChat={setChatFor}
            onRate={setRateFor}
          />
          <BookingGroup
            title="Sessions booked with you"
            rows={asTeacher}
            actions={{ cancelM, completeM, releaseM, confirmM }}
            onChat={setChatFor}
            onRate={setRateFor}
          />
        </div>
      )}

      <Dialog open={!!chatFor} onOpenChange={(o) => !o && setChatFor(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Session chat</DialogTitle>
          </DialogHeader>
          {chatFor && <SessionChat bookingId={chatFor} myId={me.data?.id} />}
        </DialogContent>
      </Dialog>

      <RateDialog booking={rateFor} onClose={() => setRateFor(null)} />
    </div>
  );
}

type Actions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  confirmM: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cancelM: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  completeM: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  releaseM: any;
};

function BookingGroup({
  title,
  rows,
  actions,
  onChat,
  onRate,
}: {
  title: string;
  rows: BookingRow[];
  actions: Actions;
  onChat: (id: string) => void;
  onRate: (b: BookingRow) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">{title}</h2>
      <div className="mt-3 space-y-3">
        {rows.map((b) => (
          <article key={b.id} className="rounded-2xl border border-border bg-background p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-lg font-bold text-ink">{b.offering_title}</h3>
                <p className="text-xs text-ink-soft">
                  {b.offering_category} · with {b.counterparty_name ?? "a neighbor"} ·{" "}
                  {new Date(b.scheduled_at).toLocaleString()} · {b.duration_minutes} min
                </p>
                <BookingTrust userId={b.counterparty_id} />
              </div>
              <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-wider text-ink-soft">
                {b.status}
              </span>
            </div>
            {b.notes && <p className="mt-2 text-sm text-ink-soft">{b.notes}</p>}
            <BookingTimeline status={b.status} rated={b.my_rating != null} />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-ink">{inr(b.price)}</span>
              {b.payment_status && (
                <span className="text-xs text-ink-soft">payment: {b.payment_status}</span>
              )}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <ContactReveal
                userId={b.counterparty_id}
                name={b.counterparty_name}
                unlocked={["confirmed", "in_progress", "completed"].includes(b.status)}
                onChat={() => onChat(b.id)}
              />
              <ReportUserMenu
                targetUserId={b.counterparty_id}
                targetName={b.counterparty_name}
                contextType="skill_booking"
                contextId={b.id}
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => onChat(b.id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Chat
              </button>

              {b.role === "teacher" && b.status === "requested" && (
                <button
                  onClick={() => actions.confirmM.mutate(b.id)}
                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Confirm session
                </button>
              )}
              {UPCOMING.includes(b.status) && (
                <button
                  onClick={() => {
                    if (confirm("Cancel this session?")) actions.cancelM.mutate(b.id);
                  }}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft"
                >
                  Cancel
                </button>
              )}
              {b.status === "confirmed" && (
                <button
                  onClick={() => actions.completeM.mutate(b.id)}
                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Mark complete
                </button>
              )}
              {b.status === "completed" && b.payment_id && b.payment_status !== "released" && (
                <button
                  onClick={() => actions.releaseM.mutate(b.id)}
                  className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Release payment
                </button>
              )}
              {b.status === "completed" && b.my_rating == null && (
                <button
                  onClick={() => onRate(b)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink"
                >
                  <Star className="h-3.5 w-3.5" /> Rate
                </button>
              )}
              {b.my_rating != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-ink-soft">
                  <Star className="h-3.5 w-3.5 fill-current" /> You rated {b.my_rating}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RateDialog({ booking, onClose }: { booking: BookingRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");

  const rate = useMutation({
    mutationFn: () =>
      rateSession({
        data: {
          bookingId: booking!.id,
          rateeId: booking!.counterparty_id,
          score,
          comment: comment || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Thanks for the rating.");
      setComment("");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <Dialog open={!!booking} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">
            Rate {booking?.counterparty_name ?? "your session"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              aria-label={`${s} star`}
              onClick={() => setScore(s)}
              className={s <= score ? "text-primary" : "text-ink-soft/40"}
            >
              <Star className="h-7 w-7 fill-current" />
            </button>
          ))}
        </div>
        <textarea
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="How did the session go?"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        />
        <button
          onClick={() => rate.mutate()}
          disabled={rate.isPending}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {rate.isPending ? "Sending…" : "Submit rating"}
        </button>
      </DialogContent>
    </Dialog>
  );
}