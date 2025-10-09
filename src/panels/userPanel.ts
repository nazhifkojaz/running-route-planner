import * as api from '../api';
import { paceSecToStr, fmtKmBare } from '../utils';
import type { MeResponse } from '../types';


export function createUserPanel(): { panel: HTMLDivElement; content: HTMLDivElement; backdrop: HTMLDivElement } {
  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'sheetBackdrop';
  backdrop.className = 'sheet-backdrop hidden';

  // Panel
  const panel = document.createElement('div');
  panel.id = 'userPanel';
  panel.className = 'panel user-panel hidden';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'userPanelTitle');

  panel.innerHTML = `
    <div class="panel-header">
      <div class="header-content">
        <div class="icon-badge athlete-badge">👟</div>
        <h3 id="userPanelTitle">Account</h3>
      </div>
      <button id="userClose" class="close-btn" title="Close" aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div id="userContent" class="panel-content"></div>
  `;

  const content = panel.querySelector('#userContent') as HTMLDivElement;

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  return { panel, content, backdrop };
}

function renderLoggedOut(userContent: HTMLDivElement) {
  userContent.innerHTML = `
    <div class="auth-state">
      <div class="auth-illustration">
        <div class="illustration-circle">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="38" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4" opacity="0.3"/>
            <path d="M40 20V40L50 30" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="40" cy="55" r="8" stroke="currentColor" stroke-width="3"/>
          </svg>
        </div>
      </div>
      <div class="auth-content">
        <h4>Connect to Strava</h4>
        <p>Link your Strava account to get personalized pace and heart rate estimates based on your running history.</p>
      </div>
      <button id="connectStrava" class="connect-btn">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M7.5 6.5L2 13H6.5L10 6.5L7.5 6.5Z" fill="currentColor"/>
          <path d="M10 6.5L6.5 13H11L14.5 6.5L10 6.5Z" fill="currentColor" opacity="0.7"/>
        </svg>
        <span>Connect with Strava</span>
      </button>
      <p class="auth-hint">You'll be redirected to authorize securely</p>
    </div>
  `;

  document.getElementById('connectStrava')?.addEventListener('click', () => {
    location.href = api.getStravaStartUrl();
  });
}

function renderLoggedIn(me: MeResponse, userContent: HTMLDivElement) {
  const stats = [
    { 
      icon: '🏃', 
      label: 'Total Runs', 
      value: me.run_count_all?.toLocaleString() || '−'
    },
    { 
      icon: '📏', 
      label: 'Total Distance', 
      value: fmtKmBare(me.run_distance_all_m)
    },
    { 
      icon: '⚖️', 
      label: 'Weight', 
      value: me.weight_kg ? `${me.weight_kg} kg` : '−'
    },
    { 
      icon: '⏱️', 
      label: 'Avg Pace (Last 5)', 
      value: paceSecToStr(me.avg_pace_5_sec_per_km)
    },
    { 
      icon: '❤️', 
      label: 'Avg HR (Last 5)', 
      value: me.avg_hr_5 ? `${me.avg_hr_5} bpm` : '−'
    }
  ];

  userContent.innerHTML = `
    <div class="athlete-profile">
      <div class="profile-header">
        <div class="profile-avatar">
          ${me.username ? me.username.charAt(0).toUpperCase() : '?'}
        </div>
        <div class="profile-info">
          <h4>${me.username || 'Athlete'}</h4>
          <p class="athlete-id">ID: ${me.strava_athlete_id || '−'}</p>
        </div>
        <div class="connected-badge">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.2"/>
            <path d="M5 8L7 10L11 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>

      <div class="stats-grid">
        ${stats.map(stat => `
          <div class="stat-card">
            <div class="stat-icon">${stat.icon}</div>
            <div class="stat-content">
              <span class="stat-label">${stat.label}</span>
              <span class="stat-value">${stat.value}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <button id="syncStrava" class="sync-btn">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" class="sync-icon">
          <path d="M15 9C15 12.3137 12.3137 15 9 15C5.68629 15 3 12.3137 3 9C3 5.68629 5.68629 3 9 3C10.8885 3 12.5546 3.89731 13.5972 5.28125" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M13 3V6H10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>Sync Latest Data</span>
      </button>
    </div>
  `;

  const syncBtn = document.getElementById('syncStrava') as HTMLButtonElement;
  syncBtn?.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.classList.add('syncing');
    try {
      const updated = await api.syncStrava();
      renderLoggedIn(updated, userContent);
    } finally {
      syncBtn.disabled = false;
      syncBtn.classList.remove('syncing');
    }
  });
}

export async function openUserPanel(
  panel: HTMLDivElement,
  content: HTMLDivElement,
  backdrop: HTMLDivElement,
  accountControl: { setIcon: (connected: boolean) => void }
) {
  content.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
  
  backdrop.classList.remove('hidden');
  panel.classList.remove('hidden');
  panel.classList.add('opening');
  
  setTimeout(() => panel.classList.remove('opening'), 300);

  try {
    const me = await api.getMe();
    accountControl.setIcon(!!me.connected);
    me.connected ? renderLoggedIn(me, content) : renderLoggedOut(content);
  } catch {
    content.innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <h4>Connection Error</h4>
        <p>Could not reach the server. Please try again later.</p>
      </div>
    `;
  }
}

export function closeUserPanel(panel: HTMLDivElement, backdrop: HTMLDivElement) {
  panel.classList.add('closing');
  backdrop.classList.add('closing');
  
  setTimeout(() => {
    panel.classList.add('hidden');
    backdrop.classList.add('hidden');
    panel.classList.remove('closing');
    backdrop.classList.remove('closing');
  }, 250);
}

export async function initAccountIcon(
  accountControl: { setIcon: (connected: boolean) => void }
) {
  try {
    const me = await api.getMe();
    accountControl.setIcon(!!me.connected);
  } catch {}

  if (location.hash.includes('connected=strava')) {
    try {
      await api.syncStrava();
      const me = await api.getMe();
      accountControl.setIcon(!!me.connected);
    } catch {}
  }
}