import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { agenda } from '../agendaAdapter';

interface CancelRequest {
  appointmentId: string;
  reason?: string;
}

interface CancelResponse {
  success: boolean;
  error?: string;
}

/**
 * Annule un rendez-vous
 */
export async function cancelAppointment(request: CancelRequest): Promise<CancelResponse> {
  try {
    const { appointmentId, reason } = request;
    
    // 1. Récupérer le rendez-vous
    const appointmentRef = doc(db, 'appointments', appointmentId);
    const appointmentDoc = await getDoc(appointmentRef);
    
    if (!appointmentDoc.exists()) {
      return {
        success: false,
        error: 'Rendez-vous non trouvé'
      };
    }
    
    const appointmentData = appointmentDoc.data();
    
    // 2. Vérifier que le rendez-vous peut être annulé
    if (appointmentData.status === 'cancelled') {
      return {
        success: false,
        error: 'Rendez-vous déjà annulé'
      };
    }
    
    if (appointmentData.status === 'completed') {
      return {
        success: false,
        error: 'Impossible d\'annuler un rendez-vous terminé'
      };
    }
    
    // 3. Annuler dans l'agenda existant
    if (appointmentData.agendaEventId) {
      await agenda.cancelEvent(appointmentData.agendaEventId);
    }
    
    // 4. Mettre à jour le statut du rendez-vous
    await updateDoc(appointmentRef, {
      status: 'cancelled',
      cancelledAt: Timestamp.now(),
      cancellationReason: reason || 'Annulé par le patient',
      updatedAt: Timestamp.now()
    });
    
    // 5. Libérer le créneau si c'est dans le futur
    const startAt = appointmentData.startAt.toDate();
    if (startAt > new Date()) {
      // Trouver et libérer le créneau correspondant
      const slotId = this.generateSlotId(
        appointmentData.practitionerId,
        appointmentData.serviceId,
        startAt.toISOString()
      );
      
      try {
        const slotRef = doc(db, 'appointmentSlots', slotId);
        const slotDoc = await getDoc(slotRef);
        
        if (slotDoc.exists()) {
          await updateDoc(slotRef, {
            status: 'free',
            heldUntil: null,
            updatedAt: Timestamp.now()
          });
        }
      } catch (slotError) {
        console.warn('⚠️ Impossible de libérer le créneau:', slotError);
      }
    }
    
    // 6. Programmer la notification d'annulation
    await this.scheduleNotification(appointmentId, 'cancel', 'email');
    
    return {
      success: true
    };
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'annulation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de l\'annulation'
    };
  }
}

/**
 * Génère un ID de créneau (même logique que generateSlots)
 */
function generateSlotId(practitionerId: string, serviceId: string, startISO: string): string {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha1');
  hash.update(`${practitionerId}|${serviceId}|${startISO}`);
  return hash.digest('hex').slice(0, 28);
}

/**
 * Programme une notification
 */
async function scheduleNotification(appointmentId: string, type: string, channel: string): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      appointmentId,
      type,
      channel,
      scheduledAt: Timestamp.now(),
      createdAt: Timestamp.now()
    });
  } catch (error) {
    console.error('❌ Erreur lors de la programmation de la notification:', error);
  }
}