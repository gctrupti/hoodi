import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarCheck, Clock, Loader2, MapPin, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { getTeacherPublicProfile } from "@/lib/hoodi/skills.functions";
import { bookSession } from "@/lib/hoodi/bookings.functions";
import { inr } from "@/lib/hoodi/format";
import {
  DAY_SHORT,
  formatSlot,
  groupByDay,
  parseSlots,
  slotsForDate,
  upcomingDates,
} from "@/lib/hoodi/availability";
import { HoodiMap } from "@/components/hoodi/HoodiMap";
import { googleDirectionsUrl } from "@/lib/hoodi/location";
import { useTrust } from "@/hooks/use-trust";
import { TrustBadges } from "@/components/hoodi/TrustBadges";
import { ReportUserMenu } from "@/components/hoodi/ReportUserMenu";

export const Route = createFileRoute("/_authenticated/skills/teacher/$teacherId")({
  head: () => ({
    meta: [
      { title: "Mentor profile — Hoodi Skills" },
      {
        name: "description",
        content: "See a neighbor's skills, experience, availability and reviews, then book a session.",
      },
      { property: "og:title", content: "Mentor profile — Hoodi Skills" },
      {
        property: "og:description",
        content: "Skills, experience, availability and reviews for a Hoodi Skills mentor.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TeacherProfilePage,
});

function dateLabel(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return { day: DAY_SHORT[d.getDay()], num: d.getDate() };
}

function TeacherTrust({ teacherId }: { teacherId: string }) {
  const trust = useTrust(teacherId);
  return <TrustBadges badges={trust.data?.badges} />;
}

function TeacherProfilePage() {
  const { teacherId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const detail = useQuery({
    queryKey: ["teacher-public", teacherId],
    queryFn: () => getTeacherPublicProfile({ data: { teacherId } }),
  });

  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);

  const slots = useMemo(
    () => parseSlots(detail.data?.teacher?.availability_slots),
    [detail.data?.teacher?.availability_slots],
  );
  const daySlots = useMemo(() => slotsForDate(slots, date), [slots, date]);
  const offerings = detail.data?.offerings ?? [];
  const offering = offerings.find((o) => o.id === offeringId) ?? null;

  const book = useMutation({
    mutationFn: () => {
      const when = new Date(`${date}T${time}:00`);
      return bookSession({
        data: {
          offeringId: offeringId!,
          scheduledAt: when.toISOString(),
          slotDay: when.getDay(),
          slotStart: time,
          notes: notes || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Session requested — your mentor will confirm shortly.");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      navigate({ to: "/skills/bookings" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  if (detail.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-ink-soft">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (detail.isError || !detail.data?.profile) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-border bg-sand/40 p-10 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Mentor not found</h1>
        <p className="mt-2 text-sm text-ink-soft">
          This profile may have been unpublished. Browse other mentors nearby.
        </p>
        <Link
          to="/skills/learn"
          className="mt-5 inline-block rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Back to Learn
        </Link>
      </div>
    );
  }

  const d = detail.data;
  const prof = d.profile!;
  const t = d.teacher;
  const canBook = !d.is_me && offerings.length > 0;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        to="/skills/learn"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to mentors
      </Link>

      <header className="mt-4 flex flex-wrap items-start gap-5 rounded-3xl border border-border bg-background p-6 shadow-sm">
        {prof.profile_photo_url ? (
          <img
            src={prof.profile_photo_url}
            alt={`${prof.name ?? "Mentor"} profile photo`}
            className="h-20 w-20 rounded-2xl object-cover"
            loading="lazy"
          />
        ) : (
          <span className="grid h-20 w-20 place-items-center rounded-2xl bg-sand font-display text-2xl font-bold text-ink">
            {(prof.name ?? "H").slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
              {prof.name ?? "Neighbor"}
            </h1>
            <TeacherTrust teacherId={teacherId} />
          </div>
          {t?.headline && <p className="mt-1 text-sm text-ink-soft">{t.headline}</p>}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Stat
              icon={<Star className="h-3.5 w-3.5 fill-current" />}
              label={
                d.rating.avg_score != null
                  ? `${d.rating.avg_score} · ${d.rating.rating_count} review${d.rating.rating_count === 1 ? "" : "s"}`
                  : "No ratings yet"
              }
            />
            <Stat icon={<CalendarCheck className="h-3.5 w-3.5" />} label={`${d.sessions_completed} sessions completed`} />
            <Stat icon={<Users className="h-3.5 w-3.5" />} label={`${t?.experience_years ?? 0} yr experience`} />
            {Number(t?.hourly_rate ?? 0) > 0 && (
              <Stat icon={<Clock className="h-3.5 w-3.5" />} label={`${inr(Number(t?.hourly_rate))}/hr`} />
            )}
          </div>
        </div>
        {!d.is_me && (
          <ReportUserMenu
            targetUserId={teacherId}
            targetName={prof.name}
            contextType="profile"
            contextId={teacherId}
          />
        )}
      </header>

      {(t?.bio || prof.bio) && (
        <section className="mt-6 rounded-2xl border border-border bg-background p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">About</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-ink-soft">{t?.bio || prof.bio}</p>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-border bg-background p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Skills offered</h2>
        {offerings.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">This mentor hasn't published any sessions yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {offerings.map((o) => (
              <button
                key={o.id}
                disabled={!canBook}
                onClick={() => {
                  setOfferingId(o.id);
                  setTime("");
                }}
                className={
                  "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition disabled:cursor-default " +
                  (offeringId === o.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:border-primary/50")
                }
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{o.title}</p>
                  <p className="text-xs text-ink-soft">
                    {o.category} · {o.duration_minutes} min
                  </p>
                  {o.description && <p className="mt-1 text-xs text-ink-soft">{o.description}</p>}
                </div>
                <span className="ml-3 shrink-0 text-sm font-bold text-ink">
                  {inr(Number(o.price_per_session))}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {t?.teaching_mode !== "online" && t?.latitude != null && t?.longitude != null && (
        <section className="mt-6 rounded-2xl border border-border bg-background p-5 shadow-sm">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Where sessions happen
          </h2>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-ink-soft">
            <MapPin className="h-4 w-4 text-primary" />
            {t.formatted_address ?? t.city ?? "Nearby"}
          </p>
          <div className="mt-3">
            <HoodiMap
              center={{ lat: Number(t.latitude), lng: Number(t.longitude) }}
              zoom={15}
              height={240}
              markers={[
                {
                  id: "teacher",
                  lat: Number(t.latitude),
                  lng: Number(t.longitude),
                  tone: "primary",
                },
              ]}
            />
          </div>
          <a
            href={googleDirectionsUrl(Number(t.latitude), Number(t.longitude))}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink hover:bg-sand"
          >
            Get directions
          </a>
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-border bg-background p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Availability</h2>
        {slots.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            {t?.availability || "This mentor hasn't set a weekly schedule yet — request any time that suits you."}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {groupByDay(slots).map(({ day, slots: list }) => (
              <div key={day} className="flex flex-wrap items-center gap-2">
                <span className="w-12 text-xs font-semibold text-ink">{DAY_SHORT[day]}</span>
                {list.map((s) => (
                  <span
                    key={`${day}-${s.start}`}
                    className="rounded-full bg-sand px-2.5 py-1 text-xs text-ink-soft"
                  >
                    {formatSlot(s)}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      {canBook && (
        <section className="mt-6 rounded-2xl border border-border bg-background p-5 shadow-sm">
          <h2 className="font-display text-lg font-bold text-ink">Book a session</h2>
          {!offeringId ? (
            <p className="mt-2 text-sm text-ink-soft">Pick a skill above to choose a date and time.</p>
          ) : (
            <div className="mt-4 space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">1 · Choose a date</p>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {upcomingDates(21).map((iso) => {
                    const { day, num } = dateLabel(iso);
                    const has = slots.length === 0 || slotsForDate(slots, iso).length > 0;
                    return (
                      <button
                        key={iso}
                        disabled={!has}
                        onClick={() => {
                          setDate(iso);
                          setTime("");
                        }}
                        className={
                          "flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border text-xs transition disabled:opacity-35 " +
                          (date === iso
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-ink-soft")
                        }
                      >
                        <span>{day}</span>
                        <span className="font-display text-lg font-bold text-ink">{num}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {date && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                    2 · Choose a time
                  </p>
                  {slots.length === 0 ? (
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="mt-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                    />
                  ) : daySlots.length === 0 ? (
                    <p className="mt-2 text-sm text-ink-soft">No slots left on this day — try another date.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {daySlots.map((s) => (
                        <button
                          key={s.start}
                          onClick={() => setTime(s.start)}
                          className={
                            "rounded-full border px-3 py-1.5 text-xs font-semibold transition " +
                            (time === s.start
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-ink-soft hover:text-ink")
                          }
                        >
                          {formatSlot(s)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {time && (
                <div className="rounded-2xl bg-sand/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
                    3 · Booking summary
                  </p>
                  <dl className="mt-2 space-y-1 text-sm text-ink-soft">
                    <Row label="Skill" value={offering?.title ?? ""} />
                    <Row
                      label="When"
                      value={new Date(`${date}T${time}:00`).toLocaleString(undefined, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    />
                    <Row label="Duration" value={`${offering?.duration_minutes ?? 60} min`} />
                    <Row
                      label="Amount held"
                      value={inr(Number(offering?.price_per_session ?? 0))}
                      strong
                    />
                  </dl>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={1000}
                    placeholder="What would you like to focus on?"
                    className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                  />
                  <p className="mt-2 text-xs text-ink-soft">
                    Payment is held safely and only released to your mentor after the session is completed.
                  </p>
                  {!confirming ? (
                    <button
                      onClick={() => setConfirming(true)}
                      className="mt-3 w-full rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                    >
                      Continue to payment
                    </button>
                  ) : (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => book.mutate()}
                        disabled={book.isPending}
                        className="flex-1 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                      >
                        {book.isPending
                          ? "Confirming…"
                          : `Confirm & hold ${inr(Number(offering?.price_per_session ?? 0))}`}
                      </button>
                      <button
                        onClick={() => setConfirming(false)}
                        className="rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-ink"
                      >
                        Back
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Reviews</h2>
        {d.reviews.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">No reviews yet — be the first to learn with them.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {d.reviews.map((r) => (
              <article key={r.id} className="rounded-2xl border border-border bg-background p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">{r.reviewer_name ?? "A neighbor"}</p>
                  <span className="inline-flex items-center gap-0.5 text-primary">
                    {Array.from({ length: r.score }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </span>
                </div>
                {r.comment && <p className="mt-1.5 text-sm text-ink-soft">{r.comment}</p>}
                <p className="mt-1 text-xs text-ink-soft/80">
                  {new Date(r.created_at).toLocaleDateString()}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 font-semibold text-ink-soft">
      {icon}
      {label}
    </span>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt>{label}</dt>
      <dd className={strong ? "font-bold text-ink" : "text-ink"}>{value}</dd>
    </div>
  );
}
