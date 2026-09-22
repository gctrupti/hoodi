import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  getRequest,
  acceptRequest,
  deleteRequest,
  repostRequest,
  updateRequestProgress,
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
  FileText,
  RotateCcw,
  Pencil,
  ShieldAlert,
  Camera,
  Eye,
  Wallet,
  Clock,
  UserCheck,
  AlertTriangle,
} from "lucide-react";
import { REQUEST_TYPE_META, type RequestType } from "@/lib/hoodi/request-types";
import { googleDirectionsUrl } from "@/lib/hoodi/location";
import { toast } from "sonner";
import { useTrust } from "@/hooks/use-trust";
import { TrustBadges } from "@/components/hoodi/TrustBadges";
import { ReportUserMenu } from "@/components/hoodi/ReportUserMenu";
import { ContactReveal } from "@/components/hoodi/ContactReveal";
import { RequestReceiptModal } from "@/components/hoodi/RequestReceiptModal";
import { EditRequestModal } from "@/components/hoodi/EditRequestModal";
import { CancelRequestModal } from "@/components/hoodi/CancelRequestModal";
import { DisputeRequestModal } from "@/components/hoodi/DisputeRequestModal";
import { HelperProfileModal } from "@/components/hoodi/HelperProfileModal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/help/requests/$id")({
  component: RequestDetail,
});

function RequestDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  // Dialog states
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [helperProfileOpen, setHelperProfileOpen] = useState(false);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [proofInputUrl, setProofInputUrl] = useState("");
  const [proofNote, setProofNote] = useState("");

  const me = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const req = useQuery({
    queryKey: ["request", id],
    queryFn: () => getRequest({ data: { requestId: id } }),
    refetchInterval: 5_000,
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

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`request_realtime_${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "help_requests", filter: `id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["request", id] });
          qc.invalidateQueries({ queryKey: ["thread", id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  // Actions
  const accept = useMutation({
    mutationFn: () => acceptRequest({ data: { requestId: id } }),
    onSuccess: () => {
      toast.success("You accepted this request!");
      qc.invalidateQueries({ queryKey: ["request", id] });
      qc.invalidateQueries({ queryKey: ["thread", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const progressMutation = useMutation({
    mutationFn: (args: { stage: "to_pickup" | "arrived" | "completed"; proofPhotoUrl?: string; notes?: string }) =>
      updateRequestProgress({
        data: {
          requestId: id,
          stage: args.stage,
          proofPhotoUrl: args.proofPhotoUrl,
          notes: args.notes,
        },
      }),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["request", id] });
      if (vars.stage === "to_pickup") toast.success("Task started! Head towards pickup location.");
      else if (vars.stage === "arrived") toast.success("Marked arrived at location!");
      else if (vars.stage === "completed") {
        toast.success("Task marked complete with proof! Awaiting requester release.");
        setProofModalOpen(false);
      }
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

  const repostMutation = useMutation({
    mutationFn: () => repostRequest({ data: { requestId: id } }),
    onSuccess: (newReq) => {
      toast.success("Request reposted to neighborhood feed!");
      navigate({ to: "/help/requests/$id", params: { id: newReq.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const removeReq = useMutation({
    mutationFn: () => deleteRequest({ data: { requestId: id } }),
    onSuccess: () => {
      toast.success("Request deleted.");
      navigate({ to: "/help/dashboard" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  if (req.isLoading || me.isLoading) {
    return (
      <div className="grid place-items-center py-24 text-ink-soft">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!r) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center text-ink-soft">
        Request not found.
      </div>
    );
  }

  const fare = r.final_fare ?? r.estimated_fare ?? 0;
  const platformFee = Math.round(fare * 0.15);
  const helperNetEarnings = fare - platformFee;

  // Determine current lifecycle step:
  // 1: OPEN, 2: ASSIGNED, 3: IN_PROGRESS, 4: ARRIVED, 5: COMPLETED, 6: RATED
  let currentStep = 1;
  const isCancelled = r.status === "cancelled";
  const hasDispute = !!r.dispute;
  const isRated = !!r.rating;

  if (isRated) {
    currentStep = 6;
  } else if (r.status === "completed") {
    currentStep = 5;
  } else if (r.status === "in_progress") {
    if (r.delivery_stage === "picked_up") {
      currentStep = 4; // ARRIVED
    } else {
      currentStep = 3; // IN_PROGRESS
    }
  } else if (r.status === "accepted") {
    currentStep = 2; // ASSIGNED
  } else {
    currentStep = 1; // OPEN
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/help/dashboard" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink transition">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <div className="flex items-center gap-2">
          {(r.status === "completed" || isRated) && (
            <button
              onClick={() => setReceiptOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-sand transition shadow-2xs"
            >
              <FileText className="h-3.5 w-3.5 text-primary" /> View Invoice & Receipt
            </button>
          )}
          {iAmRequester && (isCancelled || r.status === "completed" || isRated) && (
            <button
              onClick={() => repostMutation.mutate()}
              disabled={repostMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-sand/80 transition"
            >
              <RotateCcw className="h-3.5 w-3.5 text-primary" /> Repost Request
            </button>
          )}
        </div>
      </div>

      {/* Lifecycle Progress Stepper */}
      <section className="rounded-3xl border border-border bg-card p-5 shadow-xs overflow-hidden">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-ink-soft flex items-center gap-2">
            <span>Marketplace Status Pipeline</span>
            {isCancelled && (
              <span className="rounded-full bg-urgency-emergency-soft px-2.5 py-0.5 text-[11px] font-bold text-urgency-emergency border border-urgency-emergency/30">
                CANCELLED
              </span>
            )}
            {hasDispute && (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 border border-amber-500/30">
                DISPUTED
              </span>
            )}
          </div>
          <div className="text-xs font-medium text-ink-soft">
            {isRated
              ? "Completed & Rated ★"
              : r.status === "completed"
              ? "Completed"
              : currentStep === 4
              ? "Helper Arrived"
              : currentStep === 3
              ? "In Progress"
              : currentStep === 2
              ? "Assigned to Helper"
              : isCancelled
              ? "Cancelled"
              : "Open for Assistance"}
          </div>
        </div>

        {/* Steps visual track */}
        <div className="grid grid-cols-6 gap-1 relative">
          {[
            { step: 1, label: "Open" },
            { step: 2, label: "Assigned" },
            { step: 3, label: "In Progress" },
            { step: 4, label: "Arrived" },
            { step: 5, label: "Completed" },
            { step: 6, label: "Rated" },
          ].map((s) => {
            const isDone = !isCancelled && currentStep >= s.step;
            const isCurrent = !isCancelled && currentStep === s.step;
            return (
              <div key={s.step} className="flex flex-col items-center text-center group">
                <div
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition",
                    isDone
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : isCancelled
                      ? "bg-muted text-muted-foreground"
                      : "bg-sand text-ink-soft border border-border",
                    isCurrent && "ring-4 ring-primary/20",
                  )}
                >
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : s.step}
                </div>
                <span
                  className={cn(
                    "mt-1.5 text-[11px] font-medium transition",
                    isDone ? "text-ink font-semibold" : "text-ink-soft",
                    isCurrent && "text-primary font-bold",
                  )}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Active Dispute Banner */}
      {hasDispute && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed flex-1">
            <div className="font-bold text-sm">Dispute under Community Review</div>
            <p className="mt-0.5 text-amber-800 dark:text-amber-300">
              A dispute was raised for this request: {r.dispute.details}. Escrow funds are secured while trust moderators investigate.
            </p>
          </div>
        </div>
      )}

      {/* Main Request Card */}
      <article className="rounded-3xl border border-border bg-card p-6 shadow-xs relative">
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
            {isRated ? "Rated" : String(r.status).replace(/_/g, " ")}
          </span>

          {iAmRequester && r.status === "open" && (
            <button
              onClick={() => setEditOpen(true)}
              className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit Request
            </button>
          )}
        </div>

        <h1 className="mt-4 font-display text-2xl sm:text-3xl font-bold text-ink">{r.title}</h1>
        {r.description && (
          <p className="mt-2 whitespace-pre-line text-sm text-ink-soft leading-relaxed">{r.description}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-ink-soft">
          <span>Posted {formatRelative(r.created_at)}</span>
          {r.address_text && <span>· {r.address_text}</span>}
          <div className="ml-auto flex items-baseline gap-1">
            <span className="text-xs text-ink-soft font-medium">Offered Fare:</span>
            <span className="font-display text-2xl font-bold text-ink">
              {r.is_paid === false ? "Free Mutual Aid" : inr(fare)}
            </span>
          </div>
        </div>

        {/* Route / Locations Map Box */}
        <RequestRoute request={r} />

        {/* Uploaded Proof Photo Preview (if completed) */}
        {r.photo_url && (
          <div className="mt-5 rounded-2xl border border-border/80 bg-sand/30 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-2 flex items-center gap-1.5">
              <Camera className="h-3.5 w-3.5 text-primary" /> Delivery Proof / Completion Photo
            </div>
            <div className="flex items-center gap-4">
              <img
                src={r.photo_url}
                alt="Delivery proof"
                className="h-28 w-28 rounded-xl object-cover border border-border shadow-xs"
              />
              <div className="text-xs text-ink-soft space-y-1">
                <div className="font-semibold text-ink">Attached by Helper</div>
                <div>Proof submitted upon task completion.</div>
                <a
                  href={r.photo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                >
                  <Eye className="h-3 w-3" /> View full photo
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Contextual Action Bar */}
        <div className="mt-6 flex flex-wrap items-center gap-2.5 pt-4 border-t border-border">
          {/* Helper: Accept Button */}
          {!canParticipate && r.status === "open" && (
            <button
              disabled={accept.isPending}
              onClick={() => accept.mutate()}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs disabled:opacity-60"
            >
              {accept.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Accept & Help Neighbor
            </button>
          )}

          {/* Helper: Navigate to Pickup */}
          {iAmHelper && (r.status === "accepted" || r.status === "in_progress") && (
            <a
              href={googleDirectionsUrl(r.pickup_lat ?? 12.973, r.pickup_lng ?? 77.602)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-ink hover:bg-sand transition"
            >
              <Navigation className="h-3.5 w-3.5 text-primary" /> Directions to Pickup
            </a>
          )}

          {/* Helper: Start Task (ASSIGNED -> IN_PROGRESS) */}
          {iAmHelper && r.status === "accepted" && (
            <button
              disabled={progressMutation.isPending}
              onClick={() => progressMutation.mutate({ stage: "to_pickup" })}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-background hover:bg-primary transition shadow-xs"
            >
              <Play className="h-3.5 w-3.5" /> Start Errand (Head to Pickup)
            </button>
          )}

          {/* Helper: Mark Arrived (IN_PROGRESS -> ARRIVED) */}
          {iAmHelper && r.status === "in_progress" && r.delivery_stage !== "picked_up" && (
            <button
              disabled={progressMutation.isPending}
              onClick={() => progressMutation.mutate({ stage: "arrived" })}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
            >
              <MapPin className="h-3.5 w-3.5" /> I Have Arrived at Location
            </button>
          )}

          {/* Helper: Upload Proof & Complete Task */}
          {iAmHelper && (r.status === "accepted" || r.status === "in_progress") && (
            <button
              onClick={() => setProofModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-urgency-normal px-4 py-2 text-xs font-semibold text-background hover:opacity-90 transition shadow-xs"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Upload Proof & Mark Complete
            </button>
          )}

          {/* Requester: Release Escrow Payment */}
          {iAmRequester && r.status === "completed" && r.is_paid && !r.final_fare && (
            <button
              onClick={() => releasePayment.mutate()}
              disabled={releasePayment.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs disabled:opacity-60"
            >
              <CircleDollarSign className="h-4 w-4" />
              Confirm & Release {inr(fare)}
            </button>
          )}

          {/* File Dispute Button */}
          {canParticipate && (r.status === "accepted" || r.status === "in_progress") && !hasDispute && (
            <button
              onClick={() => setDisputeOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-card px-3.5 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-500/10 transition"
            >
              <ShieldAlert className="h-3.5 w-3.5" /> Raise Dispute
            </button>
          )}

          {/* Cancel Button */}
          {canParticipate && r.status !== "completed" && r.status !== "cancelled" && (
            <button
              onClick={() => setCancelOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold text-ink-soft hover:bg-sand transition"
            >
              <XCircle className="h-3.5 w-3.5" /> Cancel Request
            </button>
          )}

          {/* Delete (open only) */}
          {iAmRequester && r.status === "open" && (
            <button
              onClick={() => {
                if (confirm("Delete this request permanently?")) removeReq.mutate();
              }}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-urgency-emergency/40 px-3 py-1.5 text-xs font-semibold text-urgency-emergency hover:bg-urgency-emergency-soft transition"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
        </div>
      </article>

      {/* Helper Earnings Card (shown only to helper) */}
      {iAmHelper && r.is_paid && (
        <section className="rounded-3xl border border-border bg-sand/40 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <h2 className="font-display text-base font-bold text-ink">Helper Earnings Breakdown</h2>
            </div>
            <Link to="/help/dashboard" className="text-xs font-semibold text-primary hover:underline">
              View Wallet
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
            <div className="rounded-2xl border border-border/80 bg-background/80 p-3">
              <div className="text-ink-soft">Gross Request Fare</div>
              <div className="mt-0.5 font-display text-base font-bold text-ink">{inr(fare)}</div>
            </div>
            <div className="rounded-2xl border border-border/80 bg-background/80 p-3">
              <div className="text-ink-soft">Platform Fee (15%)</div>
              <div className="mt-0.5 font-display text-base font-bold text-clay">- {inr(platformFee)}</div>
            </div>
            <div className="rounded-2xl border border-primary/40 bg-primary/5 p-3">
              <div className="text-primary font-semibold">Your Net Payout</div>
              <div className="mt-0.5 font-display text-base font-extrabold text-primary">{inr(helperNetEarnings)}</div>
            </div>
          </div>
        </section>
      )}

      {/* Counterparty Profile Card (Helper details for Requester, Requester details for Helper) */}
      {canParticipate && (
        <CounterpartyCard
          isRequesterViewingHelper={iAmRequester}
          user={iAmRequester ? r.helper : r.requester}
          userId={iAmRequester ? r.helper_id : r.requester_id}
          requestId={id}
          onOpenProfile={() => setHelperProfileOpen(true)}
          unlocked={["accepted", "in_progress", "completed"].includes(String(r.status))}
        />
      )}

      {/* Realtime Private Chat Thread */}
      {canParticipate && thread.data && (
        <ChatPanel threadId={thread.data.id} myId={myId!} isRequester={iAmRequester} />
      )}

      {/* Rating & Review Panel */}
      {canParticipate && r.status === "completed" && (
        <RatingReviewSection
          requestId={id}
          rateeId={iAmRequester ? r.helper_id : r.requester_id}
          existingRating={r.rating}
        />
      )}

      {/* Helper: Upload Proof Modal */}
      {proofModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              <h3 className="font-display text-lg font-bold text-ink">Upload Delivery / Errand Proof</h3>
            </div>
            <p className="text-xs text-ink-soft">
              Provide a photo URL (receipt, delivered parcel, handed item) to verify task completion.
            </p>

            <div>
              <label className="text-xs font-semibold text-ink-soft">Proof Photo URL</label>
              <input
                value={proofInputUrl}
                onChange={(e) => setProofInputUrl(e.target.value)}
                placeholder="https://... or choose quick demo proof below"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs outline-none focus:border-primary"
              />
            </div>

            {/* Quick Demo Photo options */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-ink-soft uppercase tracking-wider">Quick Sample Proof:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: "Medicine Receipt", url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500" },
                  { label: "Doorstep Package", url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500" },
                  { label: "Grocery Bag", url: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500" },
                ].map((demo) => (
                  <button
                    key={demo.label}
                    type="button"
                    onClick={() => setProofInputUrl(demo.url)}
                    className="rounded-full border border-border bg-sand/60 px-2.5 py-1 text-[11px] font-medium text-ink hover:bg-sand"
                  >
                    {demo.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-ink-soft">Completion Note (Optional)</label>
              <textarea
                rows={2}
                value={proofNote}
                onChange={(e) => setProofNote(e.target.value)}
                placeholder="e.g. Handed package to gatekeeper, sealed with bill attached."
                className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-xs outline-none focus:border-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setProofModalOpen(false)}
                className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-sand transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={progressMutation.isPending}
                onClick={() =>
                  progressMutation.mutate({
                    stage: "completed",
                    proofPhotoUrl: proofInputUrl.trim() || undefined,
                    notes: proofNote.trim() || undefined,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-full bg-urgency-normal px-5 py-2 text-xs font-semibold text-background hover:opacity-90 transition disabled:opacity-60"
              >
                {progressMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm & Mark Complete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <RequestReceiptModal open={receiptOpen} onOpenChange={setReceiptOpen} request={r} />
      <EditRequestModal open={editOpen} onOpenChange={setEditOpen} request={r} />
      <CancelRequestModal
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        requestId={id}
        isAssigned={r.status === "accepted" || r.status === "in_progress"}
      />
      <DisputeRequestModal open={disputeOpen} onOpenChange={setDisputeOpen} requestId={id} />
      <HelperProfileModal
        open={helperProfileOpen}
        onOpenChange={setHelperProfileOpen}
        helper={r.helper}
      />
    </div>
  );
}

/** Counterparty card showing helper details to requester, or requester details to helper */
function CounterpartyCard({
  isRequesterViewingHelper,
  user,
  userId,
  requestId,
  onOpenProfile,
  unlocked,
}: {
  isRequesterViewingHelper: boolean;
  user?: { name?: string | null; bio?: string | null; profile_photo_url?: string | null; phone_verified?: boolean } | null;
  userId?: string | null;
  requestId: string;
  onOpenProfile: () => void;
  unlocked: boolean;
}) {
  const trust = useTrust(userId ?? null);
  if (!userId) return null;

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary font-display font-bold text-lg border border-primary/20">
            {user?.name ? user.name[0].toUpperCase() : "U"}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold text-ink">
                {user?.name ?? (isRequesterViewingHelper ? "Assigned Helper" : "Requester")}
              </h2>
              <TrustBadges badges={trust.data?.badges} />
            </div>
            <div className="text-xs text-ink-soft mt-0.5">
              {isRequesterViewingHelper ? "Neighborhood Community Helper" : "Neighbor in need of assistance"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRequesterViewingHelper && (
            <button
              onClick={onOpenProfile}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-sand/60 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sand transition"
            >
              <UserCheck className="h-3.5 w-3.5 text-primary" /> View Helper Profile
            </button>
          )}
          <ReportUserMenu
            targetUserId={userId}
            targetName={user?.name}
            contextType="help_request"
            contextId={requestId}
          />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/70">
        <ContactReveal userId={userId} name={user?.name} unlocked={unlocked} />
      </div>
    </section>
  );
}

/** Route path stops breakdown */
function RequestRoute({ request }: { request: Record<string, unknown> }) {
  const type = (request.request_type as RequestType | undefined) ?? "custom";
  const meta = REQUEST_TYPE_META[type] ?? REQUEST_TYPE_META.custom;
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
      address: (request.dropoff_address as string | null) ?? (request.address_text as string | null) ?? null,
      lat: dropLat,
      lng: dropLng,
    });
  }
  if (model.service && stops.length === 0) {
    stops.push({
      label: model.service.label,
      name: null,
      address: (request.address_text as string | null) ?? null,
      lat: null,
      lng: null,
    });
  }

  return (
    <div className="mt-5 rounded-2xl border border-border bg-sand/40 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
        <span aria-hidden>{meta.emoji}</span>
        {meta.label} Route
      </div>
      <ol className="space-y-3">
        {stops.map((s, i) => (
          <li key={s.label + i} className="flex gap-3">
            <div className="flex flex-col items-center">
              {s.business ? <Store className="h-4 w-4 text-clay" /> : <MapPin className="h-4 w-4 text-primary" />}
              {i < stops.length - 1 && <span className="mt-1 h-6 w-px flex-1 bg-border" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-soft">{s.label}</div>
              {s.name && <div className="text-sm font-semibold text-ink">{s.name}</div>}
              <div className="text-xs text-ink-soft">{s.address ?? "Address shared with helper"}</div>
              {s.lat != null && s.lng != null && (
                <a
                  href={googleDirectionsUrl(s.lat, s.lng)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Navigation className="h-3 w-3" /> Get Directions
                </a>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Realtime Chat Panel with quick chips */
function ChatPanel({
  threadId,
  myId,
  isRequester,
}: {
  threadId: string;
  myId: string;
  isRequester: boolean;
}) {
  const qc = useQueryClient();
  const msgs = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => listMessages({ data: { threadId } }),
    refetchInterval: 4_000,
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

  const suggestions = isRequester
    ? ["I'm at the gate waiting", "Please call when you reach", "Take your time, no rush!", "Thank you!"]
    : ["I'm on my way!", "Arrived at the location", "Item purchased successfully", "Standing near the entrance"];

  return (
    <div className="flex h-[28rem] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-xs">
      <div className="border-b border-border px-5 py-3 text-xs font-semibold uppercase tracking-widest text-ink-soft flex items-center justify-between">
        <span>Private Neighbor Chat</span>
        <span className="text-[10px] text-primary font-bold">End-to-End Encrypted</span>
      </div>

      <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
        {msgs.data?.length === 0 && (
          <p className="mt-16 text-center text-xs text-ink-soft">
            Say hello — messages are only visible between you and your neighbor.
          </p>
        )}
        {msgs.data?.map((m) => {
          const mine = m.sender_id === myId;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-2xs",
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

      {/* Canned suggestions */}
      <div className="flex gap-1.5 overflow-x-auto px-4 py-1.5 bg-sand/30 border-t border-border/60">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => send.mutate(s)}
            className="whitespace-nowrap rounded-full border border-border/80 bg-background px-2.5 py-0.5 text-[11px] text-ink-soft hover:text-ink hover:bg-sand transition"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) send.mutate(text.trim());
        }}
        className="flex items-center gap-2 border-t border-border px-4 py-3 bg-card"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message to your neighbor…"
          className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="submit"
          disabled={send.isPending || !text.trim()}
          className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition shadow-2xs disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

/** Rating & Review section with stars & praise tags */
function RatingReviewSection({
  requestId,
  rateeId,
  existingRating,
}: {
  requestId: string;
  rateeId: string | null;
  existingRating?: { score: number; comment?: string | null; created_at: string } | null;
}) {
  const qc = useQueryClient();
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  const rateMutation = useMutation({
    mutationFn: () => {
      const fullComment = selectedTag ? `[${selectedTag}] ${comment}`.trim() : comment.trim();
      return submitRating({
        data: {
          requestId,
          rateeId: rateeId!,
          score,
          comment: fullComment || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Thank you! Rating submitted.");
      qc.invalidateQueries({ queryKey: ["request", requestId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  if (!rateeId) return null;

  if (existingRating) {
    return (
      <section className="rounded-3xl border border-border bg-card p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-urgency-today text-urgency-today" />
            <h3 className="font-display text-base font-bold text-ink">Your Rating & Review</h3>
          </div>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
            Rated {existingRating.score} / 5 Stars
          </span>
        </div>
        <div className="mt-3 flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={cn(
                "h-5 w-5",
                s <= existingRating.score ? "fill-urgency-today text-urgency-today" : "text-border",
              )}
            />
          ))}
        </div>
        {existingRating.comment && (
          <p className="mt-2 text-xs text-ink-soft italic">"{existingRating.comment}"</p>
        )}
      </section>
    );
  }

  const tags = ["Prompt & Fast", "Handled With Care", "Very Polite", "Great Communication", "Super Reliable"];

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-xs space-y-4">
      <div>
        <h3 className="font-display text-lg font-bold text-ink">Rate this Experience</h3>
        <p className="text-xs text-ink-soft">
          Help build neighbor trust by leaving an honest rating and feedback.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setScore(n)}
            className="p-1 hover:scale-110 transition"
          >
            <Star
              className={cn(
                "h-7 w-7",
                n <= score ? "fill-urgency-today text-urgency-today" : "text-sand border-border",
              )}
            />
          </button>
        ))}
        <span className="ml-2 text-sm font-bold text-ink">{score} of 5 Stars</span>
      </div>

      {/* Praise tags */}
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSelectedTag(selectedTag === t ? null : t)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              selectedTag === t
                ? "border-primary bg-primary text-primary-foreground font-semibold"
                : "border-border bg-sand/50 text-ink-soft hover:bg-sand",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <textarea
        rows={2}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Write a helpful note about this errand..."
        className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-xs outline-none focus:border-primary"
      />

      <div className="flex justify-end">
        <button
          onClick={() => rateMutation.mutate()}
          disabled={rateMutation.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-2 text-xs font-semibold text-background hover:bg-primary transition shadow-xs disabled:opacity-60"
        >
          {rateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Submit Rating & Complete
        </button>
      </div>
    </section>
  );
}