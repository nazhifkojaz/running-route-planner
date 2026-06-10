export function openPanel(panel: HTMLElement, backdrop?: HTMLElement) {
  if (backdrop) backdrop.classList.remove('hidden');
  panel.classList.remove('hidden');
  panel.classList.add('opening');
  setTimeout(() => panel.classList.remove('opening'), 300);
}

export function closePanel(panel: HTMLElement, backdrop?: HTMLElement) {
  panel.classList.add('closing');
  backdrop?.classList.add('closing');
  setTimeout(() => {
    panel.classList.add('hidden');
    backdrop?.classList.add('hidden');
    panel.classList.remove('closing');
    backdrop?.classList.remove('closing');
  }, 250);
}
