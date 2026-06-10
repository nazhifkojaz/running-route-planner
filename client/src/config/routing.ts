export const ROUTING_CONFIG = {
  ROUTE_WEIGHT: 5,
  ROUTE_OPACITY: 0.9,
  FIT_BOUNDS_PADDING: [20, 20] as [number, number],
  OSRM_BASE: 'https://router.project-osrm.org',
  ORS_BASE: 'https://api.openrouteservice.org',
  ROAD_RUNNING_CACHE_LIMIT: 200,
  ROAD_RUNNING_COORD_PRECISION: 5,
} as const;

export const ROUTE_STYLE = {
  weight: ROUTING_CONFIG.ROUTE_WEIGHT,
  opacity: ROUTING_CONFIG.ROUTE_OPACITY,
  pane: 'routePane',
} as const;
