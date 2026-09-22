import {
  type Coords,
  calculateHaversineDistance,
  estimateTravelTimes,
  type TravelTimeEstimate,
  formatDistance,
} from "./location";

export {
  calculateHaversineDistance,
  estimateTravelTimes,
  formatDistance,
  type Coords,
  type TravelTimeEstimate,
};

export type HelperCandidate = {
  id: string;
  name: string | null;
  bio: string | null;
  profile_photo_url: string | null;
  phone_verified: boolean;
  latitude: number;
  longitude: number;
  avg_score?: number | null;
  rating_count?: number | null;
  helps_completed?: number | null;
  badges?: string[];
  active_tasks_count?: number;
  is_online?: boolean;
};

export type SmartMatchResult = {
  helper: HelperCandidate;
  matchScore: number; // 0 - 100
  distanceMeters: number;
  travelTimes: TravelTimeEstimate;
  matchReason: string;
  highlights: string[];
  isTopPick: boolean;
};

export type SmartMatchOptions = {
  urgency?: "normal" | "today" | "emergency";
  category?: string;
  maxRadiusM?: number;
};

/**
 * Calculates a composite match score between a candidate helper and a target location / request.
 */
export function calculateSmartMatchScore(
  helper: HelperCandidate,
  targetCoords: Coords,
  options: SmartMatchOptions = {},
): SmartMatchResult {
  const urgency = options.urgency ?? "normal";
  const maxRadiusM = options.maxRadiusM ?? 5000;

  // 1. Distance & Travel Times
  const distanceMeters = calculateHaversineDistance(targetCoords, {
    lat: helper.latitude,
    lng: helper.longitude,
  });
  const travelTimes = estimateTravelTimes(distanceMeters);

  // Distance score (0 - 100): 100% within 400m, decays across radius
  const distRatio = Math.min(1, distanceMeters / maxRadiusM);
  let distanceScore = Math.max(0, 100 - distRatio * 75);
  if (distanceMeters <= 800) distanceScore += 15; // Hyperlocal walking bonus
  distanceScore = Math.min(100, distanceScore);

  // Travel time score based on urgency requirements
  let travelScore = 100;
  if (urgency === "emergency") {
    // Must arrive in <10 mins
    if (travelTimes.bikeMins <= 5) travelScore = 100;
    else if (travelTimes.bikeMins <= 10) travelScore = 80;
    else if (travelTimes.bikeMins <= 15) travelScore = 50;
    else travelScore = 20;
  } else if (urgency === "today") {
    if (travelTimes.bikeMins <= 15) travelScore = 95;
    else if (travelTimes.bikeMins <= 25) travelScore = 80;
    else travelScore = 60;
  } else {
    travelScore = Math.max(40, 100 - travelTimes.bikeMins * 1.5);
  }

  // 2. Reliability & Trust Score (0 - 100)
  const avgScore = helper.avg_score ?? 5.0;
  const ratingScore = (avgScore / 5.0) * 50; // max 50 pts
  const tasksBonus = Math.min(25, (helper.helps_completed ?? 4) * 2.5); // max 25 pts
  const verifiedBonus = (helper.phone_verified ? 15 : 5) + ((helper.badges?.length ?? 1) >= 2 ? 10 : 0); // max 25 pts
  const reliabilityScore = Math.min(100, ratingScore + tasksBonus + verifiedBonus);

  // 3. Availability Score (0 - 100)
  let availabilityScore = helper.is_online !== false ? 100 : 70;
  const activeCount = helper.active_tasks_count ?? 0;
  availabilityScore -= activeCount * 20;
  availabilityScore = Math.max(20, Math.min(100, availabilityScore));

  // 4. Weighted Composite Matching
  let matchScore = 0;
  if (urgency === "emergency") {
    // Emergency prioritizes proximity & rapid ETA
    matchScore = distanceScore * 0.4 + travelScore * 0.35 + reliabilityScore * 0.15 + availabilityScore * 0.1;
  } else if (urgency === "today") {
    // Balanced priority
    matchScore = distanceScore * 0.3 + travelScore * 0.25 + reliabilityScore * 0.3 + availabilityScore * 0.15;
  } else {
    // Normal favors high reliability and track-record
    matchScore = distanceScore * 0.25 + travelScore * 0.15 + reliabilityScore * 0.45 + availabilityScore * 0.15;
  }

  matchScore = Math.round(Math.min(99, Math.max(45, matchScore)));

  // Generate highlight chips
  const highlights: string[] = [];
  if (distanceMeters <= 1000) {
    highlights.push(`🚶 ${travelTimes.walkingMins}m walking`);
  } else {
    highlights.push(`🛵 ~${travelTimes.bikeMins}m ETA`);
  }
  if (avgScore >= 4.8) {
    highlights.push(`★ ${avgScore.toFixed(1)} Top Rated`);
  }
  if (helper.phone_verified || helper.badges?.includes("government_id")) {
    highlights.push("Verified Neighbor");
  }
  if ((helper.helps_completed ?? 0) >= 10) {
    highlights.push(`${helper.helps_completed}+ Helps Done`);
  }

  // Primary matching reason
  let matchReason = `~${travelTimes.bikeMins} mins away · ${formatDistance(distanceMeters)}`;
  if (distanceMeters <= 800) {
    matchReason = `Closest Neighbor (${formatDistance(distanceMeters)}) · Immediate Arrival`;
  } else if (avgScore >= 4.9 && (helper.helps_completed ?? 0) >= 5) {
    matchReason = `Top Rated Neighbor (${avgScore.toFixed(1)}★) · Reliable & Verified`;
  } else if (urgency === "emergency" && travelTimes.bikeMins <= 8) {
    matchReason = `Fastest Responder · ${travelTimes.bikeMins} mins ETA`;
  }

  return {
    helper,
    matchScore,
    distanceMeters,
    travelTimes,
    matchReason,
    highlights,
    isTopPick: false,
  };
}

/**
 * Sorts and ranks all candidate helpers by smart suitability.
 */
export function rankSuitableHelpers(
  helpers: HelperCandidate[],
  targetCoords: Coords,
  options: SmartMatchOptions = {},
): SmartMatchResult[] {
  const scored = helpers.map((h) => calculateSmartMatchScore(h, targetCoords, options));
  scored.sort((a, b) => b.matchScore - a.matchScore);
  if (scored.length > 0) {
    scored[0].isTopPick = true;
  }
  return scored;
}
