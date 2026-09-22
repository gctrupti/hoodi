import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  type?: "request" | "helper" | "pin";
  tone?: "primary" | "emergency" | "today" | "normal";
  name?: string;
  fare?: number;
  rating?: number;
  photoUrl?: string;
  category?: string;
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
  normal: "#16a34a",
};

function userLocationRadarIcon() {
  return L.divIcon({
    className: "user-gps-marker",
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;width:24px;height:24px;">
        <span style="position:absolute;width:24px;height:24px;border-radius:9999px;background:rgba(37,99,235,0.35);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
        <span style="width:14px;height:14px;border-radius:9999px;background:#2563eb;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function requestMarkerIcon(tone: NonNullable<MapMarker["tone"]>, fare?: number) {
  const color = TONE_COLORS[tone] ?? "#c2410c";
  const isEmergency = tone === "emergency";
  return L.divIcon({
    className: "request-map-marker",
    html: `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;">
        ${
          isEmergency
            ? '<span style="position:absolute;width:32px;height:32px;border-radius:9999px;background:rgba(220,38,38,0.35);animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite;"></span>'
            : ""
        }
        <div style="background:${color};color:#fff;padding:${fare ? "2px 6px" : "4px"};border-radius:9999px;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.35);display:flex;align-items:center;gap:3px;font-size:10px;font-weight:bold;white-space:nowrap;">
          <span style="width:6px;height:6px;border-radius:9999px;background:#fff;display:inline-block;"></span>
          ${fare ? `₹${fare}` : ""}
        </div>
      </div>
    `,
    iconSize: [fare ? 48 : 20, 24],
    iconAnchor: [fare ? 24 : 10, 12],
  });
}

function helperMarkerIcon(name: string, rating?: number) {
  const initial = name ? name[0].toUpperCase() : "H";
  return L.divIcon({
    className: "helper-map-marker",
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;">
        <div style="width:28px;height:28px;border-radius:9999px;background:#0284c7;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.35);">
          ${initial}
        </div>
        <div style="background:#0f172a;color:#fbbf24;font-size:9px;font-weight:bold;padding:1px 4px;border-radius:6px;border:1px solid rgba(255,255,255,0.3);margin-top:-6px;display:flex;align-items:center;gap:1px;box-shadow:0 1px 3px rgba(0,0,0,0.2);">
          ★ ${rating ? rating.toFixed(1) : "5.0"}
        </div>
      </div>
    `,
    iconSize: [32, 38],
    iconAnchor: [16, 20],
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
  height = 340,
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
    const map = L.map(nodeRef.current, { attributionControl: false, scrollWheelZoom: false }).setView(
      [center.lat, center.lng],
      zoom,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    const marker = L.marker([center.lat, center.lng], {
      draggable: draggableCenter,
      icon: userLocationRadarIcon(),
    }).addTo(map);

    marker.bindPopup(`
      <div style="font-family:sans-serif;font-size:12px;padding:2px 4px;">
        <strong style="color:#0f172a;">Your Location</strong>
        <div style="color:#64748b;font-size:11px;margin-top:2px;">Search center point</div>
      </div>
    `);

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

    const sizeTimer = setTimeout(() => {
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
        weight: 1.5,
        fillColor: "#ea580c",
        fillOpacity: 0.07,
        dashArray: "4, 6",
      }).addTo(map);
      map.fitBounds(circleRef.current.getBounds(), { padding: [24, 24] });
    }
  }, [radiusM, center.lat, center.lng]);

  useEffect(() => {
    const group = layerRef.current;
    if (!group) return;
    group.clearLayers();

    for (const m of markers) {
      let icon = requestMarkerIcon(m.tone ?? "primary", m.fare);
      if (m.type === "helper") {
        icon = helperMarkerIcon(m.name ?? "Helper", m.rating);
      }

      const marker = L.marker([m.lat, m.lng], { icon });
      if (m.label) {
        marker.bindPopup(m.label, { className: "hoodi-map-popup" });
      }
      marker.addTo(group);
    }
  }, [markers]);

  return (
    <div
      ref={nodeRef}
      className={"overflow-hidden rounded-3xl border border-border shadow-xs " + (className ?? "")}
      style={{ height }}
      role="application"
      aria-label="Hyperlocal Neighborhood Map"
    />
  );
}