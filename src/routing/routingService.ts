import { CONFIG } from '../config';
import { state } from '../state';
import type { LonLat, RouteResult } from '../types';


export class RoutingService {
  constructor(
    private orsKeyInput: HTMLInputElement,
    private engineORS: HTMLInputElement,
    private engineNote: HTMLParagraphElement
  ) {}

  private getOrsKey(): string {
    return (this.orsKeyInput.value || '').trim();
  }

  async osrmDriving(coords: LonLat[]): Promise<RouteResult> {
    const path = coords.map(c => `${c[0]},${c[1]}`).join(';');
    const url = `${CONFIG.OSRM_BASE}/route/v1/driving/${path}?overview=full&geometries=geojson&steps=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`);
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) throw new Error('OSRM: no route');
    return {
      geometry: route.geometry.coordinates as LonLat[],
      distance: route.distance as number
    };
  }

  async orsDirectionsFoot(coords: LonLat[]): Promise<RouteResult> {
    const key = this.getOrsKey();
    if (!key) {
      state.orsDegraded = true;
      this.updateEngineAvailability();
      throw new Error('ORS key missing');
    }

    const res = await fetch(`${CONFIG.ORS_BASE}/v2/directions/foot-walking/geojson`, {
      method: 'POST',
      headers: {
        'Authorization': key,
        'Content-Type': 'application/json'
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
        return await this.osrmDriving(coords);
      }
    }
    return await this.osrmDriving(coords);
  }

  updateEngineAvailability() {
    const hasKey = !!this.getOrsKey();
    if (!hasKey || state.orsDegraded) {
      this.engineORS.checked = false;
      this.engineORS.disabled = true;
      this.engineNote.textContent = hasKey
        ? 'ORS temporarily disabled due to rate limit/error; using OSRM (driving).'
        : 'Set an ORS key to enable ORS.';
    } else {
      this.engineORS.disabled = false;
      this.engineNote.textContent = 'ORS enabled. Using snap + foot-walking when selected.';
    }
  }

  initOrsKey() {
    this.orsKeyInput.value = localStorage.getItem(CONFIG.STORAGE_KEYS.ORS_KEY) ?? '';
    this.orsKeyInput.addEventListener('input', () => {
      localStorage.setItem(CONFIG.STORAGE_KEYS.ORS_KEY, this.orsKeyInput.value.trim());
      state.orsDegraded = false;
      this.updateEngineAvailability();
    });
  }
}
