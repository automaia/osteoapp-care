import { Patient } from '../types';

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: Patient;
  timestamp: number;
}

class PatientCache {
  private cache: Map<string, CacheEntry> = new Map();

  set(patientId: string, data: Patient): void {
    this.cache.set(patientId, {
      data,
      timestamp: Date.now(),
    });
  }

  get(patientId: string): Patient | null {
    const entry = this.cache.get(patientId);
    
    if (!entry) return null;
    
    // Check if cache is still valid
    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      this.cache.delete(patientId);
      return null;
    }
    
    return entry.data;
  }

  invalidate(patientId: string): void {
    this.cache.delete(patientId);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const patientCache = new PatientCache();