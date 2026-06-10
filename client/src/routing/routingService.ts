import { ROUTING_CONFIG } from '../config/routing';
import { STORAGE_CONFIG } from '../config/storage';
import { state } from '../state';
import type { LonLat, RouteResult } from '../types';
import { haversineMeters } from '../utils';

const ROAD_RUNNING_DETOUR_RATIO = 1.2;
const ROAD_RUNNING_DETOUR_WEIGHT = 0.5;
const ROAD_RUNNING_EXPECTED_POINT_SPACING_M = 25;
const ROAD_RUNNING_EXTRA_POINT_WEIGHT_M = 2;

export class RoutingService {
  private osrmCache = new Map<string, Promise<RouteResult>>();

  constructor(
    private orsKeyInput: HTMLInputElement,
    private engineOSRM: HTMLInputElement,
    private engineORS: HTMLInputElement,
    private engineNote: HTMLParagraphElement,
  ) {}

  private getOrsKey(): string {
    return (this.orsKeyInput.value || '').trim();
  }

  private getOsrmCacheKey(coords: LonLat[]): string {
    return coords
      .map(
        ([lon, lat]) =>
          `${lon.toFixed(ROUTING_CONFIG.ROAD_RUNNING_COORD_PRECISION)},${lat.toFixed(ROUTING_CONFIG.ROAD_RUNNING_COORD_PRECISION)}`,
      )
      .join(';');
  }

  private cacheOsrmRequest(cacheKey: string, request: Promise<RouteResult>) {
    this.osrmCache.set(cacheKey, request);

    if (this.osrmCache.size > ROUTING_CONFIG.ROAD_RUNNING_CACHE_LIMIT) {
      const oldestKey = this.osrmCache.keys().next().value;
      if (oldestKey) this.osrmCache.delete(oldestKey);
    }
  }

