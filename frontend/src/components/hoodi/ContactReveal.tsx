import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Loader2, Lock, MessageCircle, Phone } from "lucide-react";
import { toast } from "sonner";
import { getCounterpartyPhone } from "@/lib/hoodi/trust.functions";
import { useSessionReady } from "@/hooks/use-session-ready";

/**
 * Privacy-first contact block: chat is always available, the phone number only
 * appears once both sides are committed (accepted request / confirmed booking).
 */
export function ContactReveal({
  userId,
  name,
  unlocked,
  onChat,
}: {
  userId?: string | null;
  name?: string | null;
  unlocked: boolean;
  onChat?: () => void;
}) {
  const ready = useSessionReady();
  const [revealed, setRevealed] = useState(false);

  const phone = useQuery({
    queryKey: ["counterparty-phone", userId],
    queryFn: () => getCounterpartyPhone({ data: { userId: userId! } }),
    enabled: ready && unlocked && revealed && Boolean(userId),
  });

  const number = phone.data?.phone ?? null;

  if (!userId) return null;

  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">Contact {name ?? "neighbor"}</h3>
        {!unlocked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
            <Lock className="h-3 w-3" /> Chat only
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-ink-soft">
        {unlocked
          ? "You're both committed — phone number is available."
          : "Phone numbers stay private until this is accepted. Use in-app chat for now."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {onChat && (
          <button
            onClick={onChat}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold text-ink transition hover:bg-sand"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Chat
          </button>
        )}

        {unlocked && !revealed && (
          <button
            onClick={() => setRevealed(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-2 text-xs font-semibold text-background transition hover:opacity-90"
          >
            <Phone className="h-3.5 w-3.5" /> Show phone number
          </button>
        )}

        {unlocked && revealed && (
          phone.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-ink-soft" />
          ) : number ? (
            <>
              <a
                href={`tel:${number}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition hover:opacity-90"
              >
                <Phone className="h-3.5 w-3.5" /> Call {number}
              </a>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(number);
                  toast.success("Number copied");
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-xs font-semibold text-ink"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </>
          ) : (
            <span className="text-xs text-ink-soft">
              They haven&apos;t added a phone number yet — keep using chat.
            </span>
          )
        )}
      </div>
    </div>
  );
}