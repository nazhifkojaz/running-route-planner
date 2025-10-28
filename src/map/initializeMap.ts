import L from 'leaflet';
import { CONFIG } from '../config';

export interface MapContext {
  map: L.Map;
  kmLayer: L.LayerGroup;
}

export function initializeMap(containerId = 'map'): MapContext {
  const map = L.map(containerId);

  const routePane = map.createPane('routePane');
  routePane.style.zIndex = CONFIG.Z_INDEX.ROUTE_PANE;

  const kmPane = map.createPane('kmPane');
  kmPane.style.zIndex = CONFIG.Z_INDEX.KM_PANE;

  map.setView(CONFIG.DEFAULT_LOCATION, CONFIG.DEFAULT_ZOOM);
  L.tileLayer(CONFIG.TILE_URL, {
    maxZoom: CONFIG.MAX_ZOOM,
    attribution: CONFIG.TILE_ATTRIBUTION,
  }).addTo(map);

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => map.setView(
        [pos.coords.latitude, pos.coords.longitude],
        CONFIG.USER_LOCATION_ZOOM
      ),
      () => {},
      CONFIG.GEO_OPTIONS
    );
  }

  const kmLayer = L.layerGroup().addTo(map);
  return { map, kmLayer };
}
