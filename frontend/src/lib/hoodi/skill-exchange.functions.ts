import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateHaversineDistance, formatDistance } from "./location";

export type ExchangePreferences = {
  user_id: string;
  offers_skills: string[];
  wants_skills: string[];
  bio_note: string | null;
  preferred_mode: "online" | "offline" | "both";
  is_active: boolean;
};

export type SkillExchangeMatch = {
  candidate_id: string;
  candidate_name: string | null;
  candidate_photo: string | null;
  candidate_headline: string | null;
  candidate_location: string | null;
  distance_meters: number | null;
  formatted_distance: string | null;
  they_offer: string[];
  they_want: string[];
  matching_offer: string; // What candidate teaches that user wants
  matching_want: string; // What user teaches that candidate wants
  match_score: number; // 0 - 100
  is_two_way_swap: boolean;
  match_reason: string;
  preferred_mode: "online" | "offline" | "both";
};

export type SkillExchangeRow = {
  id: string;
  status: "proposed" | "accepted" | "scheduled" | "in_progress" | "completed" | "cancelled" | "declined";
  proposer_id: string;
  recipient_id: string;
  proposer_teaches: string;
  proposer_learns: string;
  recipient_teaches: string;
  recipient_learns: string;
  teaching_mode: "online" | "offline" | "both";
  session_schedule: { date: string; time: string; durationMinutes?: number }[];
  meeting_link: string | null;
  location_address: string | null;
  chat_thread_id: string | null;
  proposer_completed: boolean;
  recipient_completed: boolean;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  counterparty: {
    id: string;
    name: string | null;
    profile_photo_url: string | null;
    role: "proposer" | "recipient";
  };
};

/* -------------------------- 1. User Exchange Preferences -------------------------- */

export const getMyExchangePreferences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExchangePreferences | null> => {
    const { data, error } = await context.supabase
      .from("skill_exchange_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      user_id: data.user_id,
      offers_skills: data.offers_skills ?? [],
      wants_skills: data.wants_skills ?? [],
      bio_note: data.bio_note,
      preferred_mode: data.preferred_mode ?? "both",
      is_active: Boolean(data.is_active),
    };
  });

const PreferencesInput = z.object({
  offers_skills: z.array(z.string().min(1).max(80)).min(1).max(20),
  wants_skills: z.array(z.string().min(1).max(80)).min(1).max(20),
  bio_note: z.string().max(500).nullable().optional(),
  preferred_mode: z.enum(["online", "offline", "both"]).optional(),
  is_active: z.boolean().optional(),
});

export const upsertExchangePreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PreferencesInput.parse(input))
  .handler(async ({ data, context }): Promise<ExchangePreferences> => {
    const { data: row, error } = await context.supabase
      .from("skill_exchange_preferences")
      .upsert(
        {
          user_id: context.userId,
          offers_skills: data.offers_skills,
          wants_skills: data.wants_skills,
          bio_note: data.bio_note ?? null,
          preferred_mode: data.preferred_mode ?? "both",
          is_active: data.is_active ?? true,
        },
        { onConflict: "user_id" },
      )
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return {
      user_id: row.user_id,
      offers_skills: row.offers_skills,
      wants_skills: row.wants_skills,
      bio_note: row.bio_note,
      preferred_mode: row.preferred_mode,
      is_active: row.is_active,
    };
  });

/* -------------------------- 2. Matching Engine (2-Way Swaps) -------------------------- */

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function skillsOverlap(listA: string[], listB: string[]): string | null {
  for (const a of listA) {
    const normA = normalize(a);
    for (const b of listB) {
      const normB = normalize(b);
      if (normA === normB || normA.includes(normB) || normB.includes(normA)) {
        return a;
      }
    }
  }
  return null;
}

