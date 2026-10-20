'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cx } from '@/lib/format';

// A Leaflet map with OpenStreetMap tiles (no API key). Leaflet loads only in
// the browser and only where a map is shown, so pages without one don't pay
// for it. Pins are drawn with CSS (no image files to bundle).
//
// Tiles: OpenStreetMap's own servers are fine for light use; move to a tile
// provider (e.g. MapTiler, Stadia) before heavy production traffic.
export type MapPin = { id: string; lat: number; lng: number; label?: string; onClick?: () => void };

const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
export const NAIROBI = { lat: -1.2864, lng: 36.8172 };

function pinIcon(L: typeof import('leaflet'), label?: string) {
  const html = label
    ? `<span class="trimmy-pin-label">${label.replace(/[<>&"]/g, '')}</span>`
    : '<span class="trimmy-pin-dot"></span>';
  return L.divIcon({ html, className: 'trimmy-pin', iconSize: undefined, iconAnchor: label ? [0, 0] : [12, 24] });
}

export function TrimmyMap({
  center, zoom = 15, pins = [], draggablePin, onPinMove, onMapClick, className, fitToPins, label,
}: {
  center: { lat: number; lng: number };
  zoom?: number;
  pins?: MapPin[];
  // One pin the user moves (location picker): dragged or placed by clicking.
  draggablePin?: { lat: number; lng: number };
  onPinMove?: (pos: { lat: number; lng: number }) => void;
  onMapClick?: (pos: { lat: number; lng: number }) => void;
  className?: string;
  fitToPins?: boolean;
  label: string; // for screen readers
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const leaflet = useRef<typeof import('leaflet') | null>(null);
  const layer = useRef<Marker[]>([]);
  const dragMarker = useRef<Marker | null>(null);
  // The latest props, for Leaflet's own callbacks and for redrawing pins.
  const latest = useRef({ pins, draggablePin, onPinMove, onMapClick, fitToPins });

  // Draw the pins (and the draggable one) from the latest props.
  const sync = useRef(() => {
    const L = leaflet.current;
    const m = map.current;
    if (!L || !m) return;
    const { pins: current, draggablePin: drag, fitToPins: fit } = latest.current;
    layer.current.forEach((mk) => mk.remove());
    layer.current = current.map((p) => {
      const mk = L.marker([p.lat, p.lng], { icon: pinIcon(L, p.label), keyboard: true, title: p.label });
      if (p.onClick) mk.on('click', p.onClick);
      return mk.addTo(m);
    });
    if (drag) {
      if (!dragMarker.current) {
        dragMarker.current = L.marker([drag.lat, drag.lng], { icon: pinIcon(L), draggable: true, keyboard: true, title: 'Business location' })
          .addTo(m)
          .on('dragend', (e) => {
            const ll = (e.target as Marker).getLatLng();
            latest.current.onPinMove?.({ lat: ll.lat, lng: ll.lng });
          });
      } else {
        dragMarker.current.setLatLng([drag.lat, drag.lng]);
      }
    }
    if (fit && current.length > 1) {
      m.fitBounds(L.latLngBounds(current.map((p) => [p.lat, p.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 });
    }
  });

  // Create once.
  useEffect(() => {
    let cancelled = false;
    import('leaflet').then((L) => {
      if (cancelled || !el.current || map.current) return;
      leaflet.current = L;
      const m = L.map(el.current, { zoomControl: true, scrollWheelZoom: false, attributionControl: true });
      m.setView([center.lat, center.lng], zoom);
      L.tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(m);
      m.on('click', (e) => {
        const pos = { lat: e.latlng.lat, lng: e.latlng.lng };
        latest.current.onMapClick?.(pos);
        if (dragMarker.current) {
          dragMarker.current.setLatLng(e.latlng);
          latest.current.onPinMove?.(pos);
        }
      });
      // Scroll-zoom only once the map has been clicked, so the page still scrolls past it.
      m.on('focus', () => m.scrollWheelZoom.enable());
      m.on('blur', () => m.scrollWheelZoom.disable());
      map.current = m;
      sync.current();
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      dragMarker.current = null;
      layer.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pins in step with props.
  useEffect(() => {
    latest.current = { pins, draggablePin, onPinMove, onMapClick, fitToPins };
    sync.current();
  });

  // Recentre when asked to (e.g. "Use my location").
  useEffect(() => {
    map.current?.setView([center.lat, center.lng], map.current.getZoom());
  }, [center.lat, center.lng]);

  return (
    <div
      ref={el}
      role="application"
      aria-label={label}
      className={cx('relative z-0 overflow-hidden rounded-card border border-line bg-surface-2', className ?? 'h-72')}
    />
  );
}
