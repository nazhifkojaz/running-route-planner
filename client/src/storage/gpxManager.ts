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
  routeManager: RouteManager
) {
  try {
    const text = await file.text();
    const { route, markers: gpxMarkers } = fromGPX(text);

    const distanceM = polylineDistanceMeters(route);

    await routeManager.loadRouteFromData(
      route,
      gpxMarkers,
      distanceM,
    );

    trackEvent('gpx_loaded');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    alert(`Failed to load GPX: ${message}`);
  }
}
