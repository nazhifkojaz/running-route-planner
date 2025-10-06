/// <reference types="vite/client" />
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { elevationStats } from './elevation';
import { toGPX } from './gpx';
import './style.css';

// Fix Leaflet marker icons when bundling
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

type LonLat = [number, number]; // [lon, lat]

// ===== UI Refs =====
const elevVal   = document.getElementById('elevVal') as HTMLSpanElement;
const etaVal    = document.getElementById('etaVal')  as HTMLSpanElement;
const calVal    = document.getElementById('calVal')  as HTMLSpanElement;
const distanceV = document.getElementById('distanceVal') as HTMLSpanElement;

const undoFab   = document.getElementById('undoFab') as HTMLButtonElement;
const locBtn    = document.getElementById('locBtn')  as HTMLButtonElement;
const zoomInBtn = document.getElementById('zoomInBtn') as HTMLButtonElement;
const zoomOutBtn= document.getElementById('zoomOutBtn') as HTMLButtonElement;

const settingsBtn   = document.getElementById('settingsBtn') as HTMLButtonElement;
const settingsClose = document.getElementById('settingsClose') as HTMLButtonElement;
const settingsPanel = document.getElementById('settingsPanel') as HTMLDivElement;

const undoMenuBtn = document.getElementById('undoMenuBtn') as HTMLButtonElement;
const clearBtn    = document.getElementById('clearBtn') as HTMLButtonElement;
const reverseBtn  = document.getElementById('reverseBtn') as HTMLButtonElement;

const loopChk     = document.getElementById('loop') as HTMLInputElement;
const exportBtn   = document.getElementById('exportBtn') as HTMLButtonElement;

const targetPaceI    = document.getElementById('targetPace') as HTMLInputElement;
const targetWeightI  = document.getElementById('targetWeight') as HTMLInputElement;

// Bottom-center profile bar (icons; locked to car)
const footBtn = document.getElementById('footBtn') as HTMLButtonElement;
const bikeBtn = document.getElementById('bikeBtn') as HTMLButtonElement;
const carBtn  = document.getElementById('carBtn')  as HTMLButtonElement;

// ===== ORS key (optional) from Vite env; if not set, we stick with OSRM =====
const ORS_KEY: string = (import.meta as any).env?.VITE_ORS_KEY ?? '';

