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

  reverseWaypoints() {
    this.waypoints.reverse();
    this.markers.reverse();
  }

  setStravaData(pace: number | null | undefined, hr: number | null | undefined, weight: number | null | undefined) {
    this.stravaPace = pace || 0;
    this.stravaHR = hr || 0;
    this.stravaWeight = weight || 0;
  }
}

export const state = new AppState();
