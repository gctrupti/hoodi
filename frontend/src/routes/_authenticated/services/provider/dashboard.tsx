import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  Star,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  Send,
  Plus,
  Trash2,
  Receipt,
  Play,
  Check,
  AlertCircle,
  Loader2,
  DollarSign,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getMyProviderProfile,
  saveProviderProfile,
  listProviderBookings,
  sendQuotation,
  updateBookingStatus,
} from "@/lib/hoodi/services.functions";

export const Route = createFileRoute("/_authenticated/services/provider/dashboard")({
  head: () => ({
    meta: [{ title: "Provider Dashboard — Hoodi Services" }],
  }),
  component: ProviderDashboardPage,
});

type LineItem = { description: string; amount: number };

function ProviderDashboardPage() {
  const queryClient = useQueryClient();
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  // Quote Builder State
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "Inspection & Diagnostic", amount: 150 },
    { description: "Labor & Service", amount: 500 },
  ]);
  const [duration, setDuration] = useState("1-2 hours");
  const [quoteNotes, setQuoteNotes] = useState("");

  // Provider Onboarding Form State
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [bio, setBio] = useState("");
  const [experienceYears, setExperienceYears] = useState(3);
  const [serviceRadiusKm, setServiceRadiusKm] = useState(15);
  const [skillsStr, setSkillsStr] = useState("Electrical, AC Repair, Plumbing");

  const getProfile = useServerFn(getMyProviderProfile);
  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["services", "my-provider-profile"],
    queryFn: () => getProfile(),
  });

  const getBookings = useServerFn(listProviderBookings);
  const { data: bookings = [], isLoading: isBookingsLoading } = useQuery({
    queryKey: ["services", "provider-bookings"],
    queryFn: () => getBookings(),
  });

  const saveProfileFn = useServerFn(saveProviderProfile);
  const profileMutation = useMutation({
    mutationFn: () =>
      saveProfileFn({
        data: {
          businessName: businessName.trim(),
          bio: bio.trim(),
          experienceYears,
          serviceRadiusKm,
          skills: skillsStr
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          languages: ["English", "Hindi"],
          isAvailable: true,
        },
      }),
    onSuccess: () => {
      toast.success("Provider profile saved!");
      setIsOnboardingOpen(false);
      queryClient.invalidateQueries({ queryKey: ["services", "my-provider-profile"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save profile.");
    },
  });

  const sendQuoteFn = useServerFn(sendQuotation);
  const quoteMutation = useMutation({
    mutationFn: () => {
      if (!selectedBookingId) throw new Error("No booking selected");
      const total = lineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return sendQuoteFn({
        data: {
          bookingId: selectedBookingId,
          totalAmount: total,
          estimatedDuration: duration,
          itemizedItems: lineItems,
          notes: quoteNotes.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Quotation sent to customer!");
      setIsQuoteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["services", "provider-bookings"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to send quote.");
    },
  });

  const updateStatusFn = useServerFn(updateBookingStatus);
  const statusMutation = useMutation({
    mutationFn: (payload: { bookingId: string; status: "in_progress" | "completed" | "cancelled" }) =>
      updateStatusFn({ data: payload }),
    onSuccess: () => {
      toast.success("Booking status updated!");
      queryClient.invalidateQueries({ queryKey: ["services", "provider-bookings"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update booking status.");
    },
  });

  const totalQuoteAmount = lineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  if (isProfileLoading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-sm text-ink-soft">Loading provider dashboard...</p>
      </div>
    );
  }

  // If not yet a provider, show onboarding banner
  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
          <span className="grid h-16 w-16 place-items-center rounded-3xl bg-amber-500/10 text-amber-800 mx-auto">
            <Briefcase className="h-8 w-8" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-extrabold text-ink sm:text-3xl">
            Become a Hoodi Service Provider
          </h1>
          <p className="mt-2 max-w-lg mx-auto text-sm leading-relaxed text-ink-soft">
            Offer your professional skills, trade, or services to verified neighbors on Hoodi.
            Publish custom service listings, set your rates, send itemized quotes, and get paid securely.
          </p>

          <button
            onClick={() => setIsOnboardingOpen(true)}
            className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft hover:bg-primary/90"
          >
            Create Provider Profile
          </button>
        </div>

        {/* Onboarding Dialog */}
        <Dialog open={isOnboardingOpen} onOpenChange={setIsOnboardingOpen}>
          <DialogContent className="max-w-md rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold text-ink">
                Setup Provider Profile
              </DialogTitle>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                profileMutation.mutate();
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Business / Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Suresh Electrical Solutions"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Professional Bio
                </label>
                <textarea
                  placeholder="Briefly describe your experience, tools, and background..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                    Experience (Years)
                  </label>
                  <input
                    type="number"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(Number(e.target.value))}
                    min={0}
                    max={50}
                    className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                    Service Radius (km)
                  </label>
                  <input
                    type="number"
                    value={serviceRadiusKm}
                    onChange={(e) => setServiceRadiusKm(Number(e.target.value))}
                    min={1}
                    max={50}
                    className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Skills (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="Wiring, AC Service, Inverter, Plumbing"
                  value={skillsStr}
                  onChange={(e) => setSkillsStr(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOnboardingOpen(false)}
                  className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-sand"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={profileMutation.isPending}
                  className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Save & Launch Profile
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Active Provider Dashboard
  const pendingRequests = bookings.filter((b: any) => ["requested", "provider_review", "quote_sent"].includes(b.status));
  const activeJobs = bookings.filter((b: any) => ["accepted", "scheduled", "in_progress"].includes(b.status));
  const completedJobs = bookings.filter((b: any) => b.status === "completed");

  const totalEarnings = completedJobs.reduce((sum: number, b: any) => {
    const gross = Number(b.final_price || 0);
    const comm = Number(b.commission_amount || 0);
    return sum + (gross - comm);
  }, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
              {profile.business_name}
            </h1>
            {profile.is_verified_provider && (
              <span title="Verified Pro">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Service Provider Portal • {profile.completed_jobs_count} completed jobs • ⭐ {Number(profile.rating).toFixed(1)} rating
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            to="/services/provider/services"
            className="rounded-2xl border border-border px-4 py-2 text-xs font-semibold text-ink hover:bg-sand"
          >
            Manage My Listings
          </Link>
          <Link
            to="/services/provider/$providerId"
            params={{ providerId: profile.user_id }}
            className="rounded-2xl bg-ink px-4 py-2 text-xs font-semibold text-background hover:bg-primary"
          >
            Public Profile
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-ink-soft">Pending Requests</span>
          <p className="mt-2 font-display text-3xl font-bold text-amber-700">{pendingRequests.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-ink-soft">Active Jobs</span>
          <p className="mt-2 font-display text-3xl font-bold text-primary">{activeJobs.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-ink-soft">Completed Jobs</span>
          <p className="mt-2 font-display text-3xl font-bold text-emerald-700">{completedJobs.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <span className="text-xs uppercase tracking-wider text-ink-soft">Net Earnings</span>
          <p className="mt-2 font-display text-3xl font-bold text-ink">
            ₹{totalEarnings.toLocaleString()}
          </p>
          <span className="text-[10px] text-ink-soft">after 10% platform fee</span>
        </div>
      </div>

      {/* Incoming Requests Table */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink">Incoming Service Requests ({pendingRequests.length})</h2>

        {pendingRequests.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center text-xs text-ink-soft">
            No pending service requests right now.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {pendingRequests.map((req: any) => (
              <div key={req.id} className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-ink-soft uppercase tracking-wider">
                        {req.status.replace("_", " ")}
                      </span>
                      <span className="text-xs text-ink-soft">
                        Date: {req.scheduled_date} ({req.scheduled_time_slot})
                      </span>
                    </div>

                    <h3 className="mt-2 font-display text-lg font-bold text-ink">{req.title}</h3>
                    <p className="mt-1 text-xs text-ink-soft">{req.description}</p>

                    <div className="mt-3 flex items-center gap-4 text-xs text-ink-soft">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-primary" /> {req.address}
                      </span>
                      <span>Customer: {req.customer?.name ?? "Neighbor"}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className="font-display text-lg font-bold text-ink">
                      Budget: ₹{Number(req.budget ?? 0).toLocaleString()}
                    </span>

                    <button
                      onClick={() => {
                        setSelectedBookingId(req.id);
                        setIsQuoteOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-background hover:bg-primary shadow-xs"
                    >
                      <Receipt className="h-3.5 w-3.5" /> Send Quotation
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Active Jobs */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-ink">Active Scheduled Jobs ({activeJobs.length})</h2>

        {activeJobs.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border p-8 text-center text-xs text-ink-soft">
            No active jobs in progress.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {activeJobs.map((job: any) => (
              <div key={job.id} className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 uppercase tracking-wider">
                      {job.status}
                    </span>
                    <h3 className="mt-2 font-display text-lg font-bold text-ink">{job.title}</h3>
                    <p className="mt-1 text-xs text-ink-soft">{job.address}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {job.status === "accepted" && (
                      <button
                        onClick={() =>
                          statusMutation.mutate({ bookingId: job.id, status: "in_progress" })
                        }
                        className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-background hover:bg-primary"
                      >
                        Start Service
                      </button>
                    )}

                    {job.status === "in_progress" && (
                      <button
                        onClick={() =>
                          statusMutation.mutate({ bookingId: job.id, status: "completed" })
                        }
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Complete & Collect Earnings
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quotation Builder Dialog */}
      <Dialog open={isQuoteOpen} onOpenChange={setIsQuoteOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-ink">
              Send Itemized Quotation
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              quoteMutation.mutate();
            }}
            className="mt-4 space-y-4"
          >
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Itemized Line Items
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setLineItems([...lineItems, { description: "Additional Labor / Parts", amount: 200 }])
                  }
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" /> Add Item
                </button>
              </div>

              <div className="mt-2 space-y-2">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => {
                        const updated = [...lineItems];
                        updated[idx].description = e.target.value;
                        setLineItems(updated);
                      }}
                      className="flex-1 rounded-xl border border-border bg-background p-2 text-xs text-ink focus:border-primary focus:outline-none"
                    />
                    <input
                      type="number"
                      placeholder="₹"
                      value={item.amount}
                      onChange={(e) => {
                        const updated = [...lineItems];
                        updated[idx].amount = Number(e.target.value);
                        setLineItems(updated);
                      }}
                      className="w-24 rounded-xl border border-border bg-background p-2 text-xs text-ink focus:border-primary focus:outline-none"
                    />
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}
                        className="p-1 text-ink-soft hover:text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-sand/60 p-3">
              <span className="text-xs font-bold text-ink">Total Estimate:</span>
              <span className="font-display text-lg font-extrabold text-ink">
                ₹{totalQuoteAmount.toLocaleString()}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Estimated Duration
              </label>
              <input
                type="text"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 1-2 hours"
                className="mt-1 w-full rounded-xl border border-border bg-background p-2 text-xs text-ink focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Notes for Customer
              </label>
              <textarea
                placeholder="Includes 30-day workmanship warranty, genuine parts..."
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-border bg-background p-2 text-xs text-ink focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsQuoteOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-sand"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={quoteMutation.isPending || totalQuoteAmount <= 0}
                className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
              >
                Send Quotation
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
