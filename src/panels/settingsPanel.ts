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
          ETA & calories are estimates based on these values
        </p>
      </div>

      <!-- Routing Engine -->
      <div class="setting-group hidden">
        <div class="group-header">
          <span class="group-icon">🚗</span>
          <h4>Routing Engine</h4>
        </div>
        <div class="radio-group">
          <label class="radio-option">
            <input type="radio" name="engine" id="engineOSRM" value="osrm" checked />
            <div class="radio-card">
              <div class="radio-indicator"></div>
              <div class="radio-content">
                <span class="radio-title">OSRM</span>
                <span class="radio-desc">Driving routes</span>
              </div>
            </div>
          </label>
          <label class="radio-option">
            <input type="radio" name="engine" id="engineORS" value="ors" />
            <div class="radio-card">
              <div class="radio-indicator"></div>
              <div class="radio-content">
                <span class="radio-title">ORS</span>
                <span class="radio-desc">Foot-walking routes</span>
              </div>
            </div>
          </label>
        </div>
        <p id="engineNote" class="hint-text">
          <span class="hint-icon">ℹ️</span>
          Set an ORS key below to enable
        </p>
      </div>

      <!-- ORS API Key -->
      <div class="setting-group hidden">
        <div class="group-header">
          <span class="group-icon">🔑</span>
          <h4>ORS API Key</h4>
        </div>
        <div class="input-field">
          <input 
            id="orsKey" 
            type="password" 
            placeholder="Paste your ORS API key..."
            autocomplete="off" 
          />
        </div>
        <p class="hint-text">
          <span class="hint-icon">🔒</span>
          Stored locally on your device only
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
    </div>
  `;

  document.body.appendChild(panel);
  return panel;
}

export function openSettingsPanel(panel: HTMLElement) {
  panel.classList.remove('hidden');
  panel.classList.add('opening');
  setTimeout(() => panel.classList.remove('opening'), 300);
}

export function closeSettingsPanel(panel: HTMLElement) {
  panel.classList.add('closing');
  setTimeout(() => {
    panel.classList.add('hidden');
    panel.classList.remove('closing');
  }, 250);
}