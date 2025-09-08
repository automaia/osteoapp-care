import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from './firebase/config';

export interface WorkingWindow {
  start: Date;
  end: Date;
}

export interface BusyEvent {
  start: Date;
  end: Date;
  title?: string;
}

export interface CreateEventParams {
  practitionerId: string;
  start: Date;
  end: Date;
  patient: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  serviceId?: string;
  source: 'online' | 'staff';
}

/**
 * Adaptateur pour l'agenda existant - pont vers les collections existantes
 * Ne modifie pas le schéma existant, utilise les collections appointments/consultations
 */
export const agenda = {
  /**
   * Récupère les créneaux de travail d'un praticien
   */
  async listWorkingWindows(practitionerId: string, from: Date, to: Date): Promise<WorkingWindow[]> {
    try {
      // Récupérer les paramètres de l'utilisateur (horaires de travail)
      const userRef = doc(db, 'users', practitionerId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        return [];
      }
      
      const userData = userDoc.data();
      const schedule = userData.schedule || {};
      
      const windows: WorkingWindow[] = [];
      const current = new Date(from);
      
      while (current <= to) {
        const dayKey = this.getDayKey(current);
        const daySchedule = schedule[dayKey];
        
        if (daySchedule && daySchedule.isOpen && daySchedule.slots) {
          for (const slot of daySchedule.slots) {
            const startTime = new Date(current);
            const [startHour, startMin] = slot.start.split(':').map(Number);
            startTime.setHours(startHour, startMin, 0, 0);
            
            const endTime = new Date(current);
            const [endHour, endMin] = slot.end.split(':').map(Number);
            endTime.setHours(endHour, endMin, 0, 0);
            
            windows.push({
              start: startTime,
              end: endTime
            });
          }
        }
        
        current.setDate(current.getDate() + 1);
      }
      
      return windows;
    } catch (error) {
      console.error('Error listing working windows:', error);
      return [];
    }
  },

  /**
   * Récupère les événements occupés (rendez-vous existants)
   */
  async listBusyEvents(practitionerId: string, from: Date, to: Date): Promise<BusyEvent[]> {
    try {
      const busyEvents: BusyEvent[] = [];
      
      // Récupérer les rendez-vous existants
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('osteopathId', '==', practitionerId)
      );
      
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      
      for (const docSnap of appointmentsSnapshot.docs) {
        const appointment = docSnap.data();
        
        if (appointment.status === 'cancelled') continue;
        
        let startDate: Date;
        let endDate: Date;
        
        // Gestion des différents formats de date
        if (appointment.date?.toDate) {
          startDate = appointment.date.toDate();
        } else if (appointment.date) {
          startDate = new Date(appointment.date);
        } else {
          continue;
        }
        
        if (appointment.endTime?.toDate) {
          endDate = appointment.endTime.toDate();
        } else if (appointment.endTime) {
          endDate = new Date(appointment.endTime);
        } else {
          // Calculer la fin à partir de la durée
          endDate = new Date(startDate.getTime() + (appointment.duration || 60) * 60000);
        }
        
        // Vérifier si l'événement est dans la plage demandée
        if (startDate <= to && endDate >= from) {
          busyEvents.push({
            start: startDate,
            end: endDate,
            title: appointment.patientName || 'Rendez-vous'
          });
        }
      }
      
      // Récupérer les consultations existantes
      const consultationsRef = collection(db, 'consultations');
      const consultationsQuery = query(
        consultationsRef,
        where('osteopathId', '==', practitionerId)
      );
      
      const consultationsSnapshot = await getDocs(consultationsQuery);
      
      for (const docSnap of consultationsSnapshot.docs) {
        const consultation = docSnap.data();
        
        if (consultation.status === 'cancelled') continue;
        
        let startDate: Date;
        
        if (consultation.date?.toDate) {
          startDate = consultation.date.toDate();
        } else if (consultation.date) {
          startDate = new Date(consultation.date);
        } else {
          continue;
        }
        
        const endDate = new Date(startDate.getTime() + (consultation.duration || 60) * 60000);
        
        // Vérifier si l'événement est dans la plage demandée
        if (startDate <= to && endDate >= from) {
          busyEvents.push({
            start: startDate,
            end: endDate,
            title: consultation.patientName || 'Consultation'
          });
        }
      }
      
      return busyEvents;
    } catch (error) {
      console.error('Error listing busy events:', error);
      return [];
    }
  },

  /**
   * Crée un événement dans l'agenda existant
   */
  async createEvent(params: CreateEventParams): Promise<{ agendaEventId: string }> {
    try {
      // Créer un rendez-vous dans la collection appointments existante
      const appointmentData = {
        patientId: null, // Pas de patient ID pour les réservations en ligne
        patientName: `${params.patient.firstName} ${params.patient.lastName}`,
        practitionerId: params.practitionerId,
        practitionerName: '', // Sera rempli par la fonction
        date: Timestamp.fromDate(params.start),
        endTime: Timestamp.fromDate(params.end),
        duration: Math.round((params.end.getTime() - params.start.getTime()) / 60000),
        status: 'confirmed',
        type: 'Consultation en ligne',
        location: {
          type: 'office',
          name: 'Cabinet principal'
        },
        notes: `Réservation en ligne - ${params.patient.email || ''} - ${params.patient.phone || ''}`,
        osteopathId: params.practitionerId,
        source: params.source,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        // Informations patient pour les réservations en ligne
        onlineBooking: {
          firstName: params.patient.firstName,
          lastName: params.patient.lastName,
          email: params.patient.email,
          phone: params.patient.phone,
          serviceId: params.serviceId
        }
      };
      
      const docRef = await addDoc(collection(db, 'appointments'), appointmentData);
      
      return { agendaEventId: docRef.id };
    } catch (error) {
      console.error('Error creating agenda event:', error);
      throw error;
    }
  },

  /**
   * Annule un événement dans l'agenda existant
   */
  async cancelEvent(agendaEventId: string): Promise<void> {
    try {
      const appointmentRef = doc(db, 'appointments', agendaEventId);
      await updateDoc(appointmentRef, {
        status: 'cancelled',
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error cancelling agenda event:', error);
      throw error;
    }
  },

  /**
   * Utilitaire pour obtenir la clé du jour
   */
  getDayKey(date: Date): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }
};