export const discoverExchangeMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SkillExchangeMatch[]> => {
    // 1. Get my exchange preferences
    const { data: myPref } = await context.supabase
      .from("skill_exchange_preferences")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!myPref || !myPref.is_active) {
      return [];
    }

    const myOffers: string[] = myPref.offers_skills ?? [];
    const myWants: string[] = myPref.wants_skills ?? [];

    if (myOffers.length === 0 && myWants.length === 0) {
      return [];
    }

    // 2. Fetch other active candidates
    const { data: candidatePrefs, error } = await context.supabase
      .from("skill_exchange_preferences")
      .select(`
        user_id,
        offers_skills,
        wants_skills,
        bio_note,
        preferred_mode,
        profiles!inner(
          id,
          name,
          profile_photo_url,
          bio,
          city,
          latitude,
          longitude,
          is_active
        )
      `)
      .neq("user_id", context.userId)
      .eq("is_active", true);

    if (error) throw new Error(error.message);

    // Get current user location for distance calculation
    const { data: myProfile } = await context.supabase
      .from("profiles")
      .select("latitude, longitude")
      .eq("id", context.userId)
      .maybeSingle();

    const matches: SkillExchangeMatch[] = [];

    for (const row of candidatePrefs ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (row as any).profiles;
      if (!p || !p.is_active) continue;

      const candOffers: string[] = row.offers_skills ?? [];
      const candWants: string[] = row.wants_skills ?? [];

      // Check overlap:
      // What they offer that I want?
      const matchingOffer = skillsOverlap(candOffers, myWants);
      // What I offer that they want?
      const matchingWant = skillsOverlap(myOffers, candWants);

      if (!matchingOffer && !matchingWant) {
        continue;
      }

      const isTwoWay = Boolean(matchingOffer && matchingWant);
      let score = 50;
      let reason = "Partial Match";

      if (isTwoWay) {
        score = 95;
        reason = `Direct 2-Way Swap: You teach ${matchingWant} ⇄ They teach ${matchingOffer}`;
      } else if (matchingOffer) {
        score = 70;
        reason = `They teach ${matchingOffer}, which is on your wishlist`;
      } else if (matchingWant) {
        score = 65;
        reason = `They want to learn ${matchingWant}, which you offer`;
      }

      // Proximity boost
      let distM: number | null = null;
      let formattedDist: string | null = null;
      if (
        myProfile?.latitude != null &&
        myProfile?.longitude != null &&
        p.latitude != null &&
        p.longitude != null
      ) {
        distM = calculateHaversineDistance(
          { lat: myProfile.latitude, lng: myProfile.longitude },
          { lat: p.latitude, lng: p.longitude },
        );
        formattedDist = formatDistance(distM);
        if (distM < 3000) {
          score = Math.min(100, score + 4);
          reason += ` · Nearby in your neighborhood (${formattedDist})`;
        }
      }

      // Mode bonus
      if (
        myPref.preferred_mode === "both" ||
        row.preferred_mode === "both" ||
        myPref.preferred_mode === row.preferred_mode
      ) {
        score = Math.min(100, score + 1);
      }

      matches.push({
        candidate_id: row.user_id,
        candidate_name: p.name ?? "Neighbor",
        candidate_photo: p.profile_photo_url,
        candidate_headline: row.bio_note || p.bio || null,
        candidate_location: p.city || "Bengaluru",
        distance_meters: distM,
        formatted_distance: formattedDist,
        they_offer: candOffers,
        they_want: candWants,
        matching_offer: matchingOffer || candOffers[0] || "Knowledge Sharing",
        matching_want: matchingWant || candWants[0] || "Community Mentorship",
        match_score: score,
        is_two_way_swap: isTwoWay,
        match_reason: reason,
        preferred_mode: row.preferred_mode as "online" | "offline" | "both",
      });
    }

    // Sort by 2-way swaps first, then match score descending
    return matches.sort((a, b) => {
      if (a.is_two_way_swap !== b.is_two_way_swap) {
        return a.is_two_way_swap ? -1 : 1;
      }
      return b.match_score - a.match_score;
    });
  });

/* -------------------------- 3. Propose / Manage Exchanges -------------------------- */

const ProposeInput = z.object({
  recipientId: z.string().uuid(),
  proposerTeaches: z.string().min(1).max(100),
  proposerLearns: z.string().min(1).max(100),
  recipientTeaches: z.string().min(1).max(100),
  recipientLearns: z.string().min(1).max(100),
  teachingMode: z.enum(["online", "offline", "both"]).optional(),
  notes: z.string().max(1000).optional(),
});

