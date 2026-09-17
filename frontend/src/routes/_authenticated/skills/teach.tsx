import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SuggestCategory } from "@/components/hoodi/SuggestCategory";
import {
  getTeacherDashboard,
  getMyTeacherProfile,
  upsertMyTeacherProfile,
  listMyOfferings,
  createOffering,
  updateOffering,
  deleteOffering,
} from "@/lib/hoodi/skills.functions";
import { inr } from "@/lib/hoodi/format";
import {
  DAY_SHORT,
  HOUR_SLOTS,
  parseSlots,
  slotKey,
  type Slot,
} from "@/lib/hoodi/availability";
import { EmptyState } from "./learn";

export const Route = createFileRoute("/_authenticated/skills/teach")({
  head: () => ({
    meta: [
      { title: "Teach — Hoodi Skills" },
      { name: "description", content: "Share what you know and earn by teaching locally." },
    ],
  }),
  component: TeachPage,
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

function TeachPage() {
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["teacher-profile"], queryFn: () => getMyTeacherProfile() });
  const offerings = useQuery({ queryKey: ["my-offerings"], queryFn: () => listMyOfferings() });
  const stats = useQuery({ queryKey: ["teacher-dashboard"], queryFn: () => getTeacherDashboard() });

  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [years, setYears] = useState("0");
  const [rate, setRate] = useState("0");
  const [availability, setAvailability] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [mode, setMode] = useState<"online" | "offline" | "both">("both");
  const [meetingProvider, setMeetingProvider] = useState<"google_meet" | "zoom" | "teams">("google_meet");
  const [meetingLink, setMeetingLink] = useState("");
  const [languages, setLanguages] = useState("");

  useEffect(() => {
    const p = profile.data;
    if (!p) return;
    setHeadline(p.headline ?? "");
    setBio(p.bio ?? "");
    setYears(String(p.experience_years ?? 0));
    setRate(String(p.hourly_rate ?? 0));
    setAvailability(p.availability ?? "");
    setSlots(parseSlots(p.availability_slots));
    setMode((p.teaching_mode as "online" | "offline" | "both") ?? "both");
    const pm = p as unknown as {
      meeting_provider?: string | null;
      meeting_link?: string | null;
      languages?: string[] | null;
    };
    setMeetingProvider((pm.meeting_provider as "google_meet" | "zoom" | "teams") ?? "google_meet");
    setMeetingLink(pm.meeting_link ?? "");
    setLanguages((pm.languages ?? []).join(", "));
  }, [profile.data]);

  const saveProfile = useMutation({
    mutationFn: (patch?: { is_published: boolean }) =>
      upsertMyTeacherProfile({
        data: {
          headline: headline || null,
          bio: bio || null,
          experience_years: Number(years) || 0,
          hourly_rate: Number(rate) || 0,
          availability: availability || null,
          availability_slots: slots,
          teaching_mode: mode,
          meeting_provider: mode === "offline" ? null : meetingProvider,
          meeting_link: mode === "offline" || !meetingLink.trim() ? null : meetingLink.trim(),
          languages: languages
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 10),
          ...(patch ?? {}),
        },
      }),
    onSuccess: () => {
      toast.success("Teacher profile saved.");
      qc.invalidateQueries({ queryKey: ["teacher-profile"] });
      qc.invalidateQueries({ queryKey: ["teacher-dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: CATEGORIES[0],
    price: "",
    duration: "60",
  });
  const resetForm = () => {
    setEditing(null);
    setForm({ title: "", description: "", category: CATEGORIES[0], price: "", duration: "60" });
  };

  const saveOffering = useMutation({
    mutationFn: () => {
      const payload = {
        title: form.title.trim(),
        description: form.description || null,
        category: form.category,
        price_per_session: Number(form.price) || 0,
        duration_minutes: Number(form.duration) || 60,
        is_published: true,
      };
      return editing
        ? updateOffering({ data: { id: editing, ...payload } })
        : createOffering({ data: payload });
    },
    onSuccess: () => {
      toast.success(editing ? "Skill updated." : "Skill added.");
      resetForm();
      qc.invalidateQueries({ queryKey: ["my-offerings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const togglePublish = useMutation({
    mutationFn: (o: { id: string; is_published: boolean }) =>
      updateOffering({ data: { id: o.id, is_published: !o.is_published } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-offerings"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteOffering({ data: { id } }),
    onSuccess: () => {
      toast.success("Skill removed.");
      qc.invalidateQueries({ queryKey: ["my-offerings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  const published = profile.data?.is_published ?? false;

  return (
    <div className="mx-auto max-w-4xl">
      <header>
        <span className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
          Hoodi Skills
        </span>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          Teach and earn
        </h1>
        <p className="mt-2 max-w-xl text-sm text-ink-soft">
          Turn what you know into income. Set your rate, share availability, and let neighbors book sessions with you.
        </p>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Today", value: stats.data?.today_sessions ?? 0, hint: "sessions" },
          { label: "Upcoming", value: stats.data?.upcoming_sessions ?? 0, hint: "scheduled" },
          { label: "Pending", value: stats.data?.pending_requests ?? 0, hint: "requests" },
          { label: "Completed", value: stats.data?.completed_sessions ?? 0, hint: "sessions" },
          { label: "This month", value: inr(stats.data?.monthly_earnings ?? 0), hint: "earned" },
          { label: "Students", value: stats.data?.total_students ?? 0, hint: "taught" },
          {
            label: "Rating",
            value: stats.data?.avg_rating != null ? `${stats.data.avg_rating}★` : "—",
            hint: `${stats.data?.rating_count ?? 0} reviews`,
          },
          {
            label: "Hourly rate",
            value: inr(Number(profile.data?.hourly_rate ?? 0)),
            hint: "listed",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-background p-4 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-ink">{s.value}</p>
            <p className="text-xs text-ink-soft">{s.hint}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-background p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-ink">Your teacher profile</h2>
          <span
            className={
              "rounded-full px-3 py-1 text-xs font-semibold " +
              (published ? "bg-primary/15 text-primary" : "bg-sand text-ink-soft")
            }
          >
            {published ? "Visible to learners" : "Not published"}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Headline
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Guitar teacher · 8 years of gigging"
              className={`mt-1 font-normal normal-case tracking-normal ${inputClass}`}
            />
          </label>
          <label className="sm:col-span-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
            About your teaching
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={`mt-1 font-normal normal-case tracking-normal ${inputClass}`}
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Years of experience
            <input
              value={years}
              onChange={(e) => setYears(e.target.value.replace(/\D/g, ""))}
              className={`mt-1 font-normal normal-case tracking-normal ${inputClass}`}
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Hourly rate (₹)
            <input
              value={rate}
              onChange={(e) => setRate(e.target.value.replace(/\D/g, ""))}
              className={`mt-1 font-normal normal-case tracking-normal ${inputClass}`}
            />
          </label>
          <label className="sm:col-span-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Note about your schedule (optional)
            <input
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              placeholder="Happy to shift times with notice"
              className={`mt-1 font-normal normal-case tracking-normal ${inputClass}`}
            />
          </label>
          <label className="sm:col-span-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
            Languages you teach in
            <input
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              placeholder="English, Hindi, Kannada"
              className={`mt-1 font-normal normal-case tracking-normal ${inputClass}`}
            />
          </label>
        </div>

        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Teaching mode</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["online", "offline", "both"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={
                  "rounded-full border px-4 py-1.5 text-xs font-semibold capitalize transition " +
                  (mode === m
                    ? "border-ink bg-ink text-background"
                    : "border-border bg-card text-ink-soft hover:bg-sand")
                }
              >
                {m}
              </button>
            ))}
          </div>
          {mode !== "offline" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select
                value={meetingProvider}
                onChange={(e) =>
                  setMeetingProvider(e.target.value as "google_meet" | "zoom" | "teams")
                }
                className={inputClass}
              >
                <option value="google_meet">Google Meet</option>
                <option value="zoom">Zoom</option>
                <option value="teams">Microsoft Teams</option>
              </select>
              <input
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://… meeting link"
                className={inputClass}
              />
            </div>
          )}
          {mode !== "online" && (
            <p className="mt-2 text-xs text-ink-soft">
              Offline learners see your teaching location, distance and directions from your profile
              location.
            </p>
          )}
        </div>

        <div className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Weekly availability
            </h3>
            <span className="text-xs text-ink-soft">
              {slots.length} slot{slots.length === 1 ? "" : "s"} selected
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-soft">
            Tap the hours you can teach. Learners can only book these slots.
          </p>
          <div className="mt-3 overflow-x-auto">
            <div className="min-w-[640px] space-y-1.5">
              {DAY_SHORT.map((label, day) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-10 shrink-0 text-xs font-semibold text-ink">{label}</span>
                  <div className="flex flex-wrap gap-1">
                    {HOUR_SLOTS.map((h) => {
                      const on = slots.some((s) => s.day === day && s.start === h.start);
                      return (
                        <button
                          key={slotKey(day, h.start)}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            setSlots((prev) =>
                              on
                                ? prev.filter((s) => !(s.day === day && s.start === h.start))
                                : [...prev, { day, start: h.start, end: h.end }],
                            )
                          }
                          className={
                            "rounded-lg px-2 py-1 text-[11px] font-medium transition " +
                            (on
                              ? "bg-primary text-primary-foreground"
                              : "bg-sand text-ink-soft hover:text-ink")
                          }
                        >
                          {h.start}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {slots.length > 0 && (
            <button
              type="button"
              onClick={() => setSlots([])}
              className="mt-2 text-xs font-semibold text-ink-soft underline"
            >
              Clear all slots
            </button>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => saveProfile.mutate(undefined)}
            disabled={saveProfile.isPending}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saveProfile.isPending ? "Saving…" : "Save profile"}
          </button>
          <button
            onClick={() => saveProfile.mutate({ is_published: !published })}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink"
          >
            {published ? "Unpublish" : "Publish profile"}
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-background p-5 shadow-sm">
        <h2 className="font-display text-lg font-bold text-ink">
          {editing ? "Edit skill" : "Add a skill you teach"}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Session title, e.g. Beginner guitar"
            className={`sm:col-span-2 ${inputClass}`}
          />
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className={inputClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            {!CATEGORIES.includes(form.category) && (
              <option value={form.category}>{form.category}</option>
            )}
          </select>
          <input
            value={form.duration}
            onChange={(e) => setForm({ ...form, duration: e.target.value.replace(/\D/g, "") })}
            placeholder="Duration (min)"
            className={inputClass}
          />
          <div className="sm:col-span-2">
            <SuggestCategory module="skills" onPick={(name) => setForm((f) => ({ ...f, category: name }))} />
          </div>
          <input
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, "") })}
            placeholder="Price per session (₹)"
            className={inputClass}
          />
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What learners will get out of it"
            className={`sm:col-span-2 ${inputClass}`}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => saveOffering.mutate()}
            disabled={!form.title.trim() || !form.price || saveOffering.isPending}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saveOffering.isPending ? "Saving…" : editing ? "Update skill" : "Add skill"}
          </button>
          {editing && (
            <button onClick={resetForm} className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink">
              Cancel
            </button>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-soft">Your skills</h2>
        {offerings.isLoading ? (
          <div className="flex h-24 items-center justify-center text-ink-soft">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (offerings.data ?? []).length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="h-6 w-6" />}
            title="No skills listed yet"
            body="Add your first skill above, publish your profile, and neighbors nearby will be able to book you."
          />
        ) : (
          <div className="mt-3 space-y-2">
            {(offerings.data ?? []).map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{o.title}</p>
                  <p className="text-xs text-ink-soft">
                    {o.category} · {o.duration_minutes} min · {inr(Number(o.price_per_session))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => togglePublish.mutate({ id: o.id, is_published: o.is_published })}
                    className={
                      "rounded-full px-3 py-1.5 text-xs font-semibold " +
                      (o.is_published ? "bg-primary/15 text-primary" : "bg-sand text-ink-soft")
                    }
                  >
                    {o.is_published ? "Published" : "Draft · tap to publish"}
                  </button>
                  <button
                    aria-label="Edit skill"
                    onClick={() => {
                      setEditing(o.id);
                      setForm({
                        title: o.title,
                        description: o.description ?? "",
                        category: o.category,
                        price: String(o.price_per_session),
                        duration: String(o.duration_minutes),
                      });
                    }}
                    className="grid h-8 w-8 place-items-center rounded-full border border-border text-ink-soft hover:text-ink"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    aria-label="Delete skill"
                    onClick={() => remove.mutate(o.id)}
                    className="grid h-8 w-8 place-items-center rounded-full border border-border text-ink-soft hover:text-urgency-emergency"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}