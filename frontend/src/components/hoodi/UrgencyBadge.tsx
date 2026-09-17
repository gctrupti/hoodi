import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  emergency:
    "bg-urgency-emergency-soft text-urgency-emergency border-urgency-emergency/30",
  today: "bg-urgency-today-soft text-urgency-today border-urgency-today/40",
  normal: "bg-urgency-normal-soft text-urgency-normal border-urgency-normal/40",
};

const labels: Record<string, string> = {
  emergency: "Emergency",
  today: "Today",
  normal: "Normal",
};

export function UrgencyBadge({
  urgency,
  className,
  pulse,
}: {
  urgency: string | null | undefined;
  className?: string;
  pulse?: boolean;
}) {
  const u = (urgency ?? "normal") as keyof typeof styles;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        styles[u] ?? styles.normal,
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          u === "emergency" && "bg-urgency-emergency",
          u === "today" && "bg-urgency-today",
          u === "normal" && "bg-urgency-normal",
          pulse && u === "emergency" && "animate-pulse",
        )}
      />
      {labels[u] ?? u}
    </span>
  );
}

export function CategoryChip({ category }: { category: string | null | undefined }) {
  const label = (category ?? "other").replace(/_/g, " ");
  return (
    <span className="inline-flex items-center rounded-full bg-clay-soft/60 px-2.5 py-0.5 text-xs font-medium text-ink-soft">
      {label}
    </span>
  );
}