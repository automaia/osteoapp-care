import { PatientFormData } from '../types';

export interface ValidationError {
  field: string;
  message: string;
}

export function validatePatientData(data: PatientFormData): ValidationError[] {
  const errors: ValidationError[] = [];

  // Required fields - Ensure these are properly validated
  if (!data.firstName?.trim()) {
    errors.push({ field: 'firstName', message: 'Le prénom est requis' });
  }

  if (!data.lastName?.trim()) {
    errors.push({ field: 'lastName', message: 'Le nom est requis' });
  }

  if (!data.dateOfBirth) {
    errors.push({ field: 'dateOfBirth', message: 'La date de naissance est requise' });
  } else {
    try {
      const birthDate = new Date(data.dateOfBirth);
      const today = new Date();
      if (birthDate > today) {
        errors.push({ field: 'dateOfBirth', message: 'La date de naissance ne peut pas être dans le futur' });
      }
    } catch (e) {
      errors.push({ field: 'dateOfBirth', message: 'Format de date invalide' });
    }
  }

  // Email validation (optional)
  if (data.email && data.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.push({ field: 'email', message: 'Adresse email invalide' });
  }

  // Phone number format (optional)
  if (data.phone && data.phone.trim() && !/^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/.test(data.phone.trim())) {
    errors.push({ field: 'phone', message: 'Numéro de téléphone invalide' });
  }

  // Validate appointment time if date is set
  if (data.nextAppointment && !data.nextAppointmentTime) {
    errors.push({ field: 'nextAppointmentTime', message: 'L\'heure du rendez-vous est requise' });
  }

  // Validate time format
  if (data.nextAppointmentTime && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(data.nextAppointmentTime)) {
    errors.push({ field: 'nextAppointmentTime', message: 'Format d\'heure invalide (HH:mm)' });
  }

  // Validate appointment is not in the past
  if (data.nextAppointment && data.nextAppointmentTime) {
    const appointmentDate = new Date(`${data.nextAppointment}T${data.nextAppointmentTime}`);
    const now = new Date();
    if (appointmentDate < now) {
      errors.push({ field: 'nextAppointmentTime', message: 'Le rendez-vous ne peut pas être dans le passé' });
    }
  }

  // Validation des nouveaux champs
  if (data.treatmentHistory) {
    data.treatmentHistory.forEach((treatment, index) => {
      if (!treatment.date) {
        errors.push({ field: `treatmentHistory[${index}].date`, message: 'La date du traitement est requise' });
      }
      if (!treatment.treatment) {
        errors.push({ field: `treatmentHistory[${index}].treatment`, message: 'La description du traitement est requise' });
      }
    });
  }

  return errors;
}

export function validatePatientUpdate(currentData: PatientFormData, newData: Partial<PatientFormData>): boolean {
  // Check if there are actual changes
  return Object.entries(newData).some(([key, value]) => {
    const currentValue = currentData[key as keyof PatientFormData];
    return value !== currentValue;
  });
}

export function validateAppointmentTime(time: string, date: string): boolean {
  // Validate time format
  if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time)) {
    return false;
  }

  // Validate appointment is not in the past
  const appointmentDate = new Date(`${date}T${time}`);
  const now = new Date();
  if (appointmentDate < now) {
    return false;
  }

  // Validate time is within working hours (8:00-18:00)
  const [hours] = time.split(':').map(Number);
  return hours >= 8 && hours < 18;
}