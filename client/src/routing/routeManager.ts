import L from 'leaflet';
import { CONFIG } from '../config';
import { elevationStats } from '../elevation';
import { trackEvent } from '../services/analytics';
import { state } from '../state';
import type { LatLng, LonLat } from '../types';
import {
  estimateKcalFromPaceWeight,
  fmtHMS,
  fmtKmBare,
  haversineMeters,
  parsePaceSecPerKm,
  polylineDistanceMeters,
} from '../utils';
import type { RoutingService } from './routingService';

interface StatsElements {
  elevVal: HTMLSpanElement;
  etaVal: HTMLSpanElement;
  calVal: HTMLSpanElement;
  distanceV: HTMLSpanElement;
}

const ROUTE_STYLE = {
  weight: CONFIG.ROUTE_WEIGHT,
  opacity: CONFIG.ROUTE_OPACITY,
  pane: 'routePane',
} as const;

const KM_ICON = L.divIcon({ className: 'km-anchor', iconSize: [0, 0], iconAnchor: [0, 0] });

export class RouteManager {
  private routeSeq = 0;

  constructor(
    private map: L.Map,
    private kmLayer: L.LayerGroup,
    private stats: StatsElements,
    private routing: RoutingService,
    private loopChk: HTMLInputElement,
    private targetPaceI: HTMLInputElement,
    private targetWeightI: HTMLInputElement,
    private saveGpxBtn: HTMLButtonElement
  ) {}

  refreshLabels() {
    state.markers.forEach((m, i) =>
      m.bindTooltip(String(i + 1), {
        permanent: true,
        direction: 'top'
      }).openTooltip()
    );
  }

  addKmLabels(latlngs: LatLng[], totalMeters?: number) {
    this.kmLayer.clearLayers();
    if (!latlngs.length) return;

    const total = totalMeters ?? polylineDistanceMeters(latlngs);
    const kmCount = Math.floor(total / 1000);
    if (kmCount < 1) return;

    let cum = 0;
    let nextMark = 1000;
    let k = 1;

    for (let i = 1; i < latlngs.length && k <= kmCount; i++) {
      const [aLat, aLon] = latlngs[i - 1];
      const [bLat, bLon] = latlngs[i];
      const seg = haversineMeters(aLat, aLon, bLat, bLon);

      if (seg === 0) {
        cum += seg;
        continue;
      }

      while (cum + seg >= nextMark && k <= kmCount) {
        const t = (nextMark - cum) / seg;
        const lat = aLat + (bLat - aLat) * t;
        const lon = aLon + (bLon - aLon) * t;

        L.marker([lat, lon], { icon: KM_ICON, interactive: false })
          .bindTooltip(`${k} km`, {
            permanent: true,
            direction: 'center',
            offset: [0, 0],
            className: 'km-tip',
            pane: 'kmPane'
          })
          .addTo(this.kmLayer)
          .openTooltip();

        k++;
        nextMark += 1000;
      }

      cum += seg;
    }
  }

  private computeEtaCal(distance: number) {
    const pace = parsePaceSecPerKm(this.targetPaceI.value || '') || state.stravaPace || 0;
    const etaSec = pace ? (distance / 1000) * pace : null;
    this.stats.etaVal.textContent = pace && etaSec ? fmtHMS(etaSec) : '-';

    const weight = Number(this.targetWeightI.value) || state.stravaWeight || 0;
    if (pace && weight && etaSec) {
      const kcal = estimateKcalFromPaceWeight(distance, pace, weight);
      this.stats.calVal.textContent = Math.round(kcal).toString();
    } else {
      this.stats.calVal.textContent = '-';
    }
  }

  updateStats(distance: number, latlngs: LatLng[]) {
    this.stats.distanceV.textContent = fmtKmBare(distance);

    this.stats.elevVal.textContent = '...';
    elevationStats(latlngs).then(elev => {
      this.stats.elevVal.textContent = elev
        ? `+${Math.round(elev.gain)} / -${Math.round(elev.loss)} m`
        : '-';
    });

    this.computeEtaCal(distance);
  }

