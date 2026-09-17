import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shimmering placeholder block — the platform-wide loading atom. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("hoodi-shimmer rounded-xl bg-sand", className)} />;
}

/** Card-shaped skeleton used by feeds and lists while data loads. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3" />
        ))}
      </div>
    </div>
  );
}

/** Warm, useful empty state — never a bare "no data". */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "hoodi-rise flex flex-col items-center rounded-3xl border border-dashed border-border bg-sand/50 px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-card text-clay shadow-soft">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Consistent page heading with optional eyebrow + right-side actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="hoodi-rise mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-clay">
            {eyebrow}
          </span>
        )}
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Elevated surface used across modules for grouped content. */
export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border/80 bg-card p-5 shadow-soft transition duration-300 hover:shadow-lift",
        className,
      )}
    >
      {children}
    </div>
  );
}