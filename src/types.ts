export type LonLat = [number, number]; // [longitude, latitude]
export type LatLng = [number, number]; // [latitude, longitude] - Leaflet thingies

export interface RouteResult {
  geometry: LonLat[];
  distance: number;
  duration?: number;
}

export interface MeResponse {
  connected: boolean;
  strava_athlete_id?: number;
  username?: string | null;
  weight_kg?: number | null;
  run_count_all?: number | null;
  run_distance_all_m?: number | null;
  avg_pace_5_sec_per_km?: number | null;
  avg_hr_5?: number | null;
}

export interface StatsDisplay {
  elevation: string;
  eta: string;
  calories: string;
  distance: string;
}

export interface RoutingEngine {
  type: 'osrm' | 'ors';
  available: boolean;
  degraded?: boolean;
}

export interface AppState {
  waypoints: LonLat[];
  markers: L.Marker[];
  routeLayer: L.Polyline | null;
  baseDistanceM: number;
  lastRouteLatLngs: LatLng[];
  orsDegraded: boolean;
}