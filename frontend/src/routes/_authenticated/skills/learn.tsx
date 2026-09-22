import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Crosshair,
  ExternalLink,
  GraduationCap,
  Loader2,
  MapPin,
  Plus,
  Repeat,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  browseTeachers,
  getMyLearnerProfile,
  upsertMyLearnerProfile,
  type TeacherCard,
  type LearnerProfile,
} from "@/lib/hoodi/skills.functions";
import {
  getMyExchangePreferences,
  upsertExchangePreferences,
  discoverExchangeMatches,
  proposeSkillExchange,
  type SkillExchangeMatch,
  type ExchangePreferences,
} from "@/lib/hoodi/skill-exchange.functions";
import { inr } from "@/lib/hoodi/format";
import { DAY_SHORT, groupByDay, parseSlots } from "@/lib/hoodi/availability";
import { LocationSearch } from "@/components/hoodi/LocationSearch";
import { useHoodiLocation } from "@/hooks/use-hoodi-location";
import {
  DEFAULT_RADIUS_M,
  RADIUS_OPTIONS,
  formatDistance,
  formatRadius,
  shortAddress,
} from "@/lib/hoodi/location";
import { useTrustBatch } from "@/hooks/use-trust";
import { TrustBadges } from "@/components/hoodi/TrustBadges";

