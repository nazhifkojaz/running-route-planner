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
import { state } from './state';
import { RoutingService } from './routing';
import { 
  createZoomControl, 
  createUndoControl, 
  createSettingsControl,
  createStatsControls,
  createAccountControl,
  createSearchControl,
  createMarkersToggleControl,
  createSaveRouteControl,
  createMyRoutesControl,
  createExploreRoutesControl
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
  openSettingsPanel,
  closeSettingsPanel 
} from './panels/settingsPanel';
import {
  createSearchPanel,
  openSearchPanel,
  closeSearchPanel,
  setupSearchPanel
} from './panels/searchPanel';
import {
  createSaveRoutePanel,
  openSaveRoutePanel,
  closeSaveRoutePanel,
  setupSaveRoutePanel
} from './panels/saveRoutePanel';
import {
  createExplorePanel,
  openExplorePanel,
  closeExplorePanel,
  setupExplorePanel
} from './panels/explorePanel';
import {
  createMyRoutesPanel,
  openMyRoutesPanel,
  closeMyRoutesPanel,
  setupMyRoutesPanel
} from './panels/myRoutesPanel';
import { initAnalytics, trackEvent } from './analytics';

// Fix Leaflet marker icons
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
    closeSaveRoutePanel(dom.saveRoutePanel, dom.saveRouteBackdrop);
    closeExplorePanel(dom.explorePanel, dom.exploreBackdrop);
    closeMyRoutesPanel(dom.myRoutesPanel, dom.myRoutesBackdrop);
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
  const { panel: saveRoutePanel, backdrop: saveRouteBackdrop } = createSaveRoutePanel();
  const { panel: explorePanel, backdrop: exploreBackdrop } = createExplorePanel();
  const { panel: myRoutesPanel, backdrop: myRoutesBackdrop } = createMyRoutesPanel();

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
    userClose: document.getElementById('userClose') as HTMLButtonElement,
    backdrop,
    searchPanel,
    searchBackdrop,
    saveRoutePanel,
    saveRouteBackdrop,
    explorePanel,
    exploreBackdrop,
    myRoutesPanel,
    myRoutesBackdrop,
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
  
  // Markers toggle control (bottom-left, above undo)
  const markersToggle = createMarkersToggleControl(map, kmLayer, (visible) => {
    // Toggle km markers
    if (visible) {
      kmLayer.addTo(map);
    } else {
      map.removeLayer(kmLayer);
    }
    
    // Toggle waypoint markers
    state.markers.forEach(marker => {
      if (visible) {
        marker.addTo(map);
      } else {
        map.removeLayer(marker);
      }
    });
    
    trackEvent('markers_toggled', { visible });
  });

  // Save Route control (bottom-left, above GPS)
  createSaveRouteControl(map, () => {
    if (!state.lastRouteLatLngs.length || state.baseDistanceM === 0) {
      alert('No route to save. Please create a route first.');
      return;
    }

    // Get elevation data
    const elevText = stats.elevVal.textContent || '';
    const elevMatch = elevText.match(/\+(\d+) \/ -(\d+) m/);
    const elevation_gain_m = elevMatch ? parseFloat(elevMatch[1]) : undefined;
    const elevation_loss_m = elevMatch ? parseFloat(elevMatch[2]) : undefined;

    openSaveRoutePanel(saveRoutePanel, saveRouteBackdrop, {
      distance_m: state.baseDistanceM,
      elevation_gain_m,
      elevation_loss_m
    });
  });
  
  createSettingsControl(map, settingsPanel);

  // Bottom-right controls (in order from top to bottom)
  
  // Explore Routes control
  createExploreRoutesControl(map, () => {
    if (explorePanel.classList.contains('hidden')) {
      openExplorePanel(explorePanel, exploreBackdrop);
    } else {
      closeExplorePanel(explorePanel, exploreBackdrop);
    }
  });

  
  // My Routes control
  const loadMyRoutes = setupMyRoutesPanel(myRoutesPanel, myRoutesBackdrop, map, routeManager);
  createMyRoutesControl(map, () => {
    if (myRoutesPanel.classList.contains('hidden')) {
      openMyRoutesPanel(myRoutesPanel, myRoutesBackdrop, loadMyRoutes);
    } else {
      closeMyRoutesPanel(myRoutesPanel, myRoutesBackdrop);
    }
  });

  // Search control
  createSearchControl(map, () => {
    if (searchPanel.classList.contains('hidden')) {
      openSearchPanel(searchPanel, searchBackdrop);
    } else {
      closeSearchPanel(searchPanel, searchBackdrop);
    }
  });

  // Setup search panel functionality
  setupSearchPanel(map, searchPanel, searchBackdrop);

  // Setup save route panel
  setupSaveRoutePanel(saveRoutePanel, saveRouteBackdrop, () => {
    // Success callback - optionally open My Routes
    console.log('Route saved successfully!');
  });

  // Setup explore panel
  setupExplorePanel(explorePanel, exploreBackdrop, map, routeManager);

  // Setup my routes panel
  setupMyRoutesPanel(myRoutesPanel, myRoutesBackdrop, map, routeManager);

  // Account control (at the bottom)
  const accountControl = createAccountControl(map, () => {
    if (userPanel.classList.contains('hidden')) {
      openUserPanel(userPanel, userContent, backdrop, accountControl);
    } else {
      closeUserPanel(userPanel, backdrop);
    }
  });
  await initAccountIcon(accountControl);

  // Event handlers
  setupEventHandlers(map, routeManager, accountControl, dom);

  console.log('Running Route Planner initialized');
}

init().catch(err => console.error('Failed to initialize:', err));