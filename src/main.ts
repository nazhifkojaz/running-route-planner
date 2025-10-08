/// <reference types="vite/client" />
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { elevationStats } from './elevation';
import { toGPX, fromGPX } from './gpx';
import './style.css';

// Fix Leaflet marker icons when bundling
// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

function readHashParam(key: string): string | null {
  const h = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  const params = new URLSearchParams(h);
  return params.get(key);
}

const sessionFromHash = readHashParam('session');
if (sessionFromHash) {
  localStorage.setItem('session_token', sessionFromHash);
  // optional: clean hash (but keep other states if you use any)
  const params = new URLSearchParams(location.hash.slice(1));
  params.delete('session');
  history.replaceState(null, '', location.pathname + (location.search || '') + (params.size ? '#' + params.toString() : ''));
}


type LonLat = [number, number]; // [lon, lat]


// ===== UI Refs =====\
const settingsClose = document.getElementById('settingsClose') as HTMLButtonElement;
const settingsPanel = document.getElementById('settingsPanel') as HTMLDivElement;

const clearBtn    = document.getElementById('clearBtn') as HTMLButtonElement;
const reverseBtn  = document.getElementById('reverseBtn') as HTMLButtonElement;

const loopChk     = document.getElementById('loop') as HTMLInputElement;
const saveGpxBtn  = document.getElementById('saveGpxBtn') as HTMLButtonElement;
const loadGpxBtn  = document.getElementById('loadGpxBtn') as HTMLButtonElement;
const loadGpxInput= document.getElementById('loadGpxInput') as HTMLInputElement;


const targetPaceI    = document.getElementById('targetPace') as HTMLInputElement;
const targetWeightI  = document.getElementById('targetWeight') as HTMLInputElement;

const engineOSRM = document.getElementById('engineOSRM') as HTMLInputElement;
const engineORS  = document.getElementById('engineORS')  as HTMLInputElement;
const engineNote = document.getElementById('engineNote') as HTMLParagraphElement;
const orsKeyInput = document.getElementById('orsKey') as HTMLInputElement;

// === Panel refs (existing HTML) ===
const userPanel   = document.getElementById('userPanel') as HTMLDivElement;
const userClose   = document.getElementById('userClose') as HTMLButtonElement;
const userContent = document.getElementById('userContent') as HTMLDivElement;

const backdrop = document.getElementById('sheetBackdrop') as HTMLDivElement;

// ===== ORS key (optional) from Vite env; if not set, we stick with OSRM =====
// const ORS_KEY: string = (import.meta as any).env?.VITE_ORS_KEY ?? '';

// ===== Map =====
const map = L.map('map');

// ===== Map related thingies =====
const routePane = map.createPane('routePane');
routePane.style.zIndex = '450'
const kmPane = map.createPane('kmPane');
kmPane.style.zIndex = '800';
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

// ===== Leaflet UI thingies =====
map.zoomControl?.remove();
const zoomCtl = L.control.zoom({ position: 'bottomleft' }).addTo(map);
const zc = zoomCtl.getContainer();

