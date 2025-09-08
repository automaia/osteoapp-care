import { Timestamp } from 'firebase/firestore';

export interface User {
  name: string;
  email: string;
  role: 'osteopath';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MedicalHistoryEntry {
  date: Timestamp;
  description: string;
  treatment?: string;
  createdAt: Timestamp;
}

export interface Consultation {
  date: Timestamp;
  reason: string;
  treatment: string;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Patient {
  name: string;
  birthDate: Timestamp;
  osteopathId: string;
  medicalHistory: MedicalHistoryEntry[];
  consultations: Consultation[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}