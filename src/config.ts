import { API_CONFIG } from './config/api';
import { GEOLOCATION_CONFIG } from './config/geolocation';
import { MAP_CONFIG } from './config/map';
import { ROUTING_CONFIG } from './config/routing';
import { STORAGE_CONFIG } from './config/storage';
import { UI_CONFIG } from './config/ui';

export const CONFIG = {
  ...API_CONFIG,
  ...MAP_CONFIG,
  ...ROUTING_CONFIG,
  ...GEOLOCATION_CONFIG,
  ...STORAGE_CONFIG,
  ...UI_CONFIG,
} as const;

export type AppConfig = typeof CONFIG;

export {
  API_CONFIG,
  MAP_CONFIG,
  ROUTING_CONFIG,
  GEOLOCATION_CONFIG,
  STORAGE_CONFIG,
  UI_CONFIG,
};
