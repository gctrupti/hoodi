import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Wrench,
  Clock,
  MapPin,
  Star,
  CheckCircle2,
  Calendar,
  Send,
  Loader2,
  User,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getServiceDetail,
  requestServiceBooking,
} from "@/lib/hoodi/services.functions";

export const Route = createFileRoute("/_authenticated/services/$serviceId")({
  head: () => ({
    meta: [{ title: "Service Details — Hoodi" }],
  }),
  component: ServiceDetailPage,
});

function ServiceDetailPage() {
  const { serviceId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  // Form state
  const [scheduledDate, setScheduledDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0],
  );
  const [timeSlot, setTimeSlot] = useState("morning");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");

  const getDetail = useServerFn(getServiceDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["services", "detail", serviceId],
    queryFn: () => getDetail({ data: { serviceId } }),
  });

  const requestBookingFn = useServerFn(requestServiceBooking);
  const bookingMutation = useMutation({
    mutationFn: (payload: {
      providerId: string;
      listingId: string;
      categoryId?: string;
      title: string;
      description: string;
      scheduledDate: string;
      scheduledTimeSlot: string;
      address: string;
      budget?: number;
    }) => requestBookingFn({ data: payload }),
    onSuccess: () => {
      toast.success("Service request sent to provider!");
      setIsBookingOpen(false);
      queryClient.invalidateQueries({ queryKey: ["services", "my-bookings"] });
      navigate({ to: "/services/bookings" });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to submit request.");
    },
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-sm text-ink-soft">Loading service details...</p>
      </div>
    );
  }

  const { listing, reviews } = data;
  const prov = listing.provider;

  function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) {
      toast.error("Please enter service location/address");
      return;
    }
    if (!description.trim()) {
      toast.error("Please describe what needs to be done");
      return;
    }

    bookingMutation.mutate({
      providerId: prov.user_id,
      listingId: listing.id,
      categoryId: listing.category?.id,
      title: listing.title,
      description: description.trim(),
      scheduledDate,
      scheduledTimeSlot: timeSlot,
      address: address.trim(),
      budget: budget ? Number(budget) : undefined,
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        to="/services/search"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to service search
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Main Details */}
        <main>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-ink-soft">
              {listing.category?.name ?? "Service"}
            </span>
            {listing.subcategory && (
              <span className="rounded-full bg-sand/60 px-3 py-1 text-xs text-ink-soft">
                {listing.subcategory.name}
              </span>
            )}
          </div>

          <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {listing.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-ink-soft">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-primary" /> Estimated Duration: ~{listing.estimated_duration_mins} mins
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-primary" /> Service Area: {listing.service_area_radius_km} km radius
            </span>
            <span className="flex items-center gap-1 font-bold text-amber-700">
              <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
              {Number(listing.rating).toFixed(1)} ({listing.completed_jobs} completed jobs)
            </span>
          </div>

          {/* Description */}
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-2xs">
            <h2 className="font-display text-lg font-bold text-ink">Service Description</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
              {listing.description}
            </p>
          </div>

          {/* Provider Card */}
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-2xs">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-500/10 text-amber-800">
                  <User className="h-6 w-6" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-display text-lg font-bold text-ink">
                      {prov.business_name}
                    </h3>
                    {prov.is_verified_provider && (
                      <span title="Verified Pro">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-soft">
                    {prov.experience_years} years experience • {prov.completed_jobs_count} completed jobs
                  </p>
                </div>
              </div>
              <Link
                to="/services/provider/$providerId"
                params={{ providerId: prov.user_id }}
                className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sand"
              >
                View Profile
              </Link>
            </div>

            {/* Provider skills & languages */}
            <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-border/60">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-600/20">
                <ShieldCheck className="h-3 w-3" /> Identity Verified
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-0.5 text-xs text-ink-soft">
                ⭐ {Number(prov.rating).toFixed(1)} Provider Rating
              </span>
            </div>
          </div>

          {/* Customer Reviews */}
          <div className="mt-8">
            <h2 className="font-display text-xl font-bold text-ink">Customer Reviews ({reviews.length})</h2>
            {reviews.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">No reviews yet for this provider.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {reviews.map((rev: any) => (
                  <div key={rev.id} className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink">
                        {rev.reviewer?.name ?? "Neighbor"}
                      </span>
                      <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold">
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                        {rev.rating} / 5
                      </div>
                    </div>
                    {rev.comment && (
                      <p className="mt-2 text-xs leading-relaxed text-ink-soft">{rev.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Pricing & Booking Card Sidebar */}
        <aside className="h-fit rounded-3xl border border-border bg-card p-6 shadow-soft">
          <div className="border-b border-border/60 pb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {listing.pricing_type === "fixed"
                ? "Fixed Price"
                : listing.pricing_type === "hourly"
                ? "Hourly Rate"
                : "Starting From"}
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-display text-4xl font-extrabold text-ink">
                ₹{Number(listing.base_price).toLocaleString()}
              </span>
              {listing.pricing_type === "hourly" && (
                <span className="text-xs text-ink-soft">/ hour</span>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              {listing.pricing_type === "custom_quote"
                ? "Final price provided via custom quotation after review."
                : "Transparent direct booking with escrow guarantee."}
            </p>
          </div>

          <div className="mt-6 space-y-3 text-xs text-ink-soft">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> No upfront charges before booking confirmation
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Direct in-app chat with {prov.business_name}
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Itemized quotation for labor & parts
            </div>
          </div>

          <button
            onClick={() => setIsBookingOpen(true)}
            className="mt-6 w-full rounded-2xl bg-ink py-3.5 text-sm font-semibold text-background shadow-soft transition hover:bg-primary"
          >
            Request Booking
          </button>
        </aside>
      </div>

      {/* Booking Request Dialog */}
      <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-ink">
              Request &quot;{listing.title}&quot;
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmitRequest} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Preferred Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Preferred Time Slot
              </label>
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink focus:border-primary focus:outline-none"
              >
                <option value="morning">Morning (9 AM - 12 PM)</option>
                <option value="afternoon">Afternoon (12 PM - 4 PM)</option>
                <option value="evening">Evening (4 PM - 8 PM)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Service Address / Neighborhood
              </label>
              <input
                type="text"
                placeholder="Apartment name, street, landmarks..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Task Details & Instructions
              </label>
              <textarea
                placeholder="Describe what needs to be inspected, repaired or taught..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Estimated Budget (Optional, ₹)
              </label>
              <input
                type="number"
                placeholder="e.g. 500"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBookingOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-sand"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={bookingMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
              >
                {bookingMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit Request
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
