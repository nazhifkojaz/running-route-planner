/// <reference types="vite/client" />
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import './css/style.css';
import './css/panels.css';

// Modules
import { CONFIG } from './config';
import { readHashParam } from './utils';
import { RoutingService } from './routing';
import { 
  createZoomControl, 
  createUndoControl, 
  createSettingsControl,
  createStatsControls,
  createAccountControl,
  createSearchControl
} from './controls';
import { RouteManager } from './route';
import { saveGPX, loadGPX } from './gpxManager';
import { 
  createUserPanel,
  openUserPanel, 
  closeUserPanel, 
  initAccountIcon 
} from './panels/userPanel';
import { 
  createSettingsPanel,
  closeSettingsPanel 
} from './panels/settingsPanel';
import {
  createSearchPanel,
  openSearchPanel,
  closeSearchPanel,
  setupSearchPanel
} from './panels/searchPanel';
import { initAnalytics, trackEvent } from './analytics';

// @ts-ignore
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

// Session management
function handleHashSession() {
  const sessionFromHash = readHashParam('session');
  if (sessionFromHash) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.SESSION_TOKEN, sessionFromHash);
    const params = new URLSearchParams(location.hash.slice(1));
    params.delete('session');
    const newHash = params.size ? '#' + params.toString() : '';
    history.replaceState(null, '', location.pathname + (location.search || '') + newHash);
  }
}

// Map initialization
function initMap() {
  const map = L.map('map');
  const routePane = map.createPane('routePane');
  routePane.style.zIndex = CONFIG.Z_INDEX.ROUTE_PANE;
  const kmPane = map.createPane('kmPane');
  kmPane.style.zIndex = CONFIG.Z_INDEX.KM_PANE;

  map.setView(CONFIG.DEFAULT_LOCATION, CONFIG.DEFAULT_ZOOM);
  L.tileLayer(CONFIG.TILE_URL, {
    maxZoom: CONFIG.MAX_ZOOM,
    attribution: CONFIG.TILE_ATTRIBUTION
  }).addTo(map);

  // Try user location
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], CONFIG.USER_LOCATION_ZOOM),
      () => {},
      CONFIG.GEO_OPTIONS
    );
  }

  return { map, kmLayer: L.layerGroup().addTo(map) };
}

// Event handlers
function setupEventHandlers(
  map: L.Map,
  routeManager: RouteManager,
  accountControl: { setIcon: (connected: boolean) => void },
  dom: any
) {
  // Map click - add waypoint
  map.on('click', (e: L.LeafletMouseEvent) => {
    closeSettingsPanel(dom.settingsPanel);
    closeUserPanel(dom.userPanel, dom.backdrop);
    closeSearchPanel(dom.searchPanel, dom.searchBackdrop);
    routeManager.addWaypoint(e.latlng.lat, e.latlng.lng);
  });

  // Settings
  dom.settingsClose.addEventListener('click', () => {
    closeSettingsPanel(dom.settingsPanel);
  });

  // Route actions
  dom.clearBtn.addEventListener('click', () => {
    routeManager.clearAll();
    trackEvent('route_cleared');
  });

  dom.reverseBtn.addEventListener('click', () => {
    routeManager.reverseRoute();
    trackEvent('route_reversed');
  });

  dom.loopChk.addEventListener('change', () => {
    routeManager.renderRoute();
    trackEvent('loop_toggled', { enabled: dom.loopChk.checked });
  });

  // Target inputs
  dom.targetPaceI.addEventListener('input', () => routeManager.renderRoute());
  dom.targetWeightI.addEventListener('input', () => routeManager.renderRoute());

  // GPX
  dom.saveGpxBtn.addEventListener('click', () => saveGPX());
  dom.loadGpxBtn.addEventListener('click', () => dom.loadGpxInput.click());
  dom.loadGpxInput.addEventListener('change', async () => {
    const file = dom.loadGpxInput.files?.[0];
    if (!file) return;
    await loadGPX(file, map, routeManager);
    dom.loadGpxInput.value = '';
  });

  // User panel
  dom.userClose.addEventListener('click', () => closeUserPanel(dom.userPanel, dom.backdrop));
  dom.backdrop.addEventListener('click', () => closeUserPanel(dom.userPanel, dom.backdrop));
}

// App initialization
async function init() {
  initAnalytics();
  trackEvent('app_loaded');
  handleHashSession();

  const { map, kmLayer } = initMap();

  // Create panels dynamically
  const settingsPanel = createSettingsPanel();
  const { panel: userPanel, content: userContent, backdrop } = createUserPanel();
  const { panel: searchPanel, backdrop: searchBackdrop } = createSearchPanel();

  // Get DOM references after panels are created
  const dom = {
    settingsPanel,
    settingsClose: document.getElementById('settingsClose') as HTMLButtonElement,
    clearBtn: document.getElementById('clearBtn') as HTMLButtonElement,
    reverseBtn: document.getElementById('reverseBtn') as HTMLButtonElement,
    saveGpxBtn: document.getElementById('saveGpxBtn') as HTMLButtonElement,
    loadGpxBtn: document.getElementById('loadGpxBtn') as HTMLButtonElement,
    loadGpxInput: document.getElementById('loadGpxInput') as HTMLInputElement,
    loopChk: document.getElementById('loop') as HTMLInputElement,
    targetPaceI: document.getElementById('targetPace') as HTMLInputElement,
    targetWeightI: document.getElementById('targetWeight') as HTMLInputElement,
    engineOSRM: document.getElementById('engineOSRM') as HTMLInputElement,
    engineORS: document.getElementById('engineORS') as HTMLInputElement,
    engineNote: document.getElementById('engineNote') as HTMLParagraphElement,
    orsKeyInput: document.getElementById('orsKey') as HTMLInputElement,
    userPanel,
    userContent,
    searchPanel,
    searchBackdrop,
    userClose: document.getElementById('userClose') as HTMLButtonElement,
    backdrop,
  };

  // Routing service
  const routing = new RoutingService(
    dom.orsKeyInput,
    dom.engineORS,
    dom.engineNote
  );
  routing.updateEngineAvailability();
  routing.initOrsKey();

  // Map controls
  const stats = createStatsControls(map);
  
  // Route manager
  const routeManager = new RouteManager(
    map,
    kmLayer,
    stats,
    routing,
    dom.loopChk,
    dom.targetPaceI,
    dom.targetWeightI,
    dom.saveGpxBtn
  );

  // Setup controls
  createZoomControl(map);
  createUndoControl(map, () => routeManager.undoLastWaypoint());
  createSettingsControl(map, settingsPanel);

  // Account control
  const accountControl = createAccountControl(map, () => {
    if (userPanel.classList.contains('hidden')) {
      openUserPanel(userPanel, userContent, backdrop, accountControl);
    } else {
      closeUserPanel(userPanel, backdrop);
    }
  });
  await initAccountIcon(accountControl);
  
  // Search control (above account button)
  createSearchControl(map, () => {
    if (searchPanel.classList.contains('hidden')) {
      openSearchPanel(searchPanel, searchBackdrop);
    } else {
      closeSearchPanel(searchPanel, searchBackdrop);
    }
  });

  // Setup search panel functionality
  setupSearchPanel(map, searchPanel, searchBackdrop);

  // Event handlers
  setupEventHandlers(map, routeManager, accountControl, dom);

  console.log('Running Route Planner initialized');
}

init().catch(err => console.error('Failed to initialize:', err));