// gps button
const gpsBtn = L.DomUtil.create('a', 'leaflet-control-gps', zc);
gpsBtn.href = '#'; gpsBtn.title = 'Use my location'; gpsBtn.innerHTML = '⌖';
L.DomEvent.on(gpsBtn, 'click', (e: Event) => {
  L.DomEvent.stop(e);
  if (!('geolocation' in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => map.flyTo([pos.coords.latitude, pos.coords.longitude], Math.max(map.getZoom(), 14)),
    () => {},
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
  )
})
zc?.insertBefore(gpsBtn, zc.firstChild);

// undo button
const undoBtn = L.Control.extend({
  options: { position: 'bottomleft' as L.ControlPosition },
  onAdd: () => {
    const bar = L.DomUtil.create('div', 'leaflet-bar');
    const a = L.DomUtil.create('a', 'leaflet-control-undo', bar);
    a.href = '#';
    a.title = 'Undo last waypoint';
    a.setAttribute('aria-label', 'Undo last waypoint');
    a.innerHTML = '↶';

    L.DomEvent.on(a, 'click', (e: Event) => {
      L.DomEvent.stop(e);
      if (!waypoints.length) return;
      waypoints.pop();
      const m = markers.pop(); if (m) map.removeLayer(m);
      refreshLabels?.();
      renderRoute();
    });

    // prevent map drag when tapping the control
    L.DomEvent.disableClickPropagation(bar);
    return bar;
  }
});
new undoBtn().addTo(map);

// routing profile control
// function addBottomCenterProfileBar(map: L.Map){
//   const el = L.DomUtil.create('div', 'leaflet-control leaflet-bar profile-center');
//   el.innerHTML = `
//     <a href="#" id="footBtn" aria-disabled="true" title="Foot">👟</a>
//     <a href="#" id="bikeBtn" aria-disabled="true" title="Bike">🚴</a>
//     <a href="#" id="carBtn"  aria-pressed="true" title="Car">🚗</a>
//   `;

//   // Position it in the map container (not in a corner)
//   const container = map.getContainer();
//   el.style.position = 'absolute';
//   el.style.left = '50%';
//   el.style.bottom = 'max(10px, env(safe-area-inset-bottom))';
//   el.style.transform = 'translateX(-50%)';
//   el.style.zIndex = '800';

//   container.appendChild(el);
//   L.DomEvent.disableClickPropagation(el); // don’t drag the map when tapping it

//   // Wire buttons (lock to car for now)
//   const carBtn  = el.querySelector('#carBtn')  as HTMLAnchorElement;
//   const footBtn = el.querySelector('#footBtn') as HTMLAnchorElement;
//   const bikeBtn = el.querySelector('#bikeBtn') as HTMLAnchorElement;

//   footBtn.onclick = (e) => { e.preventDefault(); /* disabled for now */ };
//   bikeBtn.onclick = (e) => { e.preventDefault(); /* disabled for now */ };
//   carBtn.onclick  = (e) => { e.preventDefault(); /* already active */ };

//   return el;
// }

// // Call once after the map is created:
// addBottomCenterProfileBar(map);



// setting toggle
const SettingsToggle = L.Control.extend({
  onAdd() {
    const wrap = L.DomUtil.create('div', 'leaflet-control settings-toggle leaflet-bar');
    const btn  = L.DomUtil.create('a', '', wrap);
    btn.href = '#';
    btn.title = 'Settings';
    btn.setAttribute('aria-label','Settings');
    btn.textContent = '🧰';
    L.DomEvent.on(btn, 'click', (e: Event) => {
      L.DomEvent.stop(e);
      settingsPanel.classList.toggle('hidden');
    });
    L.DomEvent.disableClickPropagation(wrap);
    return wrap;
  }
});
new SettingsToggle({ position: 'bottomright' }).addTo(map);

// Close when tapping the map
map.on('click', () => settingsPanel.classList.add('hidden'));

// stats and distance
const StatsControl = L.Control.extend({
  onAdd() {
    const el = L.DomUtil.create('div', 'panel stats');
    el.innerHTML = `
      <div><strong>Elev:</strong> <span id="elevVal">-</span></div>
      <div><strong>ETA:</strong> <span id="etaVal">-</span></div>
      <div><strong>kcal:</strong> <span id="calVal">-</span></div>
    `;
    // prevent map from panning when dragging on the panel
    L.DomEvent.disableClickPropagation(el);
    return el;
  },
  onRemove() {}
});

const DistanceControl = L.Control.extend({
  onAdd() {
    const el = L.DomUtil.create('div', 'panel distance');
    el.innerHTML = `
    <span id="distanceVal">0 Km</span>
    `;
    L.DomEvent.disableClickPropagation(el);
    return el;
  },
  onRemove() {}
});

const statsCtl = new StatsControl({ position: 'topleft' }).addTo(map);
const distCtl = new DistanceControl({ position: 'topright' }).addTo(map);

// Re-grab refs after control is created:
const elevVal = document.getElementById('elevVal') as HTMLSpanElement;
const etaVal  = document.getElementById('etaVal') as HTMLSpanElement;
const calVal  = document.getElementById('calVal') as HTMLSpanElement;
const distanceV = document.getElementById('distanceVal') as HTMLSpanElement;


// ===== State =====
const waypoints: LonLat[] = [];
const markers: L.Marker[] = [];
const kmLayer = L.layerGroup().addTo(map);
let routeLayer: L.Polyline | null = null;
let baseDistanceM = 0;                      // meters (one pass)
let lastRouteLatLngs: [number, number][] = []; // [lat, lon]
let orsDegraded = false; 

// Persist ORS key in localStorage
orsKeyInput.value = localStorage.getItem('ors_key') ?? '';
orsKeyInput.addEventListener('input', () => {
  localStorage.setItem('ors_key', orsKeyInput.value.trim());
  orsDegraded = false;   // new key → retry allowed
  updateEngineAvailability();
});

// ------------ Engine gating ------------
function getOrsKey(): string { return (orsKeyInput.value || '').trim(); }
function updateEngineAvailability() {
  const hasKey = !!getOrsKey();
  if (!hasKey || orsDegraded) {
    engineORS.checked = false;
    engineORS.disabled = true;
    engineOSRM.checked = true;
    engineNote.textContent = hasKey
      ? 'ORS temporarily disabled due to rate limit/error; using OSRM (driving).'
      : 'Set an ORS key to enable ORS.';
  } else {
    engineORS.disabled = false;
    engineNote.textContent = 'ORS enabled. Using snap + foot-walking when selected.';
  }
}
updateEngineAvailability();

// === API base (reuse your existing) ===
const API_BASE = 'https://running-route-planner.vercel.app';

type MeResp = {
  connected: boolean;
  strava_athlete_id?: number;
  username?: string | null;
  weight_kg?: number | null;
  run_count_all?: number | null;
  run_distance_all_m?: number | null;
  avg_pace_5_sec_per_km?: number | null;
  avg_hr_5?: number | null;
};

function authHeaders(): HeadersInit {
  const t = localStorage.getItem('session_token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiMe() {
  const res = await fetch(`${API_BASE}/me`, {
    headers: authHeaders(),
    // credentials no longer required, but harmless to keep:
    // credentials: 'include',
  });
  if (!res.ok) throw new Error(`ME ${res.status}`);
  return res.json();
}

async function apiSync() {
  const res = await fetch(`${API_BASE}/me/sync`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    // credentials: 'include',
  });
  if (!res.ok) throw new Error(`SYNC ${res.status}`);
  return res.json();
}

function stravaStartUrl(): string {
  const redirect = `${location.origin}${location.pathname}`;
  return `${API_BASE}/auth/strava/start?redirect=${encodeURIComponent(redirect)}`;
}


backdrop.addEventListener('click', closeUserPanel);
map.on('click', closeUserPanel);


// Simple renderers (adjust as you like)
function renderLoggedOut() {
  userContent.innerHTML = `
    <p>Connect your Strava account to personalize pace/HR estimates and show your stats.</p>
    <div class="account-actions">
      <button id="connectStrava" class="primary">Connect Strava</button>
      <span class="muted">You'll be redirected to Strava to authorize.</span>
    </div>`;
  document.getElementById('connectStrava')?.addEventListener('click', () => {
    location.href = stravaStartUrl();
  });
}

function renderLoggedIn(me: MeResp) {
  userContent.innerHTML = `
    <div class="kv"><span>Name</span><strong> : ${me.username ?? '-'}</strong></div>
    <div class="kv"><span>Athlete ID</span><strong> : ${me.strava_athlete_id ?? '-'}</strong></div>
    <div class="kv"><span>Weight</span><strong> : ${me.weight_kg ? me.weight_kg + ' kg' : '-'}</strong></div>
    <div class="kv"><span>Runs (all-time)</span><strong> : ${me.run_count_all ?? '-'}</strong></div>
    <div class="kv"><span>Distance (all-time)</span><strong> : ${fmtKmBare(me.run_distance_all_m)}</strong></div>
    <div class="kv"><span>Avg pace (last 5)</span><strong> : ${paceSecToStr(me.avg_pace_5_sec_per_km)}</strong></div>
    <div class="kv"><span>Avg HR (last 5)</span><strong> : ${me.avg_hr_5 ?? '-'}</strong></div>
    <div class="account-actions">
      <button id="syncStrava" class="primary">Sync latest</button>
    </div>`;
  document.getElementById('syncStrava')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    try { renderLoggedIn(await apiSync()); }
    finally { btn.disabled = false; }
  });
}

