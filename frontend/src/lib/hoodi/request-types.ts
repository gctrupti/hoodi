/**
 * Hoodi Help request types and their location models.
 * A request always has ONE primary location (used for the neighborhood feed),
 * and optionally a pickup origin and/or a destination.
 */

export const REQUEST_TYPES = [
  "pickup_delivery",
  "home_assistance",
  "transportation",
  "elder_care",
  "custom",
] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];

export type LocationModel = {
  /** Business (POI) search for the origin, e.g. the shop to buy from. */
  pickup?: { label: string; hint: string; business: boolean };
  /** Where the task ends — delivery address or ride destination. */
  dropoff?: { label: string; hint: string };
  /** Single-point tasks (cleaning, elder care) use the primary location only. */
  service?: { label: string; hint: string };
};

export const REQUEST_TYPE_META: Record<
  RequestType,
  {
    label: string;
    blurb: string;
    emoji: string;
    defaultCategory: "grocery" | "elderly_care" | "transportation" | "errand" | "first_aid" | "other";
    locations: LocationModel;
  }
> = {
  pickup_delivery: {
    label: "Pickup & Delivery",
    blurb: "Buy or collect something from a shop and bring it over.",
    emoji: "🛍️",
    defaultCategory: "grocery",
    locations: {
      pickup: {
        label: "Pickup location (shop)",
        hint: "Search a real business — florist, pharmacy, supermarket…",
        business: true,
      },
      dropoff: { label: "Delivery location", hint: "Where should it be dropped off?" },
    },
  },
  home_assistance: {
    label: "Home Assistance",
    blurb: "Help at your place — cleaning, repairs, moving things.",
    emoji: "🏠",
    defaultCategory: "errand",
    locations: { service: { label: "Service location", hint: "Where the help is needed." } },
  },
  transportation: {
    label: "Transportation",
    blurb: "A ride or a drop from one place to another.",
    emoji: "🚗",
    defaultCategory: "transportation",
    locations: {
      pickup: { label: "Pickup location", hint: "Where the trip starts.", business: false },
      dropoff: { label: "Destination", hint: "Where the trip ends." },
    },
  },
  elder_care: {
    label: "Elder Care",
    blurb: "Company, check-ins or assistance for a senior.",
    emoji: "🧓",
    defaultCategory: "elderly_care",
    locations: { service: { label: "Service location", hint: "Where care is needed." } },
  },
  custom: {
    label: "Custom Request",
    blurb: "Anything else your street can help with.",
    emoji: "✨",
    defaultCategory: "other",
    locations: { service: { label: "Location", hint: "Where the help is needed." } },
  },
};

export function isMultiStop(type: RequestType): boolean {
  const m = REQUEST_TYPE_META[type].locations;
  return Boolean(m.pickup && m.dropoff);
}
