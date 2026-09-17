import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Home as HomeIcon, GraduationCap, ArrowRight, Sparkles, LogOut } from "lucide-react";
import { getMyProfile } from "@/lib/hoodi/profiles.functions";
import { HoodiMark } from "@/components/hoodi/HoodiLogo";
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
  to: "/help" | "/skills";
  cta: string;
  Icon: typeof HomeIcon;
  accent: string;
  available: true;
};

const SERVICES: ServiceCard[] = [
  {
    key: "help",
    title: "Hoodi Help",
    tagline: "Everyday & emergency assistance",
    description:
      "Get help from nearby verified community members for groceries, elderly care, transport, and emergencies.",
    to: "/help",
    cta: "Open Hoodi Help",
    Icon: HomeIcon,
    accent: "from-clay-soft/60 via-sand to-background",
    available: true,
  },
  {
    key: "skills",
    title: "Hoodi Skills",
    tagline: "Learn, teach, exchange",
    description:
      "Discover mentors nearby, share what you know, and grow your skills with trusted people in your community.",
    to: "/skills",
    cta: "Open Hoodi Skills",
    Icon: GraduationCap,
    accent: "from-primary/15 via-sand to-background",
    available: true,
  },
];

const COMING_SOON = ["Hoodi Rescue", "Hoodi Medic", "Hoodi Jobs", "Hoodi Marketplace", "Hoodi Events"];

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
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-ink-soft transition hover:bg-sand hover:text-ink"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>

      <div className="hoodi-rise mx-auto max-w-4xl px-4 pb-16 sm:px-6">
      <header className="pt-6 text-center sm:pt-14">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1 text-xs font-semibold uppercase tracking-widest text-ink-soft">
          <Sparkles className="h-3.5 w-3.5" /> Hoodi Platform
        </span>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Welcome, {firstName} 👋
        </h1>
        <p className="mt-3 text-base text-ink-soft sm:text-lg">
          One platform. Multiple services. Choose what you need today.
        </p>
      </header>

      <section className="mt-10 grid gap-5 sm:grid-cols-2">
        {SERVICES.map((s) => (
          <Link
            key={s.key}
            to={s.to}
            className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border bg-linear-to-br ${s.accent} p-6 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-8`}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-background/40 opacity-0 blur-2xl transition duration-500 group-hover:opacity-100"
            />
            <div>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-background/90 text-ink shadow-soft transition duration-300 group-hover:scale-105">
                <s.Icon className="h-6 w-6" />
              </span>
              <h2 className="mt-5 font-display text-2xl font-bold text-ink">{s.title}</h2>
              <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-ink-soft">
                {s.tagline}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{s.description}</p>
            </div>
            <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
              {s.cta}
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </section>

      <section className="mt-12">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
          Coming soon to Hoodi
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {COMING_SOON.map((label) => (
            <span
              key={label}
              className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-ink-soft"
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