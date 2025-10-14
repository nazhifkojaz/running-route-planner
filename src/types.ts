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

export interface GeoJSONGeometry {
  type: 'LineString';
  coordinates: [number, number][]; // [lon, lat][]
  properties?: {
    waypoints?: [number, number][]; // [lon, lat][]
  };
}

export interface RouteCreateData {
  name: string;
  description?: string;
  distance_m: number;
  city?: string;
  country?: string;
  elevation_gain_m?: number;
  elevation_loss_m?: number;
  visibility: 'private' | 'public';
  geometry?: GeoJSONGeometry;
}

export interface RouteUpdateData {
  name?: string;
  description?: string;
  city?: string;
  country?: string;
  elevation_gain_m?: number;
  elevation_loss_m?: number;
  visibility?: 'private' | 'public';
}

export interface SavedRoute {
  id: string;
  user_id: string;
  username_snapshot?: string;
  name: string;
  description?: string;
  distance_m: number;
  city?: string;
  country?: string;
  elevation_gain_m?: number;
  elevation_loss_m?: number;
  visibility: 'private' | 'public';
  geometry?: GeoJSONGeometry;
  created_at: string;
  updated_at: string;
}

export interface RouteListItem {
  id: string;
  user_id: string;
  username_snapshot?: string;
  name: string;
  description?: string;
  distance_m: number;
  city?: string;
  country?: string;
  elevation_gain_m?: number;
  elevation_loss_m?: number;
  visibility: 'private' | 'public';
  has_geometry: boolean;
  created_at: string;
}

export interface RoutesListResponse {
  routes: RouteListItem[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface LocationInfo {
  city?: string;
  country?: string;
  full_address?: string;
}

export interface PanelElements {
  settingsPanel: HTMLDivElement;
  userPanel: HTMLDivElement;
  backdrop: HTMLDivElement;
  searchPanel: HTMLDivElement;
  saveRoutePanel: HTMLDivElement;
  explorePanel: HTMLDivElement;
  myRoutesPanel: HTMLDivElement;
}