async function openUserPanel() {
  userContent.innerHTML = `<p class="muted small">Loading…</p>`;
  userPanel.classList.remove('hidden');
  backdrop.classList.remove('hidden');
  try {
    const me = await apiMe();
    _accountCtl?.setIcon(!!me.connected);
    me.connected ? renderLoggedIn(me) : renderLoggedOut();
  } catch {
    userContent.innerHTML = `<p class="muted">Could not reach the server.</p>`;
  }
}

function closeUserPanel() {
  userPanel.classList.add('hidden');
  backdrop.classList.add('hidden');
}

userClose?.addEventListener('click', closeUserPanel);

// Close the sheet when clicking the map (nice on mobile)
map.on('click', closeUserPanel);

// === Leaflet control (bottom-right) that toggles the panel ===
class AccountControl extends L.Control {
  private btn!: HTMLAnchorElement;
  onAdd() {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
    this.btn = L.DomUtil.create('a', 'account-btn', container) as HTMLAnchorElement;
    this.btn.href = '#';
    this.btn.title = 'Account';
    this.btn.textContent = '🪑'; // default until we know
    L.DomEvent.on(this.btn, 'click', L.DomEvent.stopPropagation)
              .on(this.btn, 'click', L.DomEvent.preventDefault)
              .on(this.btn, 'click', () => {
                if (userPanel.classList.contains('hidden')) openUserPanel();
                else closeUserPanel();
              });
    return container;
  }
  setIcon(connected: boolean) {
    if (this.btn) this.btn.textContent = connected ? '👟' : '🪑';
  }
}
let _accountCtl = (new AccountControl({ position: 'bottomright' })).addTo(map) as AccountControl;