// ===== Map =====
const map = L.map('map');
const PALEMBANG: [number, number] = [-2.9909, 104.7566]; // Leaflet is [lat, lon]
map.setView(PALEMBANG, 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Try to center on user
if ('geolocation' in navigator) {
  navigator.geolocation.getCurrentPosition(
    (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 14),
    () => {/* keep Palembang */},
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
  );
}

// ===== State =====
const waypoints: LonLat[] = [];
const markers: L.Marker[] = [];
let routeLayer: L.Polyline | null = null;
let baseDistanceM = 0;                      // meters (one pass)
let lastRouteLatLngs: [number, number][] = []; // [lat, lon]

// ===== Helpers =====
function fmtKmBare(m: number){ return (m / 1000).toFixed(2) + ' km'; }
function fmtHMS(totalSeconds: number){
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
  const mm = String(m).padStart(2,'0'), ss = String(sec).padStart(2,'0');
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
function parsePaceSecPerKm(txt: string): number | null {
  const m = txt.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const mins = parseInt(m[1], 10), secs = parseInt(m[2], 10);
  if (isNaN(mins) || isNaN(secs)) return null;
  return mins * 60 + secs; // s per km
}
function clearRouteLayer(){ if (routeLayer){ map.removeLayer(routeLayer); routeLayer = null; } }
function refreshLabels(){ markers.forEach((m,i)=>m.bindTooltip(String(i+1),{permanent:true,direction:'top'}).openTooltip()); }

/** Running calories estimate (level ground):
 * VO2 (ml/kg/min) ≈ 0.2 * speed(m/min) + 3.5  →  MET = VO2/3.5
 * kcal/min ≈ MET * 3.5 * weight(kg) / 200
 */
function estimateKcalFromPaceWeight(distanceM: number, paceSecPerKm: number, weightKg: number): number {
  if (paceSecPerKm <= 0 || weightKg <= 0 || distanceM <= 0) return 0;
  const durationSec = (distanceM / 1000) * paceSecPerKm;
  const durationMin = durationSec / 60;
  const speed_m_per_min = 60000 / paceSecPerKm; // m/min
  const MET = (0.2 * speed_m_per_min + 3.5) / 3.5;
  const kcalPerMin = (MET * 3.5 * weightKg) / 200;
  return kcalPerMin * durationMin;
}

// ===== Providers (OSRM primary, ORS driving-car fallback if key set) =====
async function osrmDriving(coords: LonLat[]){
  const path = coords.map(c=>`${c[0]},${c[1]}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
  const data = await res.json();
  const r = data.routes?.[0]; if (!r) throw new Error('OSRM: no route');
  return { geometry: r.geometry.coordinates as LonLat[], distance: r.distance as number };
}
async function orsDriving(coords: LonLat[]){
  if (!ORS_KEY) throw new Error('ORS key missing');
  const url = `https://api.openrouteservice.org/v2/directions/driving-car/geojson`;
  const res = await fetch(url, {
    method:'POST', headers:{'Authorization': ORS_KEY, 'Content-Type':'application/json'},
    body: JSON.stringify({ coordinates: coords })
  });
  if (!res.ok) throw new Error(`ORS HTTP ${res.status}`);
  const data = await res.json();
  const feat = data.features?.[0]; if (!feat) throw new Error('ORS: no route');
  const summary = feat.properties.summary as { distance:number, duration:number };
  return { geometry: feat.geometry.coordinates as LonLat[], distance: summary.distance };
}
async function getRoute(coords: LonLat[]){
  try { return await osrmDriving(coords); }
  catch { if (ORS_KEY) return await orsDriving(coords); throw new Error('Routing failed'); }
}

// ===== Routing & stats =====
async function renderRoute(){
  clearRouteLayer();
  baseDistanceM = 0;
  elevVal.textContent = etaVal.textContent = calVal.textContent = '-';
  distanceV.textContent = '-';

  if (waypoints.length < 2){ exportBtn.disabled = true; return; }

  const coords = loopChk.checked ? [...waypoints, waypoints[0]] : waypoints.slice();

  try{
    const { geometry, distance } = await getRoute(coords);
    const latlngs = (geometry as LonLat[]).map(([lon,lat])=>[lat,lon]) as [number,number][];
    lastRouteLatLngs = latlngs;

    routeLayer = L.polyline(latlngs, { weight:5, opacity:.9 }).addTo(map);
    map.fitBounds(routeLayer.getBounds(), { padding:[20,20] });

    baseDistanceM = distance;
    distanceV.textContent = fmtKmBare(distance);

    // Elevation (best-effort)
    elevVal.textContent = '...';
    const elev = await elevationStats(latlngs);
    elevVal.textContent = elev ? `+${Math.round(elev.gain)} / -${Math.round(elev.loss)} m` : '-';

    // ETA (only if target pace provided)
    const pace = parsePaceSecPerKm(targetPaceI.value || '');
    const etaSec = pace ? (distance / 1000) * pace : null;
    etaVal.textContent = pace && etaSec ? fmtHMS(etaSec) : '-';

    // Calories (needs both pace & weight)
    const weight = Number(targetWeightI.value);
    if (pace && weight && etaSec){
      const kcal = estimateKcalFromPaceWeight(distance, pace, weight);
      calVal.textContent = Math.round(kcal).toString();
    } else {
      calVal.textContent = '-';
    }

    exportBtn.disabled = false;
  } catch {
    distanceV.textContent = 'Error';
    exportBtn.disabled = true;
  }
}

// ===== Waypoint helpers =====
function addWaypoint(lat:number, lon:number){
  const p: LonLat = [lon, lat];
  waypoints.push(p);
  const m = L.marker([lat, lon], { draggable:true })
    .on('dragend', (ev: L.LeafletEvent) => {
      const ll = (ev.target as L.Marker).getLatLng();
      const idx = markers.indexOf(ev.target as L.Marker);
      if (idx >= 0) waypoints[idx] = [ll.lng, ll.lat];
      renderRoute(); // auto-calc
    })
    .addTo(map);
  markers.push(m);
  refreshLabels();
  renderRoute(); // auto-calc
}
function undoLast(){
  if (!waypoints.length) return;
  waypoints.pop();
  const m = markers.pop(); if (m) map.removeLayer(m);
  refreshLabels();
  renderRoute(); // auto-calc
}
function clearAll(){
  waypoints.length = 0;
  markers.forEach(m=>map.removeLayer(m));
  markers.length = 0;
  clearRouteLayer();
  elevVal.textContent = etaVal.textContent = calVal.textContent = '-';
  distanceV.textContent = '-';
  exportBtn.disabled = true;
}
function reverseRoute(){
  if (waypoints.length < 2) return;
  waypoints.reverse();
  markers.reverse();
  refreshLabels();
  renderRoute(); // auto-calc
}

// ===== Events =====
map.on('click', (e: L.LeafletMouseEvent) => {
  // auto-close the settings sheet if it’s open
  setSettings(false);

  // add waypoint + recalc
  addWaypoint(e.latlng.lat, e.latlng.lng);
});


undoFab.addEventListener('click', undoLast);

// Bracketed tools
locBtn.addEventListener('click', () => {
  if (!('geolocation' in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => map.flyTo([pos.coords.latitude, pos.coords.longitude], Math.max(map.getZoom(), 14)),
    () => {}
  );
});
zoomInBtn.addEventListener('click', () => map.zoomIn());
zoomOutBtn.addEventListener('click', () => map.zoomOut());

// Settings toggle (on/off)
function setSettings(open: boolean){
  settingsPanel.classList.toggle('hidden', !open);
  settingsBtn.setAttribute('aria-expanded', String(open));
}
settingsBtn.addEventListener('click', () => {
  const willOpen = settingsPanel.classList.contains('hidden');
  setSettings(willOpen);
});
settingsClose.addEventListener('click', () => setSettings(false));

// Settings actions
undoMenuBtn.addEventListener('click', undoLast);
clearBtn.addEventListener('click', clearAll);
reverseBtn.addEventListener('click', reverseRoute);
loopChk.addEventListener('change', renderRoute);

// Target inputs → recompute dependent stats
targetPaceI.addEventListener('input', () => renderRoute());
targetWeightI.addEventListener('input', () => renderRoute());

// Bottom-center profile bar (icons; locked to car)
footBtn.addEventListener('click', () => {/* disabled */});
bikeBtn.addEventListener('click', () => {/* disabled */});
carBtn .addEventListener('click', () => {/* already active */});

// Export GPX
exportBtn.addEventListener('click', () => {
  if (!lastRouteLatLngs.length) return;
  const gpx = toGPX(lastRouteLatLngs);
  const blob = new Blob([gpx], { type:'application/gpx+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'route.gpx';
  a.click();
  URL.revokeObjectURL(a.href);
});
