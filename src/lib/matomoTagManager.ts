/**
 * Matomo Tag Manager integration for React SPA
 * 
 * This module provides functions to initialize and interact with Matomo Tag Manager
 * in a React Single Page Application context.
 */

// Define window._mtm and _paq for TypeScript
declare global {
  interface Window {
    _mtm: any[];
    _paq: any[];
  }
}

// Container ID for Matomo Tag Manager
const CONTAINER_ID = '5lHDZELp';
const MATOMO_URL = 'https://cdn.matomo.cloud/ostheoappcare.matomo.cloud';

/**
 * Initialize Matomo Tag Manager
 * This should be called once when the application loads
 */
export const initMatomoTagManager = (): void => {
  if (typeof window === 'undefined') return;

  // Initialize _paq array for Matomo tracking configuration
  window._paq = window._paq || [];
  
  // Set cookie domain to auto-detect for proper cookie handling
  // Disable cookie domain to prevent issues on localhost and development environments
  // Using false disables cookie domain setting for localhost compatibility
  window._paq.push(['setCookieDomain', false]);
  
  // Set cookie path to root directory
  window._paq.push(['setCookiePath', '/']);

  // Initialize _mtm array if it doesn't exist
  window._mtm = window._mtm || [];
  
  // Push the start event
  window._mtm.push({'mtm.startTime': new Date().getTime(), 'event': 'mtm.Start'});
  
  // Create and inject the script
  const d = document;
  const g = d.createElement('script');
  const s = d.getElementsByTagName('script')[0];
  
  g.async = true;
  g.src = `${MATOMO_URL}/container_${CONTAINER_ID}.js`;
  
  if (s && s.parentNode) {
    s.parentNode.insertBefore(g, s);
  } else {
    document.head.appendChild(g);
  }
  
  console.log('✅ Matomo Tag Manager initialized');
};

/**
 * Track a page view in SPA context
 * Call this function on route changes
 * 
 * @param {string} path - Current path (e.g., '/patients')
 * @param {string} title - Page title
 */
export const trackPageView = (path: string, title: string): void => {
  if (typeof window === 'undefined' || !window._mtm) return;
  
  // Push the page view event with custom URL and title
  window._mtm.push({
    'event': 'mtm.PageView',
    'mtm.pageUrl': window.location.origin + path,
    'mtm.pageTitle': title
  });
  
  console.log(`📊 Matomo tracked page view: ${title} (${path})`);
};

/**
 * Track a custom event
 * 
 * @param {string} category - Event category
 * @param {string} action - Event action
 * @param {string} [name] - Event name (optional)
 * @param {number} [value] - Event value (optional)
 */
export const trackEvent = (
  category: string,
  action: string,
  name?: string,
  value?: number
): void => {
  if (typeof window === 'undefined' || !window._mtm) return;
  
  const eventData: Record<string, any> = {
    'event': 'mtm.Event',
    'mtm.eventCategory': category,
    'mtm.eventAction': action
  };
  
  if (name !== undefined) {
    eventData['mtm.eventName'] = name;
  }
  
  if (value !== undefined) {
    eventData['mtm.eventValue'] = value;
  }
  
  window._mtm.push(eventData);
};

/**
 * Set a custom dimension
 * 
 * @param {number} dimensionId - The dimension ID
 * @param {string} value - The dimension value
 */
export const setCustomDimension = (dimensionId: number, value: string): void => {
  if (typeof window === 'undefined' || !window._mtm) return;
  
  window._mtm.push({
    'event': 'mtm.CustomDimension',
    [`mtm.customDimension${dimensionId}`]: value
  });
};

/**
 * Set user ID for cross-device tracking
 * 
 * @param {string} userId - The user ID
 */
export const setUserId = (userId: string): void => {
  if (typeof window === 'undefined' || !window._mtm) return;
  
  window._mtm.push({
    'mtm.userId': userId
  });
};

export default {
  initMatomoTagManager,
  trackPageView,
  trackEvent,
  setCustomDimension,
  setUserId
};