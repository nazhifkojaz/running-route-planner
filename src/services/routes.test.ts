import { describe, expect, it } from 'vitest';
import { geoJSONToLatLngs, latlngsToGeoJSON } from './routes';

describe('route service helpers', () => {
  it('converts lat/lng pairs to GeoJSON and back', () => {
    const latlngs: [number, number][] = [
      [51.5, -0.1],
      [51.51, -0.11],
      [51.52, -0.12],
    ];
    const geo = latlngsToGeoJSON(latlngs);
    expect(geo.type).toBe('LineString');
    expect(geo.coordinates).toEqual([
      [-0.1, 51.5],
      [-0.11, 51.51],
      [-0.12, 51.52],
    ]);

    const roundtrip = geoJSONToLatLngs(geo);
    expect(roundtrip.route).toEqual(latlngs);
    expect(roundtrip.waypoints).toBeUndefined();
  });

  it('includes waypoints when provided', () => {
    const route: [number, number][] = [
      [40.7128, -74.006],
      [40.7138, -74.016],
    ];
    const waypoints: [number, number][] = [
      [40.7, -74.0],
      [40.71, -74.01],
    ];

    const geo = latlngsToGeoJSON(route, waypoints);
    expect(geo.properties?.waypoints).toEqual([
      [-74.0, 40.7],
      [-74.01, 40.71],
    ]);

    const parsed = geoJSONToLatLngs(geo);
    expect(parsed.waypoints).toEqual(waypoints);
  });
});
