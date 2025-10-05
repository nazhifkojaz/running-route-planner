// src/analytics.ts
declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

/** <<< REPLACE WITH YOUR MEASUREMENT ID >>> */
const GA_ID = 'G-06L5DZX7T2'; // e.g. G-123ABC4567

function ensureGtag(id: string): (...args: any[]) => void {
  // If already defined, just return it (typed as non-optional)
  if (typeof window.gtag === 'function') return window.gtag;

  // Bootstrap gtag & dataLayer
  window.dataLayer = window.dataLayer || [];
  const g = (...args: any[]) => {
    (window.dataLayer as any[]).push(args);
  };
  window.gtag = g;

  // Load the GA script
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);

  // Init config (send_page_view disabled; we’ll send manually for SPA accuracy)
  g('js', new Date());
  g('config', id, { send_page_view: false });

  return g; // <- non-optional function
}

export function initAnalytics(): void {
  if (!GA_ID || typeof document === 'undefined') return;
  const g = ensureGtag(GA_ID);

  const sendPageView = () => {
    g('event', 'page_view', {
      page_title: document.title,
      page_location: location.href,
      page_path: location.pathname + location.search + location.hash,
    });
  };

  // Initial + simple SPA navs
  sendPageView();
  window.addEventListener('hashchange', sendPageView);
  window.addEventListener('popstate', sendPageView);
}

export function trackEvent(name: string, params: Record<string, any> = {}): void {
  if (!GA_ID) return;
  const g = ensureGtag(GA_ID);
  g('event', name, params);
}

// Make this file a module so the global augmentation applies
export {};
