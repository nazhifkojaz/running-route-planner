export const MAP_CONFIG = {
  DEFAULT_LOCATION: [-2.9909, 104.7566] as [number, number], // Palembang
  DEFAULT_ZOOM: 13,
  USER_LOCATION_ZOOM: 14,
  MAX_ZOOM: 19,
  TILE_URL: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  TILE_ATTRIBUTION: '&copy; OpenStreetMap contributors',
} as const;
