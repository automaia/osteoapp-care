/// <reference types="vite/client" />

interface Window {
  clarity?: (method: string, ...args: any[]) => void;
  _mtm?: any[];
  dataLayer?: any[];
  gtag?: (...args: any[]) => void;
}