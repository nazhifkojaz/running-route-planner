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
const saveGpxBtn  = document.getElementById('saveGpxBtn') as HTMLButtonElement;
const loadGpxBtn  = document.getElementById('loadGpxBtn') as HTMLButtonElement;
const loadGpxInput= document.getElementById('loadGpxInput') as HTMLInputElement;


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

// ===== State =====
const waypoints: LonLat[] = [];
const markers: L.Marker[] = [];
const kmLayer = L.layerGroup().addTo(map);
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

function downloadGPX(gpx: string, filename = 'route.gpx') {
  const typeShare = 'application/gpx+xml';
  const typeBlob  = 'application/octet-stream';

  // web share
  const navAny = navigator as any;
  if (navAny?.share && navAny?.canShare?.({files: [new File([gpx], filename, { type: typeShare })] })) {
    navAny.share({
      files: [new File([gpx], filename, { type: typeShare })],
      title: filename,
      text: 'GPX route'
    }).catch(() => {/* User canceled or share not available, goes to fallback method */});
    return; // don't run the fallback if succeed
  }

  // fallback using blob link
  const blob = new Blob([gpx], { type: typeBlob });
  const url  = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    a.remove();
    try { URL.revokeObjectURL(url); } catch {}
  }, 3000);
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
