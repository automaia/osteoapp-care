import { OsteoAppClient } from '../client/OsteoAppClient';
import { 
  CreateAppointmentRequest, 
  CreateAppointmentResponse, 
  Appointment,
  DaySchedule,
  AvailabilityRequest,
  OsteoAppSDKError 
} from '../types';
import { DateHelpers } from '../utils/dateHelpers';

export class AppointmentService {
  constructor(private client: OsteoAppClient) {}

  /**
   * Récupère les créneaux disponibles pour un ostéopathe à une date donnée
   */
  async getAvailableSlots(
    osteopathId: string, 
    date: Date, 
    duration: number = 60
  ): Promise<DaySchedule> {
    if (!DateHelpers.isValidAppointmentDate(date)) {
      throw new OsteoAppSDKError(
        'Date de rendez-vous invalide',
        'INVALID_DATE'
      );
    }

    const request: AvailabilityRequest = {
      osteopathId,
      date: DateHelpers.formatDate(date, 'yyyy-MM-dd'),
      duration
    };

    return await this.client.getAvailableSlots(request);
  }

  /**
   * Crée un nouveau rendez-vous
   */
  async createAppointment(
    osteopathId: string,
    patient: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      dateOfBirth?: string;
    },
    date: Date,
    time: string,
    options: {
      duration?: number;
      type?: string;
      notes?: string;
    } = {}
  ): Promise<CreateAppointmentResponse> {
    // Validation des paramètres
    if (!osteopathId) {
      throw new OsteoAppSDKError('ID ostéopathe requis', 'MISSING_OSTEOPATH_ID');
    }

    if (!patient.firstName || !patient.lastName || !patient.email) {
      throw new OsteoAppSDKError(
        'Informations patient incomplètes (prénom, nom et email requis)',
        'INCOMPLETE_PATIENT_DATA'
      );
    }

    if (!DateHelpers.isValidAppointmentDate(date)) {
      throw new OsteoAppSDKError(
        'Date de rendez-vous invalide',
        'INVALID_DATE'
      );
    }

    if (!DateHelpers.isFutureSlot(date, time)) {
      throw new OsteoAppSDKError(
        'Le créneau sélectionné est dans le passé',
        'PAST_SLOT'
      );
    }

    // Vérifier la disponibilité avant de créer
    const availability = await this.getAvailableSlots(
      osteopathId, 
      date, 
      options.duration || 60
    );

    const requestedSlot = availability.slots.find(slot => 
      slot.start === time && slot.available
    );

    if (!requestedSlot) {
      throw new OsteoAppSDKError(
        'Le créneau sélectionné n\'est plus disponible',
        'SLOT_UNAVAILABLE'
      );
    }

    const request: CreateAppointmentRequest = {
      osteopathId,
      patient: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth
      },
      date: DateHelpers.formatDate(date, 'yyyy-MM-dd'),
      time,
      duration: options.duration || 60,
      type: options.type || 'Consultation standard',
      notes: options.notes
    };

    return await this.client.createAppointment(request);
  }

  /**
   * Annule un rendez-vous
   */
  async cancelAppointment(appointmentId: string, reason?: string): Promise<boolean> {
    if (!appointmentId) {
      throw new OsteoAppSDKError('ID de rendez-vous requis', 'MISSING_APPOINTMENT_ID');
    }

    return await this.client.cancelAppointment(appointmentId, reason);
  }

  /**
   * Récupère les détails d'un rendez-vous
   */
  async getAppointmentDetails(appointmentId: string): Promise<Appointment> {
    if (!appointmentId) {
      throw new OsteoAppSDKError('ID de rendez-vous requis', 'MISSING_APPOINTMENT_ID');
    }

    return await this.client.getAppointment(appointmentId);
  }

  /**
   * Recherche les créneaux disponibles sur plusieurs jours
   */
  async findAvailableSlots(
    osteopathId: string,
    startDate: Date,
    endDate: Date,
    duration: number = 60
  ): Promise<DaySchedule[]> {
    const schedules: DaySchedule[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      try {
        const daySchedule = await this.getAvailableSlots(osteopathId, current, duration);
        if (daySchedule.isOpen && daySchedule.slots.some(slot => slot.available)) {
          schedules.push(daySchedule);
        }
      } catch (error) {
        console.warn(`Erreur lors de la récupération du planning pour ${current.toISOString()}:`, error);
      }
      
      current.setDate(current.getDate() + 1);
    }

    return schedules;
  }

  /**
   * Trouve le prochain créneau disponible
   */
  async getNextAvailableSlot(
    osteopathId: string,
    duration: number = 60,
    maxDaysAhead: number = 30
  ): Promise<{ date: Date; time: string } | null> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + maxDaysAhead);

    const schedules = await this.findAvailableSlots(osteopathId, startDate, endDate, duration);

    for (const schedule of schedules) {
      const availableSlot = schedule.slots.find(slot => slot.available);
      if (availableSlot) {
        return {
          date: new Date(schedule.date),
          time: availableSlot.start
        };
      }
    }

    return null;
  }
}