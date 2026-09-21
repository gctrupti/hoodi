import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { createHelpRequest } from "@/lib/hoodi/requests.functions";
import { toast } from "sonner";
import { UrgencyBadge, CategoryChip } from "@/components/hoodi/UrgencyBadge";
import { AlertTriangle, ArrowDown, Sparkles, Loader2 } from "lucide-react";
import { LocationField, type PlacePick } from "@/components/hoodi/LocationField";
import { SuggestCategory } from "@/components/hoodi/SuggestCategory";
import { useHoodiLocation } from "@/hooks/use-hoodi-location";
import { shortAddress } from "@/lib/hoodi/location";
import {
  REQUEST_TYPES,
  REQUEST_TYPE_META,
  type RequestType,
} from "@/lib/hoodi/request-types";

const CATEGORIES = ["grocery", "elderly_care", "transportation", "errand", "first_aid", "other"] as const;
const URGENCIES = ["normal", "today", "emergency"] as const;
type Category = (typeof CATEGORIES)[number];
type Urgency = (typeof URGENCIES)[number];

function guessCategory(text: string): Category {
  const t = text.toLowerCase();
  if (/\b(bleed|injur|hurt|fell|unconscious|chest pain|first aid|medic|ambulan|breath|heart)\b/.test(t)) return "first_aid";
  if (/\b(grocer|milk|bread|shop|store|vegetables|fruit)\b/.test(t)) return "grocery";
  if (/\b(ride|drop|pick|drive|taxi|auto|cab|transport)\b/.test(t)) return "transportation";
  if (/\b(grandma|grandpa|elder|old|senior|dad|mom|parent)\b/.test(t)) return "elderly_care";
  if (t.trim().length === 0) return "other";
  return "errand";
}
function guessUrgency(text: string): Urgency {
  const t = text.toLowerCase();
  if (/\b(emergency|urgent(ly)?|asap|now|help|911|108|bleed|unconscious|fire)\b/.test(t)) return "emergency";
  if (/\b(today|tonight|this evening|this morning|by \d)\b/.test(t)) return "today";
  return "normal";
}
const FARE: Record<Category, number> = {
  grocery: 60,
  elderly_care: 120,
  transportation: 40,
  errand: 50,
  first_aid: 80,
  other: 50,
};

export const Route = createFileRoute("/_authenticated/help/ask")({
  component: CreatePage,
});

function CreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [requestType, setRequestType] = useState<RequestType>("pickup_delivery");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [manualCategory, setManualCategory] = useState<Category | "">("");
  const [manualUrgency, setManualUrgency] = useState<Urgency | "">("");
  const [addressText, setAddressText] = useState("");
  const loc = useHoodiLocation();
  const meta = REQUEST_TYPE_META[requestType];
  const model = meta.locations;

  const [pickup, setPickup] = useState<PlacePick | null>(null);
  const [dropoff, setDropoff] = useState<PlacePick | null>(null);
  const [service, setService] = useState<PlacePick | null>(null);

  // Default the single-point / delivery pin to the neighbor's saved location or Bengaluru default.
  useEffect(() => {
    const lat = loc.coords?.lat ?? 12.9716;
    const lng = loc.coords?.lng ?? 77.5946;
    const addr = shortAddress(loc.location) || "Indiranagar, Bengaluru";
    const mine: PlacePick = {
      lat,
      lng,
      address: addr,
      name: null,
    };
    setService((s) => s ?? mine);
    setDropoff((d) => d ?? mine);
    if (model.pickup && !pickup) {
      setPickup({
        lat: lat + 0.002,
        lng: lng + 0.002,
        address: "Apollo Pharmacy / Local Market",
        name: "Shop nearby",
      });
    }
  }, [loc.coords, loc.location, model.pickup, pickup]);

  /** The location the neighborhood feed searches on. */
  const primary = model.service ? service : dropoff;
  const bias = primary ?? pickup ?? (loc.coords ? { lat: loc.coords.lat, lng: loc.coords.lng, address: null, name: null } : null);

  const combinedText = `${title} ${description}`;
  const suggestedCategory = useMemo(() => guessCategory(combinedText), [combinedText]);
  const suggestedUrgency = useMemo(() => guessUrgency(combinedText), [combinedText]);
  const category: Category = (manualCategory ||
    (title.trim() ? suggestedCategory : meta.defaultCategory)) as Category;
  const urgency: Urgency = (manualUrgency || suggestedUrgency) as Urgency;
  const isPaid = urgency !== "emergency";
  const fare = isPaid ? FARE[category] ?? 50 : 0;

  async function useMyLocation(set: (p: PlacePick) => void) {
    const saved = await loc.useDeviceLocation();
    if (saved?.latitude != null && saved.longitude != null) {
      set({
        lat: saved.latitude,
        lng: saved.longitude,
        address: saved.formatted_address ?? shortAddress(saved),
        name: null,
      });
    }
  }

  const create = useMutation({
    mutationFn: async () => {
      if (model.pickup && !pickup) throw new Error(`Set the ${model.pickup.label.toLowerCase()}.`);
      if (!primary)
        throw new Error(
          model.dropoff ? `Set the ${model.dropoff.label.toLowerCase()}.` : "Set the service location.",
        );
      if (title.trim().length < 3) throw new Error("Give it a short title (3+ chars).");
      return createHelpRequest({
        data: {
          title: title.trim(),
          description: description.trim(),
          category: manualCategory || undefined,
          urgency: manualUrgency || undefined,
          lat: primary.lat,
          lng: primary.lng,
          address_text: addressText || primary.address || undefined,
          request_type: requestType,
          pickup_name: pickup?.name ?? null,
          pickup_address: pickup?.address ?? null,
          pickup_lat: pickup?.lat ?? null,
          pickup_lng: pickup?.lng ?? null,
          dropoff_name: dropoff?.name ?? null,
          dropoff_address: dropoff?.address ?? null,
          dropoff_lat: model.dropoff ? (dropoff?.lat ?? null) : null,
          dropoff_lng: model.dropoff ? (dropoff?.lng ?? null) : null,
        },
      });
    },
    onSuccess: (row) => {
      toast.success("Posted — neighbors within 5 km are being notified.");
      qc.invalidateQueries({ queryKey: ["my-requests"] });
      qc.invalidateQueries({ queryKey: ["open-community-requests"] });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      navigate({ to: "/help/requests/$id", params: { id: (row as any).id } });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink">Ask your street</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Pick what kind of help you need — the form adapts to the locations that request actually involves.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <span className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
            Request type
          </span>
          <div className="grid gap-2 sm:grid-cols-2">
            {REQUEST_TYPES.map((t) => {
              const m = REQUEST_TYPE_META[t];
              const active = requestType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRequestType(t)}
                  className={
                    "rounded-xl border p-3 text-left transition " +
                    (active
                      ? "border-ink bg-ink text-background"
                      : "border-border bg-background hover:bg-sand")
                  }
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span aria-hidden>{m.emoji}</span>
                    {m.label}
                  </span>
                  <span className={"mt-0.5 block text-xs " + (active ? "text-background/70" : "text-ink-soft")}>
                    {m.blurb}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">Title</span>
            <input
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-lg font-medium outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="e.g. Need 2L milk before dinner"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">Details (optional)</span>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Where, when, anything to know."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">Category</span>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setManualCategory(manualCategory === c ? "" : c)}
                    className={
                      "rounded-full border px-3 py-1 text-xs font-medium capitalize transition " +
                      (category === c ? "border-ink bg-ink text-background" : "border-border bg-card text-ink-soft hover:bg-sand")
                    }
                  >
                    {c.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
              <SuggestCategory module="help" />
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">Urgency</span>
              <div className="flex flex-wrap gap-1.5">
                {URGENCIES.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setManualUrgency(manualUrgency === u ? "" : u)}
                    className={
                      "rounded-full border px-3 py-1 text-xs font-semibold uppercase transition " +
                      (urgency === u ? "border-ink bg-ink text-background" : "border-border bg-card text-ink-soft hover:bg-sand")
                    }
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {model.pickup && (
            <LocationField
              label={model.pickup.label}
              hint={model.pickup.hint}
              business={model.pickup.business}
              value={pickup}
              onChange={setPickup}
              bias={bias ? { lat: bias.lat, lng: bias.lng } : null}
              onUseMyLocation={model.pickup.business ? undefined : () => useMyLocation(setPickup)}
              describe={loc.describe}
              busy={loc.isSaving}
              accent="clay"
            />
          )}

          {model.pickup && model.dropoff && (
            <div className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
              <ArrowDown className="h-4 w-4" />
              then
            </div>
          )}

          {model.dropoff && (
            <LocationField
              label={model.dropoff.label}
              hint={model.dropoff.hint}
              value={dropoff}
              onChange={setDropoff}
              bias={dropoff ? { lat: dropoff.lat, lng: dropoff.lng } : loc.coords}
              onUseMyLocation={() => useMyLocation(setDropoff)}
              describe={loc.describe}
              busy={loc.isSaving}
            />
          )}

          {model.service && (
            <LocationField
              label={model.service.label}
              hint={model.service.hint}
              value={service}
              onChange={setService}
              bias={service ? { lat: service.lat, lng: service.lng } : loc.coords}
              onUseMyLocation={() => useMyLocation(setService)}
              describe={loc.describe}
              busy={loc.isSaving}
            />
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <input
              className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="Address hint (optional, e.g. 'gate near tower B')"
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
            />
            {loc.error && <p className="mt-2 text-xs text-urgency-emergency">{loc.error}</p>}
          </div>
        </div>

        {urgency === "emergency" && (
          <div className="flex items-start gap-3 rounded-2xl border border-urgency-emergency/30 bg-urgency-emergency-soft/50 px-4 py-3 text-sm text-urgency-emergency">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <div className="font-semibold">Emergency requests are free.</div>
              <div className="text-urgency-emergency/80">
                No fare charged. Neighbors get an urgent alert. If it's life-threatening, also call 108 / 112.
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => create.mutate()}
          disabled={
            create.isPending ||
            !primary ||
            (!!model.pickup && !pickup) ||
            title.trim().length < 3
          }
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-base font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {create.isPending ? "Posting…" : `Post request${fare ? ` — ₹${fare}` : " — Free"}`}
        </button>
      </div>

      <aside className="md:sticky md:top-24 md:self-start">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">
            <Sparkles className="h-3.5 w-3.5 text-clay" />
            AI preview
          </div>
          <div className="flex flex-wrap gap-2">
            <UrgencyBadge urgency={urgency} pulse />
            <CategoryChip category={category} />
          </div>
          <div className="mt-4">
            <div className="text-xs text-ink-soft">Estimated fare</div>
            <div className="mt-1 font-display text-4xl font-bold text-ink">
              {isPaid ? `₹${fare}` : "Free"}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {isPaid
                ? "Platform fee is deducted from the helper's payout after completion."
                : "Emergency requests never charge the requester."}
            </p>
          </div>
          <p className="mt-4 rounded-xl bg-sand px-3 py-2 text-xs text-ink-soft">
            Quick client-side suggestions. Final classification runs server-side on submit.
          </p>
        </div>
      </aside>
    </div>
  );
}