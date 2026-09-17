import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Clock, IdCard, Loader2, Mail, Phone, ScanFace, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { listMyVerifications, submitVerification } from "@/lib/hoodi/trust.functions";
import { uploadVerificationDoc } from "@/lib/hoodi/verification-media";
import { cn } from "@/lib/utils";

type Kind = "email" | "phone" | "government_id" | "selfie";

const ROWS: { kind: Kind; label: string; hint: string; icon: typeof Mail; soon?: boolean }[] = [
  { kind: "email", label: "Email", hint: "Confirm the address on your account.", icon: Mail },
  { kind: "phone", label: "Phone number", hint: "Needed before neighbors can call you.", icon: Phone },
  { kind: "government_id", label: "Government ID", hint: "Upload an ID — reviewed privately by our team.", icon: IdCard },
  { kind: "selfie", label: "Selfie check", hint: "Coming soon — liveness match against your ID.", icon: ScanFace, soon: true },
];

const STATUS_STYLE = {
  verified: "bg-urgency-normal-soft text-urgency-normal",
  pending: "bg-urgency-today-soft text-urgency-today",
  rejected: "bg-urgency-emergency-soft text-urgency-emergency",
} as const;

export function VerificationCenter({ email, phone }: { email?: string | null; phone?: string | null }) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const rows = useQuery({ queryKey: ["my-verifications"], queryFn: () => listMyVerifications() });
  const byKind = new Map((rows.data ?? []).map((r) => [r.kind as Kind, r]));

  const submit = useMutation({
    mutationFn: (v: { kind: Kind; documentPath?: string; submittedValue?: string }) =>
      submitVerification({ data: v }),
    onSuccess: () => {
      toast.success("Submitted — our team reviews it shortly.");
      qc.invalidateQueries({ queryKey: ["my-verifications"] });
      qc.invalidateQueries({ queryKey: ["trust"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  async function handleFile(file?: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadVerificationDoc(file);
      await submit.mutateAsync({ kind: "government_id", documentPath: path });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2.5">
      {ROWS.map(({ kind, label, hint, icon: Icon, soon }) => {
        const row = byKind.get(kind);
        const status = row?.status as keyof typeof STATUS_STYLE | undefined;
        return (
          <div
            key={kind}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border/70 bg-background p-3.5"
          >
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                status === "verified" ? "bg-urgency-normal text-background" : "bg-sand text-clay",
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">{label}</span>
                {status && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      STATUS_STYLE[status],
                    )}
                  >
                    {status === "verified" ? (
                      <BadgeCheck className="h-3 w-3" />
                    ) : status === "pending" ? (
                      <Clock className="h-3 w-3" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    {status}
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-ink-soft">{row?.review_note || hint}</p>
            </div>

            {status === "verified" ? (
              <span className="text-xs font-semibold text-urgency-normal">Done</span>
            ) : soon ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Soon</span>
            ) : kind === "government_id" ? (
              <>
                <button
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-60"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {status === "pending" ? "Replace" : "Upload"}
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </>
            ) : (
              <button
                onClick={() =>
                  submit.mutate({
                    kind,
                    submittedValue: (kind === "email" ? email : phone) ?? undefined,
                  })
                }
                disabled={submit.isPending || status === "pending"}
                className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-ink transition hover:bg-sand disabled:opacity-60"
              >
                {status === "pending" ? "In review" : "Verify"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}