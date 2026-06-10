import { openPanel, closePanel } from './panelUtils';

export function createSettingsPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'settingsPanel';
  panel.className = 'panel settings-panel hidden';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'settingsTitle');

  panel.innerHTML = `
    <div class="panel-header">
      <div class="header-content">
        <div class="icon-badge">⚙️</div>
        <h3 id="settingsTitle">Settings</h3>
      </div>
      <button id="settingsClose" class="close-btn" title="Close" aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="panel-content">
      <!-- Route Actions -->
      <div class="setting-group">
        <div class="group-header">
          <span class="group-icon">🗺️</span>
          <h4>Route Actions</h4>
        </div>
        <div class="button-grid">
          <button id="clearBtn" type="button" class="action-btn danger-btn">
            <span class="btn-icon">🗑️</span>
            <span>Clear All</span>
          </button>
          <button id="reverseBtn" type="button" class="action-btn">
            <span class="btn-icon">🔄</span>
            <span>Reverse</span>
          </button>
        </div>
      </div>

      <!-- Loop Option -->
      <div class="setting-group">
        <div class="group-header">
          <span class="group-icon">🔁</span>
          <h4>Route Options</h4>
        </div>
        <label class="toggle-option">
          <input id="loop" type="checkbox" />
          <div class="toggle-switch">
            <div class="toggle-slider"></div>
          </div>
          <div class="toggle-label">
            <span class="label-text">Return to start</span>
            <span class="label-hint">Create a loop route</span>
          </div>
        </label>
      </div>

      <!-- Target Stats -->
      <div class="setting-group">
        <div class="group-header">
          <span class="group-icon">🎯</span>
          <h4>Target Stats</h4>
        </div>
        <div class="input-grid">
          <div class="input-field">
            <label for="targetPace">
              <span class="field-icon">⏱️</span>
              <span>Pace (mm:ss/km)</span>
            </label>
            <input id="targetPace" type="text" placeholder="5:30" />
          </div>
          <div class="input-field">
            <label for="targetWeight">
              <span class="field-icon">⚖️</span>
              <span>Weight (kg)</span>
            </label>
            <input id="targetWeight" type="number" step="0.1" min="20" max="200" placeholder="70" />
          </div>
        </div>
        <p class="hint-text">
          <span class="hint-icon">💡</span>
          ETA & calories are estimates based on these values.
          If they are left blank, your Strava data (if connected) will be used.
        </p>
      </div>

      <!-- Route Style -->
      <div class="setting-group">
        <div class="group-header">
          <span class="group-icon">🏃</span>
          <h4>Route Style</h4>
        </div>
        <div class="radio-group">
          <label class="radio-option">
            <input type="radio" name="engine" id="engineOSRM" value="osrm" checked />
            <div class="radio-card">
              <div class="radio-indicator"></div>
              <div class="radio-content">
                <span class="radio-title">Road Running</span>
                <span class="radio-desc">Clean road-biased routes; may ignore car-only detours</span>
              </div>
            </div>
          </label>
          <label class="radio-option">
            <input type="radio" name="engine" id="engineORS" value="ors" />
            <div class="radio-card">
              <div class="radio-indicator"></div>
              <div class="radio-content">
                <span class="radio-title">Pedestrian/Trail</span>
                <span class="radio-desc">Foot-walking via ORS, useful for parks and paths</span>
              </div>
            </div>
          </label>
        </div>
        <p id="engineNote" class="hint-text">
          <span class="hint-icon">ℹ️</span>
          Road Running is active. Add an ORS key to try Pedestrian/Trail.
        </p>
      </div>

      <!-- ORS API Key -->
      <div class="setting-group">
        <div class="group-header">
          <span class="group-icon">🔑</span>
          <h4>Pedestrian/Trail Key</h4>
        </div>
        <div class="input-field">
          <input 
            id="orsKey" 
            type="password" 
            placeholder="Paste your ORS API key for Pedestrian/Trail..."
            autocomplete="off" 
          />
        </div>
        <p class="hint-text">
          <span class="hint-icon">🔒</span>
          Optional. Road Running does not need a key; this is stored locally on your device only.
        </p>
      </div>

      <!-- GPX Actions -->
      <div class="setting-group">
        <div class="group-header">
          <span class="group-icon">📁</span>
          <h4>Import/Export GPX</h4>
        </div>
        <div class="button-grid">
          <button id="saveGpxBtn" type="button" class="action-btn primary-btn" disabled>
            <span class="btn-icon">💾</span>
            <span>Export GPX</span>
          </button>
          <button id="loadGpxBtn" type="button" class="action-btn">
            <span class="btn-icon">📂</span>
            <span>Import GPX</span>
          </button>
        </div>
        <input id="loadGpxInput" type="file" accept=".gpx,application/gpx+xml" style="display:none" />
      </div>

      <!-- Keyboard Shortcuts Info -->
      <div class="setting-group">
        <div class="group-header">
          <span class="group-icon">⌨️</span>
          <h4>Keyboard Shortcuts</h4>
        </div>
        <div class="shortcuts-list">
          <div class="shortcut-item">
            <span class="shortcut-key">ESC</span>
            <span class="shortcut-desc">Close panels</span>
          </div>
          <div class="shortcut-item">
            <span class="shortcut-key">Ctrl+Z</span>
            <span class="shortcut-desc">Undo last waypoint</span>
          </div>
        </div>
      </div>

      <!-- Support -->
      <div class="setting-group">
        <div class="group-header">
          <span class="group-icon">☕</span>
          <h4>Support Me!</h4>
        </div>
        <div class="shortcuts-list">
          <a 
            href="https://buymeacoffee.com/nazhifkojaz" 
            target="_blank" 
            rel="noopener noreferrer"
            class="action-btn support-btn"
          >
            <span class="btn-icon">☕</span>
            <span>Buy Me a Coffee</span>
          </a>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);
  return panel;
}

export function openSettingsPanel(panel: HTMLElement) {
  openPanel(panel);
}

export function closeSettingsPanel(panel: HTMLElement) {
  closePanel(panel);
}
