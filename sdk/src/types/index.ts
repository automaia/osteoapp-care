// Types pour les rendez-vous
export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  practitionerId: string;
  practitionerName: string;
  date: Date;
  endTime: Date;
  duration: number;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  type: string;
  notes?: string;
  osteopathId: string;
  consultationId?: string;
  isHistorical?: boolean;
}

// Types pour les créneaux disponibles
export interface TimeSlot {
  start: string; // format: "HH:MM"
  end: string;   // format: "HH:MM"
  available: boolean;
  appointmentId?: string; // Si occupé
}

export interface DaySchedule {
  date: string; // format: "YYYY-MM-DD"
  isOpen: boolean;
  slots: TimeSlot[];
}

// Types pour les patients
export interface Patient {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  address?: {
    street: string;
    city: string;
    zipCode: string;
    country: string;
  };
}

// Types pour les ostéopathes
export interface Osteopath {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  specialties: string[];
  schedule: WeeklySchedule;
  rates: Rate[];
  isActive: boolean;
}

export interface WeeklySchedule {
  monday?: DayWorkingHours;
  tuesday?: DayWorkingHours;
  wednesday?: DayWorkingHours;
  thursday?: DayWorkingHours;
  friday?: DayWorkingHours;
  saturday?: DayWorkingHours;
  sunday?: DayWorkingHours;
}

export interface DayWorkingHours {
  isOpen: boolean;
  slots: WorkingSlot[];
}

export interface WorkingSlot {
  start: string; // format: "HH:MM"
  end: string;   // format: "HH:MM"
}

export interface Rate {
  type: string;
  amount: number;
  currency: string;
  duration: number; // en minutes
}

// Types pour les requêtes de l'API
export interface CreateAppointmentRequest {
  osteopathId: string;
  patient: Patient;
  date: string; // format: "YYYY-MM-DD"
  time: string; // format: "HH:MM"
  duration: number;
  type: string;
  notes?: string;
}

export interface AvailabilityRequest {
  osteopathId: string;
  date: string; // format: "YYYY-MM-DD"
  duration?: number; // durée souhaitée en minutes
}

// Types pour les réponses de l'API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface CreateAppointmentResponse {
  appointmentId: string;
  patientId: string;
  confirmationNumber: string;
  scheduledDate: Date;
  osteopathName: string;
}

// Configuration du SDK
export interface SDKConfig {
  apiUrl: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
}

// Erreurs personnalisées
export class OsteoAppSDKError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'OsteoAppSDKError';
  }
}