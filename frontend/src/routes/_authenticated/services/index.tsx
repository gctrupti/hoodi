import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Wrench,
  Sparkles,
  Briefcase,
  Camera,
  Search,
  MapPin,
  Star,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  PlusCircle,
} from "lucide-react";
import {
  listServiceCategories,
  searchServices,
} from "@/lib/hoodi/services.functions";

export const Route = createFileRoute("/_authenticated/services/")({
  head: () => ({
    meta: [
      { title: "Hoodi Services — Professional Local Experts" },
      {
        name: "description",
        content:
          "Find and book verified electricians, plumbers, tutors, beauty experts, and professionals within your neighborhood.",
      },
    ],
  }),
  component: ServicesMarketplaceHome,
});

const CATEGORY_ICONS: Record<string, typeof Wrench> = {
  "home-services": Wrench,
  "personal-services": Sparkles,
  "professional-services": Briefcase,
  "event-services": Camera,
};

function ServicesMarketplaceHome() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const getCategories = useServerFn(listServiceCategories);
  const { data: categories = [] } = useQuery({
    queryKey: ["services", "categories"],
    queryFn: () => getCategories(),
  });

  const getServices = useServerFn(searchServices);
  const { data: featuredServices = [], isLoading } = useQuery({
    queryKey: ["services", "featured"],
    queryFn: () => getServices({ data: {} }),
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate({
        to: "/services/search",
        search: { q: searchQuery.trim() },
      });
    } else {
      navigate({ to: "/services/search" });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {/* Hero Header with Search */}
      <section className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-br from-amber-500/10 via-sand/60 to-background p-6 sm:p-10">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-900 ring-1 ring-amber-500/20">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" /> Hoodi Services Marketplace
          </div>
          <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Trusted local pros, <span className="text-primary">right on your street.</span>
          </h1>
          <p className="mt-3 text-base leading-relaxed text-ink-soft sm:text-lg">
            Book verified electricians, plumbers, tutors, beauty artists, and skilled professionals
            with transparent pricing and direct local booking.
          </p>

          <form onSubmit={handleSearch} className="mt-6 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" />
              <input
                type="text"
                placeholder="Search 'AC Repair', 'Electrician', 'Web Developer'..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-border bg-card py-3 pl-11 pr-4 text-sm text-ink placeholder:text-ink-soft/70 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-ink px-6 py-3 text-sm font-semibold text-background shadow-soft transition hover:bg-primary"
            >
              Search Pros
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </section>

      {/* Categories Grid (Dynamic) */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-ink">Explore Categories</h2>
            <p className="mt-1 text-sm text-ink-soft">Everyday home needs, personal wellness & professional services</p>
          </div>
          <Link
            to="/services/search"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.slug] ?? Wrench;
            return (
              <Link
                key={cat.id}
                to="/services/search"
                search={{ category: cat.slug }}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift"
              >
                <div>
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/10 text-amber-700 transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 font-display text-lg font-bold text-ink group-hover:text-primary">
                    {cat.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-soft">
                    {cat.description}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-ink-soft group-hover:text-ink">
                  Browse pros
                  <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured Services Nearby */}
      <section className="mt-14">
        <div className="flex items-center justify-between">
          <div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              <MapPin className="h-3.5 w-3.5" /> Hyperlocal Verified Services
            </span>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-ink">Popular Services Near You</h2>
          </div>
          <Link
            to="/services/search"
            className="hidden text-sm font-semibold text-primary hover:underline sm:inline-flex"
          >
            All listings
          </Link>
        </div>

        {isLoading ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-56 animate-pulse rounded-2xl bg-sand/60" />
            ))}
          </div>
        ) : featuredServices.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center">
            <Wrench className="mx-auto h-8 w-8 text-ink-soft" />
            <p className="mt-2 text-sm text-ink-soft">No active service listings found yet.</p>
            <Link
              to="/services/provider/services"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              <PlusCircle className="h-4 w-4" /> Be the first pro to list a service
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredServices.map((service) => (
              <div
                key={service.id}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft transition duration-200 hover:-translate-y-1 hover:shadow-lift"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center rounded-full bg-sand px-2.5 py-0.5 text-xs font-medium text-ink-soft">
                      {service.category?.name ?? "Service"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                      {Number(service.rating).toFixed(1)} ({service.completed_jobs} jobs)
                    </span>
                  </div>

                  <h3 className="mt-3 font-display text-lg font-bold leading-snug text-ink group-hover:text-primary">
                    <Link to="/services/$serviceId" params={{ serviceId: service.id }}>
                      {service.title}
                    </Link>
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm text-ink-soft">
                    {service.description}
                  </p>

                  <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-xs font-semibold text-ink">
                          {service.provider?.business_name}
                        </span>
                        {service.provider?.is_verified_provider && (
                          <span title="Verified Provider">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-[11px] text-ink-soft">
                        <Clock className="h-3 w-3" /> ~{service.estimated_duration_mins} mins
                      </span>
                    </div>
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
                    className="inline-flex items-center gap-1 rounded-xl bg-ink px-3.5 py-1.5 text-xs font-semibold text-background transition hover:bg-primary"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Become a Provider Banner */}
      <section className="mt-16 rounded-3xl border border-amber-500/20 bg-linear-to-r from-amber-500/10 via-sand to-background p-6 sm:p-8">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1 text-xs font-semibold text-ink shadow-2xs">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Grow your local business
            </span>
            <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Become a verified service provider on Hoodi
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Electricians, plumbers, yoga instructors, freelance tutors, and technicians: connect directly with
              neighbors needing your services. Set your own rates, send custom quotations, and receive secure payments.
            </p>
          </div>
          <Link
            to="/services/provider/dashboard"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90"
          >
            Open Provider Portal
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
