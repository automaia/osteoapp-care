import { auth } from '../firebase/config';

// Types for stored data
interface StoredFormData {
  formId: string;
  data: Record<string, any>;
  timestamp: number;
  path: string;
}

interface StoredNavigation {
  path: string;
  scrollPosition: { x: number; y: number };
  timestamp: number;
}

// Constants
const FORM_DATA_KEY = 'osteoapp_form_data';
const NAVIGATION_KEY = 'osteoapp_navigation';
const SESSION_KEY = 'osteoapp_session';
const EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Saves form data to localStorage
 */
export function saveFormData(formId: string, data: Record<string, any>): void {
  try {
    const currentPath = window.location.pathname;
    const storedData: StoredFormData = {
      formId,
      data,
      timestamp: Date.now(),
      path: currentPath
    };
    
    localStorage.setItem(`${FORM_DATA_KEY}_${formId}`, JSON.stringify(storedData));
    console.log(`✅ Form data saved for ${formId}`);
  } catch (error) {
    console.error('❌ Error saving form data:', error);
  }
}

/**
 * Retrieves form data from localStorage
 */
export function getFormData<T = Record<string, any>>(formId: string): T | null {
  try {
    const storedDataString = localStorage.getItem(`${FORM_DATA_KEY}_${formId}`);
    if (!storedDataString) return null;
    
    const storedData: StoredFormData = JSON.parse(storedDataString);
    
    // Check if data is expired
    if (Date.now() - storedData.timestamp > EXPIRY_TIME) {
      localStorage.removeItem(`${FORM_DATA_KEY}_${formId}`);
      return null;
    }
    
    // Check if we're on the same path
    if (storedData.path !== window.location.pathname) {
      return null;
    }
    
    return storedData.data as T;
  } catch (error) {
    console.error('❌ Error retrieving form data:', error);
    return null;
  }
}

/**
 * Clears form data from localStorage
 */
export function clearFormData(formId: string): void {
  try {
    localStorage.removeItem(`${FORM_DATA_KEY}_${formId}`);
    // Also clear any related form data that might exist
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (key.startsWith(`${FORM_DATA_KEY}_${formId}`)) {
        localStorage.removeItem(key);
      }
    });
    console.log(`✅ Form data cleared for ${formId}`);
  } catch (error) {
    console.error('❌ Error clearing form data:', error);
  }
}

/**
 * Clears all form data from localStorage
 */
export function clearAllFormData(): void {
  try {
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (key.startsWith(FORM_DATA_KEY)) {
        localStorage.removeItem(key);
      }
    });
    console.log('✅ All form data cleared');
  } catch (error) {
    console.error('❌ Error clearing all form data:', error);
  }
}

/**
 * Saves current navigation state
 */
export function saveNavigationState(): void {
  try {
    const currentPath = window.location.pathname + window.location.search;
    const scrollPosition = {
      x: window.scrollX,
      y: window.scrollY
    };
    
    const navigationState: StoredNavigation = {
      path: currentPath,
      scrollPosition,
      timestamp: Date.now()
    };
    
    sessionStorage.setItem(NAVIGATION_KEY, JSON.stringify(navigationState));
  } catch (error) {
    console.error('❌ Error saving navigation state:', error);
  }
}

/**
 * Retrieves and applies saved navigation state
 */
export function restoreNavigationState(): StoredNavigation | null {
  try {
    const storedNavString = sessionStorage.getItem(NAVIGATION_KEY);
    if (!storedNavString) return null;
    
    const storedNav: StoredNavigation = JSON.parse(storedNavString);
    
    // Check if data is expired
    if (Date.now() - storedNav.timestamp > EXPIRY_TIME) {
      sessionStorage.removeItem(NAVIGATION_KEY);
      return null;
    }
    
    return storedNav;
  } catch (error) {
    console.error('❌ Error retrieving navigation state:', error);
    return null;
  }
}

/**
 * Saves authentication session data
 */
export function saveSessionState(): void {
  try {
    if (!auth.currentUser) return;
    
    const sessionData = {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      timestamp: Date.now()
    };
    
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  } catch (error) {
    console.error('❌ Error saving session state:', error);
  }
}

/**
 * Checks if there's a valid stored session
 */
export function hasValidSession(): boolean {
  try {
    const sessionDataString = localStorage.getItem(SESSION_KEY);
    if (!sessionDataString) return false;
    
    const sessionData = JSON.parse(sessionDataString);
    
    // Check if session is expired
    if (Date.now() - sessionData.timestamp > EXPIRY_TIME) {
      localStorage.removeItem(SESSION_KEY);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking session state:', error);
    return false;
  }
}

/**
 * Clears all stored data
 */
export function clearAllStoredData(): void {
  try {
    // Clear all form data
    const formKeys = Object.keys(localStorage).filter(key => key.startsWith(FORM_DATA_KEY));
    formKeys.forEach(key => localStorage.removeItem(key));
    
    // Clear navigation data
    sessionStorage.removeItem(NAVIGATION_KEY);
    
    console.log('✅ All stored data cleared');
  } catch (error) {
    console.error('❌ Error clearing stored data:', error);
  }
}

/**
 * Handles page unload to save current state
 */
export function setupUnloadHandler(): void {
  window.addEventListener('beforeunload', () => {
    saveNavigationState();
    saveSessionState();
  });
}

/**
 * Initializes the persistence system
 */
export function initPersistenceSystem(): void {
  setupUnloadHandler();
  
  // Restore scroll position if needed
  const savedNav = restoreNavigationState();
  if (savedNav && savedNav.path === window.location.pathname + window.location.search) {
    window.scrollTo(savedNav.scrollPosition.x, savedNav.scrollPosition.y);
  }
  
  console.log('✅ Persistence system initialized');
}