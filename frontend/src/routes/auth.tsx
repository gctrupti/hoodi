import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Hoodi" },
      { name: "description", content: "Sign in to your Hoodi account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/home`,
            data: { name: name || null },
          },
        });
        if (err) throw err;
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
      navigate({ to: "/home" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-background md:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-clay-soft via-sand to-background p-10 md:flex md:flex-col md:justify-between">
        <Link to="/" className="inline-flex w-fit items-center gap-2 text-sm text-ink-soft hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
        <div>
          <h2 className="font-display text-5xl font-bold leading-tight text-ink">
            Your street,
            <br />
            on&nbsp;call.
          </h2>
          <p className="mt-4 max-w-sm text-ink-soft">
            Sign in and see who needs a hand within 5&nbsp;km. Emergencies are always free.
          </p>
        </div>
        <div className="text-xs uppercase tracking-widest text-ink-soft/70">Hoodi · Neighborhood care</div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "radial-gradient(rgba(139,115,85,0.9) 1px, transparent 1px)",
            backgroundSize: "4px 4px",
          }}
        />
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink md:hidden">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <h1 className="font-display text-3xl font-bold text-ink">
            {mode === "signup" ? "Join Hoodi" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {mode === "signup"
              ? "Create an account with your email to start posting or helping."
              : "Sign in to see requests near you."}
          </p>

          <div className="mt-6 inline-flex rounded-full border border-border bg-card p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={
                "rounded-full px-4 py-1.5 font-medium transition " +
                (mode === "signin" ? "bg-ink text-background" : "text-ink-soft")
              }
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={
                "rounded-full px-4 py-1.5 font-medium transition " +
                (mode === "signup" ? "bg-ink text-background" : "text-ink-soft")
              }
            >
              Sign up
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            {mode === "signup" && (
              <Field label="Display name">
                <input
                  className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="e.g. Priya"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            )}
            <Field label="Email">
              <input
                type="email"
                required
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                required
                minLength={6}
                className="w-full rounded-xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="min 6 chars"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {error && (
              <p className="rounded-xl bg-urgency-emergency-soft px-3 py-2 text-sm text-urgency-emergency">
                {error}
              </p>
            )}
            <button
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </span>
      {children}
    </label>
  );
}