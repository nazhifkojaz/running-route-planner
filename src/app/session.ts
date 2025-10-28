import { CONFIG } from '../config';
import { readHashParam } from '../utils';

export function handleHashSession() {
  const sessionFromHash = readHashParam('session');
  if (!sessionFromHash) return;

  localStorage.setItem(CONFIG.STORAGE_KEYS.SESSION_TOKEN, sessionFromHash);

  const params = new URLSearchParams(location.hash.slice(1));
  params.delete('session');
  const newHash = params.size ? `#${params.toString()}` : '';
  history.replaceState(
    null,
    '',
    `${location.pathname}${location.search || ''}${newHash}`
  );
}
