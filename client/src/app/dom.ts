import type { PanelContext } from './panels';

export interface DomRefs {
  settingsPanel: HTMLDivElement;
  settingsClose: HTMLButtonElement;
  clearBtn: HTMLButtonElement;
  reverseBtn: HTMLButtonElement;
  saveGpxBtn: HTMLButtonElement;
  loadGpxBtn: HTMLButtonElement;
  loadGpxInput: HTMLInputElement;
  loopChk: HTMLInputElement;
  targetPaceInput: HTMLInputElement;
  targetWeightInput: HTMLInputElement;
  engineOSRM: HTMLInputElement;
  engineORS: HTMLInputElement;
  engineNote: HTMLParagraphElement;
  orsKeyInput: HTMLInputElement;
  userPanel: HTMLDivElement;
  userContent: HTMLElement;
  userClose: HTMLButtonElement;
  backdrop: HTMLDivElement;
  searchPanel: HTMLDivElement;
  saveRoutePanel: HTMLDivElement;
  explorePanel: HTMLDivElement;
  myRoutesPanel: HTMLDivElement;
}

export function collectDomRefs(panels: PanelContext): DomRefs {
  return {
    settingsPanel: panels.settingsPanel,
    settingsClose: getRequiredElement<HTMLButtonElement>('settingsClose'),
    clearBtn: getRequiredElement<HTMLButtonElement>('clearBtn'),
    reverseBtn: getRequiredElement<HTMLButtonElement>('reverseBtn'),
    saveGpxBtn: getRequiredElement<HTMLButtonElement>('saveGpxBtn'),
    loadGpxBtn: getRequiredElement<HTMLButtonElement>('loadGpxBtn'),
    loadGpxInput: getRequiredElement<HTMLInputElement>('loadGpxInput'),
    loopChk: getRequiredElement<HTMLInputElement>('loop'),
    targetPaceInput: getRequiredElement<HTMLInputElement>('targetPace'),
    targetWeightInput: getRequiredElement<HTMLInputElement>('targetWeight'),
    engineOSRM: getRequiredElement<HTMLInputElement>('engineOSRM'),
    engineORS: getRequiredElement<HTMLInputElement>('engineORS'),
    engineNote: getRequiredElement<HTMLParagraphElement>('engineNote'),
    orsKeyInput: getRequiredElement<HTMLInputElement>('orsKey'),
    userPanel: panels.userPanel,
    userContent: panels.userContent,
    userClose: getRequiredElement<HTMLButtonElement>(panels.userCloseButtonId),
    backdrop: panels.backdrop,
    searchPanel: panels.searchPanel,
    saveRoutePanel: panels.saveRoutePanel,
    explorePanel: panels.explorePanel,
    myRoutesPanel: panels.myRoutesPanel,
  };
}

function getRequiredElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Expected DOM element with id "${id}" to exist`);
  }
  return el as T;
}