  async renderRoute() {
    const seq = ++this.routeSeq;

    state.clearRoute(this.map);
    state.baseDistanceM = 0;

    this.stats.elevVal.textContent = '-';
    this.stats.etaVal.textContent = '-';
    this.stats.calVal.textContent = '-';
    this.stats.distanceV.textContent = '0 Km';

    if (state.waypoints.length < 2) {
      this.kmLayer.clearLayers();
      this.saveGpxBtn.disabled = true;
      return;
    }

    const coords = this.loopChk.checked
      ? [...state.waypoints, state.waypoints[0]]
      : state.waypoints.slice();

    try {
      const { geometry, distance } = await this.routing.getRoute(coords);
      if (seq !== this.routeSeq) return;

      const latlngs = (geometry as LonLat[]).map(([lon, lat]) => [lat, lon] as LatLng);
      state.lastRouteLatLngs = latlngs;

      state.routeLayer = L.polyline(latlngs, ROUTE_STYLE).addTo(this.map);

      this.map.fitBounds(state.routeLayer.getBounds(), { padding: CONFIG.FIT_BOUNDS_PADDING });

      state.baseDistanceM = distance;
      this.updateStats(distance, latlngs);
      this.addKmLabels(latlngs, distance);

      this.saveGpxBtn.disabled = false;
      trackEvent('route_calculated', { distance_km: (distance / 1000).toFixed(2) });
    } catch {
      if (seq !== this.routeSeq) return;
      this.stats.distanceV.textContent = 'Error';
      this.saveGpxBtn.disabled = true;
    }
  }

  private createDraggableMarker(lat: number, lon: number): L.Marker {
    return L.marker([lat, lon], { draggable: true })
      .on('dragend', (ev: L.LeafletEvent) => {
        const ll = (ev.target as L.Marker).getLatLng();
        const idx = state.markers.indexOf(ev.target as L.Marker);
        if (idx >= 0) state.waypoints[idx] = [ll.lng, ll.lat];
        this.renderRoute();
      })
      .addTo(this.map);
  }

  addWaypoint(lat: number, lon: number) {
    state.waypoints.push([lon, lat]);
    state.markers.push(this.createDraggableMarker(lat, lon));
    this.refreshLabels();
    this.renderRoute();
  }

  clearAll() {
    state.clearAll(this.map);
    this.kmLayer.clearLayers();

    this.stats.elevVal.textContent = '-';
    this.stats.etaVal.textContent = '-';
    this.stats.calVal.textContent = '-';
    this.stats.distanceV.textContent = '0 Km';

    this.saveGpxBtn.disabled = true;
  }

  reverseRoute() {
    if (state.waypoints.length < 2) return;
    state.reverseWaypoints();
    this.refreshLabels();
    this.renderRoute();
  }

  undoLastWaypoint() {
    if (!state.waypoints.length) return;
    state.waypoints.pop();
    const marker = state.markers.pop();
    if (marker) this.map.removeLayer(marker);
    this.refreshLabels();
    this.renderRoute();
  }

  async loadRouteFromData(
    routeLatLngs: LatLng[],
    waypoints: LatLng[],
    distance_m: number,
    elevation_gain_m?: number,
    elevation_loss_m?: number
  ) {
    this.clearAll();

    state.lastRouteLatLngs = routeLatLngs.slice();
    state.baseDistanceM = distance_m;

    state.routeLayer = L.polyline(routeLatLngs, ROUTE_STYLE).addTo(this.map);
    this.map.fitBounds(state.routeLayer.getBounds(), { padding: CONFIG.FIT_BOUNDS_PADDING });

    waypoints.forEach(([lat, lon]) => {
      state.markers.push(this.createDraggableMarker(lat, lon));
      state.waypoints.push([lon, lat]);
    });
    this.refreshLabels();

    this.stats.distanceV.textContent = fmtKmBare(distance_m);

    if (elevation_gain_m !== undefined && elevation_loss_m !== undefined) {
      this.stats.elevVal.textContent = `+${Math.round(elevation_gain_m)} / -${Math.round(elevation_loss_m)} m`;
    } else {
      elevationStats(routeLatLngs).then(elev => {
        this.stats.elevVal.textContent = elev
          ? `+${Math.round(elev.gain)} / -${Math.round(elev.loss)} m`
          : '-';
      });
    }

    this.computeEtaCal(distance_m);
    this.addKmLabels(routeLatLngs, distance_m);

    this.saveGpxBtn.disabled = false;
  }
}
