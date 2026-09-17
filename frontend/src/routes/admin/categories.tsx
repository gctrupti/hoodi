import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminDecideCategory, adminListCategorySuggestions } from "@/lib/hoodi/categories.functions";
import { AdminButton, AdminCard, AdminTable } from "@/components/hoodi/AdminShell";
import { useSessionReady } from "@/hooks/use-session-ready";
import { formatRelative } from "@/lib/hoodi/format";

export const Route = createFileRoute("/admin/categories")({
  head: () => ({
    meta: [
      { title: "Category management — Hoodi admin" },
      { name: "description", content: "Approve or reject community-suggested help and skill categories." },
      { property: "og:title", content: "Category management — Hoodi admin" },
      { property: "og:description", content: "Approve or reject community-suggested help and skill categories." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const ready = useSessionReady();
  const qc = useQueryClient();
  const rows = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => adminListCategorySuggestions(),
    enabled: ready,
  });
  const decide = useMutation({
    mutationFn: (v: { id: string; status: "approved" | "rejected" }) => adminDecideCategory({ data: v }),
    onSuccess: () => {
      toast.success("Category updated.");
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const pending = (rows.data ?? []).filter((r) => r.status === "pending");
  const decided = (rows.data ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Categories</h1>
        <p className="mt-1 text-sm text-background/55">
          Suggestions become public across Hoodi Help and Hoodi Skills once approved.
        </p>
      </header>

      {rows.isLoading ? (
        <div className="grid place-items-center py-16 text-background/50">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <AdminCard title={`Awaiting approval (${pending.length})`}>
            {pending.length === 0 ? (
              <p className="py-6 text-center text-sm text-background/45">Nothing waiting.</p>
            ) : (
              <AdminTable head={["Name", "Module", "Note", "Suggested", "Actions"]}>
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2.5 font-medium">{r.name}</td>
                    <td className="px-3 py-2.5 capitalize text-background/55">{r.module}</td>
                    <td className="px-3 py-2.5 text-background/55">{r.note ?? "—"}</td>
                    <td className="px-3 py-2.5 text-background/55">{formatRelative(r.created_at)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1.5">
                        <AdminButton
                          tone="primary"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: r.id, status: "approved" })}
                        >
                          Approve
                        </AdminButton>
                        <AdminButton
                          tone="danger"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ id: r.id, status: "rejected" })}
                        >
                          Reject
                        </AdminButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </AdminTable>
            )}
          </AdminCard>

          <AdminCard title="Decided">
            <AdminTable head={["Name", "Module", "Status", "Actions"]}>
              {decided.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2.5">{r.name}</td>
                  <td className="px-3 py-2.5 capitalize text-background/55">{r.module}</td>
                  <td className="px-3 py-2.5 capitalize text-background/55">{r.status}</td>
                  <td className="px-3 py-2.5">
                    <AdminButton
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({
                          id: r.id,
                          status: r.status === "approved" ? "rejected" : "approved",
                        })
                      }
                    >
                      {r.status === "approved" ? "Remove" : "Approve"}
                    </AdminButton>
                  </td>
                </tr>
              ))}
            </AdminTable>
          </AdminCard>
        </>
      )}
    </div>
  );
}
