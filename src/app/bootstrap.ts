import {
  createAccountControl,
  createExploreRoutesControl,
  createMarkersToggleControl,
  createMyRoutesControl,
  createSaveRouteControl,
  createSearchControl,
  createSettingsControl,
  createStatsControls,
  createUndoControl,
  createZoomControl,
} from '../map/controls';
import { initializeMap } from '../map/initializeMap';
import {
  closeExplorePanel,
  openExplorePanel,
  setupExplorePanel,
} from '../panels/explorePanel';
import {
  closeMyRoutesPanel,
  openMyRoutesPanel,
  setupMyRoutesPanel,
} from '../panels/myRoutesPanel';
import {
  openSaveRoutePanel,
  setupSaveRoutePanel,
} from '../panels/saveRoutePanel';
import {
  closeSearchPanel,
  openSearchPanel,
  setupSearchPanel,
} from '../panels/searchPanel';
import {
  closeUserPanel,
  initAccountIcon,
  openUserPanel,
} from '../panels/userPanel';
import { RouteManager } from '../routing/routeManager';
import { RoutingService } from '../routing/routingService';
import { initAnalytics, trackEvent } from '../services/analytics';
import { state } from '../state';
import { collectDomRefs } from './dom';
import { setupEventHandlers } from './eventHandlers';
import { setupKeyboardShortcuts } from './keyboardShortcuts';
import { initializePanels } from './panels';
import { handleHashSession } from './session';

export async function bootstrapApp() {
  initAnalytics();
  trackEvent('app_loaded');
  handleHashSession();

  const { map, kmLayer } = initializeMap();

  const panels = initializePanels();
  const dom = collectDomRefs(panels);

  const routing = new RoutingService(
    dom.orsKeyInput,
    dom.engineORS,
    dom.engineNote
  );
  routing.updateEngineAvailability();
  routing.initOrsKey();

  const stats = createStatsControls(map);

  const routeManager = new RouteManager(
    map,
    kmLayer,
    stats,
    routing,
    dom.loopChk,
    dom.targetPaceInput,
    dom.targetWeightInput,
    dom.saveGpxBtn
  );

  createZoomControl(map);
  createUndoControl(map, () => routeManager.undoLastWaypoint());

  const markersToggle = createMarkersToggleControl(
    map,
    kmLayer,
    (visible) => {
      if (visible) {
        kmLayer.addTo(map);
      } else {
        map.removeLayer(kmLayer);
      }

      state.markers.forEach((marker) => {
        if (visible) {
          marker.addTo(map);
        } else {
          map.removeLayer(marker);
        }
      });

      trackEvent('markers_toggled', { visible });
    }
  );

  createSaveRouteControl(map, () => {
    if (!state.lastRouteLatLngs.length || state.baseDistanceM === 0) {
      alert('No route to save. Please create a route first.');
      return;
    }

    const elevText = stats.elevVal.textContent || '';
    const elevMatch = elevText.match(/\+(\d+) \/ -(\d+) m/);
    const elevation_gain_m = elevMatch ? parseFloat(elevMatch[1]) : undefined;
    const elevation_loss_m = elevMatch ? parseFloat(elevMatch[2]) : undefined;

    openSaveRoutePanel(dom.saveRoutePanel, dom.backdrop, {
      distance_m: state.baseDistanceM,
      elevation_gain_m,
      elevation_loss_m,
    });
  });

  createSettingsControl(map, dom.settingsPanel);

  createExploreRoutesControl(map, () => {
    if (dom.explorePanel.classList.contains('hidden')) {
      openExplorePanel(dom.explorePanel, dom.backdrop);
    } else {
      closeExplorePanel(dom.explorePanel, dom.backdrop);
    }
  });

  const loadMyRoutes = setupMyRoutesPanel(
    dom.myRoutesPanel,
    dom.backdrop,
    map,
    routeManager
  );

  createMyRoutesControl(map, () => {
    if (dom.myRoutesPanel.classList.contains('hidden')) {
      openMyRoutesPanel(dom.myRoutesPanel, dom.backdrop, loadMyRoutes);
    } else {
      closeMyRoutesPanel(dom.myRoutesPanel, dom.backdrop);
    }
  });

  createSearchControl(map, () => {
    if (dom.searchPanel.classList.contains('hidden')) {
      openSearchPanel(dom.searchPanel, dom.backdrop);
    } else {
      closeSearchPanel(dom.searchPanel, dom.backdrop);
    }
  });

  setupSearchPanel(map, dom.searchPanel, dom.backdrop);
  setupSaveRoutePanel(dom.saveRoutePanel, dom.backdrop, () => {
    loadMyRoutes();
  });
  setupExplorePanel(dom.explorePanel, dom.backdrop, map, routeManager);

  const accountControl = createAccountControl(map, () => {
    if (dom.userPanel.classList.contains('hidden')) {
      openUserPanel(dom.userPanel, dom.userContent, dom.backdrop, accountControl);
    } else {
      closeUserPanel(dom.userPanel, dom.backdrop);
    }
  });
  await initAccountIcon(accountControl);

  setupEventHandlers({ map, routeManager, dom });

  setupKeyboardShortcuts(routeManager, {
    settingsPanel: dom.settingsPanel,
    userPanel: dom.userPanel,
    backdrop: dom.backdrop,
    searchPanel: dom.searchPanel,
    saveRoutePanel: dom.saveRoutePanel,
    explorePanel: dom.explorePanel,
    myRoutesPanel: dom.myRoutesPanel,
  });

  markersToggle.setVisibility(true);
  console.log('Running Route Planner initialized');
}
