import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { getThreadForBooking, listMessages, sendMessage } from "@/lib/hoodi/chat.functions";
import { supabase } from "@/integrations/supabase/client";
import { formatRelative } from "@/lib/hoodi/format";
import { cn } from "@/lib/utils";

export function SessionChat({ bookingId, myId }: { bookingId: string; myId?: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const thread = useQuery({
    queryKey: ["booking-thread", bookingId],
    queryFn: () => getThreadForBooking({ data: { bookingId } }),
  });
  const threadId = thread.data?.id;

  const messages = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => listMessages({ data: { threadId: threadId! } }),
    enabled: !!threadId,
  });

  useEffect(() => {
    if (!threadId) return;
    const ch = supabase
      .channel(`chat:${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` },
        () => qc.invalidateQueries({ queryKey: ["messages", threadId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [threadId, qc]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.data]);

  const send = useMutation({
    mutationFn: () => sendMessage({ data: { threadId: threadId!, content: draft.trim() } }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["messages", threadId] });
    },
  });

  if (thread.isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-ink-soft">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[24rem] flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl bg-sand/50 p-3">
        {(messages.data ?? []).length === 0 && (
          <p className="py-12 text-center text-xs text-ink-soft">
            No messages yet — say hello and agree on the details.
          </p>
        )}
        {(messages.data ?? []).map((m) => {
          const mine = m.sender_id === myId;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                  mine ? "bg-primary text-primary-foreground" : "bg-background text-ink shadow-sm",
                )}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                <p className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-ink-soft")}>
                  {formatRelative(m.created_at)}
                  {mine && m.read_at ? " · Read" : ""}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim() && threadId) send.mutate();
        }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          className="w-full rounded-full border border-border bg-background px-4 py-2 text-sm text-ink outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={!draft.trim() || send.isPending}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
          aria-label="Send message"
        >
          {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}