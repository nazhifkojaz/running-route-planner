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

async function reverseGeocode(lat: number, lon: number): Promise<LocationInfo | null> {
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

export async function getRouteLocation(routeLatLngs: [number, number][]): Promise<LocationInfo | null> {
  if (!routeLatLngs || routeLatLngs.length === 0) {
    return null;
  }

  const [lat, lon] = routeLatLngs[0];
  return reverseGeocode(lat, lon);
}
