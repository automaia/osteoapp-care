import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface HoldSlotRequest {
  slotId: string;
  patientTempId: string;
}

interface HoldSlotResponse {
  success: boolean;
  heldUntil?: Date;
  error?: string;
}

/**
 * Réserve temporairement un créneau (10 minutes)
 */
export const holdSlot = functions.https.onCall(async (data: HoldSlotRequest, context) => {
  try {
    const { slotId, patientTempId } = data;
    
    if (!slotId || !patientTempId) {
      throw new functions.https.HttpsError('invalid-argument', 'slotId et patientTempId requis');
    }
    
    const now = new Date();
    const heldUntil = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
    
    const result = await db.runTransaction(async (transaction) => {
      // 1. Récupérer le créneau
      const slotRef = db.collection('appointmentSlots').doc(slotId);
      const slotDoc = await transaction.get(slotRef);
      
      if (!slotDoc.exists) {
        throw new Error('Créneau non trouvé');
      }
      
      const slotData = slotDoc.data()!;
      
      // 2. Vérifier que le créneau est libre
      if (slotData.status !== 'free') {
        throw new Error('Créneau non disponible');
      }
      
      // 3. Vérifier qu'il n'y a pas de hold existant non expiré
      if (slotData.heldUntil && slotData.heldUntil.toDate() > now) {
        throw new Error('Créneau temporairement réservé');
      }
      
      // 4. Réserver le créneau
      transaction.update(slotRef, {
        status: 'held',
        heldUntil: admin.firestore.Timestamp.fromDate(heldUntil),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 5. Créer l'enregistrement de hold avec TTL
      const holdRef = db.collection('slotHolds').doc(`${slotId}_${patientTempId}`);
      transaction.set(holdRef, {
        tenantId: slotData.tenantId || 'default',
        slotId,
        patientTempId,
        expiresAt: admin.firestore.Timestamp.fromDate(heldUntil),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return heldUntil;
    });
    
    return {
      success: true,
      heldUntil: result
    };
    
  } catch (error: any) {
    console.error('❌ Error holding slot:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', error.message || 'Erreur lors de la réservation du créneau');
  }
});