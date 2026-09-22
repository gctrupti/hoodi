import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelRequestWithReason } from "@/lib/hoodi/requests.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";

interface CancelRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  isAssigned: boolean;
}

const REASONS = [
  "Found another helper / alternative solution",
  "No longer need assistance",
  "Schedule or plan changed",
  "Incorrect details / posted by mistake",
  "Helper is unresponsive / delayed",
  "Other reason",
];

export function CancelRequestModal({
  open,
  onOpenChange,
  requestId,
  isAssigned,
}: CancelRequestModalProps) {
  const qc = useQueryClient();
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");

  const cancelMutation = useMutation({
    mutationFn: () =>
      cancelRequestWithReason({
        data: {
          requestId,
          reason,
          note: note.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Request has been cancelled.");
      qc.invalidateQueries({ queryKey: ["request", requestId] });
      qc.invalidateQueries({ queryKey: ["my-requests"] });
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
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="font-display text-xl font-bold text-ink">Cancel Request</DialogTitle>
              <DialogDescription className="text-xs text-ink-soft">
                {isAssigned
                  ? "The assigned helper will be immediately notified. Escrow funds will be returned."
                  : "This will remove the request from the neighborhood feed."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            cancelMutation.mutate();
          }}
          className="space-y-4 mt-3"
        >
          <div>
            <label className="text-xs font-semibold text-ink-soft">Reason for cancellation</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-soft">Additional Note (Optional)</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any details to share with the neighborhood or helper..."
              className="mt-1 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-sm outline-none focus:border-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-sand transition"
            >
              Keep Request
            </button>
            <button
              type="submit"
              disabled={cancelMutation.isPending}
              className="inline-flex items-center gap-2 rounded-full bg-urgency-emergency px-5 py-2 text-xs font-semibold text-background hover:bg-urgency-emergency/90 transition disabled:opacity-60"
            >
              {cancelMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirm Cancellation
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
