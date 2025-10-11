// src/myRoutesPanel.ts
import L from 'leaflet';
import {
  getMyRoutes,
  getRoute,
  deleteRoute,
  geoJSONToLatLngs,
} from '../routesApi';
import { fmtKmBare } from '../utils';
import { trackEvent } from '../analytics';
import type { RouteManager } from '../route';
import { RouteListItem } from '../types';


export function createMyRoutesPanel(): { panel: HTMLDivElement; backdrop: HTMLDivElement } {
  const backdrop = document.createElement('div');
  backdrop.id = 'myRoutesBackdrop';
  backdrop.className = 'sheet-backdrop hidden';

  const panel = document.createElement('div');
  panel.id = 'myRoutesPanel';
  panel.className = 'panel my-routes-panel hidden';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  panel.innerHTML = `
    <div class="panel-header">
      <div class="header-content">
        <div class="icon-badge">📂</div>
        <h3>My Routes</h3>
      </div>
      <button id="myRoutesClose" class="close-btn" title="Close">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="panel-content">
      <div id="myRoutesResults" class="explore-results">
        <!-- Routes will be rendered here -->
      </div>

      <div id="myRoutesLoadMore" class="load-more-section hidden">
        <button id="myRoutesLoadMoreBtn" class="action-btn">
          Load More Routes
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  return { panel, backdrop };
}

export function openMyRoutesPanel(
  panel: HTMLElement, 
  backdrop: HTMLElement,
  loadRoutesCallback: () => void
) {
  backdrop.classList.remove('hidden');
  panel.classList.remove('hidden');
  panel.classList.add('opening');
  
  setTimeout(() => panel.classList.remove('opening'), 300);
  
  // Trigger refresh when panel opens
  loadRoutesCallback();
}

export function closeMyRoutesPanel(panel: HTMLElement, backdrop: HTMLElement) {
  panel.classList.add('closing');
  backdrop.classList.add('closing');
  
  setTimeout(() => {
    panel.classList.add('hidden');
    backdrop.classList.add('hidden');
    panel.classList.remove('closing');
    backdrop.classList.remove('closing');
  }, 250);
}

function renderMyRouteCard(route: RouteListItem): string {
  const distance = fmtKmBare(route.distance_m);
  const elevation = route.elevation_gain_m 
    ? `⛰️ +${Math.round(route.elevation_gain_m)}m`
    : '';
  const location = [route.city, route.country].filter(Boolean).join(', ') || 'Unknown location';
  const date = new Date(route.created_at).toLocaleDateString();
  const visibilityBadge = route.visibility === 'public' 
    ? '<span class="route-card-badge public">PUBLIC</span>'
    : '<span class="route-card-badge private">PRIVATE</span>';

  return `
    <div class="route-card my-route-card" data-route-id="${route.id}">
      <div class="route-card-header">
        <div>
          <h4 class="route-card-title">${escapeHtml(route.name)}</h4>
          <p class="route-card-author">${date}</p>
          ${route.description ? `<p class="route-card-description">${escapeHtml(route.description)}</p>` : ''}
        </div>
        ${visibilityBadge}
      </div>
      <div class="route-card-meta">
        <span>📏 ${distance}</span>
        ${elevation ? `<span>${elevation}</span>` : ''}
        <span>📍 ${escapeHtml(location)}</span>
      </div>
      <div class="route-card-actions">
        <button class="card-action-btn load-route-btn" data-route-id="${route.id}">
          <span>📥</span>
          <span>Load</span>
        </button>
        <button class="card-action-btn danger-action-btn delete-route-btn" data-route-id="${route.id}">
          <span>🗑️</span>
          <span>Delete</span>
        </button>
      </div>
    </div>
  `;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderLoading(container: HTMLElement) {
  container.innerHTML = `
    <div class="explore-loading">
      <div class="spinner"></div>
      <p>Loading your routes...</p>
    </div>
  `;
}

function renderEmpty(container: HTMLElement) {
  container.innerHTML = `
    <div class="explore-empty">
      <div class="explore-empty-icon">📂</div>
      <p>No saved routes yet</p>
      <p class="muted small">Create and save a route to see it here!</p>
    </div>
  `;
}

function renderError(container: HTMLElement, message: string) {
  container.innerHTML = `
    <div class="explore-error">
      <span class="error-icon">⚠️</span>
      <span>${message}</span>
    </div>
  `;
}

export function setupMyRoutesPanel(
  panel: HTMLElement,
  backdrop: HTMLDivElement,
  map: L.Map,
  routeManager: RouteManager
) {
  const closeBtn = document.getElementById('myRoutesClose') as HTMLButtonElement;
  const resultsContainer = document.getElementById('myRoutesResults') as HTMLDivElement;
  const loadMoreSection = document.getElementById('myRoutesLoadMore') as HTMLDivElement;
  const loadMoreBtn = document.getElementById('myRoutesLoadMoreBtn') as HTMLButtonElement;

  let currentOffset = 0;
  let hasMore = false;

  // Close handlers
  closeBtn.addEventListener('click', () => closeMyRoutesPanel(panel, backdrop));
  backdrop.addEventListener('click', () => closeMyRoutesPanel(panel, backdrop));

  // Load routes function
  async function loadRoutes(append: boolean = false) {
    if (!append) {
      renderLoading(resultsContainer);
      currentOffset = 0;
    }

    try {
      const response = await getMyRoutes(20, currentOffset);

      if (response.routes.length === 0 && currentOffset === 0) {
        renderEmpty(resultsContainer);
        loadMoreSection.classList.add('hidden');
        return;
      }

      const html = response.routes.map(route => renderMyRouteCard(route)).join('');
      
      if (append) {
        resultsContainer.innerHTML += html;
      } else {
        resultsContainer.innerHTML = html;
      }

      // Setup load route buttons
      resultsContainer.querySelectorAll('.load-route-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const routeId = (e.currentTarget as HTMLElement).getAttribute('data-route-id');
          if (routeId) {
            await handleLoadRoute(routeId, map, routeManager, panel, backdrop);
          }
        });
      });

      // Setup delete buttons
      resultsContainer.querySelectorAll('.delete-route-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const routeId = (e.currentTarget as HTMLElement).getAttribute('data-route-id');
          if (routeId) {
            await handleDeleteRoute(routeId, resultsContainer, loadRoutes);
          }
        });
      });

      // Handle load more
      hasMore = response.has_more;
      if (hasMore) {
        loadMoreSection.classList.remove('hidden');
        currentOffset += response.routes.length;
      } else {
        loadMoreSection.classList.add('hidden');
      }

      trackEvent('my_routes_viewed', { count: response.routes.length });

    } catch (error: any) {
      renderError(resultsContainer, error.message || 'Failed to load your routes');
      loadMoreSection.classList.add('hidden');
    }
  }

  // Load more
  loadMoreBtn.addEventListener('click', () => {
    loadRoutes(true);
  });

  // Return the load function so it can be called externally
  return loadRoutes;
}

async function handleLoadRoute(
  routeId: string,
  map: L.Map,
  routeManager: RouteManager,
  panel: HTMLElement,
  backdrop: HTMLDivElement
) {
  try {
    const btn = document.querySelector(`[data-route-id="${routeId}"].load-route-btn`) as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span><span>Loading...</span>';
    }

    const route = await getRoute(routeId);

    if (!route.geometry) {
      throw new Error('Route has no geometry data');
    }

    const { route: routeLatLngs, waypoints } = geoJSONToLatLngs(route.geometry as any);

    await routeManager.loadRouteFromData(
      routeLatLngs,
      waypoints || [],
      route.distance_m,
      route.elevation_gain_m,
      route.elevation_loss_m
    );

    closeMyRoutesPanel(panel, backdrop);

    trackEvent('my_route_loaded', { route_id: routeId });

  } catch (error: any) {
    alert(`Failed to load route: ${error.message}`);
    
    const btn = document.querySelector(`[data-route-id="${routeId}"].load-route-btn`) as HTMLButtonElement;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>📥</span><span>Load</span>';
    }
  }
}

async function handleDeleteRoute(
  routeId: string, 
  resultsContainer: HTMLElement,
  refreshCallback: () => void
) {
  if (!confirm('Are you sure you want to delete this route? This action cannot be undone.')) {
    return;
  }

  try {
    await deleteRoute(routeId);

    // Remove card from UI
    const card = document.querySelector(`[data-route-id="${routeId}"].my-route-card`);
    if (card) {
      card.remove();
    }

    // Check if empty
    if (resultsContainer.querySelectorAll('.route-card').length === 0) {
      renderEmpty(resultsContainer);
    }

    trackEvent('route_deleted', { route_id: routeId });

  } catch (error: any) {
    alert(`Failed to delete route: ${error.message}`);
  }
}