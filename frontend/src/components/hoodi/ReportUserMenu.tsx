import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Flag, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { blockUser, reportUser, REPORT_REASONS } from "@/lib/hoodi/trust.functions";

const REASON_LABEL: Record<(typeof REPORT_REASONS)[number], string> = {
  fake_profile: "Fake profile",
  abuse: "Abusive behaviour",
  spam: "Spam",
  harassment: "Harassment",
  scam: "Scam or fraud",
  unsafe_behaviour: "Unsafe behaviour",
  other: "Something else",
};

/** Report / block control shown wherever one neighbor deals with another. */
export function ReportUserMenu({
  targetUserId,
  targetName,
  contextType,
  contextId,
  compact = false,
}: {
  targetUserId: string;
  targetName?: string | null;
  contextType?: "help_request" | "skill_booking" | "chat" | "profile";
  contextId?: string;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]>("fake_profile");
  const [details, setDetails] = useState("");

  const report = useMutation({
    mutationFn: () =>
      reportUser({
        data: {
          targetUserId,
          reason,
          details: details.trim() || undefined,
          contextType,
          contextId,
        },
      }),
    onSuccess: () => {
      toast.success("Report sent — our team will review it.");
      setOpen(false);
      setDetails("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const block = useMutation({
    mutationFn: () => blockUser({ data: { targetUserId } }),
    onSuccess: () => {
      toast.success(`${targetName ?? "This neighbor"} is blocked.`);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["my-blocks"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-urgency-emergency/40 hover:text-urgency-emergency"
      >
        <Flag className="h-3.5 w-3.5" />
        {compact ? "" : "Report"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="hoodi-rise w-full max-w-md rounded-3xl border border-border bg-card p-5 shadow-lift">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-urgency-emergency-soft text-urgency-emergency">
                <ShieldAlert className="h-4 w-4" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold text-ink">Report {targetName ?? "this neighbor"}</h3>
                <p className="text-xs text-ink-soft">Reports are private and reviewed by the Hoodi team.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={
                    "rounded-xl border px-3 py-2 text-left text-xs font-semibold transition " +
                    (reason === r
                      ? "border-primary bg-primary/10 text-ink"
                      : "border-border bg-background text-ink-soft hover:bg-sand")
                  }
                >
                  {REASON_LABEL[r]}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              maxLength={1000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="What happened? (optional)"
              className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button
                onClick={() => block.mutate()}
                disabled={block.isPending}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-semibold text-ink-soft transition hover:text-urgency-emergency disabled:opacity-60"
              >
                <Ban className="h-3.5 w-3.5" /> Block instead
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-full px-3.5 py-2 text-xs font-semibold text-ink-soft hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  onClick={() => report.mutate()}
                  disabled={report.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full bg-urgency-emergency px-4 py-2 text-xs font-bold text-background transition hover:opacity-90 disabled:opacity-60"
                >
                  {report.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Send report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}