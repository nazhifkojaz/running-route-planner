import L from 'leaflet';
import type { LonLat, LatLng } from './types';


export class AppState {
  waypoints: LonLat[] = [];
  markers: L.Marker[] = [];
  routeLayer: L.Polyline | null = null;
  baseDistanceM = 0;
  lastRouteLatLngs: LatLng[] = [];
  orsDegraded = false;

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
}

// Singleton instance
export const state = new AppState();