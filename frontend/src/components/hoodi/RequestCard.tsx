import { Link } from "@tanstack/react-router";
import { UrgencyBadge, CategoryChip } from "./UrgencyBadge";
import { formatRelative } from "@/lib/hoodi/format";
import { formatDistance } from "@/lib/hoodi/location";
import { ArrowRight, Store } from "lucide-react";

export type RequestCardData = {
  id: string;
  title: string;
  description?: string | null;
  category: string | null;
  urgency: string | null;
  is_paid: boolean | null;
  estimated_fare?: number | string | null;
  final_fare?: number | string | null;
  status?: string | null;
  distance_m?: number | null;
  created_at?: string | null;
  pickup_name?: string | null;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  address_text?: string | null;
};

export function RequestCard({ req, to = "static" }: { req: RequestCardData; to?: "static" | "link" }) {
  const fare = req.final_fare ?? req.estimated_fare;
  const inner = (
    <article className="group relative flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-[0_1px_0_rgba(139,115,85,0.04),0_8px_24px_-16px_rgba(139,115,85,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_1px_0_rgba(139,115,85,0.04),0_12px_28px_-14px_rgba(139,115,85,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyBadge urgency={req.urgency} pulse />
          <CategoryChip category={req.category} />
        </div>
        {req.is_paid === false ? (
          <span className="rounded-full bg-urgency-emergency/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-urgency-emergency">
            Free
          </span>
        ) : fare != null ? (
          <span className="font-display text-lg font-bold text-ink">₹{Number(fare)}</span>
        ) : null}
      </div>
      <h3 className="font-display text-lg font-semibold leading-snug text-ink">{req.title}</h3>
      {req.pickup_name || req.pickup_address ? (
        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
          <Store className="h-3.5 w-3.5 shrink-0 text-clay" />
          <span className="truncate font-medium text-ink">{req.pickup_name ?? req.pickup_address}</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
          <span className="truncate">{req.dropoff_address ?? req.address_text ?? "your area"}</span>
        </div>
      ) : null}
      {req.description ? (
        <p className="line-clamp-2 text-sm text-ink-soft">{req.description}</p>
      ) : null}
      <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
        <span>{req.created_at ? formatRelative(req.created_at) : ""}</span>
        {req.distance_m != null ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 font-medium text-ink-soft">
            <span className="h-1 w-1 rounded-full bg-clay" />
            {formatDistance(req.distance_m)}
          </span>
        ) : req.status ? (
          <span className="uppercase tracking-wider">{req.status}</span>
        ) : null}
      </div>
    </article>
  );

  if (to === "link") {
    return (
      <Link to="/help/requests/$id" params={{ id: req.id }} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}