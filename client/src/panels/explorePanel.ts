import L from 'leaflet';
import type { RouteManager } from '../routing/routeManager';
import { trackEvent } from '../services/analytics';
import {
  exploreRoutes,
  getRoute,
  geoJSONToLatLngs,
} from '../services/routes';
import { RouteListItem } from '../types';
import { escapeHtml, fmtKmBare } from '../utils';


export function createExplorePanel(): { panel: HTMLDivElement } {
  const panel = document.createElement('div');
  panel.id = 'explorePanel';
  panel.className = 'panel explore-panel hidden';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  panel.innerHTML = `
    <div class="panel-header">
      <div class="header-content">
        <div class="icon-badge">🗺️</div>
        <h3>Explore Routes</h3>
      </div>
      <button id="exploreClose" class="close-btn" title="Close">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="panel-content">
      <div class="explore-filters collapsed">
        <button id="filterToggle" class="filter-toggle-btn">
          <span>🔍 Filter Routes</span>
          <span class="filter-toggle-icon">▼</span>
        </button>
        <div class="filter-content">
          <div class="filter-row">
            <div class="input-field">
              <input 
                id="filterCity" 
                type="text" 
                placeholder="Filter by city..."
                class="filter-input"
              />
            </div>
            <div class="input-field">
              <input 
                id="filterCountry" 
                type="text" 
                placeholder="Filter by country..."
                class="filter-input"
              />
            </div>
          </div>
          <div class="filter-row">
            <div class="input-field">
              <input 
                id="filterMinDistance" 
                type="number" 
                placeholder="Min km"
                class="filter-input-small"
                min="0"
                step="0.1"
              />
            </div>
            <div class="input-field">
              <input 
                id="filterMaxDistance" 
                type="number" 
                placeholder="Max km"
                class="filter-input-small"
                min="0"
                step="0.1"
              />
            </div>
            <button id="applyFilters" class="action-btn primary-btn">
              <span>Filter</span>
            </button>
            <button id="clearFilters" class="action-btn">
              <span>Clear</span>
            </button>
          </div>
        </div>
      </div>

      <div id="exploreResults" class="explore-results">
      </div>

      <div id="exploreLoadMore" class="load-more-section hidden">
        <button id="loadMoreBtn" class="action-btn">
          Load More Routes
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  return { panel };
}

export function openExplorePanel(panel: HTMLElement, backdrop: HTMLElement) {
  backdrop.classList.remove('hidden');
  panel.classList.remove('hidden');
  panel.classList.add('opening');
  
  setTimeout(() => panel.classList.remove('opening'), 300);
}

export function closeExplorePanel(panel: HTMLElement, backdrop: HTMLElement) {
  panel.classList.add('closing');
  backdrop.classList.add('closing');
  
  setTimeout(() => {
    panel.classList.add('hidden');
    backdrop.classList.add('hidden');
    panel.classList.remove('closing');
    backdrop.classList.remove('closing');
  }, 250);
}

function renderRouteCard(route: RouteListItem): string {
  const distance = fmtKmBare(route.distance_m);
  const elevation = route.elevation_gain_m 
    ? `⛰️ +${Math.round(route.elevation_gain_m)}m`
    : '';
  const location = [route.city, route.country].filter(Boolean).join(', ') || 'Unknown location';
  const author = route.username_snapshot || 'Anonymous';
  const date = new Date(route.created_at).toLocaleDateString();

  return `
    <div class="route-card" data-route-id="${route.id}">
      <div class="route-card-header">
        <div>
          <h4 class="route-card-title">${escapeHtml(route.name)}</h4>
          <p class="route-card-author">by ${escapeHtml(author)} • ${date}</p>
          ${route.description ? `<p class="route-card-description">${escapeHtml(route.description)}</p>` : ''}
        </div>
        <span class="route-card-badge public">PUBLIC</span>
      </div>
      <div class="route-card-meta">
        <span>📏 ${distance}</span>
        ${elevation ? `<span>${elevation}</span>` : ''}
        <span>📍 ${escapeHtml(location)}</span>
      </div>
      <div class="route-card-actions">
        <button class="card-action-btn load-route-btn" data-route-id="${route.id}">
          <span>📥</span>
          <span>Load on Map</span>
        </button>
      </div>
    </div>
  `;
}

function renderLoading(container: HTMLElement) {
  container.innerHTML = `
    <div class="explore-loading">
      <div class="spinner"></div>
      <p>Loading routes...</p>
    </div>
  `;
}

function renderEmpty(container: HTMLElement, message: string = 'No routes found') {
  container.innerHTML = `
    <div class="explore-empty">
      <div class="explore-empty-icon">🗺️</div>
      <p>${message}</p>
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

export function setupExplorePanel(
  panel: HTMLElement,
  backdrop: HTMLElement,
  map: L.Map,
  routeManager: RouteManager
) {
  const closeBtn = document.getElementById('exploreClose') as HTMLButtonElement;
  const resultsContainer = document.getElementById('exploreResults') as HTMLDivElement;
  const loadMoreSection = document.getElementById('exploreLoadMore') as HTMLDivElement;
  const loadMoreBtn = document.getElementById('loadMoreBtn') as HTMLButtonElement;
  
  const filterToggle = document.getElementById('filterToggle') as HTMLButtonElement;
  const exploreFilters = document.querySelector('.explore-filters') as HTMLDivElement;
  
  filterToggle.addEventListener('click', () => {
    exploreFilters.classList.toggle('collapsed');
  });
  
  const filterCity = document.getElementById('filterCity') as HTMLInputElement;
  const filterCountry = document.getElementById('filterCountry') as HTMLInputElement;
  const filterMinDistance = document.getElementById('filterMinDistance') as HTMLInputElement;
  const filterMaxDistance = document.getElementById('filterMaxDistance') as HTMLInputElement;
  const applyFiltersBtn = document.getElementById('applyFilters') as HTMLButtonElement;
  const clearFiltersBtn = document.getElementById('clearFilters') as HTMLButtonElement;

  let currentOffset = 0;
  let hasMore = false;
  let currentFilters = {};

  closeBtn.addEventListener('click', () => closeExplorePanel(panel, backdrop));
  backdrop.addEventListener('click', () => closeExplorePanel(panel, backdrop));

  resultsContainer.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest('.load-route-btn') as HTMLElement;
    if (!btn) return;
    const routeId = btn.getAttribute('data-route-id');
    if (routeId) {
      await handleLoadRoute(routeId, map, routeManager, panel, backdrop);
    }
  });

  async function loadRoutes(append: boolean = false) {
    if (!append) {
      renderLoading(resultsContainer);
      currentOffset = 0;
    }

    try {
      const response = await exploreRoutes({
        limit: 20,
        offset: currentOffset,
        ...currentFilters
      });

      if (response.routes.length === 0 && currentOffset === 0) {
        renderEmpty(resultsContainer);
        loadMoreSection.classList.add('hidden');
        return;
      }

      const html = response.routes.map(route => renderRouteCard(route)).join('');
      
      if (append) {
        resultsContainer.insertAdjacentHTML('beforeend', html);
      } else {
        resultsContainer.innerHTML = html;
      }

      hasMore = response.has_more;
      if (hasMore) {
        loadMoreSection.classList.remove('hidden');
        currentOffset += response.routes.length;
      } else {
        loadMoreSection.classList.add('hidden');
      }

      trackEvent('routes_explored', { count: response.routes.length });

    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to load routes';
      renderError(resultsContainer, message);
      loadMoreSection.classList.add('hidden');
    }
  }

  applyFiltersBtn.addEventListener('click', () => {
    currentFilters = {
      city: filterCity.value.trim() || undefined,
      country: filterCountry.value.trim() || undefined,
      min_distance_km: filterMinDistance.value ? parseFloat(filterMinDistance.value) : undefined,
      max_distance_km: filterMaxDistance.value ? parseFloat(filterMaxDistance.value) : undefined,
    };
    loadRoutes(false);
  });

  clearFiltersBtn.addEventListener('click', () => {
    filterCity.value = '';
    filterCountry.value = '';
    filterMinDistance.value = '';
    filterMaxDistance.value = '';
    currentFilters = {};
    loadRoutes(false);
  });

  loadMoreBtn.addEventListener('click', () => {
    loadRoutes(true);
  });

  panel.addEventListener('transitionend', () => {
    const isVisible = !panel.classList.contains('hidden');
    if (isVisible && resultsContainer.children.length === 0) {
      loadRoutes(false);
    }
  });
}

async function handleLoadRoute(
  routeId: string,
  map: L.Map,
  routeManager: RouteManager,
  panel: HTMLElement,
  backdrop: HTMLElement
) {
  const btn = document.querySelector(`[data-route-id="${routeId}"].load-route-btn`) as HTMLButtonElement;
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
      route.elevation_loss_m
    );

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>📥</span><span>Load on Map</span>';
    }

    closeExplorePanel(panel, backdrop);

    trackEvent('route_loaded', { 
      route_id: routeId,
      distance_km: (route.distance_m / 1000).toFixed(2)
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    alert(`Failed to load route: ${message}`);
    
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>📥</span><span>Load on Map</span>';
    }
  }
}
