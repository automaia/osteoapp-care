import { OsteoAppClient } from './client/OsteoAppClient';
import { AppointmentService } from './services/AppointmentService';
import { PatientService } from './services/PatientService';
import { SDKConfig, OsteoAppSDKError } from './types';

/**
 * Classe principale du SDK OsteoApp
 * Point d'entrée unique pour toutes les fonctionnalités
 */
export class OsteoAppSDK {
  private client: OsteoAppClient;
  public appointments: AppointmentService;
  public patients: PatientService;

  constructor(config: SDKConfig) {
    // Validation de la configuration
    if (!config.apiUrl) {
      throw new OsteoAppSDKError(
        'URL de l\'API requise',
        'MISSING_API_URL'
      );
    }

    // Initialisation du client HTTP
    this.client = new OsteoAppClient(config);

    // Initialisation des services
    this.appointments = new AppointmentService(this.client);
    this.patients = new PatientService(this.client);
  }

  /**
   * Vérifie la connexion à l'API
   */
  async testConnection(): Promise<boolean> {
    try {
      return await this.client.healthCheck();
    } catch (error) {
      console.error('Test de connexion échoué:', error);
      return false;
    }
  }

  /**
   * Configure l'authentification
   */
  setAuthToken(token: string): void {
    this.client.setAuthToken(token);
  }

  /**
   * Supprime l'authentification
   */
  clearAuth(): void {
    this.client.clearAuth();
  }

  /**
   * Récupère la liste des ostéopathes disponibles
   */
  async getOsteopaths() {
    return await this.client.getOsteopaths();
  }

  /**
   * Méthode de convenance pour créer un rendez-vous complet
   */
  async bookAppointment(params: {
    osteopathId: string;
    patient: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      dateOfBirth?: string;
    };
    date: Date;
    time: string;
    duration?: number;
    type?: string;
    notes?: string;
  }) {
    // Validation des données patient
    const patientValidation = this.patients.validatePatientData(params.patient);
    if (!patientValidation.isValid) {
      throw new OsteoAppSDKError(
        `Données patient invalides: ${patientValidation.errors.join(', ')}`,
        'INVALID_PATIENT_DATA',
        { errors: patientValidation.errors }
      );
    }

    // Vérifier la disponibilité
    const availability = await this.appointments.getAvailableSlots(
      params.osteopathId,
      params.date,
      params.duration || 60
    );

    const isSlotAvailable = availability.slots.some(slot => 
      slot.start === params.time && slot.available
    );

    if (!isSlotAvailable) {
      throw new OsteoAppSDKError(
        'Le créneau sélectionné n\'est pas disponible',
        'SLOT_UNAVAILABLE'
      );
    }

    // Créer le rendez-vous
    return await this.appointments.createAppointment(
      params.osteopathId,
      params.patient,
      params.date,
      params.time,
      {
        duration: params.duration,
        type: params.type,
        notes: params.notes
      }
    );
  }

  /**
   * Trouve les prochains créneaux disponibles
   */
  async findNextAvailableSlots(
    osteopathId: string,
    count: number = 5,
    duration: number = 60
  ) {
    const slots: Array<{ date: Date; time: string }> = [];
    const startDate = new Date();
    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 2); // 2 mois dans le futur

    const current = new Date(startDate);

    while (slots.length < count && current <= maxDate) {
      try {
        const daySchedule = await this.appointments.getAvailableSlots(
          osteopathId,
          current,
          duration
        );

        if (daySchedule.isOpen) {
          const availableSlots = daySchedule.slots.filter(slot => slot.available);
          
          for (const slot of availableSlots) {
            if (slots.length < count) {
              slots.push({
                date: new Date(current),
                time: slot.start
              });
            }
          }
        }
      } catch (error) {
        console.warn(`Erreur lors de la vérification du ${current.toISOString()}:`, error);
      }

      current.setDate(current.getDate() + 1);
    }

    return slots;
  }

  /**
   * Récupère les informations d'un ostéopathe
   */
  async getOsteopathInfo(osteopathId: string) {
    const osteopaths = await this.getOsteopaths();
    const osteopath = osteopaths.find(o => o.id === osteopathId);
    
    if (!osteopath) {
      throw new OsteoAppSDKError(
        'Ostéopathe non trouvé',
        'OSTEOPATH_NOT_FOUND'
      );
    }

    return osteopath;
  }
}