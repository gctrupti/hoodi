import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarCheck,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Star,
  Loader2,
  Receipt,
  Check,
  X,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listCustomerBookings,
  respondToQuotation,
  updateBookingStatus,
  submitServiceReview,
} from "@/lib/hoodi/services.functions";

export const Route = createFileRoute("/_authenticated/services/bookings")({
  head: () => ({
    meta: [{ title: "My Service Bookings — Hoodi" }],
  }),
  component: CustomerBookingsPage,
});

function CustomerBookingsPage() {
  const queryClient = useQueryClient();
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<string | null>(null);

  // Review Form
  const [rating, setRating] = useState(5);
  const [qualityRating, setQualityRating] = useState(5);
  const [punctualityRating, setPunctualityRating] = useState(5);
  const [communicationRating, setCommunicationRating] = useState(5);
  const [comment, setComment] = useState("");

  const getBookings = useServerFn(listCustomerBookings);
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["services", "customer-bookings"],
    queryFn: () => getBookings(),
  });

  const respondQuoteFn = useServerFn(respondToQuotation);
  const quoteMutation = useMutation({
    mutationFn: (payload: { bookingId: string; quoteId: string; action: "accept" | "reject" }) =>
      respondQuoteFn({ data: payload }),
    onSuccess: (_, vars) => {
      toast.success(vars.action === "accept" ? "Quotation accepted & booking confirmed!" : "Quotation rejected.");
      queryClient.invalidateQueries({ queryKey: ["services", "customer-bookings"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to respond to quote.");
    },
  });

  const updateStatusFn = useServerFn(updateBookingStatus);
  const statusMutation = useMutation({
    mutationFn: (payload: { bookingId: string; status: "in_progress" | "completed" | "cancelled"; reason?: string }) =>
      updateStatusFn({ data: payload }),
    onSuccess: () => {
      toast.success("Booking updated!");
      queryClient.invalidateQueries({ queryKey: ["services", "customer-bookings"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update booking.");
    },
  });

  const submitReviewFn = useServerFn(submitServiceReview);
  const reviewMutation = useMutation({
    mutationFn: (payload: {
      bookingId: string;
      rating: number;
      qualityRating?: number;
      punctualityRating?: number;
      communicationRating?: number;
      comment?: string;
    }) => submitReviewFn({ data: payload }),
    onSuccess: () => {
      toast.success("Thank you for reviewing your provider!");
      setSelectedBookingForReview(null);
      queryClient.invalidateQueries({ queryKey: ["services", "customer-bookings"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to submit review.");
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between border-b border-border/60 pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            My Service Bookings
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Track your requested services, review quotes, and rate completed work
          </p>
        </div>
        <Link
          to="/services/search"
          className="rounded-2xl bg-ink px-4 py-2 text-xs font-semibold text-background hover:bg-primary"
        >
          Book Another Service
        </Link>
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-ink-soft">Loading your bookings...</p>
        </div>
      ) : bookings.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-border p-12 text-center">
          <CalendarCheck className="mx-auto h-12 w-12 text-ink-soft" />
          <h3 className="mt-3 font-display text-xl font-bold text-ink">No service bookings yet</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Explore trusted local electricians, plumbers, tutors, and professionals near you.
          </p>
          <Link
            to="/services"
            className="mt-5 inline-flex items-center gap-1 rounded-2xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            Explore Services
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {bookings.map((booking: any) => {
            const latestQuote = booking.quotes?.find((q: any) => q.status === "pending") ?? booking.quotes?.[0];
            return (
              <div
                key={booking.id}
                className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-2xs"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-ink-soft uppercase tracking-wider">
                        {booking.status.replace("_", " ")}
                      </span>
                      <span className="text-xs text-ink-soft">
                        Scheduled for: {booking.scheduled_date} ({booking.scheduled_time_slot})
                      </span>
                    </div>

                    <h2 className="mt-2 font-display text-xl font-bold text-ink">
                      {booking.title}
                    </h2>
                    <p className="mt-1 text-xs text-ink-soft leading-relaxed">
                      {booking.description}
                    </p>

                    <div className="mt-3 flex items-center gap-3 text-xs text-ink-soft">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-primary" /> {booking.address}
                      </span>
                      <span className="font-semibold text-ink">
                        Provider: {booking.provider?.business_name}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider text-ink-soft">
                      {booking.final_price ? "Final Price" : "Budget Estimate"}
                    </span>
                    <p className="font-display text-2xl font-extrabold text-ink">
                      ₹{Number(booking.final_price ?? booking.budget ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Quotation Section */}
                {latestQuote && booking.status === "quote_sent" && (
                  <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900">
                        <Receipt className="h-4 w-4 text-amber-600" /> Itemized Quotation Received
                      </span>
                      <span className="font-display text-lg font-extrabold text-amber-900">
                        Total: ₹{Number(latestQuote.total_amount).toLocaleString()}
                      </span>
                    </div>

                    {Array.isArray(latestQuote.itemized_items) && latestQuote.itemized_items.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-amber-500/20 pt-2 text-xs">
                        {latestQuote.itemized_items.map((it: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-ink-soft">
                            <span>{it.description}</span>
                            <span className="font-semibold text-ink">₹{Number(it.amount).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {latestQuote.notes && (
                      <p className="mt-2 text-xs italic text-ink-soft">
                        Note from provider: &quot;{latestQuote.notes}&quot;
                      </p>
                    )}

                    <div className="mt-4 flex gap-2 justify-end">
                      <button
                        onClick={() =>
                          quoteMutation.mutate({
                            bookingId: booking.id,
                            quoteId: latestQuote.id,
                            action: "reject",
                          })
                        }
                        disabled={quoteMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-sand"
                      >
                        <X className="h-3.5 w-3.5" /> Decline Quote
                      </button>
                      <button
                        onClick={() =>
                          quoteMutation.mutate({
                            bookingId: booking.id,
                            quoteId: latestQuote.id,
                            action: "accept",
                          })
                        }
                        disabled={quoteMutation.isPending}
                        className="inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
                      >
                        <Check className="h-3.5 w-3.5" /> Accept Quotation
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions Bar */}
                <div className="mt-5 flex flex-wrap items-center justify-between border-t border-border/60 pt-4 gap-2">
                  <div className="text-xs text-ink-soft">
                    {booking.status === "accepted" && "Waiting for provider to arrive and start service."}
                    {booking.status === "in_progress" && "Service is currently in progress."}
                    {booking.status === "completed" && "Service has been completed."}
                  </div>

                  <div className="flex gap-2">
                    {booking.status === "in_progress" && (
                      <button
                        onClick={() =>
                          statusMutation.mutate({
                            bookingId: booking.id,
                            status: "completed",
                          })
                        }
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Mark Completed
                      </button>
                    )}

                    {booking.status === "completed" && (
                      <button
                        onClick={() => setSelectedBookingForReview(booking.id)}
                        className="inline-flex items-center gap-1 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-ink shadow-2xs hover:bg-amber-400"
                      >
                        <Star className="h-3.5 w-3.5 fill-ink" /> Leave Review
                      </button>
                    )}

                    {["requested", "provider_review", "quote_sent"].includes(booking.status) && (
                      <button
                        onClick={() =>
                          statusMutation.mutate({
                            bookingId: booking.id,
                            status: "cancelled",
                            reason: "Cancelled by customer",
                          })
                        }
                        className="rounded-xl border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        Cancel Request
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog
        open={Boolean(selectedBookingForReview)}
        onOpenChange={(open) => !open && setSelectedBookingForReview(null)}
      >
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-ink">
              Rate Your Experience
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!selectedBookingForReview) return;
              reviewMutation.mutate({
                bookingId: selectedBookingForReview,
                rating,
                qualityRating,
                punctualityRating,
                communicationRating,
                comment: comment.trim(),
              });
            }}
            className="mt-4 space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Overall Rating (1 - 5 Stars)
              </label>
              <div className="mt-2 flex gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    className="p-1 text-amber-500 hover:scale-110 transition"
                  >
                    <Star
                      className={`h-7 w-7 ${
                        s <= rating ? "fill-amber-500 text-amber-500" : "text-border"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-y border-border/60 py-3 text-xs">
              <div>
                <span className="text-ink-soft">Quality</span>
                <select
                  value={qualityRating}
                  onChange={(e) => setQualityRating(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-1 text-xs"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>{n} ★</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-ink-soft">Punctuality</span>
                <select
                  value={punctualityRating}
                  onChange={(e) => setPunctualityRating(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-1 text-xs"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>{n} ★</option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-ink-soft">Communication</span>
                <select
                  value={communicationRating}
                  onChange={(e) => setCommunicationRating(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-1 text-xs"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>{n} ★</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Review Comments
              </label>
              <textarea
                placeholder="Share your feedback about the service provided..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedBookingForReview(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-sand"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reviewMutation.isPending}
                className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
              >
                Submit Review
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
