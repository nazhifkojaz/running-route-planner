import L from 'leaflet';
import { CONFIG } from './config';
import { state } from './state';
import { polylineDistanceMeters } from './utils';
import { toGPX, fromGPX } from './gpx';
import { trackEvent } from './analytics';
import type { LatLng } from './types';
import type { RouteManager } from './route';


export async function downloadGPX(gpx: string, filename = 'route.gpx') {
  const type = 'application/gpx+xml';
  const blob = new Blob([gpx], { type });

  // Try File System Access API
  try {
    const w = window as any;
    if (w.showSaveFilePicker) {
      const handle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'GPX route', accept: { [type]: ['.gpx'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }
  } catch {}

  // Try Web Share API
  try {
    const n = navigator as any;
    if (n.share) {
      const file = new File([blob], filename, { type });
      await n.share({ files: [file], title: filename, text: 'GPX route' });
      return;
    }
  } catch {}

  // Fallback to download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    try { URL.revokeObjectURL(url); } catch {}
  }, 2500);
}

export async function saveGPX() {
  if (!state.lastRouteLatLngs.length) return;

  const markerLatLngs: LatLng[] = state.waypoints.map(([lon, lat]) => [lat, lon]);
  const gpx = toGPX(state.lastRouteLatLngs, {
    name: 'Planned route',
    markers: markerLatLngs,
  });

  await downloadGPX(gpx, 'route.gpx');
  trackEvent('gpx_saved');
}

export async function loadGPX(
  file: File,
  map: L.Map,
  routeManager: RouteManager
) {
  try {
    const text = await file.text();
    const { route, markers: gpxMarkers } = fromGPX(text);

    if (state.routeLayer) {
      routeManager.clearAll();
    }

    state.lastRouteLatLngs = route.slice();
    state.routeLayer = L.polyline(route, {
      weight: CONFIG.ROUTE_WEIGHT,
      opacity: CONFIG.ROUTE_OPACITY,
      pane: 'routePane'
    }).addTo(map);

    map.fitBounds(state.routeLayer.getBounds(), { padding: CONFIG.FIT_BOUNDS_PADDING });

    if (gpxMarkers.length) {
      gpxMarkers.forEach(([lat, lon]) => {
        const m = L.marker([lat, lon], { draggable: true })
          .on('dragend', (ev: L.LeafletEvent) => {
            const ll = (ev.target as L.Marker).getLatLng();
            const idx = state.markers.indexOf(ev.target as L.Marker);
            if (idx >= 0) state.waypoints[idx] = [ll.lng, ll.lat];
          })
          .addTo(map);
        state.markers.push(m);
        state.waypoints.push([lon, lat]);
      });
      routeManager.refreshLabels();
    }

    state.baseDistanceM = polylineDistanceMeters(route);
    routeManager.updateStats(state.baseDistanceM, route);
    routeManager.addKmLabels(route, state.baseDistanceM);

    trackEvent('gpx_loaded');
  } catch (err: any) {
    alert(`Failed to load GPX: ${err?.message ?? err}`);
  }
}