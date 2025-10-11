import { LocationInfo } from "./types";

interface NominatimResponse {
  address: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
  display_name: string;
}

/**
 * Get location info from coordinates using reverse geocoding
 * Uses the first point of the route (starting location)
 */
export async function reverseGeocode(lat: number, lon: number): Promise<LocationInfo | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RunningRoutePlanner/1.0'
      }
    });

    if (!response.ok) {
      console.warn('Reverse geocoding failed:', response.status);
      return null;
    }

    const data: NominatimResponse = await response.json();
    
    // Extract city (try multiple fields as different places use different naming)
    const city = data.address.city 
      || data.address.town 
      || data.address.village 
      || data.address.municipality 
      || data.address.county
      || data.address.state;

    const country = data.address.country;

    return {
      city: city || undefined,
      country: country || undefined,
      full_address: data.display_name
    };

  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * Get location from route's starting point
 */
export async function getRouteLocation(routeLatLngs: [number, number][]): Promise<LocationInfo | null> {
  if (!routeLatLngs || routeLatLngs.length === 0) {
    return null;
  }

  // Use the first point (starting location)
  const [lat, lon] = routeLatLngs[0];
  return reverseGeocode(lat, lon);
}

/**
 * Get location from route center (alternative approach)
 * Useful if the route spans multiple areas
 */
export async function getRouteCenterLocation(routeLatLngs: [number, number][]): Promise<LocationInfo | null> {
  if (!routeLatLngs || routeLatLngs.length === 0) {
    return null;
  }

  // Calculate center point
  let sumLat = 0;
  let sumLon = 0;
  
  for (const [lat, lon] of routeLatLngs) {
    sumLat += lat;
    sumLon += lon;
  }
  
  const centerLat = sumLat / routeLatLngs.length;
  const centerLon = sumLon / routeLatLngs.length;

  return reverseGeocode(centerLat, centerLon);
}

/**
 * Debounced reverse geocoding for better UX
 * Waits for route to stabilize before fetching location
 */
let geocodeTimeout: number | null = null;

export function debouncedReverseGeocode(
  routeLatLngs: [number, number][],
  callback: (location: LocationInfo | null) => void,
  delay: number = 1000
): void {
  if (geocodeTimeout) {
    clearTimeout(geocodeTimeout);
  }

  geocodeTimeout = window.setTimeout(async () => {
    const location = await getRouteLocation(routeLatLngs);
    callback(location);
  }, delay);
}