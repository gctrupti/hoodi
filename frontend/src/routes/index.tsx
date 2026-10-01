import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listRecentOpenPreview, publicStats } from "@/lib/hoodi/public.functions";
import { UrgencyBadge, CategoryChip } from "@/components/hoodi/UrgencyBadge";
import { formatRelative } from "@/lib/hoodi/format";
import {
  ArrowRight,
  Sparkles,
  MapPin,
  HeartHandshake,
  ShieldCheck,
  GraduationCap,
  Wrench,
  Zap,
  Lock,
  CheckCircle2,
  Users,
  Wallet,
  Clock,
  ExternalLink,
} from "lucide-react";
import { HoodiMark } from "@/components/hoodi/HoodiLogo";
import { ThemeToggle } from "@/components/hoodi/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hoodi — Hyperlocal Community & Mutual Aid Platform" },
      {
        name: "description",
        content:
          "Connect with your street. Everyday errands, peer-to-peer skill learning, and verified neighborhood services within 5 km. Emergencies are always free.",
      },
      { property: "og:title", content: "Hoodi — Hyperlocal Community Platform" },
      { property: "og:description", content: "Hyperlocal help, skills, and services within 5 km, in minutes." },
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
    <div className="min-h-screen bg-background text-ink transition-colors duration-200">
      {/* Subtle textured background grid */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.035] dark:opacity-[0.05]"
        style={{
          backgroundImage: "radial-gradient(rgba(139,115,85,0.7) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
        }}
      />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20 shadow-2xs">
              <HoodiMark className="h-6 w-6" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-2xl font-extrabold tracking-tight">Hoodi</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-soft">
                Hyperlocal Platform
              </span>
            </span>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-ink-soft md:flex">
            <a href="#pillars" className="transition hover:text-ink">Pillars</a>
            <a href="#how-it-works" className="transition hover:text-ink">How it Works</a>
            <a href="#trust" className="transition hover:text-ink">Trust & Safety</a>
            <a href="#feed" className="transition hover:text-ink">Live Feed</a>
          </nav>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link
              to="/auth"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-ink-soft hover:bg-sand hover:text-ink sm:inline-block transition"
            >
              Sign in
            </Link>
            <Link
              to="/auth"
              className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-background shadow-soft transition duration-200 hover:-translate-y-0.5 hover:bg-primary hover:shadow-lift"
            >
              Join your block
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-6 pb-20 pt-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-12 md:pt-14">
        <div className="flex flex-col justify-center">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-xs font-semibold text-ink-soft shadow-2xs backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-urgency-normal opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-urgency-normal" />
            </span>
            <span>Hyperlocal Mutual Aid &middot; 5 km Radius Active</span>
          </div>

          <h1 className="font-display text-5xl font-extrabold leading-[1.03] tracking-tight text-ink sm:text-6xl md:text-7xl">
            Ask your&nbsp;street.
            <br />
            <span className="bg-gradient-to-r from-primary via-clay to-primary bg-clip-text text-transparent">
              Help gets closer.
            </span>
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
            Everyday errands, peer-to-peer skill lessons, or urgent assistance &mdash; post what you need
            and verified neighbors within 5&nbsp;km respond in minutes. <strong className="text-ink font-semibold">Emergencies are always 100% free.</strong>
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 hover:-translate-y-0.5"
            >
              Post a request
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-base font-semibold text-ink transition hover:bg-sand hover:-translate-y-0.5"
            >
              Earn as a helper
            </Link>
          </div>

          <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-border/60 pt-6">
            <Stat label="Neighbors" value={stats.data?.neighbors ?? "120+"} />
            <Stat label="Open tasks" value={stats.data?.open ?? "18"} />
            <Stat label="Completed" value={stats.data?.completed ?? "340+"} />
          </dl>

          <ul className="mt-8 flex flex-wrap gap-4 text-xs font-medium text-ink-soft">
            <li className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> 5&nbsp;km Geo-Shield</li>
            <li className="inline-flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> AI-classified urgency</li>
            <li className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Community Verified</li>
            <li className="inline-flex items-center gap-1.5"><HeartHandshake className="h-4 w-4 text-primary" /> Free for emergencies</li>
          </ul>
        </div>

        {/* Live Feed Card */}
        <div id="feed" className="relative flex flex-col justify-center">
          <div className="absolute -inset-4 -z-10 rounded-[2.5rem] bg-gradient-to-br from-clay-soft/60 via-sand/80 to-background blur-2xl" />
          <div className="rounded-[2rem] border border-border bg-card/85 p-6 shadow-lift backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-urgency-emergency opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-urgency-emergency" />
                </span>
                <span className="font-display text-sm font-bold uppercase tracking-wider text-ink">
                  Live Neighborhood Feed
                </span>
              </div>
              <span className="rounded-full bg-sand px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
                {preview.data?.length ?? 3} open nearby
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
                    No open requests right now &mdash; your neighborhood is all caught up!
                  </p>
                </div>
              )}
              {preview.data?.slice(0, 4).map((r) => (
                <div
                  key={r.id}
                  className="group flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4 transition-all duration-200 hover:border-primary/50 hover:bg-background hover:shadow-2xs"
                >
                  <div className="mt-1 flex flex-col items-center gap-1">
                    <span
                      className={
                        "h-2.5 w-2.5 rounded-full " +
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <UrgencyBadge urgency={r.urgency} />
                      <CategoryChip category={r.category} />
                    </div>
                    <p className="mt-2 truncate font-display text-base font-semibold text-ink">
                      {r.title}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelative(r.created_at)}
                      </span>
                      <span className="font-bold text-ink">
                        {r.is_paid === false
                          ? "Free Aid"
                          : r.estimated_fare != null
                          ? `₹${Number(r.estimated_fare)}`
                          : "Free"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Link
              to="/auth"
              className="mt-5 flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-background transition hover:bg-primary"
            >
              See all requests on your block
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* 3 Pillars Section */}
      <section id="pillars" className="relative z-10 border-t border-border/60 bg-sand/30 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-full bg-primary/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-primary">
              The Hoodi Ecosystem
            </span>
            <h2 className="mt-4 font-display text-3xl font-extrabold text-ink sm:text-4xl">
              Three Pillars of Neighborhood Care
            </h2>
            <p className="mt-3 text-base text-ink-soft">
              More than an errand app. Hoodi is a full-fledged hyperlocal community super-app designed to rebuild trust, mutual aid, and local commerce.
            </p>
          </div>

          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {/* Pillar 1 */}
            <div className="group rounded-3xl border border-border bg-card p-8 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-urgency-emergency-soft text-urgency-emergency shadow-2xs transition group-hover:scale-110">
                <Zap className="h-7 w-7" />
              </span>
              <div className="mt-6 flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold text-ink">Hoodi Help</h3>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">5 km Radius</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Errands, grocery runs, medicine pickups, car jumpstarts, and elderly companionship. Post tasks and match with nearby helpers in minutes.
              </p>
              <ul className="mt-5 space-y-2 text-xs text-ink/80">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-urgency-normal" /> Emergencies are 100% free forever</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-urgency-normal" /> Live helper tracking & private chat</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-urgency-normal" /> Haversine 5 km hyperlocal radius filter</li>
              </ul>
              <Link
                to="/auth"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:underline"
              >
                Explore Hoodi Help <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Pillar 2 */}
            <div className="group rounded-3xl border border-border bg-card p-8 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary shadow-2xs transition group-hover:scale-110">
                <GraduationCap className="h-7 w-7" />
              </span>
              <div className="mt-6 flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold text-ink">Hoodi Skills</h3>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">Peer-to-Peer</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Learn guitar, coding, cooking, chess, or conversational French from a neighbor down your street. Or monetize what you know.
              </p>
              <ul className="mt-5 space-y-2 text-xs text-ink/80">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-urgency-normal" /> 1-on-1 private lesson bookings</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-urgency-normal" /> Skill bartering & cash lesson options</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-urgency-normal" /> Verified teacher reviews & portfolio</li>
              </ul>
              <Link
                to="/auth"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:underline"
              >
                Explore Hoodi Skills <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Pillar 3 */}
            <div className="group rounded-3xl border border-border bg-card p-8 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-2xs transition group-hover:scale-110">
                <Wrench className="h-7 w-7" />
              </span>
              <div className="mt-6 flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold text-ink">Hoodi Services</h3>
                <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">Verified Pros</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                Hire trusted neighborhood electricians, plumbers, painters, appliance fixers, and tutors directly without middleman markups.
              </p>
              <ul className="mt-5 space-y-2 text-xs text-ink/80">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-urgency-normal" /> Direct WhatsApp & phone contact reveal</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-urgency-normal" /> Zero platform gouging on hourly wages</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-urgency-normal" /> Community trust score & work history</li>
              </ul>
              <Link
                to="/auth"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:underline"
              >
                Explore Hoodi Services <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Safety Section */}
      <section id="trust" className="relative z-10 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-full bg-urgency-normal-soft px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-urgency-normal">
              Built on Trust
            </span>
            <h2 className="mt-4 font-display text-3xl font-extrabold text-ink sm:text-4xl">
              How We Protect Every Neighbor
            </h2>
            <p className="mt-3 text-base text-ink-soft">
              Unlike generic classifieds or impersonal gig apps, Hoodi is architected around neighborhood accountability, verification, and escrow security.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" />
              </span>
              <h4 className="mt-4 font-display text-lg font-bold text-ink">5 km Geo-Fence</h4>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                Mathematical Haversine formula strictly limits visibility to neighbors within 5 km. No long-distance bad actors.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <h4 className="mt-4 font-display text-lg font-bold text-ink">Verified Identity</h4>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                Community verification tiers with government ID badges, phone checks, and transparent helper ratings.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" />
              </span>
              <h4 className="mt-4 font-display text-lg font-bold text-ink">Protected Escrow</h4>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                Fares are safely locked until the requester inspects and confirms the task. Helpers receive 85% net earnings instantly.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Lock className="h-5 w-5" />
              </span>
              <h4 className="mt-4 font-display text-lg font-bold text-ink">Private Chat & Privacy</h4>
              <p className="mt-2 text-xs leading-relaxed text-ink-soft">
                Exact addresses and contact numbers remain masked until an errand or booking is officially accepted.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="relative z-10 border-t border-border/70 bg-sand/40 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-full bg-clay-soft px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-ink">
              Seamless Process
            </span>
            <h2 className="mt-4 font-display text-3xl font-extrabold text-ink sm:text-4xl">
              Simple. Fast. Hyperlocal.
            </h2>
          </div>

          <div className="mt-14 grid gap-8 md:grid-cols-3">
            <Step
              n="01"
              title="Post what you need"
              body="Describe your request in one line. Our AI classifies category and urgency automatically so the most relevant neighbors see it first."
            />
            <Step
              n="02"
              title="Neighbors respond"
              body="Verified community members within 5 km receive instant alerts. The first qualified helper accepts, and a private real-time chat opens."
            />
            <Step
              n="03"
              title="Complete & Cash out"
              body="Mark the task done, leave feedback, and release payment. Helpers immediately receive funds in their in-app wallet."
            />
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="relative z-10 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="rounded-3xl border border-primary/20 bg-linear-to-r from-primary/10 via-sand to-primary/10 p-8 sm:p-12 text-center shadow-soft">
            <h3 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
              Ready to bring your neighborhood closer?
            </h3>
            <p className="mt-3 text-base text-ink-soft max-w-xl mx-auto">
              Join thousands of neighbors helping each other, exchanging skills, and building resilient local communities.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                to="/auth"
                className="rounded-full bg-ink px-8 py-3.5 text-base font-semibold text-background shadow-soft hover:bg-primary transition hover:-translate-y-0.5"
              >
                Join Hoodi for Free
              </Link>
              <Link
                to="/auth"
                className="rounded-full border border-border bg-card px-8 py-3.5 text-base font-semibold text-ink hover:bg-sand transition hover:-translate-y-0.5"
              >
                Explore Test Accounts
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Comprehensive Footer */}
      <footer className="border-t border-border/70 bg-card py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                  <HoodiMark className="h-5 w-5" />
                </span>
                <span className="font-display text-xl font-extrabold text-ink">Hoodi</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink-soft">
                A full-stack, open-source hyperlocal platform connecting neighbors for everyday tasks, peer-to-peer skill learning, and mutual aid.
              </p>
              <p className="mt-3 text-[11px] text-muted-foreground">
                &copy; {new Date().getFullYear()} Hoodi Platform. Built for neighborhoods.
              </p>
            </div>

            <div>
              <h5 className="font-display text-xs font-bold uppercase tracking-wider text-ink">Pillars</h5>
              <ul className="mt-3 space-y-2 text-xs text-ink-soft">
                <li><Link to="/auth" className="hover:text-ink">Hoodi Help (Errands)</Link></li>
                <li><Link to="/auth" className="hover:text-ink">Hoodi Skills (Tutoring)</Link></li>
                <li><Link to="/auth" className="hover:text-ink">Hoodi Services (Experts)</Link></li>
                <li><Link to="/auth" className="hover:text-ink">Emergency Assistance</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="font-display text-xs font-bold uppercase tracking-wider text-ink">Ecosystem</h5>
              <ul className="mt-3 space-y-2 text-xs text-ink-soft">
                <li><Link to="/auth" className="hover:text-ink">Web Application (React 19)</Link></li>
                <li><a href="http://127.0.0.1:8000/api/docs/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-ink">Django REST API <ExternalLink className="h-3 w-3" /></a></li>
                <li><span className="text-muted-foreground">Flutter Mobile App</span></li>
                <li><Link to="/admin/login" className="hover:text-ink">Admin Console</Link></li>
              </ul>
            </div>

            <div>
              <h5 className="font-display text-xs font-bold uppercase tracking-wider text-ink">Community & Trust</h5>
              <ul className="mt-3 space-y-2 text-xs text-ink-soft">
                <li><a href="#trust" className="hover:text-ink">5 km Radius Policy</a></li>
                <li><a href="#trust" className="hover:text-ink">Identity Verification</a></li>
                <li><a href="#trust" className="hover:text-ink">Zero-Fee Emergencies</a></li>
                <li><Link to="/auth" className="hover:text-ink">Sign In / Register</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="font-display text-3xl font-extrabold text-ink">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-ink-soft">{label}</div>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-border/80 bg-card p-6 shadow-2xs">
      <div className="font-display text-xs font-extrabold tracking-widest text-primary">{n}</div>
      <h3 className="mt-3 font-display text-xl font-bold text-ink">{title}</h3>
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
