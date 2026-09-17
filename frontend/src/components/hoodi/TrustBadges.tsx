import { BadgeCheck, Crown, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const BADGES: Record<
  string,
  { label: string; icon: typeof BadgeCheck; tone: "trust" | "gold" | "clay" }
> = {
  verified_user: { label: "Verified User", icon: BadgeCheck, tone: "trust" },
  verified_helper: { label: "Verified Helper", icon: ShieldCheck, tone: "trust" },
  verified_teacher: { label: "Verified Teacher", icon: ShieldCheck, tone: "trust" },
  super_helper: { label: "Super Helper", icon: Sparkles, tone: "clay" },
  top_mentor: { label: "Top Mentor", icon: Trophy, tone: "gold" },
};

const TONES = {
  trust: "bg-urgency-normal-soft text-urgency-normal",
  gold: "bg-urgency-today-soft text-urgency-today",
  clay: "bg-clay-soft text-ink",
} as const;

/**
 * Renders earned trust badges. `compact` shows only the highest-signal one,
 * for dense surfaces like cards and chat headers.
 */
export function TrustBadges({
  badges,
  compact = false,
  max = 3,
  className,
}: {
  badges?: string[] | null;
  compact?: boolean;
  max?: number;
  className?: string;
}) {
  const order = ["top_mentor", "super_helper", "verified_teacher", "verified_helper", "verified_user"];
  const known = (badges ?? []).filter((b) => b in BADGES).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (!known.length) return null;
  const shown = compact ? known.slice(0, 1) : known.slice(0, max);

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {shown.map((key) => {
        const { label, icon: Icon, tone } = BADGES[key];
        return (
          <span
            key={key}
            title={label}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
              TONES[tone],
            )}
          >
            <Icon className="h-3 w-3" />
            {label}
          </span>
        );
      })}
      {!compact && known.length > shown.length && (
        <span className="text-[10px] font-semibold text-muted-foreground">+{known.length - shown.length}</span>
      )}
    </span>
  );
}

/** Small crown marker for list rows where a full pill is too heavy. */
export function TopBadgeDot({ badges }: { badges?: string[] | null }) {
  if (!badges?.includes("top_mentor")) return null;
  return <Crown className="h-3.5 w-3.5 text-urgency-today" aria-label="Top mentor" />;
}