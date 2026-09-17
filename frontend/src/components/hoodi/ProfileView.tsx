import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getMyProfile,
  updateMyProfile,
  addOfferTag,
  removeOfferTag,
  getProfileStats,
  listReviewsForUser,
} from "@/lib/hoodi/profiles.functions";
import { LocationPicker } from "@/components/hoodi/LocationPicker";
import { getMyWallet, requestPayout, listMyEarnings, getWalletSummary } from "@/lib/hoodi/wallet.functions";
import { listMyNotifications, markAllNotificationsRead } from "@/lib/hoodi/notifications.functions";
import { supabase } from "@/integrations/supabase/client";
import { inr, formatRelative } from "@/lib/hoodi/format";
import { shortAddress } from "@/lib/hoodi/location";
import { useHoodiLocation } from "@/hooks/use-hoodi-location";
import { useSessionReady } from "@/hooks/use-session-ready";
import { ProfileHero } from "@/components/hoodi/ProfileHero";
import { VerificationCenter } from "@/components/hoodi/VerificationCenter";
import { TrustBadges } from "@/components/hoodi/TrustBadges";
import { useTrust } from "@/hooks/use-trust";
import { AchievementGrid, Avatar, RatingStars, StatTile, type Achievement } from "@/components/hoodi/Identity";
import { EmptyState, Skeleton } from "@/components/hoodi/Primitives";
import {
  Award,
  Bell,
  BookOpen,
  GraduationCap,
  HandHeart,
  Heart,
  MessageSquareQuote,
  PlusCircle,
  Receipt,
  Sparkles,
  Star,
  Wallet as WalletIcon,
  X,
  ArrowDownRight,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

const SUGGESTED_TAGS = ["grocery", "elderly_care", "transportation", "errand", "first_aid"];

function MyTrustStrip() {
  const trust = useTrust();
  if (!trust.data?.badges?.length) return null;
  return (
    <div className="hoodi-rise flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your badges</span>
      <TrustBadges badges={trust.data.badges} max={5} />
    </div>
  );
}

export function ProfileView() {
  const qc = useQueryClient();
  const loc = useHoodiLocation();
  const ready = useSessionReady();
  const profile = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile(), enabled: ready });
  const stats = useQuery({
    queryKey: ["profile-stats"],
    queryFn: () => getProfileStats({ data: {} }),
    enabled: ready,
  });
  const reviews = useQuery({
    queryKey: ["my-reviews"],
    queryFn: () => listReviewsForUser({ data: {} }),
    enabled: ready,
  });
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => getMyWallet(), enabled: ready });
  const earnings = useQuery({ queryKey: ["earnings"], queryFn: () => listMyEarnings(), enabled: ready });
  const summary = useQuery({ queryKey: ["wallet-summary"], queryFn: () => getWalletSummary(), enabled: ready });
  const notifs = useQuery({ queryKey: ["notifications"], queryFn: () => listMyNotifications(), enabled: ready });
  const tagsQuery = useQuery({
    queryKey: ["my-tags"],
    enabled: ready,
    queryFn: async () => {
      const { data } = await supabase.from("user_offer_tags").select("tag").order("tag");
      return Array.from(new Set((data ?? []).map((r: { tag: string }) => r.tag)));
    },
  });

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [newTag, setNewTag] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.name ?? "");
      setBio(profile.data.bio ?? "");
      setPhone(profile.data.phone_number ?? "");
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () =>
      updateMyProfile({ data: { name: name || undefined, bio: bio || null, phone_number: phone || null } }),
    onSuccess: () => {
      toast.success("Profile saved.");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const saveImage = useMutation({
    mutationFn: (v: { kind: "avatar" | "cover"; url: string }) =>
      updateMyProfile({
        data: v.kind === "avatar" ? { profile_photo_url: v.url } : { cover_image_url: v.url },
      }),
    onSuccess: (_d, v) => {
      toast.success(v.kind === "avatar" ? "Profile photo updated." : "Cover updated.");
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const addTag = useMutation({
    mutationFn: (tag: string) => addOfferTag({ data: { tag } }),
    onSuccess: () => {
      setNewTag("");
      qc.invalidateQueries({ queryKey: ["my-tags"] });
    },
  });
  const removeTag = useMutation({
    mutationFn: (tag: string) => removeOfferTag({ data: { tag } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-tags"] }),
  });

  const payout = useMutation({
    mutationFn: () => requestPayout({ data: { amount: Number(payoutAmount) } }),
    onSuccess: () => {
      toast.success("Payout requested — admin will process it.");
      setPayoutAmount("");
      qc.invalidateQueries({ queryKey: ["wallet"] });
      qc.invalidateQueries({ queryKey: ["wallet-summary"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const readAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = (notifs.data ?? []).filter((n) => !n.is_read).length;
  const s = stats.data;
  const achievements: Achievement[] = [
    {
      icon: HandHeart,
      label: "Good neighbor",
      hint: "Complete your first help request",
      earned: (s?.helps_completed ?? 0) >= 1,
    },
    {
      icon: Sparkles,
      label: "Ten times over",
      hint: "10 completed helps in your area",
      earned: (s?.helps_completed ?? 0) >= 10,
    },
    {
      icon: GraduationCap,
      label: "Mentor",
      hint: "Teach your first Skills session",
      earned: (s?.sessions_taught ?? 0) >= 1,
    },
    {
      icon: Star,
      label: "Highly rated",
      hint: "Hold a 4.5+ rating with 3 reviews",
      earned: (s?.avg_score ?? 0) >= 4.5 && (s?.rating_count ?? 0) >= 3,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ProfileHero
        profile={profile.data}
        place={shortAddress(loc.location)}
        avgScore={s?.avg_score}
        ratingCount={s?.rating_count}
        onImage={(kind, url) => saveImage.mutate({ kind, url })}
      />

      <MyTrustStrip />

      <div className="hoodi-rise grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.isLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[74px] rounded-2xl" />)
          : [
              { value: s?.helps_completed ?? 0, label: "Helps done", icon: HandHeart },
              { value: s?.requests_posted ?? 0, label: "Requests", icon: Heart },
              { value: s?.sessions_taught ?? 0, label: "Taught", icon: GraduationCap },
              { value: s?.sessions_learned ?? 0, label: "Learned", icon: BookOpen },
            ].map((t) => <StatTile key={t.label} {...t} />)}
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Section title="About you" icon={Sparkles}>
            <div className="space-y-3">
              <Field label="Display name">
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Priya" />
              </Field>
              <Field label="Bio">
                <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} className={inputClass} placeholder="A line about you." />
              </Field>
              <Field label="Phone">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="+91…" />
              </Field>
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift disabled:opacity-60"
              >
                Save profile
              </button>
            </div>
          </Section>

          <Section title="Verification" icon={ShieldCheck}>
            <p className="mb-4 -mt-1 text-sm text-ink-soft">
              Verified neighbors get matched faster. Your documents stay private and are reviewed by the Hoodi team.
            </p>
            <VerificationCenter phone={phone} />
          </Section>

          <Section title="Achievements" icon={Award}>
            <AchievementGrid items={achievements} />
          </Section>

          <Section title={`Reviews${s?.rating_count ? ` (${s.rating_count})` : ""}`} icon={MessageSquareQuote}>
            {reviews.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
              </div>
            ) : (reviews.data ?? []).length === 0 ? (
              <EmptyState
                icon={MessageSquareQuote}
                title="No reviews yet"
                description="Complete a help request or a Skills session and your neighbors' words land here."
              />
            ) : (
              <div className="space-y-3">
                {reviews.data!.map((r) => (
                  <article key={r.id} className="rounded-2xl border border-border/70 bg-background p-4">
                    <div className="flex items-center gap-3">
                      <Avatar src={r.author_photo} name={r.author_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink">{r.author_name}</div>
                        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                          {formatRelative(r.created_at)}
                        </div>
                      </div>
                      <RatingStars score={r.score} />
                    </div>
                    {r.comment && <p className="mt-3 text-sm leading-relaxed text-ink-soft">{r.comment}</p>}
                  </article>
                ))}
              </div>
            )}
          </Section>

          <Section title="Your location" icon={Heart}>
            <p className="mb-4 -mt-1 text-sm text-ink-soft">
              Used across Hoodi to match you with neighbors and mentors near you. Drag the pin to fine-tune it.
            </p>
            <LocationPicker />
          </Section>

          <Section title="I can help with" icon={HandHeart}>
            <div className="flex flex-wrap gap-2">
              {(tagsQuery.data ?? []).map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-xs font-semibold text-background">
                  {t.replace(/_/g, " ")}
                  <button onClick={() => removeTag.mutate(t)} aria-label="remove">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {(tagsQuery.data ?? []).length === 0 && <span className="text-sm text-ink-soft">No tags yet.</span>}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.filter((t) => !(tagsQuery.data ?? []).includes(t)).map((t) => (
                <button
                  key={t}
                  onClick={() => addTag.mutate(t)}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-ink-soft transition hover:bg-sand"
                >
                  + {t.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add custom tag" className={inputClass} />
              <button
                disabled={!newTag.trim()}
                onClick={() => addTag.mutate(newTag.trim())}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                <PlusCircle className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </Section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-border/80 bg-linear-to-br from-clay-soft/70 via-card to-card p-5 shadow-soft">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
              <WalletIcon className="h-3.5 w-3.5 text-clay" /> Wallet
            </div>
            <div className="mt-2 font-display text-4xl font-bold tracking-tight text-ink">
              {wallet.isLoading ? <Skeleton className="h-9 w-32" /> : inr(wallet.data?.balance ?? 0)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Earnings from completed work, platform fee already deducted.
            </p>
            <dl className="mt-4 space-y-1.5 rounded-2xl bg-card/70 p-3 text-xs">
              {[
                { k: "Withdrawable now", v: summary.data?.withdrawable ?? 0 },
                { k: "Pending (held in escrow)", v: summary.data?.pending ?? 0 },
                { k: "In payout requests", v: summary.data?.in_payout ?? 0 },
              ].map(({ k, v }) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold text-ink">{inr(v)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 flex gap-2">
              <input
                type="number"
                min={1}
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                placeholder="Amount"
                className={inputClass}
              />
              <button
                onClick={() => payout.mutate()}
                disabled={payout.isPending || !payoutAmount}
                className="inline-flex shrink-0 items-center gap-1 rounded-full bg-ink px-4 py-2 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
              >
                Request payout
              </button>
            </div>
          </section>

          <Section title="Recent earnings" icon={Receipt}>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {earnings.isLoading &&
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
              {earnings.data?.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  No earnings yet — accept a paid request to start.
                </p>
              )}
              {earnings.data?.map((e) => (
                <div key={e.id} className="rounded-xl border border-border/60 bg-background p-3 transition hover:border-primary/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-ink">{e.title}</div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                        {e.source === "skills" ? "Skills" : "Help"} · {String(e.category).replace(/_/g, " ")} ·{" "}
                        {formatRelative(e.completed_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-sm font-bold text-urgency-normal">+{inr(e.net)}</div>
                      <div className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <ArrowDownRight className="h-3 w-3" />
                        fee {inr(e.commission)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <section className="rounded-3xl border border-border/80 bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">
                <Bell className="h-3.5 w-3.5 text-clay" /> Notifications
                {unread > 0 && (
                  <span className="rounded-full bg-urgency-emergency px-1.5 text-[10px] font-bold text-background">
                    {unread}
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button onClick={() => readAll.mutate()} className="text-xs font-semibold text-ink-soft hover:text-ink">
                  Mark all read
                </button>
              )}
            </div>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {notifs.isLoading &&
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
              {notifs.data?.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">No notifications yet.</p>
              )}
              {notifs.data?.map((n) => (
                <div
                  key={n.id}
                  className={
                    "rounded-xl border p-3 text-sm transition " +
                    (n.is_read
                      ? "border-border/60 bg-background text-ink-soft"
                      : "border-primary/25 bg-primary/5 text-ink")
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <span>{n.message}</span>
                    {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-urgency-emergency" />}
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                    {formatRelative(n.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="hoodi-rise rounded-3xl border border-border/80 bg-card p-5 shadow-soft">
      <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-ink">
        {Icon && <Icon className="h-4 w-4 text-clay" />}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">{label}</span>
      {children}
    </label>
  );
}