import L from 'leaflet';
import type { LonLat, LatLng } from '../types';

export class AppState {
  waypoints: LonLat[] = [];
  markers: L.Marker[] = [];
  routeLayer: L.Polyline | null = null;
  baseDistanceM = 0;
  lastRouteLatLngs: LatLng[] = [];
  orsDegraded = false;
  stravaPace = 0;
  stravaHR = 0;
  stravaWeight = 0;

  clearRoute(map: L.Map) {
    if (this.routeLayer) {
      map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
  }

  clearAll(map: L.Map) {
    this.waypoints = [];
    this.markers.forEach(m => map.removeLayer(m));
    this.markers = [];
    this.clearRoute(map);
    this.baseDistanceM = 0;
    this.lastRouteLatLngs = [];
  }

  reverseWaypoints() {
    this.waypoints.reverse();
    this.markers.reverse();
  }

  setStravaData(pace:number | null | undefined, hr: number | null | undefined, weight: number | null | undefined) {
    this.stravaPace = pace || 0;
    this.stravaHR = hr || 0;
    this.stravaWeight = weight || 0;
  }
}

// Singleton instance
export const state = new AppState();