  private async fetchOsrmDriving(coords: LonLat[]): Promise<RouteResult> {
    const path = coords.map((c) => `${c[0]},${c[1]}`).join(';');
    const url = `${ROUTING_CONFIG.OSRM_BASE}/route/v1/driving/${path}?overview=full&geometries=geojson&steps=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) throw new Error('OSRM: no route');
    return {
      geometry: route.geometry.coordinates as LonLat[],
      distance: route.distance as number,
      duration: typeof route.duration === 'number' ? route.duration : undefined,
    };
  }

  async osrmDriving(coords: LonLat[]): Promise<RouteResult> {
    const cacheKey = this.getOsrmCacheKey(coords);
    const cached = this.osrmCache.get(cacheKey);
    if (cached) return await cached;

    const request = this.fetchOsrmDriving(coords).catch((error) => {
      this.osrmCache.delete(cacheKey);
      throw error;
    });
    this.cacheOsrmRequest(cacheKey, request);
    return await request;
  }

  private distanceBetween([fromLon, fromLat]: LonLat, [toLon, toLat]: LonLat): number {
    return haversineMeters(fromLat, fromLon, toLat, toLon);
  }

  private scoreRoadRunningSegment(route: RouteResult, from: LonLat, to: LonLat): number {
    const directDistance = Math.max(this.distanceBetween(from, to), 1);
    const detourPenalty =
      Math.max(0, route.distance - directDistance * ROAD_RUNNING_DETOUR_RATIO) *
      ROAD_RUNNING_DETOUR_WEIGHT;
    const expectedPoints = Math.max(
      12,
      Math.ceil(route.distance / ROAD_RUNNING_EXPECTED_POINT_SPACING_M),
    );
    const noisePenalty =
      Math.max(0, route.geometry.length - expectedPoints) * ROAD_RUNNING_EXTRA_POINT_WEIGHT_M;

    return route.distance + detourPenalty + noisePenalty;
  }

  private reverseRouteResult(route: RouteResult): RouteResult {
    return {
      ...route,
      geometry: route.geometry.slice().reverse(),
    };
  }

  private async osrmRoadRunningSegment(from: LonLat, to: LonLat): Promise<RouteResult> {
    const [forward, reverse] = await Promise.allSettled([
      this.osrmDriving([from, to]),
      this.osrmDriving([to, from]).then((route) => this.reverseRouteResult(route)),
    ]);

    if (forward.status === 'fulfilled' && reverse.status === 'fulfilled') {
      return this.scoreRoadRunningSegment(reverse.value, from, to) <
        this.scoreRoadRunningSegment(forward.value, from, to)
        ? reverse.value
        : forward.value;
    }

    if (forward.status === 'fulfilled') return forward.value;
    if (reverse.status === 'fulfilled') return reverse.value;

    throw forward.reason instanceof Error
      ? forward.reason
      : new Error('OSRM road-running: no route');
  }

  private mergeSegments(segments: RouteResult[]): RouteResult {
    const geometry: LonLat[] = [];
    let distance = 0;
    let duration = 0;
    let hasDuration = false;

    segments.forEach((segment) => {
      const segmentGeometry = geometry.length ? segment.geometry.slice(1) : segment.geometry;

      geometry.push(...segmentGeometry);
      distance += segment.distance;

      if (segment.duration !== undefined) {
        duration += segment.duration;
        hasDuration = true;
      }
    });

    return {
      geometry,
      distance,
      duration: hasDuration ? duration : undefined,
    };
  }

  async osrmRoadRunning(coords: LonLat[]): Promise<RouteResult> {
    if (coords.length < 2) throw new Error('OSRM road-running: not enough coordinates');

    const segments: RouteResult[] = [];
    for (let i = 1; i < coords.length; i++) {
      segments.push(await this.osrmRoadRunningSegment(coords[i - 1], coords[i]));
    }

    return this.mergeSegments(segments);
  }

  async orsDirectionsFoot(coords: LonLat[]): Promise<RouteResult> {
    const key = this.getOrsKey();
    if (!key) {
      state.orsDegraded = true;
      this.updateEngineAvailability();
      throw new Error('ORS key missing');
    }

    const res = await fetch(`${ROUTING_CONFIG.ORS_BASE}/v2/directions/foot-walking/geojson`, {
      method: 'POST',
      headers: {
        Authorization: key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ coordinates: coords }),
    });

    if (!res.ok) {
      if ([401, 403, 429].includes(res.status)) {
        state.orsDegraded = true;
        this.updateEngineAvailability();
      }
      throw new Error('ORS HTTP ' + res.status);
    }

    const data = await res.json();
    const feat = data.features?.[0];
    if (!feat) throw new Error('ORS: no route');

    const geometry = feat.geometry.coordinates as LonLat[];
    const summary = feat.properties.summary as { distance: number; duration: number };
    return { geometry, distance: summary.distance, duration: summary.duration };
  }

  async getRoute(coords: LonLat[]): Promise<RouteResult> {
    const wantORS = this.engineORS.checked && !state.orsDegraded && !!this.getOrsKey();

    if (wantORS) {
      try {
        return await this.orsDirectionsFoot(coords);
      } catch {
        return await this.osrmRoadRunning(coords);
      }
    }
    return await this.osrmRoadRunning(coords);
  }

  updateEngineAvailability() {
    const hasKey = !!this.getOrsKey();
    if (!hasKey || state.orsDegraded) {
      this.engineOSRM.checked = true;
      this.engineORS.checked = false;
      this.engineORS.disabled = true;
      this.engineNote.textContent = hasKey
        ? 'Pedestrian/Trail temporarily disabled due to rate limit/error; using Road Running.'
        : 'Road Running is active. Add an ORS key to try Pedestrian/Trail.';
    } else {
      this.engineORS.disabled = false;
      this.engineNote.textContent =
        'Road Running is default. Pedestrian/Trail uses ORS foot-walking when selected.';
    }
  }

  initOrsKey() {
    this.orsKeyInput.value = localStorage.getItem(STORAGE_CONFIG.STORAGE_KEYS.ORS_KEY) ?? '';
    this.orsKeyInput.addEventListener('input', () => {
      localStorage.setItem(STORAGE_CONFIG.STORAGE_KEYS.ORS_KEY, this.orsKeyInput.value.trim());
      state.orsDegraded = false;
      this.updateEngineAvailability();
    });
  }
}
