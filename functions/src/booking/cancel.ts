import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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
export const cancel = functions.https.onCall(async (data: CancelRequest, context) => {
  try {
    const { appointmentId, reason } = data;
    
    if (!appointmentId) {
      throw new functions.https.HttpsError('invalid-argument', 'appointmentId requis');
    }
    
    // 1. Récupérer le rendez-vous
    const appointmentRef = db.collection('appointments').doc(appointmentId);
    const appointmentDoc = await appointmentRef.get();
    
    if (!appointmentDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Rendez-vous non trouvé');
    }
    
    const appointmentData = appointmentDoc.data()!;
    
    // 2. Vérifier que le rendez-vous peut être annulé
    if (appointmentData.status === 'cancelled') {
      throw new functions.https.HttpsError('failed-precondition', 'Rendez-vous déjà annulé');
    }
    
    if (appointmentData.status === 'completed') {
      throw new functions.https.HttpsError('failed-precondition', 'Impossible d\'annuler un rendez-vous terminé');
    }
    
    // 3. Annuler dans l'agenda existant
    if (appointmentData.agendaEventId) {
      await cancelAgendaEvent(appointmentData.agendaEventId);
    }
    
    // 4. Mettre à jour le statut du rendez-vous
    await appointmentRef.update({
      status: 'cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      cancellationReason: reason || 'Annulé par le patient',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // 5. Libérer le créneau si c'est dans le futur
    const startAt = appointmentData.startAt.toDate();
    if (startAt > new Date()) {
      // Trouver et libérer le créneau correspondant
      const slotId = generateSlotId(
        appointmentData.practitionerId,
        appointmentData.serviceId,
        startAt.toISOString()
      );
      
      try {
        const slotRef = db.collection('appointmentSlots').doc(slotId);
        const slotDoc = await slotRef.get();
        
        if (slotDoc.exists) {
          await slotRef.update({
            status: 'free',
            heldUntil: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      } catch (slotError) {
        console.warn('⚠️ Impossible de libérer le créneau:', slotError);
      }
    }
    
    // 6. Programmer la notification d'annulation
    await scheduleNotification(appointmentId, 'cancel', 'email');
    
    return {
      success: true
    };
    
  } catch (error: any) {
    console.error('❌ Erreur lors de l\'annulation:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', error.message || 'Erreur lors de l\'annulation');
  }
});

/**
 * Annule un événement dans l'agenda existant
 */
async function cancelAgendaEvent(agendaEventId: string): Promise<void> {
  try {
    const appointmentRef = db.collection('appointments').doc(agendaEventId);
    await appointmentRef.update({
      status: 'cancelled',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error cancelling agenda event:', error);
    throw error;
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
    await db.collection('notifications').add({
      appointmentId,
      type,
      channel,
      scheduledAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('❌ Erreur lors de la programmation de la notification:', error);
  }
}