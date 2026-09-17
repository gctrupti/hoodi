import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  getRequest,
  acceptRequest,
  updateRequestStatus,
  deleteRequest,
} from "@/lib/hoodi/requests.functions";
import { getThreadForRequest, listMessages, sendMessage } from "@/lib/hoodi/chat.functions";
import { simulateCapturePayment } from "@/lib/hoodi/payments.functions";
import { submitRating } from "@/lib/hoodi/ratings.functions";
import { getMyProfile } from "@/lib/hoodi/profiles.functions";
import { supabase } from "@/integrations/supabase/client";
import { UrgencyBadge, CategoryChip } from "@/components/hoodi/UrgencyBadge";
import { formatRelative, inr } from "@/lib/hoodi/format";
import {
  ArrowLeft,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  MapPin,
  Navigation,
  Play,
  Send,
  Star,
  Store,
  Trash2,
  XCircle,
} from "lucide-react";
import { REQUEST_TYPE_META, type RequestType } from "@/lib/hoodi/request-types";
import { googleDirectionsUrl } from "@/lib/hoodi/location";
import { toast } from "sonner";
import { useTrust } from "@/hooks/use-trust";
import { TrustBadges } from "@/components/hoodi/TrustBadges";
import { ReportUserMenu } from "@/components/hoodi/ReportUserMenu";
import { ContactReveal } from "@/components/hoodi/ContactReveal";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/help/requests/$id")({
  component: RequestDetail,
});

function RequestDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();

  const me = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const req = useQuery({
    queryKey: ["request", id],
    queryFn: () => getRequest({ data: { requestId: id } }),
    refetchInterval: 10_000,
  });
  const thread = useQuery({
    queryKey: ["thread", id],
    queryFn: () => getThreadForRequest({ data: { requestId: id } }),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = req.data as any;
  const myId = me.data?.id ?? null;
  const iAmRequester = !!(r && myId && r.requester_id === myId);
  const iAmHelper = !!(r && myId && r.helper_id === myId);
  const canParticipate = iAmRequester || iAmHelper;

  const accept = useMutation({
    mutationFn: () => acceptRequest({ data: { requestId: id } }),
    onSuccess: () => {
      toast.success("You accepted this request.");
      qc.invalidateQueries({ queryKey: ["request", id] });
      qc.invalidateQueries({ queryKey: ["thread", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const setStatus = useMutation({
    mutationFn: (s: "in_progress" | "completed" | "cancelled") =>
      updateRequestStatus({ data: { requestId: id, newStatus: s } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["request", id] });
      if (res.needsPaymentCapture) toast.info("Complete — release payment to the helper below.");
      else toast.success("Status updated.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const releasePayment = useMutation({
    mutationFn: () => simulateCapturePayment({ data: { requestId: id } }),
    onSuccess: (out) => {
      toast.success(`Released ₹${out.helper_credit} to helper (₹${out.commission} platform fee).`);
      qc.invalidateQueries({ queryKey: ["request", id] });
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["earnings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const removeReq = useMutation({
    mutationFn: () => deleteRequest({ data: { requestId: id } }),
    onSuccess: () => {
      toast.success("Deleted.");
      window.location.href = "/help/dashboard";
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  if (req.isLoading || me.isLoading) {
    return (
      <div className="grid place-items-center py-24 text-ink-soft">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!r) {
    return <div className="rounded-2xl border border-dashed border-border p-10 text-center text-ink-soft">Request not found.</div>;
  }

  const fare = r.final_fare ?? r.estimated_fare;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/help/nearby" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <article className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyBadge urgency={r.urgency} pulse />
          <CategoryChip category={r.category} />
          <span
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
              r.status === "open" && "border-clay/50 bg-clay-soft/60 text-ink",
              r.status === "accepted" && "border-urgency-today/40 bg-urgency-today-soft text-urgency-today",
              r.status === "in_progress" && "border-urgency-normal/40 bg-urgency-normal-soft text-urgency-normal",
              r.status === "completed" && "border-primary/40 bg-primary/10 text-primary",
              r.status === "cancelled" && "border-urgency-emergency/30 bg-urgency-emergency-soft text-urgency-emergency",
            )}
          >
            {String(r.status).replace(/_/g, " ")}
          </span>
        </div>
        <h1 className="mt-4 font-display text-3xl font-bold text-ink">{r.title}</h1>
        {r.description && <p className="mt-2 whitespace-pre-line text-ink-soft">{r.description}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ink-soft">
          <span>Posted {formatRelative(r.created_at)}</span>
          {r.address_text && <span>· {r.address_text}</span>}
          <span className="ml-auto font-display text-2xl font-bold text-ink">
            {r.is_paid === false ? "Free" : inr(fare)}
          </span>
        </div>

        <RequestRoute request={r} />

        <div className="mt-5 flex flex-wrap gap-2">
          {!canParticipate && r.status === "open" && (
            <button
              disabled={accept.isPending}
              onClick={() => accept.mutate()}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {accept.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Accept & help
            </button>
          )}
          {iAmHelper && r.status === "accepted" && (
            <button
              onClick={() => setStatus.mutate("in_progress")}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-background hover:bg-primary"
            >
              <Play className="h-4 w-4" /> Start
            </button>
          )}
          {iAmHelper && (r.status === "accepted" || r.status === "in_progress") && (
            <ConfirmButton
              onConfirm={() => setStatus.mutate("completed")}
              title="Mark this request complete?"
              description="The requester will be asked to release payment. You can't undo this."
              actionLabel="Yes, mark complete"
              trigger={
                <button className="inline-flex items-center gap-2 rounded-full bg-urgency-normal px-4 py-2 text-sm font-semibold text-background hover:opacity-90">
                  <CheckCircle2 className="h-4 w-4" /> Mark complete
                </button>
              }
            />
          )}
          {canParticipate && r.status !== "completed" && r.status !== "cancelled" && (
            <ConfirmButton
              onConfirm={() => setStatus.mutate("cancelled")}
              title="Cancel this request?"
              description={
                iAmRequester
                  ? "The helper will be notified. If money was held, it will be refunded."
                  : "The requester will be notified. Only cancel if you truly can't help."
              }
              actionLabel="Yes, cancel"
              destructive
              trigger={
                <button className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-sand">
                  <XCircle className="h-4 w-4" /> Cancel
                </button>
              }
            />
          )}
          {iAmRequester && r.status === "open" && (
            <ConfirmButton
              onConfirm={() => removeReq.mutate()}
              title="Delete this request?"
              description="This removes it from the neighborhood feed. It can't be recovered."
              actionLabel="Delete permanently"
              destructive
              trigger={
                <button className="ml-auto inline-flex items-center gap-2 rounded-full border border-urgency-emergency/40 px-3 py-2 text-xs font-semibold text-urgency-emergency hover:bg-urgency-emergency-soft">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              }
            />
          )}
        </div>

        {r.status === "completed" && r.is_paid && r.payment_id && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div>
              <div className="font-display text-lg font-bold text-ink">Release payment</div>
              <div className="text-sm text-ink-soft">
                {r.final_fare
                  ? "Payment already released. Helper received their share."
                  : `Simulated capture — releases ₹${fare} to helper wallet (platform fee auto-deducted).`}
              </div>
            </div>
            {!r.final_fare && (
              <button
                onClick={() => releasePayment.mutate()}
                disabled={releasePayment.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                <CircleDollarSign className="h-4 w-4" />
                Release ₹{fare}
              </button>
            )}
          </div>
        )}
      </article>

      {canParticipate && (
        <CounterpartyPanel
          userId={iAmRequester ? r.helper_id : r.requester_id}
          name={iAmRequester ? r.helper?.name : r.requester?.name}
          unlocked={["accepted", "in_progress", "completed"].includes(String(r.status))}
          requestId={id}
        />
      )}
      {canParticipate && thread.data && <ChatPanel threadId={thread.data.id} myId={myId!} />}
      {canParticipate && r.status === "completed" && (
        <RatingPanel requestId={id} rateeId={iAmRequester ? r.helper_id : r.requester_id} />
      )}
    </div>
  );
}

function CounterpartyPanel({
  userId,
  name,
  unlocked,
  requestId,
}: {
  userId?: string | null;
  name?: string | null;
  unlocked: boolean;
  requestId: string;
}) {
  const trust = useTrust(userId ?? null);
  if (!userId) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-bold text-ink">{name ?? "Your neighbor"}</h2>
          <TrustBadges badges={trust.data?.badges} />
        </div>
        <ReportUserMenu
          targetUserId={userId}
          targetName={name}
          contextType="help_request"
          contextId={requestId}
        />
      </div>
      <div className="mt-3">
        <ContactReveal userId={userId} name={name} unlocked={unlocked} />
      </div>
    </section>
  );
}

function ConfirmButton({
  trigger,
  title,
  description,
  actionLabel,
  onConfirm,
  destructive,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Never mind</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={cn(
              destructive &&
                "bg-urgency-emergency text-background hover:bg-urgency-emergency/90",
            )}
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ChatPanel({ threadId, myId }: { threadId: string; myId: string }) {
  const qc = useQueryClient();
  const msgs = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => listMessages({ data: { threadId } }),
    refetchInterval: 5_000,
  });
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [msgs.data?.length]);

  useEffect(() => {
    const ch = supabase
      .channel(`chat:${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` },
        () => qc.invalidateQueries({ queryKey: ["messages", threadId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [threadId, qc]);

  const send = useMutation({
    mutationFn: (content: string) => sendMessage({ data: { threadId, content } }),
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["messages", threadId] });
    },
  });

  return (
    <div className="flex h-[26rem] flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border/70 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-ink-soft">
        Private chat
      </div>
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
        {msgs.data?.length === 0 && (
          <p className="mt-16 text-center text-sm text-muted-foreground">
            Say hello — messages are only visible to the two of you.
          </p>
        )}
        {msgs.data?.map((m) => {
          const mine = m.sender_id === myId;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  mine ? "bg-primary text-primary-foreground" : "bg-sand text-ink",
                )}
              >
                <div>{m.content}</div>
                <div className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-ink-soft")}>
                  {formatRelative(m.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send.mutate(text.trim());
        }}
        className="flex items-center gap-2 border-t border-border/70 px-3 py-3"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={send.isPending || !text.trim()}
          className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

/** Shows the location model of the request: shop → customer, origin → destination, or a single spot. */
function RequestRoute({ request }: { request: Record<string, unknown> }) {
  const type = (request.request_type as RequestType | undefined) ?? "custom";
  const meta = REQUEST_TYPE_META[type];
  const model = meta.locations;

  const pickupLat = request.pickup_lat as number | null;
  const pickupLng = request.pickup_lng as number | null;
  const dropLat = request.dropoff_lat as number | null;
  const dropLng = request.dropoff_lng as number | null;

  const stops: {
    label: string;
    name: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    business?: boolean;
  }[] = [];

  if (model.pickup && pickupLat != null && pickupLng != null) {
    stops.push({
      label: model.pickup.label,
      name: (request.pickup_name as string | null) ?? null,
      address: (request.pickup_address as string | null) ?? null,
      lat: pickupLat,
      lng: pickupLng,
      business: model.pickup.business,
    });
  }
  if (model.dropoff) {
    stops.push({
      label: model.dropoff.label,
      name: (request.dropoff_name as string | null) ?? null,
      address:
        (request.dropoff_address as string | null) ?? (request.address_text as string | null) ?? null,
      lat: dropLat,
      lng: dropLng,
    });
  }
  if (model.service) {
    stops.push({
      label: model.service.label,
      name: null,
      address: (request.address_text as string | null) ?? null,
      lat: null,
      lng: null,
    });
  }

  return (
    <div className="mt-5 rounded-2xl border border-border bg-sand/50 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
        <span aria-hidden>{meta.emoji}</span>
        {meta.label}
      </div>
      <ol className="space-y-3">
        {stops.map((s, i) => (
          <li key={s.label} className="flex gap-3">
            <div className="flex flex-col items-center">
              {s.business ? (
                <Store className="h-4 w-4 text-clay" />
              ) : (
                <MapPin className="h-4 w-4 text-primary" />
              )}
              {i < stops.length - 1 && <span className="mt-1 h-6 w-px flex-1 bg-border" />}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                {s.label}
              </div>
              {s.name && <div className="text-sm font-semibold text-ink">{s.name}</div>}
              <div className="text-sm text-ink-soft">{s.address ?? "Shared with the helper"}</div>
              {s.lat != null && s.lng != null && (
                <a
                  href={googleDirectionsUrl(s.lat, s.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Navigation className="h-3 w-3" /> Directions
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RatingPanel({ requestId, rateeId }: { requestId: string; rateeId: string | null }) {
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const rate = useMutation({
    mutationFn: () =>
      submitRating({ data: { requestId, rateeId: rateeId!, score, comment: comment || undefined } }),
    onSuccess: () => toast.success("Rating submitted."),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });
  if (!rateeId) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="font-display text-lg font-bold text-ink">Rate this experience</div>
      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setScore(n)} className="p-1" aria-label={`${n} stars`}>
            <Star className={cn("h-6 w-6", n <= score ? "fill-urgency-today text-urgency-today" : "text-clay-soft")} />
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional note…"
        className="mt-3 w-full rounded-xl border border-border bg-background px-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      <button
        onClick={() => rate.mutate()}
        disabled={rate.isPending}
        className="mt-3 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-background hover:bg-primary disabled:opacity-60"
      >
        Submit rating
      </button>
    </div>
  );
}