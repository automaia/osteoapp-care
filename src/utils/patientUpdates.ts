import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Patient, PatientFormData } from '../types';
import { patientCache } from './patientCache';

interface UpdateOptions {
  onProgress?: (progress: number) => void;
}

export async function updatePatient(
  patientId: string,
  updates: Partial<PatientFormData>,
  options?: UpdateOptions
): Promise<void> {
  const start = Date.now();
  options?.onProgress?.(0);

  try {
    // Get cached data if available
    const cachedPatient = patientCache.get(patientId);
    
    // Trim string values, especially name fields
    const processedUpdates = { ...updates };
    if (processedUpdates.firstName) processedUpdates.firstName = processedUpdates.firstName.trim();
    if (processedUpdates.lastName) processedUpdates.lastName = processedUpdates.lastName.trim();
    
    // Only update changed fields
    const changedFields = Object.entries(updates).reduce((acc, [key, value]) => {
      if (!cachedPatient || cachedPatient[key as keyof Patient] !== value) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    if (Object.keys(changedFields).length === 0) {
      console.log('No changes detected, skipping update');
      options?.onProgress?.(100);
      return;
    }

    options?.onProgress?.(30);

    // Update Firestore
    const patientRef = doc(db, 'patients', patientId);
    await updateDoc(patientRef, {
      ...processedUpdates,
      updatedAt: new Date().toISOString()
    });

    options?.onProgress?.(70);

    // Update cache
    if (cachedPatient) {
      patientCache.set(patientId, {
        ...cachedPatient,
        ...changedFields,
        updatedAt: new Date().toISOString()
      });
    }

    options?.onProgress?.(100);

    const duration = Date.now() - start;
    console.log(`Patient update completed in ${duration}ms`);
  } catch (error) {
    console.error('Error updating patient:', error);
    throw error;
  }
}