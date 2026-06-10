import L from 'leaflet';
import { MAP_CONFIG } from '../../config/map';
import { GEOLOCATION_CONFIG } from '../../config/geolocation';

function createToggleControl(
  map: L.Map,
  position: L.ControlPosition,
  cssClass: string,
  title: string,
  emoji: string,
  onToggle: () => void,
) {
  const Control = L.Control.extend({
    onAdd() {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      const btn = L.DomUtil.create('a', cssClass, container) as HTMLAnchorElement;
      btn.href = '#';
      btn.title = title;
      btn.textContent = emoji;

      L.DomEvent.on(btn, 'click', L.DomEvent.stopPropagation)
        .on(btn, 'click', L.DomEvent.preventDefault)
        .on(btn, 'click', onToggle);
      return container;
    }
  });
  new Control({ position }).addTo(map);
}

export function createZoomControl(map: L.Map) {
  map.zoomControl?.remove();
  const zoomCtl = L.control.zoom({ position: 'bottomleft' }).addTo(map);
  const container = zoomCtl.getContainer();

  // GPS button
  const gpsBtn = L.DomUtil.create('a', 'leaflet-control-gps', container);
  gpsBtn.href = '#';
  gpsBtn.title = 'Use my location';
  gpsBtn.innerHTML = '📍';

  L.DomEvent.on(gpsBtn, 'click', (e: Event) => {
    L.DomEvent.stop(e);
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => map.flyTo(
        [pos.coords.latitude, pos.coords.longitude],
        Math.max(map.getZoom(), MAP_CONFIG.USER_LOCATION_ZOOM)
      ),
      () => {},
      GEOLOCATION_CONFIG.GEO_OPTIONS
    );
  });

  container?.insertBefore(gpsBtn, container.firstChild);
}

export function createUndoControl(map: L.Map, onUndo: () => void) {
  const UndoControl = L.Control.extend({
    options: { position: 'bottomleft' as L.ControlPosition },
    onAdd: () => {
      const bar = L.DomUtil.create('div', 'leaflet-bar');
      const a = L.DomUtil.create('a', 'leaflet-control-undo', bar);
      a.href = '#';
      a.title = 'Undo last waypoint';
      a.setAttribute('aria-label', 'Undo last waypoint');
      a.innerHTML = '⟲';

      L.DomEvent.on(a, 'click', (e: Event) => {
        L.DomEvent.stop(e);
        onUndo();
      });

      L.DomEvent.disableClickPropagation(bar);
      return bar;
    }
  });
  new UndoControl().addTo(map);
}

export function createSettingsControl(map: L.Map, settingsPanel: HTMLDivElement) {
  const SettingsToggle = L.Control.extend({
    onAdd() {
      const wrap = L.DomUtil.create('div', 'leaflet-control settings-toggle leaflet-bar');
      const btn = L.DomUtil.create('a', '', wrap);
      btn.href = '#';
      btn.title = 'Settings';
      btn.setAttribute('aria-label', 'Settings');
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
}

export function createStatsControls(map: L.Map): {
  elevVal: HTMLSpanElement;
  etaVal: HTMLSpanElement;
  calVal: HTMLSpanElement;
  distanceV: HTMLSpanElement;
} {
  const StatsControl = L.Control.extend({
    onAdd() {
      const el = L.DomUtil.create('div', 'panel stats');
      el.innerHTML = `
        <div><strong>Elev:</strong> <span id="elevVal">-</span></div>
        <div><strong>ETA:</strong> <span id="etaVal">-</span></div>
        <div><strong>kcal:</strong> <span id="calVal">-</span></div>
      `;
      L.DomEvent.disableClickPropagation(el);
      return el;
    }
  });

  const DistanceControl = L.Control.extend({
    onAdd() {
      const el = L.DomUtil.create('div', 'panel distance');
      el.innerHTML = '<span id="distanceVal">0 Km</span>';
      L.DomEvent.disableClickPropagation(el);
      return el;
    }
  });

  new StatsControl({ position: 'topleft' }).addTo(map);
  new DistanceControl({ position: 'topright' }).addTo(map);

  return {
    elevVal: document.getElementById('elevVal') as HTMLSpanElement,
    etaVal: document.getElementById('etaVal') as HTMLSpanElement,
    calVal: document.getElementById('calVal') as HTMLSpanElement,
    distanceV: document.getElementById('distanceVal') as HTMLSpanElement,
  };
}

type AccountControlHandle = L.Control & {
  setIcon: (connected: boolean) => void;
};

export function createAccountControl(
  map: L.Map,
  onToggle: () => void
): AccountControlHandle {
  class AccountControl extends L.Control {
    private btn!: HTMLAnchorElement;

    onAdd() {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      this.btn = L.DomUtil.create('a', 'account-btn', container) as HTMLAnchorElement;
      this.btn.href = '#';
      this.btn.title = 'Account';
      this.btn.textContent = '😴';

      L.DomEvent.on(this.btn, 'click', L.DomEvent.stopPropagation)
        .on(this.btn, 'click', L.DomEvent.preventDefault)
        .on(this.btn, 'click', onToggle);
      return container;
    }

    setIcon(connected: boolean) {
      if (this.btn) this.btn.textContent = connected ? '👟' : '😴';
    }
  }

  const control = new AccountControl({ position: 'bottomright' }).addTo(map);
  return control as AccountControlHandle;
}

export function createSearchControl(map: L.Map, onToggle: () => void) {
  createToggleControl(map, 'bottomright', 'search-btn', 'Search Location', '🔎', onToggle);
}

type MarkersControlHandle = L.Control & {
  setVisibility: (visible: boolean) => void;
};

export function createMarkersToggleControl(
  map: L.Map,
  kmLayer: L.LayerGroup,
  onToggle: (visible: boolean) => void
): MarkersControlHandle {
  class MarkersToggleControl extends L.Control {
    private btn!: HTMLAnchorElement;
    private markersVisible = true;

    onAdd() {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      this.btn = L.DomUtil.create('a', 'markers-toggle-btn', container) as HTMLAnchorElement;
      this.btn.href = '#';
      this.btn.title = 'Toggle Markers';
      this.btn.textContent = '😳';

      L.DomEvent.on(this.btn, 'click', L.DomEvent.stopPropagation)
        .on(this.btn, 'click', L.DomEvent.preventDefault)
        .on(this.btn, 'click', () => {
          this.markersVisible = !this.markersVisible;
          this.updateIcon();
          onToggle(this.markersVisible);
        });
      return container;
    }

    updateIcon() {
      if (this.btn) {
        this.btn.textContent = this.markersVisible ? '😳' : '🫣';
        this.btn.title = this.markersVisible ? 'Hide Markers' : 'Show Markers';
      }
    }

    setVisibility(visible: boolean) {
      this.markersVisible = visible;
      this.updateIcon();
    }
  }

  const control = new MarkersToggleControl({ position: 'bottomleft' }).addTo(map);
  return control as MarkersControlHandle;
}

export function createSaveRouteControl(map: L.Map, onToggle: () => void) {
  createToggleControl(map, 'bottomleft', 'save-route-btn', 'Save Route', '💾', onToggle);
}

export function createMyRoutesControl(map: L.Map, onToggle: () => void) {
  createToggleControl(map, 'bottomright', 'my-routes-btn', 'My Routes', '📂', onToggle);
}

export function createExploreRoutesControl(map: L.Map, onToggle: () => void) {
  createToggleControl(map, 'bottomright', 'explore-routes-btn', 'Explore Routes', '🗺️', onToggle);
}
