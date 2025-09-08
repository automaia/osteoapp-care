import { db, auth } from './config';
import { collection, doc, setDoc, getDoc, Timestamp, DocumentReference } from 'firebase/firestore';
import type { User, Patient } from './schema';

export async function checkUserPermissions(): Promise<boolean> {
  if (!auth.currentUser) {
    console.error('No authenticated user');
    return false;
  }

  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.error('User document not found');
      return false;
    }

    const userData = userDoc.data();
    if (userData.role !== 'osteopath') {
      console.error('User is not an osteopath');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking user permissions:', error);
    return false;
  }
}

export async function createUser(userId: string, userData: Omit<User, 'createdAt' | 'updatedAt'>) {
  console.log('Creating user document:', { userId, userData });
  
  const userRef = doc(db, 'users', userId);
  const timestamp = Timestamp.now();
  
  try {
    await setDoc(userRef, {
      ...userData,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    console.log('User document created successfully');
  } catch (error) {
    console.error('Error creating user document:', error);
    throw error;
  }
}

export async function createPatient(patientData: Omit<Patient, 'createdAt' | 'updatedAt'>) {
  console.log('Creating patient document:', patientData);
  
  if (!await checkUserPermissions()) {
    throw new Error('Insufficient permissions to create patient');
  }
  
  const patientsRef = collection(db, 'patients');
  const timestamp = Timestamp.now();
  
  try {
    const newPatient: Patient = {
      ...patientData,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    const docRef = doc(patientsRef);
    await setDoc(docRef, newPatient);
    console.log('Patient document created successfully:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating patient document:', error);
    throw error;
  }
}

export async function validateDocumentAccess(docRef: DocumentReference): Promise<boolean> {
  try {
    const doc = await getDoc(docRef);
    if (!doc.exists()) {
      console.error('Document does not exist');
      return false;
    }

    const data = doc.data();
    if (data.osteopathId !== auth.currentUser?.uid) {
      console.error('User does not have access to this document');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating document access:', error);
    return false;
  }
}