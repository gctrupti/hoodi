export const DELIVERY_STAGES = [
  "accepted",
  "to_pickup",
  "picked_up",
  "on_the_way",
  "delivered",
] as const;

export type DeliveryStage = (typeof DELIVERY_STAGES)[number];

export const STAGE_LABELS: Record<DeliveryStage, string> = {
  accepted: "Accepted",
  to_pickup: "Travelling to pickup",
  picked_up: "Picked up",
  on_the_way: "On the way",
  delivered: "Delivered",
};

/** Stages shown for a given help request type. */
export function stagesForType(requestType: string | null | undefined): DeliveryStage[] {
  if (requestType === "pickup_delivery") return [...DELIVERY_STAGES];
  if (requestType === "transportation") return ["accepted", "to_pickup", "picked_up", "on_the_way", "delivered"];
  return ["accepted", "to_pickup", "delivered"];
}

export function formatEta(minutes: number | null | undefined) {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  return `${h}h ${minutes % 60}m`;
}

export function formatDistance(meters: number | null | undefined) {
  if (meters == null) return "—";
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}
