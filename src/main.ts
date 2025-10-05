/// <reference types="vite/client" />
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { elevationStats } from './elevation';
import './style.css';

// Fix Leaflet marker icons when bundling
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

type LonLat = [number, number]; // [lon, lat]
type Engine = 'ors-foot-direction' | 'ors-cycle-direction' | 'ors-foot-snap' | 'osrm-driving';

// ==== UI refs ====
const panel       = document.getElementById('panel') as HTMLDivElement;
const panelToggle = document.getElementById('panelToggle') as HTMLButtonElement;
const calcBtn     = document.getElementById('calcBtn') as HTMLButtonElement;
const undoBtn     = document.getElementById('undoBtn') as HTMLButtonElement;
const resetBtn    = document.getElementById('resetBtn') as HTMLButtonElement;

const loopChk     = document.getElementById('loop') as HTMLInputElement;
const lapsInput   = document.getElementById('laps') as HTMLInputElement;
const paceInput   = document.getElementById('pace') as HTMLInputElement;

const engineSel   = document.getElementById('engine') as HTMLSelectElement;
const engineNote  = document.getElementById('engineNote') as HTMLParagraphElement;

const distVal     = document.getElementById('distVal') as HTMLSpanElement;
const elevVal     = document.getElementById('elevVal') as HTMLSpanElement;
const etaVal      = document.getElementById('etaVal') as HTMLSpanElement;

// ORS key (read from env; no UI field). NOTE: this will be embedded in the client build.
const ORS_KEY: string = (import.meta as any).env?.VITE_ORS_KEY ?? '';

// ==== Map ====
// default the position to Palembang, Sumatera Selatan
const map = L.map('map');
const PALEMBANG: [number, number] = [-2.9909, 104.7566];
map.setView(PALEMBANG, 13);
if ('geolocation' in navigator) {
  navigator.geolocation.getCurrentPosition(
    (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 14),
    () => {/* keep Palembang */},
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
  );
}
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// ==== State ====
const waypoints: LonLat[] = [];
const markers: L.Marker[] = [];
let routeLayer: L.Polyline | null = null;
let baseDistanceM = 0; // meters for one lap
let lastRouteLatLngs: [number, number][] = [];
let lastElev: { gain: number; loss: number } | null = null;
let lastElevRef: [number, number][] | null = null;
let orsDegraded = false; // set when missing key or ORS returns 401/403/429

// ==== Helpers ====
function fmtKm(m: number) { return (m / 1000).toFixed(2) + ' km'; }
function fmtHMS(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
  const mm = String(m).padStart(2, '0'); const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
function parsePaceSecPerKm(txt: string): number | null {
  const parts = txt.trim().split(':');
  if (parts.length !== 2) return null;
  const mins = parseInt(parts[0], 10); const secs = parseInt(parts[1], 10);
  if (isNaN(mins) || isNaN(secs)) return null;
  return mins * 60 + secs; // seconds per km
}

function clearRouteLayer() { if (routeLayer) { map.removeLayer(routeLayer); routeLayer = null; } }
function refreshLabels() { markers.forEach((m, i) => m.bindTooltip(String(i + 1), { permanent: true, direction: 'top' }).openTooltip()); }

// Disable/lock engine picker when ORS absent/limited
function updateEngineAvailability() {
  const hasKey = !!ORS_KEY;
  if (!hasKey || orsDegraded) {
    engineSel.value = 'osrm-driving';
    engineSel.disabled = true;
    if (engineNote) engineNote.textContent = !hasKey
      ? 'Engine locked: no ORS key; using OSRM (driving).'
      : 'Engine locked: ORS rate limit/error; using OSRM (driving).';
  } else {
    engineSel.disabled = false;
    if (engineNote) engineNote.textContent = 'ORS engines available. If ORS errors, fallback to OSRM (driving).';
  }
}

// ==== Providers ====
async function orsDirections(profile: 'foot-walking' | 'cycling-regular', coords: LonLat[]) {
  if (!ORS_KEY) { orsDegraded = true; updateEngineAvailability(); throw new Error('ORS key missing'); }
  const res = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
    method: 'POST',
    headers: { 'Authorization': ORS_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinates: coords })
  });
  if (!res.ok) {
    if ([401, 403, 429].includes(res.status)) { orsDegraded = true; updateEngineAvailability(); }
    throw new Error(`ORS HTTP ${res.status}`);
  }
  const data = await res.json();
  const feat = data.features?.[0]; if (!feat) throw new Error('ORS: no route');
  const geometry = feat.geometry.coordinates as LonLat[];
  const summary = feat.properties.summary as { distance: number, duration: number };
  return { geometry, distance: summary.distance, duration: summary.duration };
}

// ors snap -> snap to nearest edge (a bit smoother than direction)
async function orsSnap(profile: 'foot-walking', coords: LonLat[], radius = 100): Promise<LonLat[]> {
  if (!ORS_KEY) { orsDegraded = true; updateEngineAvailability(); throw new Error('ORS key missing'); }
  const res = await fetch(`https://api.openrouteservice.org/v2/snap/${profile}/json`, {
    method: 'POST',
    headers: { 'Authorization': ORS_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations: coords, radius })
  });
  if (!res.ok) {
    if ([401, 403, 429].includes(res.status)) { orsDegraded = true; updateEngineAvailability(); }
    throw new Error(`ORS snap HTTP ${res.status}`);
  }
  const data = await res.json();
  const snapped = (data.locations as any[]).map((it, i) =>
    Array.isArray(it?.location) ? (it.location as [number, number]) : coords[i]
  );
  return snapped as LonLat[];
}


