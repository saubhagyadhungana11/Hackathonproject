import { useEffect, useRef } from 'react';
import L from 'leaflet';

export type MarkerColor =
  | 'blue'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'purple'
  | 'cyan'
  | 'gray';

export interface MapMarker {
  id: string;
  position: [number, number];
  color: MarkerColor;
  popup?: string;
  pulsing?: boolean;
  icon?: 'pin' | 'dot' | 'square';
}

export interface MapRoute {
  id: string;
  positions: [number, number][];
  color?: string;
  weight?: number;
  dashed?: boolean;
}

interface LeafletMapProps {
  center: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  routes?: MapRoute[];
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
  fitBounds?: boolean;
}

const colorHex: Record<MarkerColor, string> = {
  blue: '#3b82f6',
  red: '#ef4444',
  orange: '#f97316',
  yellow: '#eab308',
  green: '#22c55e',
  purple: '#a855f7',
  cyan: '#06b6d4',
  gray: '#6b7280',
};

function createMarkerIcon(color: MarkerColor, shape: 'pin' | 'dot' | 'square', pulsing: boolean) {
  const hex = colorHex[color];
  if (shape === 'dot') {
    const pulseClass = pulsing ? 'sos-marker' : 'user-location-marker';
    return L.divIcon({
      className: '',
      html: `<div class="${pulseClass}" style="${pulsing ? '' : `background:${hex};`}"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
  }
  if (shape === 'square') {
    return L.divIcon({
      className: '',
      html: `<div class="incident-marker" style="background:${hex};"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }
  // pin
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${hex};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;"><div style="transform:rotate(45deg);width:10px;height:10px;background:#fff;border-radius:50%;"></div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

export default function LeafletMap({
  center,
  zoom = 13,
  markers = [],
  routes = [],
  className = '',
  onMapClick,
  fitBounds = false,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);
    markerLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);

    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng));
    }

    setTimeout(() => map.invalidateSize(), 100);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers
  useEffect(() => {
    if (!markerLayerRef.current) return;
    markerLayerRef.current.clearLayers();
    markers.forEach((m) => {
      const icon = createMarkerIcon(m.color, m.icon ?? 'pin', m.pulsing ?? false);
      const marker = L.marker(m.position, { icon });
      if (m.popup) marker.bindPopup(m.popup);
      markerLayerRef.current!.addLayer(marker);
    });
  }, [markers]);

  // Update routes
  useEffect(() => {
    if (!routeLayerRef.current) return;
    routeLayerRef.current.clearLayers();
    routes.forEach((r) => {
      const line = L.polyline(r.positions, {
        color: r.color ?? '#3b82f6',
        weight: r.weight ?? 5,
        opacity: 0.8,
        dashArray: r.dashed ? '10, 10' : undefined,
      });
      routeLayerRef.current!.addLayer(line);
    });
  }, [routes]);

  // Fit bounds to all markers + route points
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fitBounds) return;
    const points: [number, number][] = [
      ...markers.map((m) => m.position),
      ...routes.flatMap((r) => r.positions),
    ];
    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points), { padding: [60, 60] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [fitBounds, markers, routes]);

  // Update center when prop changes (only if not fitting bounds)
  useEffect(() => {
    if (mapRef.current && !fitBounds) {
      mapRef.current.setView(center, zoom);
    }
  }, [center[0], center[1], zoom, fitBounds]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className={`w-full h-full ${className}`} />;
}
