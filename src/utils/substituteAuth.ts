import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Vérifie si l'utilisateur est un remplaçant
 */
export async function isSubstitute(user: User | null): Promise<boolean> {
  if (!user) return false;

  try {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return false;
    
    const userData = userDoc.data();
    return userData.role === 'substitute';
  } catch (error) {
    console.error('Error checking if user is substitute:', error);
    return false;
  }
}

/**
 * Récupère l'ID de l'ostéopathe titulaire pour un remplaçant
 */
export async function getLinkedOsteopathId(user: User | null): Promise<string | null> {
  if (!user) return null;

  try {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return null;
    
    const userData = userDoc.data();
    return userData.role === 'substitute' ? userData.linkedTo : null;
  } catch (error) {
    console.error('Error getting linked osteopath ID:', error);
    return null;
  }
}

/**
 * Détermine l'ID de l'ostéopathe à utiliser pour les requêtes de données
 * - Si l'utilisateur est un ostéopathe : retourne son propre ID
 * - Si l'utilisateur est un remplaçant : retourne l'ID de l'ostéopathe titulaire
 */
export async function getEffectiveOsteopathId(user: User | null): Promise<string | null> {
  if (!user) return null;

  try {
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return null;
    
    const userData = userDoc.data();
    
    if (userData.role === 'osteopath') {
      return user.uid;
    } else if (userData.role === 'admin') {
      return user.uid;
    } else if (userData.role === 'substitute') {
      return userData.linkedTo;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting effective osteopath ID:', error);
    return null;
  }
}

/**
 * Vérifie si l'utilisateur a accès aux données d'un patient
 */
export async function hasPatientAccess(user: User | null, patientOsteopathId: string): Promise<boolean> {
  if (!user) return false;

  try {
    const effectiveOsteopathId = await getEffectiveOsteopathId(user);
    return effectiveOsteopathId === patientOsteopathId;
  } catch (error) {
    console.error('Error checking patient access:', error);
    return false;
  }
}