import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  User,
  Star,
  CheckCircle2,
  MapPin,
  Clock,
  ShieldCheck,
  Briefcase,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { getProviderPublicProfile } from "@/lib/hoodi/services.functions";

export const Route = createFileRoute("/_authenticated/services/provider/$providerId")({
  head: () => ({
    meta: [{ title: "Provider Profile — Hoodi Services" }],
  }),
  component: ProviderPublicProfilePage,
});

function ProviderPublicProfilePage() {
  const { providerId } = Route.useParams();

  const getProfile = useServerFn(getProviderPublicProfile);
  const { data, isLoading } = useQuery({
    queryKey: ["services", "provider", providerId],
    queryFn: () => getProfile({ data: { providerId } }),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-sm text-ink-soft">Loading provider profile...</p>
      </div>
    );
  }

  const { provider, listings, reviews } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        to="/services/search"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to services
      </Link>

      {/* Header Profile Card */}
      <div className="mt-4 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-3xl bg-amber-500/10 text-amber-800">
              <User className="h-8 w-8" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">
                  {provider.business_name}
                </h1>
                {provider.is_verified_provider && (
                  <span title="Verified Professional Provider">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                {provider.experience_years} years experience • {provider.completed_jobs_count} completed jobs
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-600/20">
                  <ShieldCheck className="h-3 w-3" /> Identity Verified
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-0.5 text-xs font-bold text-amber-800">
                  <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  {Number(provider.rating).toFixed(1)} / 5.0 Rating
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 text-xs text-ink-soft">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-primary" /> Service Area: {provider.service_radius_km} km radius
            </span>
            {provider.address && <span className="text-[11px]">{provider.address}</span>}
          </div>
        </div>

        {/* Bio */}
        {provider.bio && (
          <div className="mt-6 border-t border-border/60 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">About Provider</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
              {provider.bio}
            </p>
          </div>
        )}

        {/* Skills */}
        {Array.isArray(provider.skills) && provider.skills.length > 0 && (
          <div className="mt-4 border-t border-border/60 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Skills & Specializations</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {provider.skills.map((skill: string) => (
                <span key={skill} className="rounded-full bg-sand px-3 py-1 text-xs font-medium text-ink">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Services Offered by this Provider */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
          Services Offered ({listings.length})
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((item: any) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 shadow-2xs transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              <div>
                <span className="rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-medium text-ink-soft">
                  {item.category?.name ?? "Service"}
                </span>
                <h3 className="mt-2 font-display text-lg font-bold text-ink">
                  <Link to="/services/$serviceId" params={{ serviceId: item.id }} className="hover:text-primary">
                    {item.title}
                  </Link>
                </h3>
                <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{item.description}</p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                <span className="font-display text-base font-extrabold text-ink">
                  ₹{Number(item.base_price).toLocaleString()}
                </span>
                <Link
                  to="/services/$serviceId"
                  params={{ serviceId: item.id }}
                  className="rounded-xl bg-ink px-3.5 py-1.5 text-xs font-semibold text-background transition hover:bg-primary"
                >
                  Book
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink">
          Customer Reviews ({reviews.length})
        </h2>
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
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-700">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    {rev.rating} / 5
                  </span>
                </div>
                {rev.comment && (
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft">{rev.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
