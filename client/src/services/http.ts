import { API_CONFIG } from '../config/api';
import { STORAGE_CONFIG } from '../config/storage';

export function getAuthHeaders(includeContentType = false): HeadersInit {
  const token = localStorage.getItem(STORAGE_CONFIG.STORAGE_KEYS.SESSION_TOKEN);
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (includeContentType) headers['Content-Type'] = 'application/json';
  return headers;
}

export function buildUrl(path: string): string {
  return `${API_CONFIG.API_BASE}${path}`;
}
