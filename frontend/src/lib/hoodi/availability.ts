/** Structured weekly availability shared by Hoodi Skills teachers and learners. */
export type Slot = { day: number; start: string; end: string };

export const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Hourly slots teachers can offer, 07:00 → 22:00. */
export const HOUR_SLOTS: { start: string; end: string }[] = Array.from({ length: 15 }, (_, i) => {
  const h = i + 7;
  return { start: `${String(h).padStart(2, "0")}:00`, end: `${String(h + 1).padStart(2, "0")}:00` };
});

export function parseSlots(value: unknown): Slot[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (s): s is Slot =>
        !!s &&
        typeof s === "object" &&
        typeof (s as Slot).day === "number" &&
        typeof (s as Slot).start === "string" &&
        typeof (s as Slot).end === "string",
    )
    .map((s) => ({ day: s.day, start: s.start, end: s.end }))
    .filter((s) => s.day >= 0 && s.day <= 6)
    .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
}

export function slotKey(day: number, start: string) {
  return `${day}|${start}`;
}

/** Slots offered on a given calendar date (local time), excluding times already past. */
export function slotsForDate(slots: Slot[], dateISO: string): Slot[] {
  if (!dateISO) return [];
  const date = new Date(`${dateISO}T00:00:00`);
  if (Number.isNaN(date.getTime())) return [];
  const now = new Date();
  return slots
    .filter((s) => s.day === date.getDay())
    .filter((s) => {
      const when = new Date(`${dateISO}T${s.start}:00`);
      return when.getTime() > now.getTime();
    });
}

/** Groups slots by weekday for compact display. */
export function groupByDay(slots: Slot[]): { day: number; slots: Slot[] }[] {
  const map = new Map<number, Slot[]>();
  for (const s of slots) map.set(s.day, [...(map.get(s.day) ?? []), s]);
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, list]) => ({ day, slots: list.sort((a, b) => a.start.localeCompare(b.start)) }));
}

export function formatSlot(s: Slot) {
  return `${s.start}–${s.end}`;
}

/** Next 21 bookable dates, as YYYY-MM-DD in local time. */
export function upcomingDates(count = 21): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    out.push(
      `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`,
    );
  }
  return out;
}
