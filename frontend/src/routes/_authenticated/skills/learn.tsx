import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clock, Crosshair, Loader2, MapPin, Search, Star } from "lucide-react";
import { browseTeachers, type TeacherCard } from "@/lib/hoodi/skills.functions";
import { inr } from "@/lib/hoodi/format";
import { DAY_SHORT, groupByDay, parseSlots } from "@/lib/hoodi/availability";
import { LocationSearch } from "@/components/hoodi/LocationSearch";
import { useHoodiLocation } from "@/hooks/use-hoodi-location";
import {
  DEFAULT_RADIUS_M,
  RADIUS_OPTIONS,
  formatDistance,
  formatRadius,
  shortAddress,
} from "@/lib/hoodi/location";
import { useTrustBatch } from "@/hooks/use-trust";
import { TrustBadges } from "@/components/hoodi/TrustBadges";

export const Route = createFileRoute("/_authenticated/skills/learn")({
  head: () => ({
    meta: [
      { title: "Learn — Hoodi Skills" },
      { name: "description", content: "Learn skills from trusted mentors in your community." },
      { property: "og:title", content: "Learn — Hoodi Skills" },
      {
        property: "og:description",
        content: "Find mentors near you and book real sessions in your neighborhood.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LearnPage,
});

const CATEGORIES = [
  "Languages",
  "Music",
  "Cooking",
  "Tech & Coding",
  "Art & Design",
  "Fitness",
  "Academics",
  "Crafts",
];

function LearnPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("");
  const loc = useHoodiLocation();
  const [nearMe, setNearMe] = useState(true);
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const coords = nearMe ? loc.coords : null;

  const filters = {
    q: q.trim() || undefined,
    category: category ?? undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    minRating: minRating ? Number(minRating) : undefined,
    lat: coords?.lat,
    lng: coords?.lng,
    radiusM: coords ? radiusM : undefined,
  };

  const teachers = useQuery({
    queryKey: ["browse-teachers", filters],
    queryFn: () => browseTeachers({ data: filters }),
  });

  const placeLabel = shortAddress(loc.location);
  const trust = useTrustBatch((teachers.data ?? []).map((t) => t.teacher_id));

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Hoodi Skills
          </span>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Learn from your neighbors
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-soft">
            Browse mentors nearby, book sessions, and pick up new skills in your own community.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={() => (loc.coords ? setNearMe((v) => !v) : loc.useDeviceLocation())}
            disabled={loc.isSaving}
            className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:text-ink disabled:opacity-60"
          >
            {loc.isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Crosshair className="h-3.5 w-3.5" />
            )}
            {!loc.coords
              ? "Use my location"
              : nearMe
                ? `Near ${placeLabel ?? "me"} · tap to show all`
                : "Show mentors near me"}
          </button>
          {nearMe && loc.coords && (
            <div className="flex items-center gap-1.5 text-xs">
              {RADIUS_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRadiusM(r)}
                  className={
                    "rounded-full border px-2.5 py-1 font-semibold transition " +
                    (radiusM === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-ink-soft hover:bg-sand")
                  }
                >
                  {formatRadius(r)}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="mt-4">
        <LocationSearch
          bias={loc.coords}
          onSelect={(p) => {
            setNearMe(true);
            loc.saveLocation({
              latitude: p.latitude,
              longitude: p.longitude,
              formatted_address: p.formatted_address,
              city: p.city,
              state: p.state,
              country: p.country,
            });
          }}
          placeholder="Search another neighborhood to browse mentors there…"
        />
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 shadow-sm">
        <Search className="h-4 w-4 text-ink-soft" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search skills, mentors, or topics…"
          className="w-full bg-transparent text-sm text-ink placeholder:text-ink-soft/70 focus:outline-none"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <label className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-ink-soft">
          Max ₹
          <input
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
            placeholder="any"
            className="w-14 bg-transparent text-ink outline-none"
          />
        </label>
        <label className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-ink-soft">
          Min rating
          <select
            value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
            className="bg-transparent text-ink outline-none"
          >
            <option value="">any</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
            <option value="4.5">4.5+</option>
          </select>
        </label>
        {category && (
          <button
            onClick={() => setCategory(null)}
            className="rounded-full bg-primary/15 px-3 py-1.5 font-semibold text-primary"
          >
            {category} ✕
          </button>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
          Browse categories
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(category === c ? null : c)}
              className={
                "rounded-2xl border px-4 py-5 text-center text-sm font-medium shadow-sm transition " +
                (category === c
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-ink hover:border-primary/50")
              }
            >
              {c}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
          {teachers.data?.length ?? 0} mentor{(teachers.data?.length ?? 0) === 1 ? "" : "s"} available
        </h2>
        {teachers.isLoading ? (
          <div className="flex h-40 items-center justify-center text-ink-soft">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (teachers.data ?? []).length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title="No mentors match yet"
            body="Try clearing filters or widening your search. New neighbors are publishing skills all the time."
          />
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(teachers.data ?? []).map((t) => (
              <TeacherCardView key={t.teacher_id} t={t} badges={trust.data?.[t.teacher_id]?.badges} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
}

function TeacherCardView({ t, badges }: { t: TeacherCard; badges?: string[] }) {
  const slots = parseSlots(t.availability_slots);
  const days = groupByDay(slots).map((g) => DAY_SHORT[g.day]);
  return (
    <article className="flex flex-col rounded-2xl border border-border bg-background p-5 shadow-sm transition hover:border-primary/60">
      <div className="flex items-start gap-3">
        {t.profile_photo_url ? (
          <img
            src={t.profile_photo_url}
            alt={`${t.name ?? "Mentor"} profile photo`}
            className="h-14 w-14 shrink-0 rounded-2xl object-cover"
            loading="lazy"
          />
        ) : (
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sand font-display text-lg font-bold text-ink">
            {(t.name ?? "H").slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-bold text-ink">{t.name ?? "Neighbor"}</h3>
              <TrustBadges badges={badges} max={2} className="mt-1" />
            </div>
            {t.avg_score != null && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sand px-2 py-1 text-xs font-semibold text-ink">
                <Star className="h-3 w-3 fill-current" /> {t.avg_score} ({t.rating_count})
              </span>
            )}
          </div>
          {t.headline && <p className="text-sm text-ink-soft">{t.headline}</p>}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {t.offerings.slice(0, 3).map((o) => (
          <span key={o.id} className="rounded-full bg-sand px-2.5 py-1 text-xs text-ink-soft">
            {o.title}
          </span>
        ))}
        {t.offerings.length > 3 && (
          <span className="rounded-full px-2 py-1 text-xs text-ink-soft">
            +{t.offerings.length - 3} more
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
        <span className="font-semibold text-ink">from {inr(t.min_price ?? 0)}</span>
        <span>{t.experience_years} yr experience</span>
        {formatDistance(t.distance_m) && (
          <span className="inline-flex items-center gap-1 text-ink-soft">
            <MapPin className="h-3 w-3 text-primary" />
            {formatDistance(t.distance_m)} away
          </span>
        )}
      </div>

      <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-soft">
        <Clock className="h-3.5 w-3.5" />
        {days.length ? days.join(" · ") : t.availability || "Flexible timings"}
      </p>

      <div className="mt-4 flex gap-2">
        <Link
          to="/skills/teacher/$teacherId"
          params={{ teacherId: t.teacher_id }}
          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
        >
          Book now
        </Link>
        <Link
          to="/skills/teacher/$teacherId"
          params={{ teacherId: t.teacher_id }}
          className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink"
        >
          View profile
        </Link>
      </div>
    </article>
  );
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="mt-10 flex flex-col items-center rounded-3xl border border-dashed border-border bg-sand/40 px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-background text-ink shadow-inner">
        {icon}
      </span>
      <h3 className="mt-4 font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-ink-soft">{body}</p>
    </div>
  );
}