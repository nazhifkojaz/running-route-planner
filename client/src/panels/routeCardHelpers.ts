import type { RouteManager } from '../routing/routeManager';
import { trackEvent } from '../services/analytics';
import { getRoute, geoJSONToLatLngs } from '../services/routes';
import type { RouteListItem } from '../types';
import { escapeHtml, fmtKmBare } from '../utils';

export function renderRouteCard(
  route: RouteListItem,
  options: {
    showAuthor?: boolean;
    actions: Array<{ label: string; cssClass: string; icon?: string }>;
    visibilityBadge?: 'always-public' | 'dynamic';
  },
): string {
  const distance = fmtKmBare(route.distance_m);
  const elevation = route.elevation_gain_m
    ? `⛰️ +${Math.round(route.elevation_gain_m)}m`
    : '';
  const location = [route.city, route.country].filter(Boolean).join(', ') || 'Unknown location';
  const date = new Date(route.created_at).toLocaleDateString();

  const authorLine = options.showAuthor
    ? `by ${escapeHtml(route.username_snapshot || 'Anonymous')} • ${date}`
    : date;

  let badge = '';
  if (options.visibilityBadge === 'always-public') {
    badge = '<span class="route-card-badge public">PUBLIC</span>';
  } else if (options.visibilityBadge === 'dynamic') {
    badge = route.visibility === 'public'
      ? '<span class="route-card-badge public">PUBLIC</span>'
      : '<span class="route-card-badge private">PRIVATE</span>';
  }

  const actionsHtml = options.actions.map(action => `
    <button class="card-action-btn ${action.cssClass}" data-route-id="${route.id}">
      <span>${action.icon ?? '📥'}</span>
      <span>${action.label}</span>
    </button>
  `).join('');

  return `
    <div class="route-card" data-route-id="${route.id}">
      <div class="route-card-header">
        <div>
          <h4 class="route-card-title">${escapeHtml(route.name)}</h4>
          <p class="route-card-author">${authorLine}</p>
          ${route.description ? `<p class="route-card-description">${escapeHtml(route.description)}</p>` : ''}
        </div>
        ${badge}
      </div>
      <div class="route-card-meta">
        <span>📏 ${distance}</span>
        ${elevation ? `<span>${elevation}</span>` : ''}
        <span>📍 ${escapeHtml(location)}</span>
      </div>
      <div class="route-card-actions">
        ${actionsHtml}
      </div>
    </div>
  `;
}

export function renderLoading(container: HTMLElement, message = 'Loading...') {
  container.innerHTML = `
    <div class="explore-loading">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;
}

export function renderEmpty(container: HTMLElement, icon = '📂', message = 'No routes found') {
  container.innerHTML = `
    <div class="explore-empty">
      <div class="explore-empty-icon">${icon}</div>
      <p>${message}</p>
    </div>
  `;
}

export function renderError(container: HTMLElement, message: string) {
  container.innerHTML = `
    <div class="explore-error">
      <span class="error-icon">⚠️</span>
      <span>${message}</span>
    </div>
  `;
}

export async function handleLoadRoute(
  routeId: string,
  routeManager: RouteManager,
  closePanelFn: () => void,
  buttonLabel = 'Load on Map',
) {
  const btn = document.querySelector(`[data-route-id="${routeId}"] .load-route-btn`) as HTMLButtonElement;
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span><span>Loading...</span>';
    }

    const route = await getRoute(routeId);

    if (!route.geometry) {
      throw new Error('Route has no geometry data');
    }

    const { route: routeLatLngs, waypoints } = geoJSONToLatLngs(route.geometry);

    await routeManager.loadRouteFromData(
      routeLatLngs,
      waypoints || [],
      route.distance_m,
      route.elevation_gain_m,
      route.elevation_loss_m,
    );

    closePanelFn();

    trackEvent('route_loaded', {
      route_id: routeId,
      distance_km: (route.distance_m / 1000).toFixed(2),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    alert(`Failed to load route: ${message}`);

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>📥</span><span>${buttonLabel}</span>`;
    }
  }
}
