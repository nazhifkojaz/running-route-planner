import L from 'leaflet';
import type { RouteManager } from '../routing/routeManager';
import { trackEvent } from '../services/analytics';
import {
  deleteRoute,
  getMyRoutes,
} from '../services/routes';
import { openPanel, closePanel } from './panelUtils';
import { renderRouteCard, renderLoading, renderEmpty, renderError, handleLoadRoute } from './routeCardHelpers';


export function createMyRoutesPanel(): { panel: HTMLDivElement } {
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
      </div>

      <div id="myRoutesLoadMore" class="load-more-section hidden">
        <button id="myRoutesLoadMoreBtn" class="action-btn">
          Load More Routes
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  return { panel };
}

export function openMyRoutesPanel(
  panel: HTMLElement,
  backdrop: HTMLElement,
  loadRoutesCallback: () => void
) {
  openPanel(panel, backdrop);
  loadRoutesCallback();
}

export function closeMyRoutesPanel(panel: HTMLElement, backdrop: HTMLElement) {
  closePanel(panel, backdrop);
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

  closeBtn.addEventListener('click', () => closeMyRoutesPanel(panel, backdrop));
  backdrop.addEventListener('click', () => closeMyRoutesPanel(panel, backdrop));

  resultsContainer.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const loadBtn = target.closest('.load-route-btn') as HTMLElement;
    if (loadBtn) {
      const routeId = loadBtn.getAttribute('data-route-id');
      if (routeId) {
        await handleLoadRoute(routeId, routeManager, () => closeMyRoutesPanel(panel, backdrop), 'Load');
      }
      return;
    }
    const deleteBtn = target.closest('.delete-route-btn') as HTMLElement;
    if (deleteBtn) {
      const routeId = deleteBtn.getAttribute('data-route-id');
      if (routeId) {
        await handleDeleteRoute(routeId, resultsContainer);
      }
    }
  });

  async function loadRoutes(append: boolean = false) {
    if (!append) {
      renderLoading(resultsContainer, 'Loading your routes...');
      currentOffset = 0;
    }

    try {
      const response = await getMyRoutes(20, currentOffset);

      if (response.routes.length === 0 && currentOffset === 0) {
        renderEmpty(resultsContainer, '📂', 'No saved routes yet');
        loadMoreSection.classList.add('hidden');
        return;
      }

      const html = response.routes.map(route => renderRouteCard(route, {
        actions: [
          { label: 'Load', cssClass: 'load-route-btn' },
          { label: 'Delete', cssClass: 'danger-action-btn delete-route-btn', icon: '🗑️' },
        ],
        visibilityBadge: 'dynamic',
      })).join('');
      
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

      trackEvent('my_routes_viewed', { count: response.routes.length });

    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to load your routes';
      renderError(resultsContainer, message);
      loadMoreSection.classList.add('hidden');
    }
  }

  loadMoreBtn.addEventListener('click', () => {
    loadRoutes(true);
  });

  return loadRoutes;
}

async function handleDeleteRoute(
  routeId: string,
  resultsContainer: HTMLElement
) {
  if (!confirm('Are you sure you want to delete this route? This action cannot be undone.')) {
    return;
  }

  try {
    await deleteRoute(routeId);

    const card = document.querySelector(`.route-card[data-route-id="${routeId}"]`);
    if (card) {
      card.remove();
    }

    if (resultsContainer.querySelectorAll('.route-card').length === 0) {
      renderEmpty(resultsContainer);
    }

    trackEvent('route_deleted', { route_id: routeId });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    alert(`Failed to delete route: ${message}`);
  }
}
