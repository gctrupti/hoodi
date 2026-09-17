import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyLocation,
  saveMyLocation,
  reverseGeocodeLocation,
  type SavedLocation,
} from "@/lib/hoodi/location.functions";
import {
  getDeviceCoords,
  readCachedLocation,
  writeCachedLocation,
  type CachedLocation,
  type Coords,
} from "@/lib/hoodi/location";

/**
 * The one location hook for the whole Hoodi platform.
 * Any module (Help, Skills, Rescue, Medic, Jobs) consumes this.
 */
export function useHoodiLocation() {
  const qc = useQueryClient();
  const [cached, setCached] = useState<CachedLocation | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCached(readCachedLocation());
  }, []);

  const stored = useQuery({
    queryKey: ["my-location"],
    queryFn: () => getMyLocation(),
    staleTime: 60_000,
  });

  useEffect(() => {
    const d = stored.data;
    if (d?.latitude != null && d.longitude != null) {
      writeCachedLocation({
        latitude: d.latitude,
        longitude: d.longitude,
        formatted_address: d.formatted_address,
        city: d.city,
        state: d.state,
        country: d.country,
      });
      setCached(readCachedLocation());
    }
  }, [stored.data]);

  const save = useMutation({
    mutationFn: (input: {
      latitude: number;
      longitude: number;
      formatted_address?: string | null;
      city?: string | null;
      state?: string | null;
      country?: string | null;
    }) => saveMyLocation({ data: input }),
    onSuccess: (row: SavedLocation) => {
      setError(null);
      qc.setQueryData(["my-location"], row);
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["nearby"] });
      qc.invalidateQueries({ queryKey: ["browse-teachers"] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : String(e)),
  });

  /** Ask the device, reverse geocode and persist in one step. */
  const useDeviceLocation = useCallback(async (): Promise<SavedLocation | null> => {
    setError(null);
    try {
      const c: Coords = await getDeviceCoords();
      return await save.mutateAsync({ latitude: c.lat, longitude: c.lng });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [save]);

  /** Resolve an arbitrary pin (drag/click) to an address without saving. */
  const describe = useCallback(
    (c: Coords) => reverseGeocodeLocation({ data: { lat: c.lat, lng: c.lng } }),
    [],
  );

  const location = useMemo(() => {
    const d = stored.data;
    if (d?.latitude != null && d.longitude != null) return d;
    if (cached)
      return {
        latitude: cached.latitude,
        longitude: cached.longitude,
        formatted_address: cached.formatted_address,
        city: cached.city,
        state: cached.state,
        country: cached.country,
      } satisfies SavedLocation;
    return null;
  }, [stored.data, cached]);

  const coords: Coords | null =
    location?.latitude != null && location?.longitude != null
      ? { lat: location.latitude, lng: location.longitude }
      : null;

  return {
    location,
    coords,
    /** true when we have neither a stored nor cached location yet */
    isMissing: !stored.isLoading && !coords,
    isLoading: stored.isLoading,
    isSaving: save.isPending,
    error,
    setError,
    saveLocation: save.mutateAsync,
    useDeviceLocation,
    describe,
    refetch: stored.refetch,
  };
}