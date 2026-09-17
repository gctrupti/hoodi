import { useQuery } from "@tanstack/react-query";
import { getTrust, getTrustBatch, type TrustSummary } from "@/lib/hoodi/trust.functions";
import { useSessionReady } from "@/hooks/use-session-ready";

/** Verification + badges for one member. */
export function useTrust(userId?: string | null) {
  const ready = useSessionReady();
  return useQuery({
    queryKey: ["trust", userId ?? "me"],
    queryFn: () => getTrust({ data: userId ? { userId } : {} }),
    enabled: ready && userId !== null,
    staleTime: 60_000,
  });
}

/** Badges for a list of members — one round trip for a whole feed. */
export function useTrustBatch(userIds: (string | null | undefined)[]) {
  const ready = useSessionReady();
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))].sort().slice(0, 60);
  return useQuery({
    queryKey: ["trust-batch", ids],
    queryFn: () => getTrustBatch({ data: { userIds: ids } }),
    enabled: ready && ids.length > 0,
    staleTime: 60_000,
  });
}

export type { TrustSummary };