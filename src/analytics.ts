declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

// Prefer env; fall back to your current ID
const GA_ID = 'G-06L5DZX7T2';

let gtagLoaded = false;

function loadGtag(id: string) {
  if (!id || gtagLoaded || document.getElementById('ga4-script')) return;

  // 1) Load GA script
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  s.id = 'ga4-script';
  document.head.appendChild(s);

  // 2) Bootstrap dataLayer + gtag shim
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtagShim(...args: any[]) {
    window.dataLayer!.push(arguments);
  };

  // 3) Initialize GA4 (debug in local dev)
  window.gtag('js', new Date());
  window.gtag('config', id, {
    send_page_view: false,
    debug_mode: location.hostname === 'localhost',
  });

  gtagLoaded = true;
}

function pageParams() {
  return {
    page_title: document.title,
    page_location: location.href,
    page_path: location.pathname + location.search + location.hash,
  };
}

function sendPageView() {
  if (!GA_ID || typeof window.gtag !== 'function') return;
  window.gtag('event', 'page_view', pageParams());
}

function bindSpaPageviews() {
  // Fire on history changes (pushState/replaceState), back/forward, and hash routing
  const fire = () => sendPageView();

  // Patch pushState/replaceState so SPA navigations trigger a page_view
  (['pushState', 'replaceState'] as const).forEach((method) => {
    const orig = history[method];
    history[method] = function (this: History, ...args: any[]) {
      const ret = orig.apply(this, args as any);
      // Wait a tick so URL/title settle
      setTimeout(fire, 0);
      return ret;
    } as any;
  });

  window.addEventListener('popstate', fire);
  window.addEventListener('hashchange', fire);

  // Initial load
  fire();
}

export function initAnalytics() {
  if (!GA_ID) return;
  loadGtag(GA_ID);
  bindSpaPageviews();
}

export function trackEvent(
  name: string,
  params: Record<string, any> = {}
): void {
  if (!GA_ID || typeof window.gtag !== 'function') return;
  window.gtag('event', name, params);
}

// Make this file a module
export {};
