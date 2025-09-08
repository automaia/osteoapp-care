/**
 * Google Analytics integration for React SPA
 * 
 * This module provides functions to initialize and interact with Google Analytics 4
 * in a React Single Page Application context.
 */

// Google Analytics Measurement ID
const GA_MEASUREMENT_ID = 'G-B4K0K66PE2';

/**
 * Initialize Google Analytics
 * This should be called once when the application loads
 */
export const initGoogleAnalytics = (): void => {
  if (typeof window === 'undefined') return;

  // Create script elements to load GA
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  
  const script2 = document.createElement('script');
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
  `;
  
  // Add scripts to document head
  document.head.appendChild(script1);
  document.head.appendChild(script2);
  
  console.log('✅ Google Analytics initialized');
};

/**
 * Track a page view in SPA context
 * Call this function on route changes
 * 
 * @param {string} path - Current path (e.g., '/patients')
 * @param {string} title - Page title
 */
export const trackPageView = (path: string, title: string): void => {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  window.gtag('event', 'page_view', {
    page_title: title,
    page_path: path,
    page_location: window.location.origin + path
  });
  
  console.log(`📊 GA tracked page view: ${title} (${path})`);
};

/**
 * Track a custom event
 * 
 * @param {string} eventName - Event name
 * @param {Object} [params] - Event parameters
 */
export const trackEvent = (
  eventName: string,
  params?: Record<string, any>
): void => {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  window.gtag('event', eventName, params);
};

/**
 * Set user properties
 * 
 * @param {Object} properties - User properties
 */
export const setUserProperties = (properties: Record<string, any>): void => {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  window.gtag('set', 'user_properties', properties);
};

/**
 * Set user ID for cross-device tracking
 * 
 * @param {string} userId - The user ID
 */
export const setUserId = (userId: string): void => {
  if (typeof window === 'undefined' || !window.gtag) return;
  
  window.gtag('config', GA_MEASUREMENT_ID, {
    user_id: userId
  });
};

export default {
  initGoogleAnalytics,
  trackPageView,
  trackEvent,
  setUserProperties,
  setUserId
};