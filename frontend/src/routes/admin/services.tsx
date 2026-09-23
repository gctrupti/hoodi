import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wrench,
  CheckCircle2,
  XCircle,
  Plus,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AdminCard, AdminButton, AdminTable } from "@/components/hoodi/AdminShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/services")({
  head: () => ({
    meta: [{ title: "Services Management — Hoodi Admin" }],
  }),
  component: AdminServicesPage,
});

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

type ProviderRow = {
  user_id: string;
  business_name: string;
  rating: number;
  completed_jobs_count: number;
  is_verified_provider: boolean;
  is_available: boolean;
  is_suspended: boolean;
  created_at: string;
  profile?: {
    name?: string | null;
    phone_number?: string | null;
    phone_verified?: boolean;
  } | null;
};

function AdminServicesPage() {
  const queryClient = useQueryClient();
  const [isAddCatOpen, setIsAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatSlug, setNewCatSlug] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("Wrench");

  // Fetch categories
  const categoriesQuery = useQuery({
    queryKey: ["admin", "services", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_categories" as never)
        .select("id, name, slug, icon, description, sort_order, is_active");
      if (error) throw error;
      return (data ?? []) as unknown as CategoryRow[];
    },
  });

  // Fetch providers
  const providersQuery = useQuery({
    queryKey: ["admin", "services", "providers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_provider_profiles" as never)
        .select(`
          user_id,
          business_name,
          rating,
          completed_jobs_count,
          is_verified_provider,
          is_available,
          is_suspended,
          created_at,
          profile:profiles(name, phone_number, phone_verified)
        `);
      if (error) throw error;
      return (data ?? []) as unknown as ProviderRow[];
    },
  });

  // Category mutation
  const addCategoryMutation = useMutation({
    mutationFn: async () => {
      const slug = newCatSlug.trim() || newCatName.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const { error } = await supabase.from("service_categories" as never).insert({
        name: newCatName.trim(),
        slug,
        description: newCatDesc.trim() || null,
        icon: newCatIcon.trim() || "Wrench",
        sort_order: (categoriesQuery.data?.length ?? 0) + 1,
        is_active: true,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Category added successfully!");
      setIsAddCatOpen(false);
      setNewCatName("");
      setNewCatSlug("");
      setNewCatDesc("");
      queryClient.invalidateQueries({ queryKey: ["admin", "services", "categories"] });
      queryClient.invalidateQueries({ queryKey: ["services", "categories"] });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Failed to add category.");
    },
  });

  // Provider verify/suspend mutation
  const toggleVerifyMutation = useMutation({
    mutationFn: async ({ userId, isVerified }: { userId: string; isVerified: boolean }) => {
      const { error } = await supabase
        .from("service_provider_profiles" as never)
        .update({ is_verified_provider: isVerified } as never)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Provider verification updated.");
      queryClient.invalidateQueries({ queryKey: ["admin", "services", "providers"] });
    },
  });

  const toggleSuspendMutation = useMutation({
    mutationFn: async ({ userId, isSuspended }: { userId: string; isSuspended: boolean }) => {
      const { error } = await supabase
        .from("service_provider_profiles" as never)
        .update({ is_suspended: isSuspended } as never)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Provider suspension status updated.");
      queryClient.invalidateQueries({ queryKey: ["admin", "services", "providers"] });
    },
  });

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Services Management</h1>
          <p className="mt-1 text-sm text-background/55">
            Admin console for Hoodi Services: dynamic categories, provider verification, and marketplace settings.
          </p>
        </div>
        <AdminButton tone="primary" onClick={() => setIsAddCatOpen(true)}>
          <span className="flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Add Category
          </span>
        </AdminButton>
      </header>

      {/* Platform Commission Setting Card */}
      <AdminCard title="Platform Commission & Revenue Policy">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs">
          <div>
            <span className="font-semibold text-background">Current Services Take-Rate: 10% Platform Fee</span>
            <p className="mt-1 text-background/60">
              When a customer completes and pays for a service, 90% is credited to provider wallet and 10% platform fee is retained in platform treasury.
            </p>
          </div>
          <div className="rounded-xl border border-background/20 bg-background/5 px-4 py-2 text-right">
            <span className="text-[10px] uppercase text-background/50">Config Status</span>
            <p className="font-bold text-emerald-400">Active (10.0%)</p>
          </div>
        </div>
      </AdminCard>

      {/* Categories Management */}
      <AdminCard title={`Dynamic Service Categories (${categoriesQuery.data?.length ?? 0})`}>
        {categoriesQuery.isLoading ? (
          <div className="py-8 text-center text-background/50">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : (
          <AdminTable head={["Category Name", "Slug", "Icon", "Description", "Status"]}>
            {(categoriesQuery.data ?? []).map((cat) => (
              <tr key={cat.id}>
                <td className="px-3 py-3 font-semibold text-background">{cat.name}</td>
                <td className="px-3 py-3">
                  <code className="text-xs text-background/60">{cat.slug}</code>
                </td>
                <td className="px-3 py-3 text-xs">{cat.icon}</td>
                <td className="px-3 py-3 text-xs text-background/70">{cat.description}</td>
                <td className="px-3 py-3">
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                    {cat.is_active ? "Active" : "Disabled"}
                  </span>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCard>

      {/* Providers Management */}
      <AdminCard title={`Registered Service Providers (${providersQuery.data?.length ?? 0})`}>
        {providersQuery.isLoading ? (
          <div className="py-8 text-center text-background/50">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : (
          <AdminTable head={["Business / Name", "Phone", "Rating", "Jobs", "Verification", "Actions"]}>
            {(providersQuery.data ?? []).map((p) => (
              <tr key={p.user_id}>
                <td className="px-3 py-3">
                  <span className="font-semibold text-background">{p.business_name}</span>
                  <span className="block text-[11px] text-background/50">{p.profile?.name}</span>
                </td>
                <td className="px-3 py-3 text-xs text-background/70">{p.profile?.phone_number ?? "—"}</td>
                <td className="px-3 py-3 text-xs font-bold text-amber-400">⭐ {Number(p.rating).toFixed(1)}</td>
                <td className="px-3 py-3 text-xs">{p.completed_jobs_count}</td>
                <td className="px-3 py-3">
                  {p.is_verified_provider ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                    </span>
                  ) : (
                    <span className="text-xs text-background/40">Unverified</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        toggleVerifyMutation.mutate({
                          userId: p.user_id,
                          isVerified: !p.is_verified_provider,
                        })
                      }
                      className="rounded-lg border border-background/20 px-2 py-1 text-xs text-background hover:bg-background/10"
                    >
                      {p.is_verified_provider ? "Unverify" : "Verify Pro"}
                    </button>
                    <button
                      onClick={() =>
                        toggleSuspendMutation.mutate({
                          userId: p.user_id,
                          isSuspended: !p.is_suspended,
                        })
                      }
                      className={`rounded-lg px-2 py-1 text-xs font-medium ${
                        p.is_suspended
                          ? "bg-emerald-600 text-white"
                          : "border border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                      }`}
                    >
                      {p.is_suspended ? "Unsuspend" : "Suspend"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
      </AdminCard>

      {/* Add Category Dialog */}
      <Dialog open={isAddCatOpen} onOpenChange={setIsAddCatOpen}>
        <DialogContent className="max-w-md rounded-3xl bg-ink p-6 text-background">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold">Add Service Category</DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              addCategoryMutation.mutate();
            }}
            className="mt-4 space-y-4 text-xs"
          >
            <div>
              <label className="block uppercase text-background/60">Category Name</label>
              <input
                type="text"
                placeholder="e.g. Pet Care & Grooming"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                required
                className="mt-1 w-full rounded-xl border border-background/20 bg-background/5 p-2.5 text-background focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block uppercase text-background/60">Slug (URL identifier)</label>
              <input
                type="text"
                placeholder="e.g. pet-care"
                value={newCatSlug}
                onChange={(e) => setNewCatSlug(e.target.value)}
                className="mt-1 w-full rounded-xl border border-background/20 bg-background/5 p-2.5 text-background focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block uppercase text-background/60">Icon Name</label>
              <input
                type="text"
                placeholder="Wrench, Sparkles, Briefcase, Camera, Heart"
                value={newCatIcon}
                onChange={(e) => setNewCatIcon(e.target.value)}
                className="mt-1 w-full rounded-xl border border-background/20 bg-background/5 p-2.5 text-background focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block uppercase text-background/60">Description</label>
              <textarea
                placeholder="Dog walking, pet grooming, veterinarian visits..."
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-xl border border-background/20 bg-background/5 p-2.5 text-background focus:border-primary focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddCatOpen(false)}
                className="rounded-xl border border-background/20 px-4 py-2 font-semibold text-background/60 hover:bg-background/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addCategoryMutation.isPending}
                className="rounded-xl bg-primary px-5 py-2 font-semibold text-primary-foreground shadow-xs hover:bg-primary/90"
              >
                Save Category
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
