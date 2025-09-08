import { Timestamp } from 'firebase/firestore';

// User related types
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

export interface UserProfile {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  specialties: string[];
  schedule?: Schedule;
  rates?: Rate[];
}

export interface Practice {
  id: string;
  name: string;
  logo?: string;
  address: Address;
  ownerId: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface Schedule {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface DaySchedule {
  isOpen: boolean;
  slots: TimeSlot[];
}

export interface TimeSlot {
  start: string; // format: "HH:MM"
  end: string;   // format: "HH:MM"
}

export interface Rate {
  type: string;
  amount: number;
  currency: string;
  duration: number; // in minutes
}

// Document related types
export interface PatientDocument {
  id: string;
  name: string;
  originalName: string;
  url: string;
  type: string;
  size: number;
  category: string;
  uploadedAt: string;
  uploadedBy: string;
  folder: string;
}

// Patient related types
export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  profession?: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string; // format: "YYYY-MM-DD"
  email: string; // Now required
  phone?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  insurance?: Insurance;
  medicalHistory?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  osteopathId: string;
  tags?: string[];
  documentUrl?: string | null;
  nextAppointment?: string; // format: "YYYY-MM-DDThh:mm:ss"
  documents?: DocumentMetadata[];
  pastAppointments?: PastAppointment[]; // Nouveau champ pour les rendez-vous passés
  
  // Champs pour le tri
  createdAtDate?: Date; // Champ calculé pour le tri
  updatedAtDate?: Date; // Champ calculé pour le tri
  
  // Nouveaux champs
  currentTreatment?: string; // Traitement actuel
  consultationReason?: string; // Motif de consultation
  medicalAntecedents?: string; // Antécédents médicaux
  treatmentHistory?: TreatmentHistoryEntry[]; // Historique des traitements
  documents?: PatientDocument[]; // Documents médicaux
  osteopathicTreatment?: string; // Traitement ostéopathique
}

// Past appointment type
export interface PastAppointment {
  date: string; // format: "YYYY-MM-DDThh:mm:ss"
  notes?: string;
  isHistorical: boolean;
}

// Nouvel interface pour l'historique des traitements
export interface TreatmentHistoryEntry {
  date: string; // format: "YYYY-MM-DD"
  treatment: string;
  provider?: string;
  notes?: string;
}
  documents?: PatientDocument[];

// Form data types
export interface PatientFormData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  email: string; // Now required
  phone?: string;
  profession?: string;
  address: string; // Now required
  city?: string;
  state?: string;
  zipCode?: string;
  insurance?: string;
  insuranceNumber?: string;
  medicalHistory?: string;
  notes?: string;
  nextAppointment?: string;
  nextAppointmentTime?: string; // format: "HH:mm"
  
  // Nouveaux champs
  currentTreatment?: string;
  consultationReason?: string;
  medicalAntecedents?: string;
  treatmentHistory?: TreatmentHistoryEntry[];
  osteopathicTreatment?: string; // Traitement ostéopathique
}

export interface Insurance {
  provider: string;
  policyNumber: string;
  expiryDate?: string;
}

// Appointment related types
export interface Appointment {
  id: string;
  patientId: string;
  practitionerId: string;
  date: string; // format: "YYYY-MM-DD"
  startTime: string; // format: "HH:MM"
  endTime: string;   // format: "HH:MM"
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  type: string;
  notes?: string;
  reminderSent: boolean;
  createdAt: string;
  updatedAt: string;
  isHistorical?: boolean; // Indique si c'est un rendez-vous historique
}

// Invoice related types
export interface Invoice {
  id: string;
  patientId: string;
  appointmentId?: string;
  practitionerId: string;
  number: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
}

// Document related types
export interface Document {
  id: string;
  patientId: string;
  name: string;
  type: 'pdf' | 'image' | 'other';
  url: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  notes?: string;
}

// Authentication types
export interface AuthFormData {
  email: string;
  password: string;
}

export interface RegisterFormData extends AuthFormData {
  firstName: string;
  lastName: string;
  confirmPassword: string;
}