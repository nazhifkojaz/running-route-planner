import L from 'leaflet';
import { trackEvent } from '../analytics';


interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  icon?: string;
}

let searchTimeout: number | null = null;

export function createSearchPanel( backdrop: HTMLDivElement ): { panel: HTMLDivElement } {
  // Panel
  const panel = document.createElement('div');
  panel.id = 'searchPanel';
  panel.className = 'panel search-panel hidden';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'searchPanelTitle');

  panel.innerHTML = `
    <div class="panel-header">
      <div class="header-content">
        <div class="icon-badge">🔎</div>
        <h3 id="searchPanelTitle">Search Location</h3>
      </div>
      <button id="searchClose" class="close-btn" title="Close" aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="panel-content">
      <div class="search-input-wrapper">
        <span class="search-icon">🔎</span>
        <input 
          id="searchInput" 
          type="text" 
          class="search-input" 
          placeholder="Search for a city, address, or place..."
          autocomplete="off"
        />
        <button id="clearSearch" class="clear-search-btn" title="Clear">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div id="searchResults" class="search-results"></div>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  return { panel };
}

export function openSearchPanel(panel: HTMLElement, backdrop: HTMLElement) {
  backdrop.classList.remove('hidden');
  panel.classList.remove('hidden');
  panel.classList.add('opening');
  
  setTimeout(() => {
    panel.classList.remove('opening');
    const input = document.getElementById('searchInput') as HTMLInputElement;
    input?.focus();
  }, 300);
}

export function closeSearchPanel(panel: HTMLElement, backdrop: HTMLElement) {
  panel.classList.add('closing');
  backdrop.classList.add('closing');
  
  setTimeout(() => {
    panel.classList.add('hidden');
    backdrop.classList.add('hidden');
    panel.classList.remove('closing');
    backdrop.classList.remove('closing');
    
    // Clear search
    const input = document.getElementById('searchInput') as HTMLInputElement;
    const results = document.getElementById('searchResults') as HTMLDivElement;
    if (input) input.value = '';
    if (results) results.innerHTML = '';
  }, 250);
}

function renderEmptyState(container: HTMLDivElement) {
  container.innerHTML = `
    <div class="search-empty">
      <div class="search-empty-icon">🗺️</div>
      <p>Start typing to search for locations</p>
    </div>
  `;
}

function renderLoading(container: HTMLDivElement) {
  container.innerHTML = `
    <div class="search-loading">
      <div class="spinner"></div>
      <p>Searching...</p>
    </div>
  `;
}

function renderError(container: HTMLDivElement, message: string) {
  container.innerHTML = `
    <div class="search-error">
      <span class="search-error-icon">⚠️</span>
      <span>${message}</span>
    </div>
  `;
}

function renderResults(
  container: HTMLDivElement, 
  results: SearchResult[],
  onSelect: (lat: number, lon: number, name: string) => void
) {
  if (results.length === 0) {
    container.innerHTML = `
      <div class="search-empty">
        <div class="search-empty-icon">🔍</div>
        <p>No results found. Try a different search term.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = results.map(result => {
    const icon = "📍";
    const parts = result.display_name.split(',');
    const name = parts[0];
    const address = parts.slice(1).join(',').trim();

    return `
      <div class="search-result-item" data-lat="${result.lat}" data-lon="${result.lon}" data-name="${name}">
        <div class="result-icon">${icon}</div>
        <div class="result-content">
          <p class="result-name">${name}</p>
          <p class="result-address">${address}</p>
        </div>
      </div>
    `;
  }).join('');

  // Add click handlers
  container.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const lat = parseFloat(item.getAttribute('data-lat') || '0');
      const lon = parseFloat(item.getAttribute('data-lon') || '0');
      const name = item.getAttribute('data-name') || 'Location';
      onSelect(lat, lon, name);
    });
  });
}

async function searchLocation(query: string): Promise<SearchResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'RunningRoutePlanner/1.0'
    }
  });

  if (!response.ok) {
    throw new Error('Search failed');
  }

  return response.json();
}

export function setupSearchPanel(
  map: L.Map,
  panel: HTMLElement,
  backdrop: HTMLElement
) {
  const input = document.getElementById('searchInput') as HTMLInputElement;
  const clearBtn = document.getElementById('clearSearch') as HTMLButtonElement;
  const results = document.getElementById('searchResults') as HTMLDivElement;
  const closeBtn = document.getElementById('searchClose') as HTMLButtonElement;

  // Initial state
  renderEmptyState(results);

  // Close handlers
  closeBtn.addEventListener('click', () => closeSearchPanel(panel, backdrop));
  backdrop.addEventListener('click', () => closeSearchPanel(panel, backdrop));

  // Clear button
  clearBtn.addEventListener('click', () => {
    input.value = '';
    renderEmptyState(results);
    input.focus();
  });

  // Handle result selection
  const handleSelect = (lat: number, lon: number, name: string) => {
    map.flyTo([lat, lon], 15, {
      duration: 1.5,
      easeLinearity: 0.25
    });
    closeSearchPanel(panel, backdrop);
    trackEvent('location_searched', { location: name });
  };

  // Search input
  input.addEventListener('input', () => {
    const query = input.value.trim();

    if (!query) {
      renderEmptyState(results);
      if (searchTimeout) clearTimeout(searchTimeout);
      return;
    }

    // Debounce search
    if (searchTimeout) clearTimeout(searchTimeout);
    
    searchTimeout = window.setTimeout(async () => {
      renderLoading(results);
      
      try {
        const searchResults = await searchLocation(query);
        renderResults(results, searchResults, handleSelect);
      } catch (error) {
        renderError(results, 'Search failed. Please try again.');
      }
    }, 500);
  });

  // Enter key to select first result
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const firstResult = results.querySelector('.search-result-item') as HTMLElement;
      if (firstResult) {
        firstResult.click();
      }
    }
  });
}