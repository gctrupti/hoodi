import { cn } from "@/lib/utils";

/**
 * Hoodi brand mark — a rounded location pin holding three linked dots:
 * neighbors (community), connected (trust), around a place (location).
 * Pure SVG so it inherits theme colors and stays crisp at any size.
 */
export function HoodiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={cn("h-8 w-8", className)} aria-hidden>
      <path
        d="M32 4.5c-12.2 0-22 9.3-22 21 0 14.6 17.9 32.1 20.3 34.4a2.4 2.4 0 0 0 3.4 0C36.1 57.6 54 40.1 54 25.5c0-11.7-9.8-21-22-21Z"
        fill="currentColor"
      />
      {/* Knockout "H" — the doorway between two neighbors. */}
      <g fill="var(--color-background, #faf8f5)">
        <rect x="20" y="13.5" width="6.5" height="24" rx="3.25" />
        <rect x="37.5" y="13.5" width="6.5" height="24" rx="3.25" />
        <rect x="22" y="22.5" width="20" height="6" rx="3" />
      </g>
    </svg>
  );
}

/** Mark inside a soft rounded tile — used in headers and nav. */
export function HoodiBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid h-9 w-9 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15",
        className,
      )}
    >
      <HoodiMark className="h-5 w-5" />
    </span>
  );
}

/** Full lockup: mark + wordmark (+ optional product/sub label). */
export function HoodiLogo({
  sub,
  className,
  wordmarkClassName,
}: {
  sub?: string;
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <HoodiBadge />
      <span className="leading-tight">
        <span
          className={cn(
            "block font-display text-xl font-extrabold tracking-tight text-ink",
            wordmarkClassName,
          )}
        >
          {sub ?? "Hoodi"}
        </span>
        <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
          {sub ? "Hoodi Platform" : "Hyperlocal community"}
        </span>
      </span>
    </span>
  );
}
