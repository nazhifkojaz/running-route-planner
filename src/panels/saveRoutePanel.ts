import { getRouteLocation } from '../geocoding';
import { trackEvent } from '../services/analytics';
import {
  createRoute,
  latlngsToGeoJSON,
} from '../services/routes';
import { state } from '../state';
import { RouteCreateData } from '../types';


export function createSaveRoutePanel( backdrop: HTMLDivElement ): { panel: HTMLDivElement } {
  const panel = document.createElement('div');
  panel.id = 'saveRoutePanel';
  panel.className = 'panel save-route-panel hidden';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');

  panel.innerHTML = `
    <div class="panel-header">
      <div class="header-content">
        <div class="icon-badge">💾</div>
        <h3>Save Route</h3>
      </div>
      <button id="saveRouteClose" class="close-btn" title="Close">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="panel-content">
      <form id="saveRouteForm">
        <!-- Route Name -->
        <div class="input-field">
          <label for="routeName">
            <span class="field-icon">📝</span>
            <span>Route Name *</span>
          </label>
          <input 
            id="routeName" 
            type="text" 
            required
            maxlength="100"
            placeholder="My Morning Run"
          />
        </div>

        <!-- Description -->
        <div class="input-field">
          <label for="routeDescription">
            <span class="field-icon">📄</span>
            <span>Description (optional)</span>
          </label>
          <textarea 
            id="routeDescription" 
            maxlength="500"
            rows="3"
            placeholder="A beautiful route through the park..."
          ></textarea>
        </div>

        <!-- Location (Auto-detected, read-only) -->
        <div class="input-grid">
          <div class="input-field">
            <label for="routeCity">
              <span class="field-icon">🏙️</span>
              <span>City (auto-detected)</span>
            </label>
            <input 
              id="routeCity" 
              type="text" 
              readonly
              placeholder="Detecting..."
              class="readonly-input"
            />
          </div>
          <div class="input-field">
            <label for="routeCountry">
              <span class="field-icon">🌍</span>
              <span>Country (auto-detected)</span>
            </label>
            <input 
              id="routeCountry" 
              type="text" 
              readonly
              placeholder="Detecting..."
              class="readonly-input"
            />
          </div>
        </div>

        <!-- Visibility -->
        <div class="setting-group">
          <div class="group-header">
            <span class="group-icon">👁️</span>
            <h4>Visibility</h4>
          </div>
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" name="visibility" value="private" checked />
              <div class="radio-card">
                <div class="radio-indicator"></div>
                <div class="radio-content">
                  <span class="radio-title">Private</span>
                  <span class="radio-desc">Only you can see</span>
                </div>
              </div>
            </label>
            <label class="radio-option">
              <input type="radio" name="visibility" value="public" />
              <div class="radio-card">
                <div class="radio-indicator"></div>
                <div class="radio-content">
                  <span class="radio-title">Public</span>
                  <span class="radio-desc">Anyone can see</span>
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- Route Info (Read-only) -->
        <div class="route-info">
          <div class="info-item">
            <span class="info-icon">📏</span>
            <span class="info-label">Distance:</span>
            <span class="info-value" id="saveRouteDistance">-</span>
          </div>
          <div class="info-item">
            <span class="info-icon">⛰️</span>
            <span class="info-label">Elevation:</span>
            <span class="info-value" id="saveRouteElevation">-</span>
          </div>
        </div>

        <!-- Submit -->
        <div class="form-actions">
          <button type="button" id="saveRouteCancel" class="action-btn">
            Cancel
          </button>
          <button type="submit" id="saveRouteSubmit" class="action-btn primary-btn">
            <span class="btn-icon">💾</span>
            <span>Save Route</span>
          </button>
        </div>

        <div id="saveRouteError" class="error-message hidden"></div>
        <div id="saveRouteSuccess" class="success-message hidden"></div>
      </form>
    </div>
  `;

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  return { panel };
}

export async function openSaveRoutePanel(
  panel: HTMLElement,
  backdrop: HTMLElement,
  routeData: {
    distance_m: number;
    elevation_gain_m?: number;
    elevation_loss_m?: number;
  }
) {
  // Pre-fill route info
  const distanceEl = document.getElementById('saveRouteDistance');
  const elevationEl = document.getElementById('saveRouteElevation');
  const cityInput = document.getElementById('routeCity') as HTMLInputElement;
  const countryInput = document.getElementById('routeCountry') as HTMLInputElement;

  if (distanceEl) {
    distanceEl.textContent = `${(routeData.distance_m / 1000).toFixed(2)} km`;
  }

  if (elevationEl) {
    if (routeData.elevation_gain_m !== undefined && routeData.elevation_loss_m !== undefined) {
      elevationEl.textContent = `+${Math.round(routeData.elevation_gain_m)}m / -${Math.round(routeData.elevation_loss_m)}m`;
    } else {
      elevationEl.textContent = 'Not available';
    }
  }

  // Auto-detect location
  if (cityInput && countryInput) {
    cityInput.value = 'Detecting...';
    countryInput.value = 'Detecting...';

    if (state.lastRouteLatLngs && state.lastRouteLatLngs.length > 0) {
      try {
        const location = await getRouteLocation(state.lastRouteLatLngs);
        
        if (location) {
          cityInput.value = location.city || 'Unknown';
          countryInput.value = location.country || 'Unknown';
        } else {
          cityInput.value = 'Unable to detect';
          countryInput.value = 'Unable to detect';
        }
      } catch (error) {
        console.error('Location detection failed:', error);
        cityInput.value = 'Detection failed';
        countryInput.value = 'Detection failed';
      }
    } else {
      cityInput.value = 'No route data';
      countryInput.value = 'No route data';
    }
  }

  backdrop.classList.remove('hidden');
  panel.classList.remove('hidden');
  panel.classList.add('opening');

  setTimeout(() => {
    panel.classList.remove('opening');
    const nameInput = document.getElementById('routeName') as HTMLInputElement;
    nameInput?.focus();
  }, 300);
}

