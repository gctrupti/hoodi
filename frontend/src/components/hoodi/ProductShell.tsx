import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ComponentType, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { LogOut, LayoutGrid } from "lucide-react";
import { HoodiMark } from "@/components/hoodi/HoodiLogo";
import { NotificationBell } from "@/components/hoodi/NotificationBell";
import { ThemeToggle } from "@/components/hoodi/ThemeToggle";

export type ShellNavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  primary?: boolean;
};

type Props = {
  brand: string;
  brandIcon: ComponentType<{ className?: string }>;
  homeHref: "/help" | "/skills" | "/services" | string;
  nav: ShellNavItem[];
  mobileNav: ShellNavItem[];
  children: ReactNode;
};

export function ProductShell({ brand, brandIcon: BrandIcon, homeHref, nav, mobileNav, children }: Props) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to={homeHref as never} className="group flex items-center gap-2.5">
            <span className="relative grid h-9 w-9 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15 transition group-hover:bg-primary/15">
              <HoodiMark className="h-5 w-5" />
              <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-card text-ink shadow-soft">
                <BrandIcon className="h-2.5 w-2.5" />
              </span>
            </span>
            <span className="leading-tight">
              <span className="block font-display text-lg font-extrabold tracking-tight text-ink">
                {brand}
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
                Hoodi Platform
              </span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to as never}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition duration-200",
                    item.primary && !active && "bg-primary text-primary-foreground hover:bg-primary/90",
                    !item.primary && !active && "text-ink-soft hover:bg-sand hover:text-ink",
                    active && "bg-ink text-background shadow-soft",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
            <Link
              to="/home"
              className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-ink-soft transition hover:bg-sand hover:text-ink md:inline-flex"
            >
              <LayoutGrid className="h-4 w-4" />
              Switch service
            </Link>
            <button
              onClick={signOut}
              className="hidden items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm text-ink-soft transition hover:bg-sand hover:text-ink md:inline-flex"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main
        key={pathname}
        className="hoodi-rise mx-auto max-w-6xl px-4 pb-28 pt-8 sm:px-6 md:pb-12"
      >
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-2 py-2">
          {mobileNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to as never}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide",
                  item.primary && "text-primary",
                  !item.primary && active && "text-ink",
                  !item.primary && !active && "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", item.primary && "h-6 w-6")} />
                {item.label}
              </Link>
            );
          })}
          <Link
            to="/home"
            className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <LayoutGrid className="h-5 w-5" />
            Switch
          </Link>
        </div>
      </nav>
    </div>
  );
}