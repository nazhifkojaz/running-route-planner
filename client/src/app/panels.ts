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
  const { panel: searchPanel } = createSearchPanel();
  const { panel: saveRoutePanel } = createSaveRoutePanel();
  const { panel: explorePanel } = createExplorePanel();
  const { panel: myRoutesPanel } = createMyRoutesPanel();

  return {
    settingsPanel,
    userPanel,
    userContent,
    userCloseButtonId: 'userClose',
    backdrop,
    searchPanel,
    saveRoutePanel,
    explorePanel,
    myRoutesPanel,
  };
}