// since we're using the orsm demo, it only lock to driving mode
async function osrmDriving(coords: LonLat[]) {
  const path = coords.map(c => `${c[0]},${c[1]}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=simplified&geometries=geojson&steps=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = await res.json(); const r = data.routes?.[0];
  if (!r) throw new Error('OSRM: no route');
  return { geometry: r.geometry.coordinates as LonLat[], distance: r.distance as number, duration: r.duration as number };
}

async function routeWithEngine(engine: Engine, coords: LonLat[]) {
  try {
    if (engine === 'ors-foot-direction') return await orsDirections('foot-walking', coords);
    if (engine === 'ors-cycle-direction') return await orsDirections('cycling-regular', coords);
    if (engine === 'ors-foot-snap') {
      const snapped = await orsSnap('foot-walking', coords);
      return await orsDirections('foot-walking', snapped);
    }
    // osrm-driving
    return await osrmDriving(coords);
  } catch {
    // Fallback to OSRM on any ORS problem
    return await osrmDriving(coords);
  }
}

// ==== Routing & stats ====
async function renderRoute() {
  clearRouteLayer();
  baseDistanceM = 0; lastElev = null; lastElevRef = null;
  distVal.textContent = '-'; elevVal.textContent = '-'; etaVal.textContent = '-';
  if (waypoints.length < 2) return;

  const coords = loopChk.checked && waypoints.length >= 2 ? [...waypoints, waypoints[0]] : waypoints.slice();

  // If ORS not available (or the api key is not set), the picker will be disabled and set to OSRM by default.
  const engine = (engineSel.value as Engine) || 'osrm-driving';

  try {
    const { geometry, distance } = await routeWithEngine(engine, coords);
    const latlngs = (geometry as LonLat[]).map(([lon, lat]) => [lat, lon]) as [number, number][];
    lastRouteLatLngs = latlngs;
    routeLayer = L.polyline(latlngs, { weight: 5, opacity: 0.9 }).addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding: [20, 20] });

    baseDistanceM = distance; // one lap
    updateStatsAfterRoute(latlngs);
  } catch {
    distVal.textContent = 'Error';
  }
}

async function updateStatsAfterRoute(latlngs?: [number, number][]) {
  const laps = Math.max(1, parseInt(lapsInput.value || '1', 10));
  const totalM = baseDistanceM * laps;
  distVal.textContent = baseDistanceM ? fmtKm(totalM) : '-';

  const pace = parsePaceSecPerKm(paceInput.value || '');
  etaVal.textContent = baseDistanceM && pace ? fmtHMS((totalM / 1000) * pace) : '-';

  if (!latlngs && lastElev && lastElevRef === lastRouteLatLngs) {
    elevVal.textContent = `+${Math.round(lastElev.gain * laps)} m / -${Math.round(lastElev.loss * laps)} m`;
    return;
  }
  if (!latlngs || !latlngs.length) { elevVal.textContent = '-'; return; }
  elevVal.textContent = '…';
  const elev = await elevationStats(latlngs);
  if (!elev) { elevVal.textContent = '-'; return; }
  lastElev = elev; lastElevRef = latlngs;
  elevVal.textContent = `+${Math.round(elev.gain * laps)} m / -${Math.round(elev.loss * laps)} m`;
}

// ==== Events ====
panelToggle.addEventListener('click', () => {
  const hidden = panel.classList.toggle('hidden');
  panelToggle.setAttribute('aria-expanded', String(!hidden));
});

// Manual routing trigger
calcBtn.addEventListener('click', renderRoute);

// Undo & Reset
undoBtn.addEventListener('click', () => {
  if (!waypoints.length) return;
  waypoints.pop();
  const m = markers.pop(); if (m) map.removeLayer(m);
  clearRouteLayer();
  refreshLabels();
  // manual: user must tap Calculate again for a fresh route
});
resetBtn.addEventListener('click', () => {
  waypoints.length = 0;
  markers.forEach(m => map.removeLayer(m));
  markers.length = 0;
  clearRouteLayer();
  distVal.textContent = elevVal.textContent = etaVal.textContent = '-';
});

// Stats live update
lapsInput.addEventListener('input', () => updateStatsAfterRoute());
paceInput.addEventListener('input', () => updateStatsAfterRoute());
engineSel.addEventListener('change', () => { /* manual calc only */ });

// Add waypoints by tapping the map
map.on('click', (e: L.LeafletMouseEvent) => {
  const p: LonLat = [e.latlng.lng, e.latlng.lat];
  waypoints.push(p);
  const m = L.marker([p[1], p[0]], { draggable: true })
    .on('dragend', (ev: L.LeafletEvent) => {
      const ll = (ev.target as L.Marker).getLatLng();
      const i = markers.indexOf(ev.target as L.Marker);
      if (i >= 0) waypoints[i] = [ll.lng, ll.lat];
      // manual: no auto route here
    })
    .addTo(map);
  markers.push(m);
  refreshLabels();
  // manual: user taps "▶" button to calculate
});

// Init engine availability based on key
updateEngineAvailability();