export const Route = createFileRoute("/_authenticated/skills/learn")({
  head: () => ({
    meta: [
      { title: "Learn & Skill Exchange — Hoodi Skills" },
      { name: "description", content: "Learn skills from mentors or swap skills peer-to-peer in your neighborhood." },
      { property: "og:title", content: "Learn & Skill Exchange — Hoodi Skills" },
      {
        property: "og:description",
        content: "Find trusted local mentors or barter skills with neighbors with zero cash.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LearnPage,
});

const CATEGORIES = [
  "Languages",
  "Music",
  "Cooking",
  "Tech & Coding",
  "Art & Design",
  "Fitness",
  "Academics",
  "Crafts",
];

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary";

function LearnPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"mentors" | "exchange">("mentors");

  // Search & Filter State
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState("");
  const [selectedMode, setSelectedMode] = useState<"online" | "offline" | "both">("both");
  const loc = useHoodiLocation();
  const [nearMe, setNearMe] = useState(true);
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_RADIUS_M);
  const coords = nearMe ? loc.coords : null;

  // Learner Preferences State & Queries
  const [showPrefModal, setShowPrefModal] = useState(false);
  const learnerPref = useQuery({
    queryKey: ["my-learner-profile"],
    queryFn: () => getMyLearnerProfile(),
  });

  const [learningGoal, setLearningGoal] = useState("");
  const [skillLevel, setSkillLevel] = useState<"beginner" | "intermediate" | "advanced" | "all">("beginner");
  const [preferredSchedule, setPreferredSchedule] = useState<"weekday_evenings" | "weekend_mornings" | "weekends" | "flexible">("flexible");
  const [budgetMax, setBudgetMax] = useState("1000");

  const saveLearnerPref = useMutation({
    mutationFn: () =>
      upsertMyLearnerProfile({
        data: {
          learning_goals: learningGoal.trim() ? [learningGoal.trim()] : [],
          skill_level: skillLevel,
          preferred_schedule: preferredSchedule,
          budget_max: Number(budgetMax) || 1000,
          mode_preference: selectedMode,
        },
      }),
    onSuccess: () => {
      toast.success("Learning preferences saved!");
      qc.invalidateQueries({ queryKey: ["my-learner-profile"] });
      setShowPrefModal(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  // Skill Exchange State & Queries
  const exchangePref = useQuery({
    queryKey: ["my-exchange-preferences"],
    queryFn: () => getMyExchangePreferences(),
  });
  const exchangeMatches = useQuery({
    queryKey: ["exchange-matches"],
    queryFn: () => discoverExchangeMatches(),
    enabled: activeTab === "exchange",
  });

  const [showEditExchangeModal, setShowEditExchangeModal] = useState(false);
  const [offersInput, setOffersInput] = useState("");
  const [wantsInput, setWantsInput] = useState("");
  const [bioNote, setBioNote] = useState("");
  const [exchangeMode, setExchangeMode] = useState<"online" | "offline" | "both">("both");

  // Propose Swap Modal State
  const [selectedMatch, setSelectedMatch] = useState<SkillExchangeMatch | null>(null);
  const [proposalTeaches, setProposalTeaches] = useState("");
  const [proposalLearns, setProposalLearns] = useState("");
  const [proposalNotes, setProposalNotes] = useState("");

  const saveExchangePref = useMutation({
    mutationFn: () => {
      const offers = offersInput.split(",").map((s) => s.trim()).filter(Boolean);
      const wants = wantsInput.split(",").map((s) => s.trim()).filter(Boolean);
      if (offers.length === 0 || wants.length === 0) {
        throw new Error("Please list at least one skill you can teach and one skill you want to learn.");
      }
      return upsertExchangePreferences({
        data: {
          offers_skills: offers,
          wants_skills: wants,
          bio_note: bioNote.trim() || null,
          preferred_mode: exchangeMode,
          is_active: true,
        },
      });
    },
    onSuccess: () => {
      toast.success("Skill exchange profile updated!");
      qc.invalidateQueries({ queryKey: ["my-exchange-preferences"] });
      qc.invalidateQueries({ queryKey: ["exchange-matches"] });
      setShowEditExchangeModal(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const sendProposal = useMutation({
    mutationFn: () => {
      if (!selectedMatch) throw new Error("No match selected.");
      return proposeSkillExchange({
        data: {
          recipientId: selectedMatch.candidate_id,
          proposerTeaches: proposalTeaches || selectedMatch.matching_want,
          proposerLearns: proposalLearns || selectedMatch.matching_offer,
          recipientTeaches: proposalLearns || selectedMatch.matching_offer,
          recipientLearns: proposalTeaches || selectedMatch.matching_want,
          teachingMode: selectedMatch.preferred_mode,
          notes: proposalNotes.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success(`Skill exchange proposal sent to ${selectedMatch?.candidate_name}!`);
      setSelectedMatch(null);
      setProposalNotes("");
      navigate({ to: "/skills/bookings" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  // Mentors query
  const filters = {
    q: q.trim() || undefined,
    category: category ?? undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    minRating: minRating ? Number(minRating) : undefined,
    mode: selectedMode,
    lat: coords?.lat,
    lng: coords?.lng,
    radiusM: coords ? radiusM : undefined,
  };

  const teachers = useQuery({
    queryKey: ["browse-teachers", filters],
    queryFn: () => browseTeachers({ data: filters }),
  });

  const placeLabel = shortAddress(loc.location);
  const trust = useTrustBatch((teachers.data ?? []).map((t) => t.teacher_id));

  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Hoodi Skills
          </span>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            Learn from your neighbors
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink-soft">
            Book paid lessons with trusted mentors or swap skills peer-to-peer with zero cash.
          </p>
        </div>

        {/* Top Tab Switcher */}
        <div className="flex items-center gap-1 rounded-2xl border border-border bg-card p-1 shadow-sm">
          <button
            onClick={() => setActiveTab("mentors")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "mentors"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            Find Mentors
          </button>
          <button
            onClick={() => {
              setActiveTab("exchange");
              const ep = exchangePref.data;
              if (ep) {
                setOffersInput(ep.offers_skills.join(", "));
                setWantsInput(ep.wants_skills.join(", "));
                setBioNote(ep.bio_note ?? "");
                setExchangeMode(ep.preferred_mode);
              }
            }}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
              activeTab === "exchange"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            <Repeat className="h-4 w-4" />
            🔥 Skill Exchange (Swap)
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* TAB 1: FIND MENTORS & LESSONS                                             */}
      {/* ========================================================================= */}
      {activeTab === "mentors" && (
        <div className="mt-6 space-y-6">
          {/* Learner Preference Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5">
            <div className="flex items-center gap-2.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs font-bold text-ink">
                  {learnerPref.data?.learning_goals.length
                    ? `Goal: ${learnerPref.data.learning_goals[0]} (${learnerPref.data.skill_level})`
                    : "Personalize your learning discovery"}
                </p>
                <p className="text-[11px] text-ink-soft">
                  Set your learning goals, skill level, preferred schedule, and budget ceiling.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (learnerPref.data) {
                  setLearningGoal(learnerPref.data.learning_goals[0] ?? "");
                  setSkillLevel(learnerPref.data.skill_level);
                  setPreferredSchedule(learnerPref.data.preferred_schedule);
                  setBudgetMax(String(learnerPref.data.budget_max));
                }
                setShowPrefModal(true);
              }}
              className="rounded-full border border-primary/30 bg-background px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10"
            >
              {learnerPref.data ? "Edit Preferences" : "Set Learning Goals"}
            </button>
          </div>

          {/* Location Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[260px]">
              <LocationSearch
                bias={loc.coords}
                onSelect={(p) => {
                  setNearMe(true);
                  loc.saveLocation({
                    latitude: p.latitude,
                    longitude: p.longitude,
                    formatted_address: p.formatted_address,
                    city: p.city,
                    state: p.state,
                    country: p.country,
                  });
                }}
                placeholder="Search neighborhood (e.g. Indiranagar, Koramangala)…"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => (loc.coords ? setNearMe((v) => !v) : loc.useDeviceLocation())}
                disabled={loc.isSaving}
                className="inline-flex items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 text-xs font-semibold text-ink-soft transition hover:text-ink disabled:opacity-60"
              >
                {loc.isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
                {!loc.coords
                  ? "Use GPS"
                  : nearMe
                  ? `Near ${placeLabel ?? "me"}`
                  : "Everywhere"}
              </button>
              {nearMe && loc.coords && (
                <div className="flex items-center gap-1 text-xs">
                  {RADIUS_OPTIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRadiusM(r)}
                      className={
                        "rounded-full border px-2 py-1 font-semibold transition " +
                        (radiusM === r
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-ink-soft hover:bg-sand")
                      }
                    >
                      {formatRadius(r)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Search bar & Filters */}
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 shadow-sm">
            <Search className="h-4 w-4 text-ink-soft" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search skills, instruments, coding, languages, or teacher names…"
              className="w-full bg-transparent text-sm text-ink placeholder:text-ink-soft/70 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Teaching Mode Toggle */}
            <div className="flex items-center rounded-full border border-border bg-background p-0.5">
              {(["both", "online", "offline"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSelectedMode(m)}
                  className={`rounded-full px-3 py-1 font-semibold capitalize transition ${
                    selectedMode === m
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {m === "both" ? "All Modes" : m}
                </button>
              ))}
            </div>

            <label className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-ink-soft">
              Max ₹
              <input
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
                placeholder="any"
                className="w-14 bg-transparent text-ink outline-none"
              />
            </label>

            <label className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-ink-soft">
              Min rating
              <select
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
                className="bg-transparent text-ink outline-none"
              >
                <option value="">any</option>
                <option value="3">3★+</option>
                <option value="4">4★+</option>
                <option value="4.8">4.8★+</option>
              </select>
            </label>

            {category && (
              <button
                onClick={() => setCategory(null)}
                className="rounded-full bg-primary/15 px-3 py-1.5 font-semibold text-primary"
              >
                {category} ✕
              </button>
            )}
          </div>

          {/* Categories Grid */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Browse categories
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(category === c ? null : c)}
                  className={
                    "rounded-2xl border px-4 py-3.5 text-center text-sm font-medium shadow-xs transition " +
                    (category === c
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-border bg-background text-ink hover:border-primary/50")
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </section>

          {/* Mentors List */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
              {teachers.data?.length ?? 0} mentor{(teachers.data?.length ?? 0) === 1 ? "" : "s"} available
            </h2>
            {teachers.isLoading ? (
              <div className="flex h-40 items-center justify-center text-ink-soft">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (teachers.data ?? []).length === 0 ? (
              <EmptyState
                icon={<BookOpen className="h-6 w-6" />}
                title="No mentors match your filters"
                body="Try expanding your radius or adjusting your budget and keywords."
              />
            ) : (
              <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
                {(teachers.data ?? []).map((t) => (
                  <TeacherCardView key={t.teacher_id} t={t} badges={trust.data?.[t.teacher_id]?.badges} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: 🔥 SKILL EXCHANGE (PEER SWAP & BARTER)                             */}
      {/* ========================================================================= */}
      {activeTab === "exchange" && (
        <div className="mt-6 space-y-6">
          {/* User's Current Exchange Profile Card */}
          <div className="rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-amber-500/5 p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <Repeat className="h-3.5 w-3.5" /> Peer Skill Barter
                  </span>
                  <span className="text-xs text-ink-soft">Zero Cash · Mutual Learning</span>
                </div>
                <h2 className="font-display text-xl font-bold text-ink">Your Skill Swap Profile</h2>
                <p className="max-w-xl text-xs text-ink-soft">
                  Declare what you can teach and what you want to learn. Hoodi matches you with neighbors for direct 2-way swaps!
                </p>
              </div>

              <button
                onClick={() => {
                  const ep = exchangePref.data;
                  if (ep) {
                    setOffersInput(ep.offers_skills.join(", "));
                    setWantsInput(ep.wants_skills.join(", "));
                    setBioNote(ep.bio_note ?? "");
                    setExchangeMode(ep.preferred_mode);
                  }
                  setShowEditExchangeModal(true);
                }}
                className="rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-amber-700"
              >
                {exchangePref.data?.offers_skills.length ? "Edit My Swap Skills" : "Create Swap Profile"}
              </button>
            </div>

            {exchangePref.data && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 rounded-2xl border border-border bg-card/60 p-4 text-xs">
                <div>
                  <p className="font-semibold text-emerald-700 dark:text-emerald-400">✨ What You Teach (Offer):</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {exchangePref.data.offers_skills.map((s) => (
                      <span key={s} className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-amber-700 dark:text-amber-400">🎯 What You Want to Learn (Wishlist):</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {exchangePref.data.wants_skills.map((s) => (
                      <span key={s} className="rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Skill Exchange Radar / Match Results */}
          <section>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-ink">Skill Exchange Radar</h2>
                <p className="text-xs text-ink-soft">
                  Detected swap matches in your neighborhood based on mutual skills.
                </p>
              </div>
              <span className="text-xs font-semibold text-amber-600">
                {exchangeMatches.data?.length ?? 0} matches found
              </span>
            </div>

            {exchangeMatches.isLoading ? (
              <div className="flex h-44 items-center justify-center text-ink-soft">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !exchangePref.data?.offers_skills.length ? (
              <EmptyState
                icon={<Repeat className="h-6 w-6 text-amber-500" />}
                title="Create your swap profile to see matches"
                body="Add what you can teach (e.g. React, Guitar, Cooking) and what you want to learn to unlock the Community Radar."
              />
            ) : (exchangeMatches.data ?? []).length === 0 ? (
              <EmptyState
                icon={<Repeat className="h-6 w-6 text-amber-500" />}
                title="No direct swap matches yet"
                body="We are actively searching nearby neighbors. Add more keywords to your skills to widen discovery."
              />
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {(exchangeMatches.data ?? []).map((m) => (
                  <div
                    key={m.candidate_id}
                    className={`flex flex-col justify-between rounded-3xl border p-5 shadow-sm transition ${
                      m.is_two_way_swap
                        ? "border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-card"
                        : "border-border bg-card"
                    }`}
                  >
                    <div>
                      {/* Top badge */}
                      <div className="flex items-center justify-between gap-2">
                        {m.is_two_way_swap ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
                            <Sparkles className="h-3 w-3" /> {m.match_score}% Match · Perfect 2-Way Swap!
                          </span>
                        ) : (
                          <span className="rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-semibold text-ink-soft">
                            {m.match_score}% Match
                          </span>
                        )}
                        {m.formatted_distance && (
                          <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
                            <MapPin className="h-3 w-3 text-primary" /> {m.formatted_distance}
                          </span>
                        )}
                      </div>

                      {/* Candidate info */}
                      <div className="mt-3.5 flex items-center gap-3">
                        {m.candidate_photo ? (
                          <img
                            src={m.candidate_photo}
                            alt={m.candidate_name ?? "Neighbor"}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="grid h-12 w-12 place-items-center rounded-full bg-amber-100 font-display text-lg font-bold text-amber-800">
                            {(m.candidate_name ?? "N").slice(0, 1)}
                          </div>
                        )}
                        <div>
                          <h3 className="font-bold text-ink text-base">{m.candidate_name}</h3>
                          <p className="text-xs text-ink-soft line-clamp-1">{m.candidate_headline ?? m.candidate_location}</p>
                        </div>
                      </div>

                      {/* 2-Way Swap Breakdown */}
                      <div className="mt-4 rounded-2xl border border-border bg-background p-3.5 text-xs space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            THEY TEACH
                          </span>
                          <span className="font-semibold text-ink">{m.matching_offer}</span>
                        </div>
                        <div className="flex items-center gap-2 text-ink-soft">
                          <Repeat className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span className="text-[11px]">{m.match_reason}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            YOU TEACH
                          </span>
                          <span className="font-semibold text-ink">{m.matching_want}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-2 border-t border-border flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedMatch(m);
                          setProposalTeaches(m.matching_want);
                          setProposalLearns(m.matching_offer);
                        }}
                        className="flex-1 rounded-full bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition flex items-center justify-center gap-1.5"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Propose Skill Swap
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LEARNER PREFERENCES                                                */}
      {/* ========================================================================= */}
      {showPrefModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Your Learning Preferences</h2>
              <button onClick={() => setShowPrefModal(false)} className="text-ink-soft hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              Help mentors tailor their lesson plans to your personal goals and schedule.
            </p>

            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-ink">Primary Learning Goal</label>
                <input
                  value={learningGoal}
                  onChange={(e) => setLearningGoal(e.target.value)}
                  placeholder="e.g. Learn acoustic fingerstyle guitar, or Build React apps"
                  className={`mt-1 ${inputClass}`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-ink">Current Skill Level</label>
                  <select
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(e.target.value as any)}
                    className={`mt-1 ${inputClass}`}
                  >
                    <option value="beginner">Beginner (Starting fresh)</option>
                    <option value="intermediate">Intermediate (Know basics)</option>
                    <option value="advanced">Advanced (Deep mastery)</option>
                    <option value="all">All Levels</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-ink">Preferred Schedule</label>
                  <select
                    value={preferredSchedule}
                    onChange={(e) => setPreferredSchedule(e.target.value as any)}
                    className={`mt-1 ${inputClass}`}
                  >
                    <option value="flexible">Flexible</option>
                    <option value="weekday_evenings">Weekday Evenings</option>
                    <option value="weekend_mornings">Weekend Mornings</option>
                    <option value="weekends">Weekends</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-ink">Max Budget per Session (₹)</label>
                <input
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value.replace(/\D/g, ""))}
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPrefModal(false)}
                className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveLearnerPref.mutate()}
                disabled={saveLearnerPref.isPending}
                className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                {saveLearnerPref.isPending ? "Saving…" : "Save Preferences"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT SKILL EXCHANGE PROFILE                                        */}
      {/* ========================================================================= */}
      {showEditExchangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">Setup Skill Barter Profile</h2>
              <button onClick={() => setShowEditExchangeModal(false)} className="text-ink-soft hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-soft">
              Enter comma-separated skills you can teach and skills you want to learn.
            </p>

            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-emerald-700 dark:text-emerald-400">
                  Skills You Can Teach (Comma-separated)
                </label>
                <input
                  value={offersInput}
                  onChange={(e) => setOffersInput(e.target.value)}
                  placeholder="e.g. React, TypeScript, Python, Chess, French"
                  className={`mt-1 ${inputClass}`}
                />
              </div>

              <div>
                <label className="font-semibold text-amber-700 dark:text-amber-400">
                  Skills You Want to Learn (Comma-separated)
                </label>
                <input
                  value={wantsInput}
                  onChange={(e) => setWantsInput(e.target.value)}
                  placeholder="e.g. Acoustic Guitar, Sourdough Baking, Yoga, Spanish"
                  className={`mt-1 ${inputClass}`}
                />
              </div>

              <div>
                <label className="font-semibold text-ink">Exchange Mode Preference</label>
                <div className="mt-1 flex gap-2">
                  {(["both", "online", "offline"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setExchangeMode(m)}
                      className={`flex-1 rounded-xl border py-2 capitalize font-semibold ${
                        exchangeMode === m
                          ? "border-amber-500 bg-amber-500 text-white"
                          : "border-border bg-card text-ink-soft"
                      }`}
                    >
                      {m === "both" ? "Online & In-Person" : m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-semibold text-ink">Bio / Note for Neighbors (Optional)</label>
                <textarea
                  rows={2}
                  value={bioNote}
                  onChange={(e) => setBioNote(e.target.value)}
                  placeholder="e.g. Happy to meet at a local cafe in Indiranagar on weekends!"
                  className={`mt-1 ${inputClass}`}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEditExchangeModal(false)}
                className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveExchangePref.mutate()}
                disabled={saveExchangePref.isPending}
                className="rounded-full bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                {saveExchangePref.isPending ? "Saving…" : "Save & Find Matches"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PROPOSE SKILL SWAP                                                 */}
      {/* ========================================================================= */}
      {selectedMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-3xl border border-border bg-background p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="h-5 w-5 text-amber-500" />
                <h2 className="font-display text-lg font-bold text-ink">
                  Propose Skill Swap to {selectedMatch.candidate_name}
                </h2>
              </div>
              <button onClick={() => setSelectedMatch(null)} className="text-ink-soft hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-sand/50 p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-ink-soft">What You Teach:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{proposalTeaches}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">What You Learn:</span>
                <span className="font-bold text-amber-700 dark:text-amber-400">{proposalLearns}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Teaching Mode:</span>
                <span className="font-semibold text-ink capitalize">{selectedMatch.preferred_mode}</span>
              </div>
            </div>

            <div className="mt-4 text-xs space-y-2">
              <label className="font-semibold text-ink">Personal Note & Proposed Times</label>
              <textarea
                rows={3}
                value={proposalNotes}
                onChange={(e) => setProposalNotes(e.target.value)}
                placeholder={`Hi ${selectedMatch.candidate_name}, I'd love to swap lessons! I can teach you ${proposalTeaches} and learn ${proposalLearns}. Let me know if weekday evenings work for you.`}
                className={inputClass}
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedMatch(null)}
                className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => sendProposal.mutate()}
                disabled={sendProposal.isPending}
                className="rounded-full bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60 flex items-center gap-1.5"
              >
                {sendProposal.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send Swap Proposal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TeacherCardView({ t, badges }: { t: TeacherCard; badges?: string[] }) {
  const slots = parseSlots(t.availability_slots);
  const days = groupByDay(slots).map((g) => DAY_SHORT[g.day]);
  return (
    <article className="flex flex-col justify-between rounded-2xl border border-border bg-background p-5 shadow-xs transition hover:border-primary/60">
      <div>
        <div className="flex items-start gap-3">
          {t.profile_photo_url ? (
            <img
              src={t.profile_photo_url}
              alt={`${t.name ?? "Mentor"} profile photo`}
              className="h-14 w-14 shrink-0 rounded-2xl object-cover"
              loading="lazy"
            />
          ) : (
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sand font-display text-lg font-bold text-ink">
              {(t.name ?? "H").slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display text-lg font-bold text-ink truncate">{t.name ?? "Neighbor"}</h3>
                  {t.is_verified_teacher && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" title="Verified Instructor" />
                  )}
                </div>
                <TrustBadges badges={badges} max={2} className="mt-1" />
              </div>
              {t.avg_score != null && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sand px-2 py-1 text-xs font-semibold text-ink">
                  <Star className="h-3 w-3 fill-current text-amber-500" /> {t.avg_score} ({t.rating_count})
                </span>
              )}
            </div>
            {t.headline && <p className="text-xs text-ink-soft line-clamp-1 mt-0.5">{t.headline}</p>}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {t.offerings.slice(0, 3).map((o) => (
            <span key={o.id} className="rounded-full bg-sand px-2.5 py-1 text-xs text-ink-soft">
              {o.title}
            </span>
          ))}
          {t.offerings.length > 3 && (
            <span className="rounded-full px-2 py-1 text-xs text-ink-soft">
              +{t.offerings.length - 3} more
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
          <span className="font-semibold text-ink">from {inr(t.min_price ?? 0)}</span>
          <span>{t.experience_years} yr exp</span>
          <span className="capitalize">{t.teaching_mode}</span>
          {t.portfolio_items.length > 0 && (
            <span className="text-primary font-medium">{t.portfolio_items.length} projects</span>
          )}
          {formatDistance(t.distance_m) && (
            <span className="inline-flex items-center gap-1 text-ink-soft">
              <MapPin className="h-3 w-3 text-primary" />
              {formatDistance(t.distance_m)} away
            </span>
          )}
        </div>

        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-ink-soft">
          <Clock className="h-3.5 w-3.5" />
          {days.length ? days.join(" · ") : t.availability || "Flexible timings"}
        </p>
      </div>

      <div className="mt-4 flex gap-2 pt-2 border-t border-border">
        <Link
          to="/skills/teacher/$teacherId"
          params={{ teacherId: t.teacher_id }}
          className="flex-1 text-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 transition"
        >
          Book session
        </Link>
        <Link
          to="/skills/teacher/$teacherId"
          params={{ teacherId: t.teacher_id }}
          className="rounded-full border border-border px-4 py-2 text-xs font-semibold text-ink hover:bg-sand transition"
        >
          View profile
        </Link>
      </div>
    </article>
  );
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="mt-10 flex flex-col items-center rounded-3xl border border-dashed border-border bg-sand/40 px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-background text-ink shadow-inner">
        {icon}
      </span>
      <h3 className="mt-4 font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-ink-soft">{body}</p>
    </div>
  );
}