import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  Search,
  Filter,
  MapPin,
  Star,
  CheckCircle2,
  Clock,
  Wrench,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import {
  listServiceCategories,
  searchServices,
} from "@/lib/hoodi/services.functions";

const SearchParamsSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  radius: z.coerce.number().optional(),
});

export const Route = createFileRoute("/_authenticated/services/search")({
  validateSearch: (search) => SearchParamsSchema.parse(search),
  head: () => ({
    meta: [{ title: "Search Services — Hoodi" }],
  }),
  component: ServicesSearchPage,
});

function ServicesSearchPage() {
  const searchParams = Route.useSearch();
  const [queryText, setQueryText] = useState(searchParams.q ?? "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.category ?? "all");
  const [selectedRadius, setSelectedRadius] = useState<number>(searchParams.radius ?? 10);
  const [pricingType, setPricingType] = useState<string>("all");
  const [minRating, setMinRating] = useState<number>(0);
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);

  const getCategories = useServerFn(listServiceCategories);
  const { data: categories = [] } = useQuery({
    queryKey: ["services", "categories"],
    queryFn: () => getCategories(),
  });

  const getServices = useServerFn(searchServices);
  const { data: services = [], isLoading } = useQuery({
    queryKey: [
      "services",
      "search",
      queryText,
      selectedCategory,
      pricingType,
      minRating,
      verifiedOnly,
      selectedRadius,
    ],
    queryFn: () =>
      getServices({
        data: {
          query: queryText,
          categorySlug: selectedCategory,
          pricingType: pricingType,
          minRating: minRating > 0 ? minRating : undefined,
          verifiedOnly: verifiedOnly,
          radiusKm: selectedRadius,
        },
      }),
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Search Header */}
      <div className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            Find Local Services
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Hyperlocal marketplace with PostGIS neighborhood radius matching
          </p>
        </div>

        {/* Radius selector */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs font-semibold text-ink-soft">
            <MapPin className="h-4 w-4 text-primary" /> Radius:
          </span>
          <div className="flex gap-1 rounded-2xl border border-border bg-card p-1">
            {[1, 2, 5, 10, 20].map((r) => (
              <button
                key={r}
                onClick={() => setSelectedRadius(r)}
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition ${
                  selectedRadius === r
                    ? "bg-ink text-background shadow-xs"
                    : "text-ink-soft hover:bg-sand hover:text-ink"
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Filters Sidebar */}
        <aside className="h-fit rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <div className="flex items-center gap-2 font-display text-base font-bold text-ink">
            <Filter className="h-4 w-4" /> Filters
          </div>

          {/* Search Query Input */}
          <div className="mt-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Keywords
            </label>
            <div className="relative mt-1.5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
              <input
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Plumber, Electrician..."
                className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs text-ink focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div className="mt-5 border-t border-border/60 pt-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink focus:border-primary focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Pricing Model */}
          <div className="mt-5 border-t border-border/60 pt-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Pricing Model
            </label>
            <select
              value={pricingType}
              onChange={(e) => setPricingType(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-ink focus:border-primary focus:outline-none"
            >
              <option value="all">Any Pricing</option>
              <option value="fixed">Fixed Price</option>
              <option value="starting_from">Starting From</option>
              <option value="hourly">Hourly Rate</option>
              <option value="custom_quote">Custom Quotation</option>
            </select>
          </div>

          {/* Rating Filter */}
          <div className="mt-5 border-t border-border/60 pt-4">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              Minimum Rating
            </label>
            <div className="mt-2 flex flex-col gap-1.5">
              {[
                { label: "Any Rating", val: 0 },
                { label: "4.0 ★ and above", val: 4.0 },
                { label: "4.5 ★ and above", val: 4.5 },
                { label: "4.8 ★ and above", val: 4.8 },
              ].map((r) => (
                <label key={r.val} className="flex items-center gap-2 text-xs text-ink cursor-pointer">
                  <input
                    type="radio"
                    name="minRating"
                    checked={minRating === r.val}
                    onChange={() => setMinRating(r.val)}
                    className="accent-primary"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          {/* Verification Only */}
          <div className="mt-5 border-t border-border/60 pt-4">
            <label className="flex items-center justify-between text-xs font-semibold text-ink cursor-pointer">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Verified Pros Only
              </span>
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(e) => setVerifiedOnly(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
              />
            </label>
          </div>
        </aside>

        {/* Results Area */}
        <main>
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {services.length} services available within {selectedRadius} km
            </span>
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-48 animate-pulse rounded-2xl bg-sand/60" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <Wrench className="mx-auto h-10 w-10 text-ink-soft" />
              <h3 className="mt-3 font-display text-lg font-bold text-ink">No services match your filters</h3>
              <p className="mt-1 text-sm text-ink-soft">
                Try expanding your search radius or selecting &quot;All Categories&quot;.
              </p>
              <button
                onClick={() => {
                  setQueryText("");
                  setSelectedCategory("all");
                  setPricingType("all");
                  setMinRating(0);
                  setVerifiedOnly(false);
                  setSelectedRadius(20);
                }}
                className="mt-4 rounded-full bg-sand px-4 py-2 text-xs font-semibold text-ink hover:bg-sand/80"
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-2xs transition hover:-translate-y-0.5 hover:shadow-soft"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
                        {service.category?.name}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                        <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                        {Number(service.rating).toFixed(1)}
                      </span>
                    </div>

                    <h3 className="mt-2.5 font-display text-lg font-bold leading-snug text-ink">
                      <Link to="/services/$serviceId" params={{ serviceId: service.id }} className="hover:text-primary">
                        {service.title}
                      </Link>
                    </h3>

                    <p className="mt-1.5 line-clamp-2 text-xs text-ink-soft">
                      {service.description}
                    </p>

                    <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-ink">
                          {service.provider?.business_name}
                        </span>
                        {service.provider?.is_verified_provider && (
                          <span title="Verified Provider">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-[11px] text-ink-soft">
                        <Clock className="h-3 w-3" /> ~{service.estimated_duration_mins}m
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-ink-soft">
                        {service.pricing_type === "fixed" ? "Fixed Price" : "Starting at"}
                      </span>
                      <p className="font-display text-lg font-extrabold text-ink">
                        ₹{Number(service.base_price).toLocaleString()}
                      </p>
                    </div>
                    <Link
                      to="/services/$serviceId"
                      params={{ serviceId: service.id }}
                      className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-background transition hover:bg-primary"
                    >
                      Book Service
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
