import * as api from './api';
import { paceSecToStr, fmtKmBare } from './utils';
import type { MeResponse } from './types';


function renderLoggedOut(userContent: HTMLDivElement) {
  userContent.innerHTML = `
    <p>Connect your Strava account to personalize pace/HR estimates and show your stats.</p>
    <div class="account-actions">
      <button id="connectStrava" class="primary">Connect Strava</button>
      <span class="muted">You'll be redirected to Strava to authorize.</span>
    </div>`;

  document.getElementById('connectStrava')?.addEventListener('click', () => {
    location.href = api.getStravaStartUrl();
  });
}

function renderLoggedIn(me: MeResponse, userContent: HTMLDivElement) {
  userContent.innerHTML = `
    <div class="kv"><span>Name</span><strong> : ${me.username ?? '-'}</strong></div>
    <div class="kv"><span>Athlete ID</span><strong> : ${me.strava_athlete_id ?? '-'}</strong></div>
    <div class="kv"><span>Weight</span><strong> : ${me.weight_kg ? me.weight_kg + ' kg' : '-'}</strong></div>
    <div class="kv"><span>Runs (all-time)</span><strong> : ${me.run_count_all ?? '-'}</strong></div>
    <div class="kv"><span>Distance (all-time)</span><strong> : ${fmtKmBare(me.run_distance_all_m)}</strong></div>
    <div class="kv"><span>Avg pace (last 5)</span><strong> : ${paceSecToStr(me.avg_pace_5_sec_per_km)}</strong></div>
    <div class="kv"><span>Avg HR (last 5)</span><strong> : ${me.avg_hr_5 ?? '-'}</strong></div>
    <div class="account-actions">
      <button id="syncStrava" class="primary">Sync latest</button>
    </div>`;

  document.getElementById('syncStrava')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    btn.disabled = true;
    try {
      const updated = await api.syncStrava();
      renderLoggedIn(updated, userContent);
    } finally {
      btn.disabled = false;
    }
  });
}

export async function openUserPanel(
  userPanel: HTMLDivElement,
  userContent: HTMLDivElement,
  backdrop: HTMLDivElement,
  accountControl: { setIcon: (connected: boolean) => void }
) {
  userContent.innerHTML = '<p class="muted small">Loading…</p>';
  userPanel.classList.remove('hidden');
  backdrop.classList.remove('hidden');

  try {
    const me = await api.getMe();
    accountControl.setIcon(!!me.connected);
    me.connected ? renderLoggedIn(me, userContent) : renderLoggedOut(userContent);
  } catch {
    userContent.innerHTML = '<p class="muted">Could not reach the server.</p>';
  }
}

export function closeUserPanel(
  userPanel: HTMLDivElement,
  backdrop: HTMLDivElement
) {
  userPanel.classList.add('hidden');
  backdrop.classList.add('hidden');
}

export async function initAccountIcon(
  accountControl: { setIcon: (connected: boolean) => void }
) {
  // Set initial icon state
  try {
    const me = await api.getMe();
    accountControl.setIcon(!!me.connected);
  } catch {}

  // Auto-sync when returning from Strava
  if (location.hash.includes('connected=strava')) {
    try {
      await api.syncStrava();
      const me = await api.getMe();
      accountControl.setIcon(!!me.connected);
    } catch {}
  }
}