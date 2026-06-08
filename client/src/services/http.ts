import { CONFIG } from '../config';

export function getAuthHeaders(includeContentType = false): HeadersInit {
  const token = localStorage.getItem(CONFIG.STORAGE_KEYS.SESSION_TOKEN);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (includeContentType) headers['Content-Type'] = 'application/json';
  return headers;
}

export function buildUrl(path: string): string {
  return `${CONFIG.API_BASE}${path}`;
}
