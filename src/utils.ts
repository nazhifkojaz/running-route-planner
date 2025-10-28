import L from 'leaflet';
import type { LatLng } from './types';

export function readHashParam(key: string): string | null {
  const h = location.hash.startsWith('#') ? location.hash.slice(1) : location.hash;
  const params = new URLSearchParams(h);
  return params.get(key);
}

export function paceSecToStr(sec?: number | null): string {
  if (!sec || sec <= 0) return '-';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

export function fmtKmBare(m: number | null | undefined): string {
  if (!m) return '0.00 Km';
  return `${(m / 1000).toFixed(2)} Km`;
}

export function fmtHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export function parsePaceSecPerKm(txt: string): number | null {
  const match = txt.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const mins = parseInt(match[1], 10);
  const secs = parseInt(match[2], 10);
  if (isNaN(mins) || isNaN(secs)) return null;
  return mins * 60 + secs;
}

export function polylineDistanceMeters(latlngs: LatLng[]): number {
  let d = 0;
  for (let i = 1; i < latlngs.length; i++) {
    const a = L.latLng(latlngs[i - 1][0], latlngs[i - 1][1]);
    const b = L.latLng(latlngs[i][0], latlngs[i][1]);
    d += a.distanceTo(b);
  }
  return d;
}

/**
 * Running calories estimate (level ground):
 * VO2 (ml/kg/min) ≈ 0.2 * speed(m/min) + 3.5 → MET = VO2/3.5
 * kcal/min ≈ MET * 3.5 * weight(kg) / 200
 */
export function estimateKcalFromPaceWeight(
  distanceM: number,
  paceSecPerKm: number,
  weightKg: number
): number {
  if (paceSecPerKm <= 0 || weightKg <= 0 || distanceM <= 0) return 0;
  const durationSec = (distanceM / 1000) * paceSecPerKm;
  const durationMin = durationSec / 60;
  const speed_m_per_min = 60000 / paceSecPerKm;
  const MET = (0.2 * speed_m_per_min + 3.5) / 3.5;
  const kcalPerMin = (MET * 3.5 * weightKg) / 200;
  return kcalPerMin * durationMin;
}
