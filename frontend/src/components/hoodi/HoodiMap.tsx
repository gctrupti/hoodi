import { Suspense, lazy } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { LeafletMapProps } from "./LeafletMap";

const LeafletMap = lazy(() => import("./LeafletMap"));

function MapSkeleton({ height }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-2xl border border-border bg-sand"
      style={{ height: height ?? 280 }}
    />
  );
}

/** SSR-safe map wrapper — Leaflet only ever loads in the browser. */
export function HoodiMap(props: LeafletMapProps) {
  return (
    <ClientOnly fallback={<MapSkeleton height={props.height} />}>
      <Suspense fallback={<MapSkeleton height={props.height} />}>
        <LeafletMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}