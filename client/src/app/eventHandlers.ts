import type L from 'leaflet';
import { closeExplorePanel } from '../panels/explorePanel';
import { closeMyRoutesPanel } from '../panels/myRoutesPanel';
import { closeSaveRoutePanel } from '../panels/saveRoutePanel';
import { closeSearchPanel } from '../panels/searchPanel';
import { closeSettingsPanel } from '../panels/settingsPanel';
import { closeUserPanel } from '../panels/userPanel';
import type { RouteManager } from '../routing/routeManager';
import { trackEvent } from '../services/analytics';
import { state } from '../state';
import { loadGPX, saveGPX } from '../storage/gpxManager';
import type { DomRefs } from './dom';

interface EventHandlerConfig {
  map: L.Map;
  routeManager: RouteManager;
  dom: DomRefs;
}

export function setupEventHandlers({ map, routeManager, dom }: EventHandlerConfig) {
  map.on('click', (e: L.LeafletMouseEvent) => {
    closeSettingsPanel(dom.settingsPanel);
    closeUserPanel(dom.userPanel, dom.backdrop);
    closeSearchPanel(dom.searchPanel, dom.backdrop);
    closeSaveRoutePanel(dom.saveRoutePanel, dom.backdrop);
    closeExplorePanel(dom.explorePanel, dom.backdrop);
    closeMyRoutesPanel(dom.myRoutesPanel, dom.backdrop);
    routeManager.addWaypoint(e.latlng.lat, e.latlng.lng);
  });

  dom.settingsClose.addEventListener('click', () => {
    closeSettingsPanel(dom.settingsPanel);
  });

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

  const updateRoutingEngine = () => {
    routeManager.renderRoute();
    trackEvent('routing_engine_changed', {
      engine: dom.engineORS.checked ? 'pedestrian_trail' : 'road_running',
    });
  };
  dom.engineOSRM.addEventListener('change', updateRoutingEngine);
  dom.engineORS.addEventListener('change', updateRoutingEngine);

  const updateEtaCal = () => {
    if (state.baseDistanceM > 0 && state.lastRouteLatLngs.length > 0) {
      routeManager.updateStats(state.baseDistanceM, state.lastRouteLatLngs);
    }
  };
  dom.targetPaceInput.addEventListener('input', updateEtaCal);
  dom.targetWeightInput.addEventListener('input', updateEtaCal);

  dom.saveGpxBtn.addEventListener('click', () => saveGPX());
  dom.loadGpxBtn.addEventListener('click', () => dom.loadGpxInput.click());
  dom.loadGpxInput.addEventListener('change', async () => {
    const file = dom.loadGpxInput.files?.[0];
    if (!file) return;
    await loadGPX(file, map, routeManager);
    dom.loadGpxInput.value = '';
  });

  dom.userClose.addEventListener('click', () => closeUserPanel(dom.userPanel, dom.backdrop));
  dom.backdrop.addEventListener('click', () => closeUserPanel(dom.userPanel, dom.backdrop));
}
