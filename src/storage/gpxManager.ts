import L from 'leaflet';
import { CONFIG } from '../config';
import type { RouteManager } from '../routing/routeManager';
import { trackEvent } from '../services/analytics';
import { state } from '../state';
import type { LatLng } from '../types';
import { polylineDistanceMeters } from '../utils';
import { fromGPX, toGPX } from './gpx';

type FilePickerOptionsLite = {
  suggestedName?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
};

type FileSaveHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
};


export async function downloadGPX(gpx: string, filename = 'route.gpx') {
  const type = 'application/gpx+xml';
  const blob = new Blob([gpx], { type });

  // Try File System Access API
  try {
    type FilePickerWindow = Window & {
      showSaveFilePicker?: (options: FilePickerOptionsLite) => Promise<FileSaveHandle>;
    };
    const pickerWindow = window as FilePickerWindow;
    if (pickerWindow.showSaveFilePicker) {
      const handle = await pickerWindow.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'GPX route', accept: { [type]: ['.gpx'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }
  } catch (error: unknown) {
    console.warn('File picker download failed; falling back', error);
  }

  // Try Web Share API
  try {
    type ShareNavigator = Navigator & {
      share?: (data: ShareData) => Promise<void>;
    };
    const shareNavigator = navigator as ShareNavigator;
    if (shareNavigator.share) {
      const file = new File([blob], filename, { type });
      await shareNavigator.share({ files: [file], title: filename, text: 'GPX route' });
      return;
    }
  } catch (error: unknown) {
    console.warn('Web share failed; falling back', error);
  }

  // Fallback to download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    try {
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      console.warn('Failed to revoke object URL', error);
    }
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    alert(`Failed to load GPX: ${message}`);
  }
}
