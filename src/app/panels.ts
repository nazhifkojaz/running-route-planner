import { createExplorePanel } from '../panels/explorePanel';
import { createMyRoutesPanel } from '../panels/myRoutesPanel';
import { createSaveRoutePanel } from '../panels/saveRoutePanel';
import { createSearchPanel } from '../panels/searchPanel';
import { createSettingsPanel } from '../panels/settingsPanel';
import { createUserPanel } from '../panels/userPanel';

export interface PanelContext {
  settingsPanel: HTMLDivElement;
  userPanel: HTMLDivElement;
  userContent: HTMLElement;
  userCloseButtonId: string;
  backdrop: HTMLDivElement;
  searchPanel: HTMLDivElement;
  saveRoutePanel: HTMLDivElement;
  explorePanel: HTMLDivElement;
  myRoutesPanel: HTMLDivElement;
}

export function initializePanels(): PanelContext {
  const settingsPanel = createSettingsPanel();
  const {
    panel: userPanel,
    content: userContent,
    backdrop,
  } = createUserPanel();
  const { panel: searchPanel } = createSearchPanel(backdrop);
  const { panel: saveRoutePanel } = createSaveRoutePanel(backdrop);
  const { panel: explorePanel } = createExplorePanel(backdrop);
  const { panel: myRoutesPanel } = createMyRoutesPanel(backdrop);

  return {
    settingsPanel,
    userPanel,
    userContent,
    // Keep the DOM id so we can fetch the element reliably later
    userCloseButtonId: 'userClose',
    backdrop,
    searchPanel,
    saveRoutePanel,
    explorePanel,
    myRoutesPanel,
  };
}
