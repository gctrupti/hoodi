import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { disputeRequest } from "@/lib/hoodi/requests.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldAlert, Loader2 } from "lucide-react";

interface DisputeRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
}

const DISPUTE_REASONS = [
  "Helper did not arrive at location",
  "Unresponsive to calls or messages",
  "Item delivered was damaged or incorrect",
  "Fare or payment amount disagreement",
  "Safety, harassment or conduct concern",
  "Task abandoned without notice",
  "Other issue",
];

export function DisputeRequestModal({
  open,
  onOpenChange,
  requestId,
}: DisputeRequestModalProps) {
  const qc = useQueryClient();
  const [reason, setReason] = useState(DISPUTE_REASONS[0]);
  const [details, setDetails] = useState("");

  const disputeMutation = useMutation({
    mutationFn: () =>
      disputeRequest({
        data: {
          requestId,
          reason,
          details: details.trim(),
        },
      }),
    onSuccess: () => {
      toast.success("Dispute filed. Hoodi Community Trust team has been notified.");
      qc.invalidateQueries({ queryKey: ["request", requestId] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card sm:rounded-3xl border border-border shadow-2xl p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-urgency-emergency-soft text-urgency-emergency">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl font-bold text-ink">Raise Dispute</DialogTitle>
              <DialogDescription className="text-xs text-ink-soft">
                Escrow funds will remain held securely while the Hoodi moderation team reviews this issue.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (details.trim().length < 5) {
              toast.error("Please provide at least a short explanation.");
              return;
            }
            disputeMutation.mutate();
          }}
          className="space-y-4 mt-3"
        >
          <div>
            <label className="text-xs font-semibold text-ink-soft">Dispute Issue</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {DISPUTE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-soft">Explain What Happened</label>
            <textarea
              required
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe the issue with timestamps, item notes, or interaction details..."
              className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="rounded-xl bg-sand/50 p-3 border border-border text-[11px] text-ink-soft leading-relaxed">
            Our neighborhood trust team will review chat history and coordinates. Both parties will be contacted via in-app notification.
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-sand transition"
            >
              Dismiss
            </button>
            <button
              type="submit"
              disabled={disputeMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-urgency-emergency px-5 py-2 text-xs font-semibold text-background hover:bg-urgency-emergency/90 transition disabled:opacity-60"
            >
              {disputeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Submit Dispute
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
