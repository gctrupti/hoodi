import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { listCategorySuggestions, suggestCategory } from "@/lib/hoodi/categories.functions";
import { useSessionReady } from "@/hooks/use-session-ready";

/**
 * Community-suggested categories: approved ones render as chips, and anyone can
 * propose a new one for admin review.
 */
export function SuggestCategory({
  module,
  onPick,
}: {
  module: "help" | "skills";
  onPick?: (name: string) => void;
}) {
  const ready = useSessionReady();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  const list = useQuery({
    queryKey: ["category-suggestions", module],
    queryFn: () => listCategorySuggestions({ data: { module } }),
    enabled: ready,
  });

  const submit = useMutation({
    mutationFn: () => suggestCategory({ data: { module, name: name.trim(), note: note.trim() || undefined } }),
    onSuccess: () => {
      toast.success("Sent for review — we'll publish it if it fits.");
      setName("");
      setNote("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["category-suggestions", module] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {(list.data?.approved ?? []).map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick?.(c.name)}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-sand"
        >
          {c.name}
        </button>
      ))}
      {(list.data?.mine ?? []).map((c) => (
        <span
          key={c.id}
          className="rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-ink-soft"
          title={`Your suggestion — ${c.status}`}
        >
          {c.name} · {c.status}
        </span>
      ))}

      {open ? (
        <div className="w-full rounded-2xl border border-border bg-background p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder={module === "help" ? "e.g. Pet care" : "e.g. Pottery"}
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="Why is this useful? (optional)"
            className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-soft"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={name.trim().length < 2 || submit.isPending}
              onClick={() => submit.mutate()}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
            >
              {submit.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Send for review
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:text-ink"
        >
          <Plus className="h-3.5 w-3.5" />
          Suggest {module === "help" ? "help" : "skill"} category
        </button>
      )}
    </div>
  );
}