export const proposeSkillExchange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ProposeInput.parse(input))
  .handler(async ({ data, context }) => {
    if (data.recipientId === context.userId) {
      throw new Error("You cannot propose a skill swap with yourself.");
    }

    const { data: exchange, error } = await context.supabase
      .from("skill_exchanges")
      .insert({
        proposer_id: context.userId,
        recipient_id: data.recipientId,
        proposer_teaches: data.proposerTeaches,
        proposer_learns: data.proposerLearns,
        recipient_teaches: data.recipientTeaches,
        recipient_learns: data.recipientLearns,
        teaching_mode: data.teachingMode ?? "both",
        status: "proposed",
        notes: data.notes ?? null,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    // Create an attached chat thread for the exchange
    const { data: thread } = await context.supabase
      .from("chat_threads")
      .insert({ exchange_id: exchange.id })
      .select("id")
      .maybeSingle();

    if (thread) {
      await context.supabase
        .from("skill_exchanges")
        .update({ chat_thread_id: thread.id })
        .eq("id", exchange.id);
      exchange.chat_thread_id = thread.id;
    }

    return exchange;
  });

export const respondToExchange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: unknown) =>
      z.object({
        exchangeId: z.string().uuid(),
        action: z.enum(["accept", "decline"]),
      }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const newStatus = data.action === "accept" ? "accepted" : "declined";

    const { data: row, error } = await context.supabase
      .from("skill_exchanges")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", data.exchangeId)
      .eq("recipient_id", context.userId)
      .eq("status", "proposed")
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

const ScheduleInput = z.object({
  exchangeId: z.string().uuid(),
  sessions: z.array(
    z.object({
      date: z.string(),
      time: z.string(),
      durationMinutes: z.number().int().min(15).max(360).optional(),
    }),
  ).min(1),
  meetingLink: z.string().url().max(500).optional(),
  locationAddress: z.string().max(300).optional(),
});

export const scheduleExchangeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ScheduleInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("skill_exchanges")
      .update({
        status: "scheduled",
        session_schedule: data.sessions,
        meeting_link: data.meetingLink ?? null,
        location_address: data.locationAddress ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.exchangeId)
      .or(`proposer_id.eq.${context.userId},recipient_id.eq.${context.userId}`)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const completeExchangeSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ exchangeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: current, error: fetchErr } = await context.supabase
      .from("skill_exchanges")
      .select("*")
      .eq("id", data.exchangeId)
      .maybeSingle();

    if (fetchErr) throw new Error(fetchErr.message);
    if (!current) throw new Error("Skill exchange not found.");

    const isProposer = current.proposer_id === context.userId;
    const isRecipient = current.recipient_id === context.userId;
    if (!isProposer && !isRecipient) throw new Error("Unauthorized.");

    const updateFields: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (isProposer) {
      updateFields.proposer_completed = true;
    }
    if (isRecipient) {
      updateFields.recipient_completed = true;
    }

    const bothWillBeDone =
      (isProposer && current.recipient_completed) ||
      (isRecipient && current.proposer_completed);

    if (bothWillBeDone) {
      updateFields.status = "completed";
      updateFields.completed_at = new Date().toISOString();
    } else {
      updateFields.status = "in_progress";
    }

    const { data: updated, error } = await context.supabase
      .from("skill_exchanges")
      .update(updateFields)
      .eq("id", data.exchangeId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return updated;
  });

export const listMyExchanges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SkillExchangeRow[]> => {
    const { data, error } = await context.supabase
      .from("skill_exchanges")
      .select(`
        *,
        proposer:profiles!skill_exchanges_proposer_id_fkey(id, name, profile_photo_url),
        recipient:profiles!skill_exchanges_recipient_id_fkey(id, name, profile_photo_url)
      `)
      .or(`proposer_id.eq.${context.userId},recipient_id.eq.${context.userId}`)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => {
      const isProposer = row.proposer_id === context.userId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const other = isProposer ? (row as any).recipient : (row as any).proposer;
      return {
        id: row.id,
        status: row.status,
        proposer_id: row.proposer_id,
        recipient_id: row.recipient_id,
        proposer_teaches: row.proposer_teaches,
        proposer_learns: row.proposer_learns,
        recipient_teaches: row.recipient_teaches,
        recipient_learns: row.recipient_learns,
        teaching_mode: row.teaching_mode,
        session_schedule: Array.isArray(row.session_schedule) ? row.session_schedule : [],
        meeting_link: row.meeting_link,
        location_address: row.location_address,
        chat_thread_id: row.chat_thread_id,
        proposer_completed: Boolean(row.proposer_completed),
        recipient_completed: Boolean(row.recipient_completed),
        completed_at: row.completed_at,
        notes: row.notes,
        created_at: row.created_at,
        counterparty: {
          id: other?.id ?? (isProposer ? row.recipient_id : row.proposer_id),
          name: other?.name ?? "Neighbor",
          profile_photo_url: other?.profile_photo_url ?? null,
          role: isProposer ? "recipient" : "proposer",
        },
      };
    });
  });
