import type { ComponentType } from "react";
import { BadgeCheck, Star, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-28 w-28 text-3xl",
} as const;

/** Round avatar with warm initials fallback — used everywhere a person appears. */
export function Avatar({
  src,
  name,
  size = "md",
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const initials = (name ?? "H")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return src ? (
    <img
      src={src}
      alt={`${name ?? "Neighbor"} profile photo`}
      loading="lazy"
      className={cn(
        "shrink-0 rounded-full object-cover ring-2 ring-card",
        SIZES[size],
        className,
      )}
    />
  ) : (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-clay-soft font-display font-bold text-ink ring-2 ring-card",
        SIZES[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Compact star rating pill. Renders nothing when there are no ratings yet. */
export function RatingStars({
  score,
  count,
  className,
}: {
  score?: number | null;
  count?: number | null;
  className?: string;
}) {
  if (score == null) {
    return (
      <span className={cn("text-xs font-medium text-muted-foreground", className)}>New here</span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-xs font-semibold text-ink",
        className,
      )}
    >
      <Star className="h-3 w-3 fill-urgency-today text-urgency-today" />
      {score.toFixed(1)}
      {count ? <span className="font-medium text-muted-foreground">({count})</span> : null}
    </span>
  );
}

/** Trust badge — phone verified, admin, or any future verification. */
export function VerifiedBadge({
  label = "Verified",
  tone = "trust",
  className,
}: {
  label?: string;
  tone?: "trust" | "neutral";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone === "trust"
          ? "bg-urgency-normal-soft text-urgency-normal"
          : "bg-sand text-ink-soft",
        className,
      )}
    >
      {tone === "trust" ? <BadgeCheck className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

export type Achievement = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  earned: boolean;
};

/** Airbnb-style achievement tiles: earned ones glow, locked ones stay quiet. */
export function AchievementGrid({ items }: { items: Achievement[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map(({ icon: Icon, label, hint, earned }) => (
        <div
          key={label}
          className={cn(
            "flex items-start gap-3 rounded-2xl border p-3 transition",
            earned
              ? "border-primary/25 bg-primary/5 shadow-soft"
              : "border-dashed border-border bg-sand/40 opacity-70",
          )}
        >
          <span
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
              earned ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-ink">{label}</div>
            <div className="text-xs text-ink-soft">{hint}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Number + caption tile used on profiles and dashboards. */
export function StatTile({
  value,
  label,
  icon: Icon,
}: {
  value: string | number;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card px-4 py-3 shadow-soft">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {Icon && <Icon className="h-3.5 w-3.5 text-clay" />}
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-bold text-ink">{value}</div>
    </div>
  );
}