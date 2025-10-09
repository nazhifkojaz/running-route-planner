export const CONFIG = {
  // API Configuration
  API_BASE: 'https://running-route-planner.vercel.app',
  
  // Map Configuration
  DEFAULT_LOCATION: [-2.9909, 104.7566] as [number, number], // Palembang
  DEFAULT_ZOOM: 13,
  USER_LOCATION_ZOOM: 14,
  MAX_ZOOM: 19,
  
  // Tile Layer
  TILE_URL: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  TILE_ATTRIBUTION: '&copy; OpenStreetMap contributors',
  
  // Route Configuration
  ROUTE_WEIGHT: 5,
  ROUTE_OPACITY: 0.9,
  FIT_BOUNDS_PADDING: [20, 20] as [number, number],
  
  // Geolocation
  GEO_OPTIONS: {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 30000
  },
  
  // Local Storage Keys
  STORAGE_KEYS: {
    SESSION_TOKEN: 'session_token',
    ORS_KEY: 'ors_key'
  },
  
  // Routing
  OSRM_BASE: 'https://router.project-osrm.org',
  ORS_BASE: 'https://api.openrouteservice.org',
  
  // UI Z-Indexes
  Z_INDEX: {
    ROUTE_PANE: '450',
    KM_PANE: '800'
  }
} as const;

export type AppConfig = typeof CONFIG;