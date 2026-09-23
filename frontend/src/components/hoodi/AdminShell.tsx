import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  BarChart3,
  FolderTree,
  GraduationCap,
  HandHeart,
  LogOut,
  Settings2,
  ShieldAlert,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { HoodiMark } from "@/components/hoodi/HoodiLogo";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/admin", label: "Dashboard", icon: BarChart3, exact: true },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/teachers", label: "Teachers", icon: GraduationCap },
  { to: "/admin/helpers", label: "Helpers", icon: HandHeart },
  { to: "/admin/services", label: "Services", icon: Wrench },
  { to: "/admin/categories", label: "Categories", icon: FolderTree },
  { to: "/admin/reports", label: "Trust & reports", icon: ShieldAlert },
  { to: "/admin/finance", label: "Finance", icon: Wallet },
  { to: "/admin/settings", label: "Settings", icon: Settings2 },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/admin/login" });
  }

  return (
    <div className="min-h-screen bg-ink text-background">
      <div className="mx-auto flex min-h-screen w-full max-w-[1500px]">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-background/10 px-4 py-6 lg:flex">
          <div className="flex items-center gap-2.5 px-2">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-background/10">
              <HoodiMark className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-lg font-extrabold tracking-tight">Hoodi</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-background/50">
                Admin console
              </span>
            </span>
          </div>

          <nav className="mt-8 space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to as never}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-background text-ink"
                      : "text-background/70 hover:bg-background/10 hover:text-background",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={signOut}
            className="mt-auto flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-background/60 transition hover:bg-background/10 hover:text-background"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex gap-1 overflow-x-auto border-b border-background/10 px-3 py-2 lg:hidden">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to as never}
                  className={cn(
                    "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold",
                    active ? "bg-background text-ink" : "text-background/60",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <main key={pathname} className="hoodi-rise min-w-0 flex-1 px-4 py-6 sm:px-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export function AdminCard({
  title,
  children,
  action,
  className,
}: {
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-background/10 bg-background/5 p-5", className)}>
      {(title || action) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && (
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-background/50">{title}</h2>
          )}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-background/10 bg-background/5 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-background/50">{label}</p>
      <p className="mt-1.5 font-display text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-background/50">{hint}</p>}
    </div>
  );
}

export function AdminTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-[0.14em] text-background/45">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-background/10">{children}</tbody>
      </table>
    </div>
  );
}

export function AdminButton({
  children,
  onClick,
  tone = "default",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "primary" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
        tone === "primary" && "bg-background text-ink hover:bg-background/90",
        tone === "danger" && "bg-destructive text-destructive-foreground hover:opacity-90",
        tone === "default" && "border border-background/20 text-background/80 hover:bg-background/10",
      )}
    >
      {children}
    </button>
  );
}
