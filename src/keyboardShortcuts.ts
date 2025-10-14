import { RouteManager } from './route';
import { 
  closeSettingsPanel 
} from './panels/settingsPanel';
import { 
  closeUserPanel 
} from './panels/userPanel';
import {
  closeSearchPanel
} from './panels/searchPanel';
import {
  closeSaveRoutePanel
} from './panels/saveRoutePanel';
import {
  closeExplorePanel
} from './panels/explorePanel';
import {
  closeMyRoutesPanel
} from './panels/myRoutesPanel';
import { PanelElements } from './types';


export function setupKeyboardShortcuts(
  routeManager: RouteManager,
  panels: PanelElements
) {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    // Escape key - Close all panels
    if (e.key === 'Escape') {
      handleEscapeKey(panels);
      return;
    }

    // Ctrl+Z - Undo last waypoint
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      if (isTyping(e.target)) {
        return;
      }
      
      e.preventDefault();
      routeManager.undoLastWaypoint();
      return;
    }
  });
}

function handleEscapeKey(panels: PanelElements) {
  if (!panels.saveRoutePanel.classList.contains('hidden')) {
    closeSaveRoutePanel(panels.saveRoutePanel, panels.backdrop);
    return;
  }

  if (!panels.explorePanel.classList.contains('hidden')) {
    closeExplorePanel(panels.explorePanel, panels.backdrop);
    return;
  }

  if (!panels.myRoutesPanel.classList.contains('hidden')) {
    closeMyRoutesPanel(panels.myRoutesPanel, panels.backdrop);
    return;
  }

  if (!panels.searchPanel.classList.contains('hidden')) {
    closeSearchPanel(panels.searchPanel, panels.backdrop);
    return;
  }

  if (!panels.userPanel.classList.contains('hidden')) {
    closeUserPanel(panels.userPanel, panels.backdrop);
    return;
  }

  if (!panels.settingsPanel.classList.contains('hidden')) {
    closeSettingsPanel(panels.settingsPanel);
    return;
  }
}

function isTyping(target: EventTarget | null): boolean {
  if (!target) return false;
  
  const element = target as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  
  // Check if user is typing in input, textarea, or contenteditable
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    element.isContentEditable
  );
}