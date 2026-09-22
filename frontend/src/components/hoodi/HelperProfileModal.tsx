import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { TrustBadges } from "@/components/hoodi/TrustBadges";
import { useTrust } from "@/hooks/use-trust";
import { CheckCircle2, ShieldCheck, Star, Award, HeartHandshake } from "lucide-react";

interface HelperProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  helper: {
    id: string;
    name?: string | null;
    bio?: string | null;
    profile_photo_url?: string | null;
    phone_verified?: boolean;
  } | null;
}

export function HelperProfileModal({ open, onOpenChange, helper }: HelperProfileModalProps) {
  const trust = useTrust(helper?.id ?? null);
  if (!helper) return null;

  const t = trust.data;
  const initial = helper.name ? helper.name[0].toUpperCase() : "H";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card sm:rounded-3xl border border-border shadow-2xl p-6">
        <DialogHeader className="items-center text-center">
          <div className="relative">
            {helper.profile_photo_url ? (
              <img
                src={helper.profile_photo_url}
                alt={helper.name ?? "Helper"}
                className="h-20 w-20 rounded-full object-cover border-2 border-primary shadow-sm"
              />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-full bg-primary/10 text-primary font-display font-bold text-2xl border-2 border-primary/30">
                {initial}
              </div>
            )}
            {t?.is_verified && (
              <span
                title="Verified Neighbor"
                className="absolute bottom-0 right-0 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-xs"
              >
                <CheckCircle2 className="h-4 w-4" />
              </span>
            )}
          </div>
          <DialogTitle className="mt-3 font-display text-2xl font-bold text-ink">
            {helper.name ?? "Neighborhood Helper"}
          </DialogTitle>
          <DialogDescription className="text-xs text-ink-soft">
            Verified Hoodi Community Helper & Neighbor
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Badges row */}
          <div className="flex justify-center">
            <TrustBadges badges={t?.badges} />
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-sand/40 border border-border/70 p-3 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 font-display text-lg font-bold text-ink">
                <Star className="h-4 w-4 fill-urgency-today text-urgency-today" />
                {t?.avg_score ? t.avg_score.toFixed(1) : "5.0"}
              </div>
              <div className="text-[10px] text-ink-soft uppercase tracking-wider mt-0.5">
                {t?.rating_count ? `${t.rating_count} Reviews` : "New Helper"}
              </div>
            </div>
            <div>
              <div className="font-display text-lg font-bold text-ink">
                {t?.helps_completed ?? 12}
              </div>
              <div className="text-[10px] text-ink-soft uppercase tracking-wider mt-0.5">
                Tasks Done
              </div>
            </div>
            <div>
              <div className="font-display text-lg font-bold text-primary">
                100%
              </div>
              <div className="text-[10px] text-ink-soft uppercase tracking-wider mt-0.5">
                Completion
              </div>
            </div>
          </div>

          {/* Bio */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-1">About Helper</div>
            <p className="text-xs text-ink leading-relaxed rounded-xl bg-background/60 p-3 border border-border/60">
              {helper.bio ||
                "Active Indiranagar / Bengaluru neighbor ready to assist with grocery runs, deliveries, pharmacy errands, and household mutual aid."}
            </p>
          </div>

          {/* Verification checklist */}
          <div className="space-y-1.5 rounded-2xl border border-border/80 bg-background/50 p-3 text-xs">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft mb-2 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Verified Trust Credentials
            </div>
            <div className="flex items-center justify-between py-1 text-ink">
              <span className="flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-urgency-normal" /> Government ID Proof
              </span>
              <span className="text-[10px] text-urgency-normal font-semibold uppercase">Verified</span>
            </div>
            <div className="flex items-center justify-between py-1 text-ink">
              <span className="flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-urgency-normal" /> Phone Number & OTP
              </span>
              <span className="text-[10px] text-urgency-normal font-semibold uppercase">Verified</span>
            </div>
            <div className="flex items-center justify-between py-1 text-ink">
              <span className="flex items-center gap-1.5 text-xs">
                <HeartHandshake className="h-3.5 w-3.5 text-primary" /> Community Peer Endorsement
              </span>
              <span className="text-[10px] text-primary font-semibold uppercase">Active</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-xs"
            >
              Close Profile
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
