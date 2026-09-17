import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listRecentOpenPreview, publicStats } from "@/lib/hoodi/public.functions";
import { UrgencyBadge, CategoryChip } from "@/components/hoodi/UrgencyBadge";
import { formatRelative } from "@/lib/hoodi/format";
import { ArrowRight, Sparkles, MapPin, HeartHandshake } from "lucide-react";
import { HoodiMark } from "@/components/hoodi/HoodiLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hoodi — Ask your street. Help gets closer." },
      {
        name: "description",
        content:
          "A warm, hyperlocal help marketplace. Post what you need — groceries, elderly care, a ride, first aid — and neighbors within 5 km respond.",
      },
      { property: "og:title", content: "Hoodi — Ask your street" },
      { property: "og:description", content: "Hyperlocal help within 5 km, in minutes." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const preview = useQuery({
    queryKey: ["public", "preview"],
    queryFn: () => listRecentOpenPreview(),
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const stats = useQuery({
    queryKey: ["public", "stats"],
    queryFn: () => publicStats(),
    refetchInterval: 60_000,
  });

  return (
    <div className="min-h-screen bg-background text-ink">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "radial-gradient(rgba(139,115,85,0.6) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <HoodiMark className="h-6 w-6" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-2xl font-extrabold tracking-tight">Hoodi</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
              Hyperlocal community
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-ink-soft hover:bg-sand sm:inline-block"
          >
            Sign in
          </Link>
          <Link
            to="/auth"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-background shadow-soft transition duration-200 hover:-translate-y-0.5 hover:bg-primary hover:shadow-lift"
          >
            Join your block
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:gap-12 md:pt-10">
        <div className="flex flex-col justify-center">
          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-ink-soft">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-urgency-normal opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-urgency-normal" />
            </span>
            Live requests within 5&nbsp;km
          </span>
          <h1 className="font-display text-5xl font-bold leading-[1.02] tracking-tight text-ink sm:text-6xl md:text-7xl">
            Ask your&nbsp;street.
            <br />
            <span className="text-primary">Help gets closer.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
            Groceries, elderly care, a ride, or a first-aid emergency — post what you
            need and the neighbors already nearby respond. Emergencies are always free.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              Post a request
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-base font-semibold text-ink transition hover:bg-sand"
            >
              Earn as a helper
            </Link>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
            <Stat label="Neighbors" value={stats.data?.neighbors ?? "—"} />
            <Stat label="Open now" value={stats.data?.open ?? "—"} />
            <Stat label="Completed" value={stats.data?.completed ?? "—"} />
          </dl>

          <ul className="mt-10 flex flex-wrap gap-4 text-sm text-ink-soft">
            <li className="inline-flex items-center gap-2"><MapPin className="h-4 w-4 text-clay" /> 5&nbsp;km radius</li>
            <li className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-clay" /> AI-classified urgency</li>
            <li className="inline-flex items-center gap-2"><HeartHandshake className="h-4 w-4 text-clay" /> Free for emergencies</li>
          </ul>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-clay-soft/70 via-sand to-background blur-xl" />
          <div className="rounded-[2rem] border border-border bg-card/80 p-5 shadow-[0_1px_0_rgba(139,115,85,0.06),0_30px_60px_-30px_rgba(139,115,85,0.35)] backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-urgency-emergency opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-urgency-emergency" />
                </span>
                <span className="font-display text-sm font-semibold uppercase tracking-widest text-ink-soft">
                  Live feed
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {preview.data?.length ?? 0} open
              </span>
            </div>

            <div className="space-y-3">
              {preview.isLoading && (
                <>
                  <SkelRow />
                  <SkelRow />
                  <SkelRow />
                </>
              )}
              {preview.data && preview.data.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-sand/40 px-4 py-10 text-center">
                  <p className="text-sm text-ink-soft">
                    No open requests right now — your neighborhood is quiet.
                  </p>
                </div>
              )}
              {preview.data?.map((r) => (
                <div
                  key={r.id}
                  className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-background/70 p-4 transition hover:border-clay/60 hover:bg-background"
                >
                  <div className="mt-1 flex flex-col items-center gap-1">
                    <span
                      className={
                        "h-2 w-2 rounded-full " +
                        (r.urgency === "emergency"
                          ? "bg-urgency-emergency animate-pulse"
                          : r.urgency === "today"
                          ? "bg-urgency-today"
                          : "bg-urgency-normal")
                      }
                    />
                    <span className="h-full w-px bg-border/60" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <UrgencyBadge urgency={r.urgency} />
                      <CategoryChip category={r.category} />
                    </div>
                    <p className="mt-2 truncate font-display text-base font-semibold text-ink">
                      {r.title}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatRelative(r.created_at)}</span>
                      <span className="font-semibold text-ink-soft">
                        {r.is_paid === false
                          ? "Free"
                          : r.estimated_fare != null
                          ? `₹${Number(r.estimated_fare)}`
                          : ""}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Link
              to="/auth"
              className="mt-5 flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-background transition hover:bg-primary"
            >
              See all near you
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-t border-border/70 bg-sand/50">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-3">
          <Step n="01" title="Post what you need" body="Describe it in one line. Our AI tags the category and urgency automatically so the right neighbor sees it first." />
          <Step n="02" title="Neighbors respond" body="Everyone within 5 km gets a ping. The first helper accepts; a private chat opens instantly." />
          <Step n="03" title="Wrap up & pay" body="Mark complete, release payment. Helpers cash out from their wallet. Emergencies are always free." />
        </div>
      </section>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
          <span>© Hoodi. Built for neighborhoods.</span>
          <div className="flex gap-4">
            <Link to="/auth" className="hover:text-ink">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="font-display text-3xl font-bold text-ink">{value}</div>
      <div className="mt-0.5 text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="font-display text-sm font-bold tracking-widest text-clay">{n}</div>
      <h3 className="mt-2 font-display text-2xl font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function SkelRow() {
  return (
    <div className="flex animate-pulse items-start gap-3 rounded-2xl border border-border/60 bg-background/50 p-4">
      <div className="mt-1 h-2 w-2 rounded-full bg-clay-soft" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 rounded bg-clay-soft/70" />
        <div className="h-4 w-2/3 rounded bg-clay-soft/70" />
        <div className="h-3 w-1/3 rounded bg-clay-soft/40" />
      </div>
    </div>
  );
}
