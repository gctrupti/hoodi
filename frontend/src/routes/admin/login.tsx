import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { HoodiMark } from "@/components/hoodi/HoodiLogo";

export const Route = createFileRoute("/admin/login")({
  validateSearch: z.object({ denied: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Admin sign in — Hoodi console" },
      { name: "description", content: "Restricted sign in for Hoodi platform administrators." },
      { property: "og:title", content: "Admin sign in — Hoodi console" },
      { property: "og:description", content: "Restricted sign in for Hoodi platform administrators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const { denied } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(denied ? "That account is not an administrator." : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !data.user) {
      setBusy(false);
      setError(signInError?.message ?? "Sign in failed.");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .maybeSingle();
    setBusy(false);
    if (!profile?.is_admin) {
      await supabase.auth.signOut();
      setError("That account is not an administrator.");
      return;
    }
    navigate({ to: "/admin" });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-ink px-4 text-background">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-3xl border border-background/10 bg-background/5 p-8"
      >
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-background/10">
            <HoodiMark className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="font-display text-xl font-extrabold tracking-tight">Hoodi</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-background/50">
              Admin console
            </p>
          </div>
        </div>

        <h1 className="mt-7 font-display text-2xl font-bold tracking-tight">Restricted access</h1>
        <p className="mt-1 text-sm text-background/60">
          Platform administrators only. Member accounts use the main app.
        </p>

        <label className="mt-6 block text-xs font-semibold uppercase tracking-[0.14em] text-background/50">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-background/15 bg-background/5 px-3 py-2.5 text-sm outline-none focus:border-background/40"
        />

        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-background/50">
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-background/15 bg-background/5 px-3 py-2.5 text-sm outline-none focus:border-background/40"
        />

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-background px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-background/90 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Sign in
        </button>
      </form>
    </div>
  );
}
