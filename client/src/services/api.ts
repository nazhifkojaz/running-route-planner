import type { MeResponse } from '../types';
import { getAuthHeaders, buildUrl } from './http';


export async function getMe(): Promise<MeResponse> {
  const res = await fetch(buildUrl('/me'), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`ME ${res.status}`);
  return res.json();
}

export async function syncStrava(): Promise<MeResponse> {
  const res = await fetch(buildUrl('/me/sync'), {
    method: 'POST',
    headers: getAuthHeaders(true),
  });
  if (!res.ok) throw new Error(`SYNC ${res.status}`);
  return res.json();
}

export function getStravaStartUrl(): string {
  const redirect = `${location.origin}${location.pathname}`;
  return buildUrl(`/auth/strava/start?redirect=${encodeURIComponent(redirect)}`);
}
