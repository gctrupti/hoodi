import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  tone?: "primary" | "emergency" | "today" | "normal";
};

export type LeafletMapProps = {
  center: { lat: number; lng: number };
  zoom?: number;
  /** Radius circle around the center, in metres. */
  radiusM?: number | null;
  markers?: MapMarker[];
  draggableCenter?: boolean;
  onCenterDragEnd?: (coords: { lat: number; lng: number }) => void;
  className?: string;
  height?: number;
};

const TONE_COLORS: Record<NonNullable<MapMarker["tone"]>, string> = {
  primary: "#c2410c",
  emergency: "#dc2626",
  today: "#d97706",
  normal: "#15803d",
};

function dotIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${color};box-shadow:0 0 0 3px rgba(255,255,255,.9),0 1px 4px rgba(0,0,0,.35)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function pinIcon() {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:20px;height:20px;border-radius:9999px;background:#0f172a;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></span>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

export default function LeafletMap({
  center,
  zoom = 14,
  radiusM = null,
  markers = [],
  draggableCenter = false,
  onCenterDragEnd,
  className,
  height = 280,
}: LeafletMapProps) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const dragCbRef = useRef(onCenterDragEnd);
  dragCbRef.current = onCenterDragEnd;

  useEffect(() => {
    if (!nodeRef.current || mapRef.current) return;
    const map = L.map(nodeRef.current, { attributionControl: true, scrollWheelZoom: false }).setView(
      [center.lat, center.lng],
      zoom,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const marker = L.marker([center.lat, center.lng], {
      draggable: draggableCenter,
      icon: pinIcon(),
    }).addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLatLng();
      dragCbRef.current?.({ lat: p.lat, lng: p.lng });
    });
    if (draggableCenter) {
      map.on("click", (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng);
        dragCbRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
    }

    centerMarkerRef.current = marker;
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // The container is often sized after mount (grid/aside layouts).
    const sizeTimer = setTimeout(() => {
      // Guard: the component may unmount before this fires.
      if (mapRef.current !== map || !map.getContainer()?.isConnected) return;
      map.invalidateSize();
    }, 60);

    return () => {
      clearTimeout(sizeTimer);
      map.remove();
      mapRef.current = null;
      centerMarkerRef.current = null;
      circleRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([center.lat, center.lng], map.getZoom());
    centerMarkerRef.current?.setLatLng([center.lat, center.lng]);
  }, [center.lat, center.lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    circleRef.current?.remove();
    circleRef.current = null;
    if (radiusM) {
      circleRef.current = L.circle([center.lat, center.lng], {
        radius: radiusM,
        color: "#c2410c",
        weight: 1,
        fillColor: "#f97316",
        fillOpacity: 0.08,
      }).addTo(map);
      map.fitBounds(circleRef.current.getBounds(), { padding: [16, 16] });
    }
  }, [radiusM, center.lat, center.lng]);

  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;
    group.clearLayers();
    for (const m of markers) {
      const marker = L.marker([m.lat, m.lng], { icon: dotIcon(TONE_COLORS[m.tone ?? "primary"]) });
      if (m.label) marker.bindPopup(m.label);
      marker.addTo(group);
    }
  }, [markers]);

  return (
    <div
      ref={nodeRef}
      className={"overflow-hidden rounded-2xl border border-border " + (className ?? "")}
      style={{ height }}
      role="application"
      aria-label="Map"
    />
  );
}