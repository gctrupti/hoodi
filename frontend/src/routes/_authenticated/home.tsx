import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Home as HomeIcon,
  GraduationCap,
  Wrench,
  ArrowRight,
  Sparkles,
  LogOut,
  MapPin,
  ShieldCheck,
  Zap,
  BookOpen,
} from "lucide-react";
import { getMyProfile } from "@/lib/hoodi/profiles.functions";
import { HoodiMark } from "@/components/hoodi/HoodiLogo";
import { ThemeToggle } from "@/components/hoodi/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Home — Hoodi" },
      { name: "description", content: "One Hoodi account. Multiple neighborhood services." },
    ],
  }),
  component: HomeHub,
});

type ServiceCard = {
  key: string;
  title: string;
  tagline: string;
  description: string;
  to: string;
  cta: string;
  Icon: typeof HomeIcon;
  accent: string;
  badge: string;
  highlights: string[];
  available: true;
};

const SERVICES: ServiceCard[] = [
  {
    key: "help",
    title: "Hoodi Help",
    tagline: "Everyday & emergency assistance",
    description:
      "Get help from nearby verified community members for groceries, medicine runs, transport, and emergencies within 5 km.",
    to: "/help",
    cta: "Open Hoodi Help",
    Icon: HomeIcon,
    accent: "from-clay-soft/60 via-sand to-background",
    badge: "5 km Radius",
    highlights: ["Groceries & Errands", "Emergency SOS Free", "Live Helper Tracking"],
    available: true,
  },
  {
    key: "skills",
    title: "Hoodi Skills",
    tagline: "Learn, teach, exchange",
    description:
      "Discover mentors nearby, share what you know, and grow your skills with trusted neighbors in your community.",
    to: "/skills",
    cta: "Open Hoodi Skills",
    Icon: GraduationCap,
    accent: "from-primary/15 via-sand to-background",
    badge: "Peer-to-Peer",
    highlights: ["1-on-1 Mentorship", "Direct Slot Booking", "Community Reviews"],
    available: true,
  },
  {
    key: "services",
    title: "Hoodi Services",
    tagline: "Professional & local experts",
    description:
      "Hire trusted electricians, plumbers, tutors, beauty experts, and freelance professionals right in your neighborhood.",
    to: "/services",
    cta: "Explore Services",
    Icon: Wrench,
    accent: "from-amber-500/15 via-sand to-background",
    badge: "Verified Pros",
    highlights: ["Electricians & Plumbers", "Direct WhatsApp & Call", "Zero Middleman Fees"],
    available: true,
  },
];

const COMING_SOON = [
  "Hoodi Rescue (Disaster Relief)",
  "Hoodi Medic (First Responder)",
  "Hoodi Jobs (Hyperlocal Gigs)",
  "Hoodi Marketplace (Buy/Sell Local)",
  "Hoodi Events (Block Parties)",
];

function HomeHub() {
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfile);
  const { data: profile } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => fetchProfile(),
  });
  const firstName = profile?.name?.split(" ")[0] ?? "there";

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <HoodiMark className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-xl font-extrabold tracking-tight text-ink">Hoodi</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                Hyperlocal community
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm text-ink-soft transition hover:bg-sand hover:text-ink cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="hoodi-rise mx-auto max-w-5xl px-4 pb-16 sm:px-6">
        <header className="pt-8 text-center sm:pt-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 px-3.5 py-1 text-xs font-semibold text-ink-soft shadow-2xs backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-urgency-normal opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-urgency-normal" />
            </span>
            <span>Hyperlocal Network Active</span>
            <span className="text-border">·</span>
            <span className="text-primary flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Within 5 km
            </span>
          </div>

          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
            Welcome, {firstName} 👋
          </h1>
          <p className="mt-3 text-base text-ink-soft sm:text-lg max-w-xl mx-auto">
            One account for your entire neighborhood. Connect, help, learn, and hire with verified neighbors.
          </p>

          {/* Quick Action Shortcuts */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              to="/help/ask"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
            >
              <Zap className="h-3.5 w-3.5" />
              Ask for Urgent Help
            </Link>
            <Link
              to="/skills/learn"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-sand"
            >
              <BookOpen className="h-3.5 w-3.5 text-clay" />
              Learn a Skill
            </Link>
            <Link
              to="/services/search"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-sand"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-clay" />
              Find Verified Pro
            </Link>
          </div>
        </header>

        {/* Main Service Cards */}
        <section className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <Link
              key={s.key}
              to={s.to}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-linear-to-br ${s.accent} p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift`}
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-background/40 opacity-0 blur-2xl transition duration-500 group-hover:opacity-100"
              />
              <div>
                <div className="flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-background/90 text-ink shadow-soft transition duration-300 group-hover:scale-105">
                    <s.Icon className="h-6 w-6" />
                  </span>
                  <span className="rounded-full border border-border bg-card/70 px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">
                    {s.badge}
                  </span>
                </div>
                <h2 className="mt-5 font-display text-2xl font-bold text-ink">{s.title}</h2>
                <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                  {s.tagline}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink-soft">{s.description}</p>

                <div className="mt-4 space-y-1.5 border-t border-border/40 pt-3">
                  {s.highlights.map((h) => (
                    <div key={h} className="flex items-center gap-1.5 text-xs text-ink/80">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                {s.cta}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </section>

        {/* Coming soon section */}
        <section className="mt-14 rounded-3xl border border-border/80 bg-sand/30 p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-ink-soft">
              Upcoming Neighborhood Expansions
            </h3>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            We are continuously rolling out more specialized community modules:
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {COMING_SOON.map((label) => (
              <span
                key={label}
                className="rounded-full border border-dashed border-border bg-card/50 px-3.5 py-1 text-xs font-medium text-ink-soft"
              >
                {label}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}