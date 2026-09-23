import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus,
  Wrench,
  Clock,
  MapPin,
  Star,
  CheckCircle2,
  Trash2,
  Edit2,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  listMyServiceListings,
  listServiceCategories,
  saveServiceListing,
} from "@/lib/hoodi/services.functions";

export const Route = createFileRoute("/_authenticated/services/provider/services")({
  head: () => ({
    meta: [{ title: "My Service Listings — Hoodi Services" }],
  }),
  component: ProviderListingsPage,
});

function ProviderListingsPage() {
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [pricingType, setPricingType] = useState<"fixed" | "starting_from" | "hourly" | "custom_quote">("starting_from");
  const [basePrice, setBasePrice] = useState(499);
  const [duration, setDuration] = useState(60);
  const [radius, setRadius] = useState(15);

  const getListings = useServerFn(listMyServiceListings);
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["services", "my-listings"],
    queryFn: () => getListings(),
  });

  const getCategories = useServerFn(listServiceCategories);
  const { data: categories = [] } = useQuery({
    queryKey: ["services", "categories"],
    queryFn: () => getCategories(),
  });

  const saveListingFn = useServerFn(saveServiceListing);
  const saveMutation = useMutation({
    mutationFn: () =>
      saveListingFn({
        data: {
          categoryId,
          subcategoryId: subcategoryId || undefined,
          title: title.trim(),
          description: description.trim(),
          pricingType,
          basePrice,
          estimatedDurationMins: duration,
          serviceAreaRadiusKm: radius,
          isActive: true,
        },
      }),
    onSuccess: () => {
      toast.success("New service listing published!");
      setIsAddOpen(false);
      setTitle("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["services", "my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["services", "featured"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save listing.");
    },
  });

  const selectedCategoryObj = categories.find((c) => c.id === categoryId);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        to="/services/provider/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>

      <div className="mt-4 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
            My Service Listings
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Manage your service offerings, set pricing, and publish new skills
          </p>
        </div>

        <button
          onClick={() => {
            if (categories.length > 0 && !categoryId) {
              setCategoryId(categories[0].id);
            }
            setIsAddOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-2xl bg-ink px-4 py-2.5 text-xs font-semibold text-background hover:bg-primary shadow-xs"
        >
          <Plus className="h-4 w-4" /> Add New Service
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-sm text-ink-soft">Loading your listings...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-border p-12 text-center">
          <Wrench className="mx-auto h-12 w-12 text-ink-soft" />
          <h3 className="mt-3 font-display text-xl font-bold text-ink">No services listed yet</h3>
          <p className="mt-1 text-sm text-ink-soft">
            Create your first service listing to start receiving requests from neighbors.
          </p>
          <button
            onClick={() => {
              if (categories.length > 0 && !categoryId) {
                setCategoryId(categories[0].id);
              }
              setIsAddOpen(true);
            }}
            className="mt-5 inline-flex items-center gap-1 rounded-2xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Create Listing
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {listings.map((item: any) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-2xs"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                    {item.category?.name ?? "Service"}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-700">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    {Number(item.rating).toFixed(1)} ({item.completed_jobs} jobs)
                  </span>
                </div>

                <h3 className="mt-2.5 font-display text-lg font-bold text-ink">
                  {item.title}
                </h3>
                <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-ink-soft">
                  {item.description}
                </p>

                <div className="mt-4 flex items-center gap-3 text-xs text-ink-soft border-t border-border/60 pt-3">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-primary" /> ~{item.estimated_duration_mins}m
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary" /> {item.service_area_radius_km} km radius
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-ink-soft">
                    {item.pricing_type}
                  </span>
                  <p className="font-display text-lg font-extrabold text-ink">
                    ₹{Number(item.base_price).toLocaleString()}
                  </p>
                </div>

                <Link
                  to="/services/$serviceId"
                  params={{ serviceId: item.id }}
                  className="rounded-xl border border-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-sand"
                >
                  View Listing
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Service Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-ink">
              Create New Service Listing
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
            className="mt-4 space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Service Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setSubcategoryId("");
                }}
                required
                className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink focus:border-primary focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCategoryObj?.subcategories && selectedCategoryObj.subcategories.length > 0 && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Subcategory
                </label>
                <select
                  value={subcategoryId}
                  onChange={(e) => setSubcategoryId(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink focus:border-primary focus:outline-none"
                >
                  <option value="">General</option>
                  {selectedCategoryObj.subcategories.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Service Title
              </label>
              <input
                type="text"
                placeholder="e.g. AC Deep Cleaning & Chemical Wash"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                Description & Inclusions
              </label>
              <textarea
                placeholder="Detail what is included in the service, tools used, and guarantee..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
                className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink focus:border-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Pricing Model
                </label>
                <select
                  value={pricingType}
                  onChange={(e) => setPricingType(e.target.value as "fixed" | "starting_from" | "hourly" | "custom_quote")}
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink focus:border-primary focus:outline-none"
                >
                  <option value="starting_from">Starting From</option>
                  <option value="fixed">Fixed Price</option>
                  <option value="hourly">Hourly Rate</option>
                  <option value="custom_quote">Custom Quote</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Base / Starting Price (₹)
                </label>
                <input
                  type="number"
                  value={basePrice}
                  onChange={(e) => setBasePrice(Number(e.target.value))}
                  min={0}
                  required
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Est. Duration (Mins)
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  min={15}
                  step={15}
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Service Radius (km)
                </label>
                <input
                  type="number"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  min={1}
                  max={50}
                  className="mt-1 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-ink focus:border-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-sand"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Publish Listing
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
