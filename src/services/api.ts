import { CONFIG } from '../config';
import type { MeResponse } from '../types';


function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem(CONFIG.STORAGE_KEYS.SESSION_TOKEN);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getMe(): Promise<MeResponse> {
  const res = await fetch(`${CONFIG.API_BASE}/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`ME ${res.status}`);
  return res.json();
}

export async function syncStrava(): Promise<MeResponse> {
  const res = await fetch(`${CONFIG.API_BASE}/me/sync`, {
    method: 'POST',
    headers: {
      ...getAuthHeaders(),
      'Content-Type': 'application/json'
    },
  });
  if (!res.ok) throw new Error(`SYNC ${res.status}`);
  return res.json();
}

export function getStravaStartUrl(): string {
  const redirect = `${location.origin}${location.pathname}`;
  return `${CONFIG.API_BASE}/auth/strava/start?redirect=${encodeURIComponent(redirect)}`;
}
