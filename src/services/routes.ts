import { CONFIG } from '../config';
import type {
    GeoJSONGeometry,
    LatLng,
    RouteCreateData,
    RoutesListResponse,
    RouteUpdateData,
    SavedRoute
} from '../types';


function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem(CONFIG.STORAGE_KEYS.SESSION_TOKEN);
  return token 
    ? { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    : { 'Content-Type': 'application/json' };
}

export function latlngsToGeoJSON(
  route: LatLng[],
  waypoints?: LatLng[]
): GeoJSONGeometry {
  return {
    type: 'LineString',
    coordinates: route.map(([lat, lon]) => [lon, lat]),
    properties: waypoints ? {
      waypoints: waypoints.map(([lat, lon]) => [lon, lat])
    } : undefined
  };
}

export function geoJSONToLatLngs(geometry: GeoJSONGeometry): {
  route: LatLng[];
  waypoints?: LatLng[];
} {
  const route: LatLng[] = geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  const waypoints = geometry.properties?.waypoints?.map(([lon, lat]) => [lat, lon] as LatLng);
  
  return { route, waypoints };
}

export async function createRoute(data: RouteCreateData): Promise<SavedRoute> {
  const response = await fetch(`${CONFIG.API_BASE}/routes`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Please sign in to save routes');
    }
    const error = await response.json().catch(() => ({ detail: 'Failed to save route' }));
    throw new Error(error.detail || 'Failed to save route');
  }

  return response.json();
}

export async function getMyRoutes(
  limit = 50,
  offset = 0
): Promise<RoutesListResponse> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`${CONFIG.API_BASE}/routes/me?${params}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Please sign in to view your routes');
    }
    throw new Error('Failed to load routes');
  }

  return response.json();
}

export async function exploreRoutes(options: {
  limit?: number;
  offset?: number;
  city?: string;
  country?: string;
  min_distance_km?: number;
  max_distance_km?: number;
} = {}): Promise<RoutesListResponse> {
  const params = new URLSearchParams();
  
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.offset) params.set('offset', options.offset.toString());
  if (options.city) params.set('city', options.city);
  if (options.country) params.set('country', options.country);
  if (options.min_distance_km) params.set('min_distance_km', options.min_distance_km.toString());
  if (options.max_distance_km) params.set('max_distance_km', options.max_distance_km.toString());

  const response = await fetch(`${CONFIG.API_BASE}/routes/explore?${params}`);

  if (!response.ok) {
    throw new Error('Failed to load public routes');
  }

  return response.json();
}

export async function getRoute(routeId: string): Promise<SavedRoute> {
  const response = await fetch(`${CONFIG.API_BASE}/routes/${routeId}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Route not found');
    }
    if (response.status === 403) {
      throw new Error('Access denied');
    }
    throw new Error('Failed to load route');
  }

  return response.json();
}

export async function updateRoute(
  routeId: string,
  data: RouteUpdateData
): Promise<SavedRoute> {
  const response = await fetch(`${CONFIG.API_BASE}/routes/${routeId}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Please sign in');
    }
    if (response.status === 404) {
      throw new Error('Route not found');
    }
    throw new Error('Failed to update route');
  }

  return response.json();
}

export async function deleteRoute(routeId: string): Promise<void> {
  const response = await fetch(`${CONFIG.API_BASE}/routes/${routeId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Please sign in');
    }
    if (response.status === 404) {
      throw new Error('Route not found');
    }
    throw new Error('Failed to delete route');
  }
}
