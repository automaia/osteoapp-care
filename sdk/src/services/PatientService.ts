import { OsteoAppClient } from '../client/OsteoAppClient';
import { Patient, OsteoAppSDKError } from '../types';

export class PatientService {
  constructor(private client: OsteoAppClient) {}

  /**
   * Recherche un patient par email
   */
  async findByEmail(email: string): Promise<Patient | null> {
    if (!email || !this.isValidEmail(email)) {
      throw new OsteoAppSDKError(
        'Adresse email invalide',
        'INVALID_EMAIL'
      );
    }

    return await this.client.findPatientByEmail(email);
  }

  /**
   * Valide le format d'un email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valide les données d'un patient
   */
  validatePatientData(patient: Partial<Patient>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!patient.firstName?.trim()) {
      errors.push('Le prénom est requis');
    }

    if (!patient.lastName?.trim()) {
      errors.push('Le nom est requis');
    }

    if (!patient.email?.trim()) {
      errors.push('L\'email est requis');
    } else if (!this.isValidEmail(patient.email)) {
      errors.push('Format d\'email invalide');
    }

    if (patient.phone && !this.isValidPhone(patient.phone)) {
      errors.push('Format de téléphone invalide');
    }

    if (patient.dateOfBirth && !this.isValidBirthDate(patient.dateOfBirth)) {
      errors.push('Date de naissance invalide');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Valide le format d'un numéro de téléphone français
   */
  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Valide une date de naissance
   */
  private isValidBirthDate(dateOfBirth: string): boolean {
    try {
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - 120); // 120 ans maximum

      return birthDate <= today && birthDate >= minDate;
    } catch {
      return false;
    }
  }

  /**
   * Formate les données patient pour l'envoi à l'API
   */
  formatPatientForAPI(patient: Partial<Patient>): Patient {
    return {
      firstName: patient.firstName?.trim() || '',
      lastName: patient.lastName?.trim() || '',
      email: patient.email?.toLowerCase().trim() || '',
      phone: patient.phone?.trim(),
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      address: patient.address
    };
  }
}