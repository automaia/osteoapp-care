import { getAuth, onAuthStateChanged } from 'firebase/auth';

let isInitialized = false;

export const initClarity = () => {
  if (typeof window !== 'undefined' && !isInitialized) {
    // Clarity is already loaded via the script tag in index.html
    isInitialized = true;
    
    // Track user identity when logged in
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      if (user && window.clarity) {
        window.clarity("identify", user.uid, {
          email: user.email || '',
          name: user.displayName || ''
        });
      }
    });
  }
};

export const setUserTag = (key: string, value: string) => {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity("set", key, value);
  }
};

export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity("event", eventName, properties);
  }
};

export const updateConsent = (hasConsent: boolean) => {
  if (typeof window !== 'undefined' && window.clarity) {
    window.clarity("consent", hasConsent);
  }
};