// Set initial icon state & optional auto-sync when returning from Strava
apiMe()
  .then(me => _accountCtl.setIcon(!!me.connected))
  .catch(() => { /* keep default */ });

if (location.hash.includes('connected=strava')) {
  apiSync()
    .catch(() => {})
    .finally(async () => {
      try { _accountCtl.setIcon(!!(await apiMe()).connected); } catch {}
      // Optional: history.replaceState(null, '', location.pathname + location.search);
    });
}


// ===== Helpers =====
function paceSecToStr(sec?: number | null): string {
  if (!sec || sec <= 0) return '-';
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2,'0')}/km`;
}
function fmtKmBare(m: number | null | undefined){
  if (!m) return '0 Km';
  return (m / 1000).toFixed(2) + ' Km'; 
}
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


function polylineDistanceMeters(latlngs: [number, number][]): number {
  let d = 0;
  for (let i = 1; i < latlngs.length; i++) {
    const a = L.latLng(latlngs[i - 1][0], latlngs[i - 1][1]);
    const b = L.latLng(latlngs[i][0], latlngs[i][1]);
    d += a.distanceTo(b);
  }
  return d;
}

function addKmLabels(latlngs: [number, number][], totalMeters?: number) {
  kmLayer.clearLayers();
  if (!latlngs.length) return;

  const total = totalMeters ?? polylineDistanceMeters(latlngs);
  const kmCount = Math.floor(total / 1000);
  if (kmCount < 1) return;

  let cum = 0;
  let nextMark = 1000; // meters
  let k = 1;

  for (let i = 1; i < latlngs.length && k <= kmCount; i++) {
    const a = L.latLng(latlngs[i - 1][0], latlngs[i - 1][1]);
    const b = L.latLng(latlngs[i][0], latlngs[i][1]);
    const seg = a.distanceTo(b);

    while (cum + seg >= nextMark && k <= kmCount) {
      const t = (nextMark - cum) / seg; // 0..1 along segment
      const lat = a.lat + (b.lat - a.lat) * t;
      const lon = a.lng + (b.lng - a.lng) * t;

      // Invisible anchor marker with a permanent tooltip as the label
      const anchorless = L.divIcon({ 
        className: 'km-anchor',
        iconSize: [0,0],
        iconAnchor: [0,0]
      });
      L.marker([lat, lon], { icon: anchorless, interactive: false })
        .bindTooltip(`${k} km`, {
          permanent: true,
          direction: 'center',
          offset: [0, 0],
          className: 'km-tip',   // <- matches the CSS above
          pane: 'kmPane'
        })
        .addTo(kmLayer)
        .openTooltip();

      k++;
      nextMark += 1000;
    }

    cum += seg;
  }
}

async function downloadGPX(gpx: string, filename = 'route.gpx') {
  const type = 'application/gpx+xml';
  const blob = new Blob([gpx], { type });

  // file system access
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
  } catch {
    /* continue to next fallback */
  }

  // web share
  try {
    const n = navigator as any;
    if (n.share) {
      const file = new File([blob], filename, { type });
      await n.share({ files: [file], title: filename, text: 'GPX route' });
      return;
    }
  } catch {
    /* continue to next fallback */
  }

  // blob
  try {
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
    return;
  } catch {
    /* continue to next fallback */
  }
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

async function orsDirectionsFoot(coords: LonLat[]) {
  const key = getOrsKey();
  if (!key) { orsDegraded = true; updateEngineAvailability(); throw new Error('ORS key missing'); }
  const res = await fetch('https://api.openrouteservice.org/v2/directions/foot-walking/geojson', {
    method: 'POST',
    headers: { 'Authorization': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinates: coords }),
  });
  if (!res.ok) { if ([401,403,429].includes(res.status)) { orsDegraded = true; updateEngineAvailability(); } throw new Error('ORS HTTP ' + res.status); }
  const data = await res.json();
  const feat = data.features?.[0]; if (!feat) throw new Error('ORS: no route');
  const geometry = feat.geometry.coordinates as LonLat[];
  const summary  = feat.properties.summary as { distance: number, duration: number };
  return { geometry, distance: summary.distance, duration: summary.duration };
}

async function getRoute(coords: LonLat[]){
  const wantORS = engineORS.checked && !orsDegraded && !!getOrsKey();
  if (wantORS) {
    try {
      return await orsDirectionsFoot(coords);
    } catch {
      // fallback + gate ORS until key changes
      return await osrmDriving(coords);
    }
  }
  return await osrmDriving(coords);
  // try { return await osrmDriving(coords); }
  // catch { if (ORS_KEY) return await orsDriving(coords); throw new Error('Routing failed'); }
}

// ===== Routing & stats =====
async function renderRoute(){
  clearRouteLayer();
  baseDistanceM = 0;
  elevVal.textContent = etaVal.textContent = calVal.textContent = '-';
  distanceV.textContent = '0 Km';

  if (waypoints.length < 2){ kmLayer.clearLayers(); saveGpxBtn.disabled = true; return; }

  const coords = loopChk.checked ? [...waypoints, waypoints[0]] : waypoints.slice();

  try{
    const { geometry, distance } = await getRoute(coords);
    const latlngs = (geometry as LonLat[]).map(([lon,lat])=>[lat,lon]) as [number,number][];
    lastRouteLatLngs = latlngs;

    routeLayer = L.polyline(latlngs, {
      weight:5,
      opacity:.9,
      pane: 'routePane'
    }).addTo(map);
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

    saveGpxBtn.disabled = false;
    addKmLabels(latlngs, distance);
  } catch {
    distanceV.textContent = 'Error';
    saveGpxBtn.disabled = true;
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

function clearAll(){
  waypoints.length = 0;
  markers.forEach(m=>map.removeLayer(m));
  markers.length = 0;
  clearRouteLayer();
  elevVal.textContent = etaVal.textContent = calVal.textContent = '-';
  distanceV.textContent = '0 Km';
  kmLayer.clearLayers();
  saveGpxBtn.disabled = true;
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

// Settings toggle (on/off)
function setSettings(open: boolean){
  settingsPanel.classList.toggle('hidden', !open);
}
settingsClose.addEventListener('click', () => setSettings(false));

// Settings actions
clearBtn.addEventListener('click', clearAll);
reverseBtn.addEventListener('click', reverseRoute);
loopChk.addEventListener('change', renderRoute);

// Target inputs → recompute dependent stats
targetPaceI.addEventListener('input', () => renderRoute());
targetWeightI.addEventListener('input', () => renderRoute());

// save the route to gpx
saveGpxBtn.addEventListener('click', async () => {
  if (!lastRouteLatLngs.length) return;
  
  const markerLatLngs: [number, number][] = waypoints.map(([lon, lat]) => [lat, lon]);
  const gpx = toGPX(lastRouteLatLngs, {
    name: 'Planned route',
    markers: markerLatLngs,
  });
  downloadGPX(gpx, 'route.gpx');
});

// load gpx
loadGpxBtn.addEventListener('click', () => loadGpxInput.click());

loadGpxInput.addEventListener('change', async () => {
  const file = loadGpxInput.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const { route, markers: gpxMarkers } = fromGPX(text); // [lat, lon][]

    // 1) Clear current state/layers
    if (routeLayer) { clearAll(); }

    // 2) Draw route polyline
    lastRouteLatLngs = route.slice();
    routeLayer = L.polyline(route, {
      weight: 5,
      opacity: 0.9,
      pane: 'routePane'
    }).addTo(map);

    // 3) Refocus camera
    map.fitBounds(routeLayer.getBounds(), { padding: [20, 20] });

    // 4) Recreate markers from GPX (if present)
    if (gpxMarkers.length) {
      gpxMarkers.forEach(([lat, lon]) => {
        const m = L.marker([lat, lon], { draggable: true })
          .on('dragend', (ev: L.LeafletEvent) => {
            const ll = (ev.target as L.Marker).getLatLng();
            // update matching waypoint and re-render route (if you want recalculation)
            const idx = markers.indexOf(ev.target as L.Marker);
            if (idx >= 0) waypoints[idx] = [ll.lng, ll.lat];
          })
          .addTo(map);
        markers.push(m);
        waypoints.push([lon, lat]); // store as [lon, lat]
      });
      refreshLabels();
    }

    // 5) Update distance/ETA/elev/calorie
    // distance
    baseDistanceM = polylineDistanceMeters(route);
    distanceV.textContent = fmtKmBare(baseDistanceM)

    // ETA
    const pace = parsePaceSecPerKm(targetPaceI.value || '');
    const etaSec = pace ? (baseDistanceM / 1000) * pace : null;
    etaVal.textContent = pace && etaSec ? fmtHMS(etaSec) : '-';

    // elev
    elevVal.textContent = '...';
    const elev = await elevationStats(route)
    elevVal.textContent = elev ? `+${Math.round(elev.gain)} / -${Math.round(elev.loss)} m` : '-';

    // calories
    const weight = Number(targetWeightI.value);
    if (pace && weight && etaSec){
      const kcal = estimateKcalFromPaceWeight(baseDistanceM, pace, weight);
      calVal.textContent = Math.round(kcal).toString();
    } else {
      calVal.textContent = '-';
    }
    
    addKmLabels(route, baseDistanceM);

  } catch (err: any) {
    alert(`Failed to load GPX: ${err?.message ?? err}`);
  } finally {
    loadGpxInput.value = '';
  }
});
