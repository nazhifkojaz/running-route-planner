// src/gpx.ts

export type LatLng = [number, number];

export interface GpxData {
  route: LatLng[];     // polyline geometry (as [lat, lon])
  markers: LatLng[];   // user waypoints (as [lat, lon], in order)
  name?: string;
}

/**
 * Serialize route + optional markers into GPX.
 * - route: array of [lat, lon] (Leaflet order)
 * - options.markers: waypoints as [lat, lon] (ordered)
 * - options.laps: repeats the same <trkseg> N times (default 1)
 */
export function toGPX(
  route: LatLng[],
  options: { name?: string; markers?: LatLng[]; laps?: number } = {}
): string {
  const name = options.name ?? 'Planned route';
  const laps = Math.max(1, options.laps ?? 1);
  const markers = options.markers ?? [];

  // Track segments (can repeat for laps)
  const trkSeg =
    route.map(([lat, lon]) => `      <trkpt lat="${lat}" lon="${lon}"/>`).join('\n');

  let trk = '';
  for (let i = 0; i < laps; i++) {
    trk += `    <trkseg>\n${trkSeg}\n    </trkseg>\n`;
  }

  // Route points (ordered planning waypoints)
  const rte =
    markers.length
      ? `  <rte>\n${markers.map(([lat, lon], idx) =>
          `    <rtept lat="${lat}" lon="${lon}">\n      <name>${escapeXml(`WP ${idx + 1}`)}</name>\n    </rtept>`
        ).join('\n')}\n  </rte>\n`
      : '';

  // Waypoints (standalone) — many apps show these as pins
  const wpts =
    markers.length
      ? markers.map(([lat, lon], idx) =>
          `  <wpt lat="${lat}" lon="${lon}">\n    <name>${escapeXml(`WP ${idx + 1}`)}</name>\n  </wpt>`
        ).join('\n') + '\n'
      : '';

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="RoutePlanner" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    wpts +
    rte +
    `  <trk>\n    <name>${escapeXml(name)}</name>\n${trk}  </trk>\n` +
    `</gpx>\n`;
}

/**
 * Parse GPX into route polyline + markers.
 * - Prefers <trk>/<trkpt> for the route; falls back to <rte>/<rtept> if no track exists.
 * - For markers: prefers <rtept> (ordered); falls back to <wpt>.
 */
export function fromGPX(gpxText: string): GpxData {
  const xml = new DOMParser().parseFromString(gpxText, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) {
    throw new Error('Invalid GPX XML.');
  }

  const name = xml.querySelector('trk > name')?.textContent ?? undefined;

  const trkpts = Array.from(xml.getElementsByTagName('trkpt'));
  const rtepts = Array.from(xml.getElementsByTagName('rtept'));
  const wpts   = Array.from(xml.getElementsByTagName('wpt'));

  // Route geometry: prefer <trkpt>, else <rtept>
  const route = (trkpts.length ? trkpts : rtepts).map(pt => [
    parseFloat(pt.getAttribute('lat') || 'NaN'),
    parseFloat(pt.getAttribute('lon') || 'NaN'),
  ] as LatLng).filter(isFiniteLatLng);

  if (route.length < 2) {
    throw new Error('No usable route points found in GPX.');
  }

  // Markers: prefer <rtept>, else <wpt> (document order)
  const markers: LatLng[] =
    (rtepts.length ? rtepts : wpts).map(pt => [
      parseFloat(pt.getAttribute('lat') || 'NaN'),
      parseFloat(pt.getAttribute('lon') || 'NaN'),
    ] as LatLng).filter(isFiniteLatLng);

  return { route, markers, name };
}

/* ---------- internal ---------- */

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
}

function isFiniteLatLng([lat, lon]: LatLng): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon);
}
