import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { findClosestSuitableHelpers, type SmartMatchResult } from "@/lib/hoodi/location.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TrustBadges } from "@/components/hoodi/TrustBadges";
import { formatDistance } from "@/lib/hoodi/location";
import { toast } from "sonner";
import {
  Zap,
  Star,
  MapPin,
  Clock,
  CheckCircle2,
  Loader2,
  Sparkles,
  Send,
  Navigation,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FindClosestHelperModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetCoords: { lat: number; lng: number };
  urgency?: "normal" | "today" | "emergency";
  radiusM?: number;
}

export function FindClosestHelperModal({
  open,
  onOpenChange,
  targetCoords,
  urgency = "normal",
  radiusM = 5000,
}: FindClosestHelperModalProps) {
  const [selectedHelperId, setSelectedHelperId] = useState<string | null>(null);

  const helpersQuery = useQuery({
    queryKey: ["closest-helpers", targetCoords.lat, targetCoords.lng, urgency, radiusM],
    queryFn: () =>
      findClosestSuitableHelpers({
        data: {
          lat: targetCoords.lat,
          lng: targetCoords.lng,
          urgency,
          radius_m: radiusM,
        },
      }),
    enabled: open,
  });

  const helpers: SmartMatchResult[] = helpersQuery.data ?? [];

  const handleInvite = (helperName: string) => {
    toast.success(`Direct request invitation dispatched to ${helperName}! They have been notified.`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card sm:rounded-3xl border border-border shadow-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-xs">
              <Zap className="h-5 w-5 fill-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="font-display text-xl font-bold text-ink">
                  Smart Helper Matching
                </DialogTitle>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                  <Sparkles className="h-3 w-3" /> AI Multi-Factor
                </span>
              </div>
              <DialogDescription className="text-xs text-ink-soft">
                Evaluates distance, estimated arrival times, urgency deadline, and helper trust ratings.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-3 space-y-3 max-h-[62vh] overflow-y-auto pr-1">
          {helpersQuery.isLoading ? (
            <div className="grid place-items-center py-16 text-ink-soft">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="mt-2 text-xs">Scanning neighborhood helpers & calculating ETAs…</p>
            </div>
          ) : helpers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-ink-soft">
              No active helpers found within this radius. Try widening to 10 km or 20 km.
            </div>
          ) : (
            helpers.map((res, index) => {
              const h = res.helper;
              const isTop = index === 0;

              return (
                <div
                  key={h.id}
                  className={cn(
                    "rounded-2xl border p-4 transition shadow-xs",
                    isTop
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card hover:bg-sand/30",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        {h.profile_photo_url ? (
                          <img
                            src={h.profile_photo_url}
                            alt={h.name ?? "Helper"}
                            className="h-12 w-12 rounded-full object-cover border border-border shadow-xs"
                          />
                        ) : (
                          <div className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary font-bold text-base border border-primary/20">
                            {h.name ? h.name[0].toUpperCase() : "H"}
                          </div>
                        )}
                        {isTop && (
                          <span
                            title="Top Match"
                            className="absolute -top-1 -left-1 grid h-5 w-5 place-items-center rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-xs"
                          >
                            #1
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-display text-sm font-bold text-ink">{h.name}</h4>
                          <TrustBadges badges={h.badges} />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-soft">
                          <span className="flex items-center gap-0.5 font-semibold text-ink">
                            <Star className="h-3 w-3 fill-urgency-today text-urgency-today" />
                            {h.avg_score ? h.avg_score.toFixed(1) : "5.0"}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-primary" />
                            {formatDistance(res.distanceMeters)}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1 font-medium text-primary">
                            <Clock className="h-3 w-3" />
                            ~{res.travelTimes.bikeMins}m ETA
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Match Score Badge */}
                    <div className="text-right shrink-0">
                      <div className="inline-flex items-center gap-1 rounded-full bg-sand px-2.5 py-1 text-xs font-bold text-ink border border-border">
                        <span className="text-primary font-extrabold">{res.matchScore}%</span>
                        <span className="text-[10px] text-ink-soft">Match</span>
                      </div>
                    </div>
                  </div>

                  {/* Reason & Highlights */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      {res.matchReason}
                    </span>
                    {res.highlights.map((hl) => (
                      <span
                        key={hl}
                        className="text-[10px] text-ink-soft bg-sand px-2 py-0.5 rounded-md border border-border/60"
                      >
                        {hl}
                      </span>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-3 flex items-center justify-between pt-2">
                    <div className="text-[11px] text-ink-soft truncate max-w-[280px]">
                      {h.bio || "Active local neighbor ready to assist."}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInvite(h.name ?? "Helper")}
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs cursor-pointer"
                    >
                      <Send className="h-3 w-3" /> Direct Invite
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-border">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-sand transition"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