export function closeSaveRoutePanel(panel: HTMLElement, backdrop: HTMLElement) {
  panel.classList.add('closing');
  backdrop.classList.add('closing');

  setTimeout(() => {
    panel.classList.add('hidden');
    backdrop.classList.add('hidden');
    panel.classList.remove('closing');
    backdrop.classList.remove('closing');

    // Reset form
    const form = document.getElementById('saveRouteForm') as HTMLFormElement;
    form?.reset();

    // Hide messages
    document.getElementById('saveRouteError')?.classList.add('hidden');
    document.getElementById('saveRouteSuccess')?.classList.add('hidden');
  }, 250);
}

export function setupSaveRoutePanel(
  panel: HTMLElement,
  backdrop: HTMLElement,
  onSuccess: () => void
) {
  const form = document.getElementById('saveRouteForm') as HTMLFormElement;
  const closeBtn = document.getElementById('saveRouteClose') as HTMLButtonElement;
  const cancelBtn = document.getElementById('saveRouteCancel') as HTMLButtonElement;
  const submitBtn = document.getElementById('saveRouteSubmit') as HTMLButtonElement;
  const errorEl = document.getElementById('saveRouteError') as HTMLDivElement;
  const successEl = document.getElementById('saveRouteSuccess') as HTMLDivElement;

  // Close handlers
  closeBtn.addEventListener('click', () => closeSaveRoutePanel(panel, backdrop));
  cancelBtn.addEventListener('click', () => closeSaveRoutePanel(panel, backdrop));
  backdrop.addEventListener('click', () => closeSaveRoutePanel(panel, backdrop));

  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Hide previous messages
    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');

    // Get form values
    const name = (document.getElementById('routeName') as HTMLInputElement).value.trim();
    const description = (document.getElementById('routeDescription') as HTMLTextAreaElement).value.trim() || undefined;
    const city = (document.getElementById('routeCity') as HTMLInputElement).value.trim();
    const country = (document.getElementById('routeCountry') as HTMLInputElement).value.trim();
    const visibility = (document.querySelector('input[name="visibility"]:checked') as HTMLInputElement).value as 'private' | 'public';

    // Don't save if location detection failed or shows placeholders
    const cityToSave = (city && !['Detecting...', 'Unable to detect', 'Detection failed', 'No route data', 'Unknown'].includes(city)) 
      ? city 
      : undefined;
    
    const countryToSave = (country && !['Detecting...', 'Unable to detect', 'Detection failed', 'No route data', 'Unknown'].includes(country)) 
      ? country 
      : undefined;

    // Get current route data
    if (!state.lastRouteLatLngs.length || state.baseDistanceM === 0) {
      errorEl.textContent = 'No route to save. Please create a route first.';
      errorEl.classList.remove('hidden');
      return;
    }

    // Get elevation data from UI
    const elevText = document.getElementById('saveRouteElevation')?.textContent || '';
    const elevMatch = elevText.match(/\+(\d+)m \/ -(\d+)m/);
    const elevation_gain_m = elevMatch ? parseFloat(elevMatch[1]) : undefined;
    const elevation_loss_m = elevMatch ? parseFloat(elevMatch[2]) : undefined;

    // Convert to GeoJSON
    const waypointsLatLng = state.waypoints.map(([lon, lat]) => [lat, lon] as [number, number]);
    const geometry = latlngsToGeoJSON(state.lastRouteLatLngs, waypointsLatLng);

    const routeData: RouteCreateData = {
      name,
      description,
      distance_m: state.baseDistanceM,
      city: cityToSave,
      country: countryToSave,
      elevation_gain_m,
      elevation_loss_m,
      visibility,
      geometry,
    };

    // Disable submit button
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      await createRoute(routeData);

      // Success!
      successEl.textContent = '✓ Route saved successfully!';
      successEl.classList.remove('hidden');

      trackEvent('route_saved', { 
        visibility,
        distance_km: (state.baseDistanceM / 1000).toFixed(2),
        has_location: !!(cityToSave || countryToSave)
      });

      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span class="btn-icon">💾</span><span>Save Route</span>';

      // Close after a short delay
      setTimeout(() => {
        closeSaveRoutePanel(panel, backdrop);
        onSuccess();
      }, 1500);

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save route';
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span class="btn-icon">💾</span><span>Save Route</span>';
    }
  });
}
