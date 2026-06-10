import L from 'leaflet';
import { MAP_CONFIG } from '../config/map';
import { UI_CONFIG } from '../config/ui';
import { GEOLOCATION_CONFIG } from '../config/geolocation';

export function initializeMap(containerId = 'map'): { map: L.Map; kmLayer: L.LayerGroup } {
  const map = L.map(containerId);

  const routePane = map.createPane('routePane');
  routePane.style.zIndex = UI_CONFIG.Z_INDEX.ROUTE_PANE;

  const kmPane = map.createPane('kmPane');
  kmPane.style.zIndex = UI_CONFIG.Z_INDEX.KM_PANE;

  map.setView(MAP_CONFIG.DEFAULT_LOCATION, MAP_CONFIG.DEFAULT_ZOOM);
  L.tileLayer(MAP_CONFIG.TILE_URL, {
    maxZoom: MAP_CONFIG.MAX_ZOOM,
    attribution: MAP_CONFIG.TILE_ATTRIBUTION,
  }).addTo(map);

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => map.setView(
        [pos.coords.latitude, pos.coords.longitude],
        MAP_CONFIG.USER_LOCATION_ZOOM
      ),
      () => {},
      GEOLOCATION_CONFIG.GEO_OPTIONS
    );
  }

  const kmLayer = L.layerGroup().addTo(map);
  return { map, kmLayer };
}
