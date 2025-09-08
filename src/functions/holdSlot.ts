import { doc, getDoc, updateDoc, setDoc, Timestamp, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';

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
export async function holdSlot(request: HoldSlotRequest): Promise<HoldSlotResponse> {
  try {
    const { slotId, patientTempId } = request;
    const now = new Date();
    const heldUntil = new Date(now.getTime() + 10 * 60 * 1000); // 10 minutes
    
    const result = await runTransaction(db, async (transaction) => {
      // 1. Récupérer le créneau
      const slotRef = doc(db, 'appointmentSlots', slotId);
      const slotDoc = await transaction.get(slotRef);
      
      if (!slotDoc.exists()) {
        throw new Error('Créneau non trouvé');
      }
      
      const slotData = slotDoc.data();
      
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
        heldUntil: Timestamp.fromDate(heldUntil),
        updatedAt: Timestamp.now()
      });
      
      // 5. Créer l'enregistrement de hold avec TTL
      const holdRef = doc(db, 'slotHolds', `${slotId}_${patientTempId}`);
      transaction.set(holdRef, {
        tenantId: slotData.tenantId || 'default',
        slotId,
        patientTempId,
        expiresAt: Timestamp.fromDate(heldUntil),
        createdAt: Timestamp.now()
      });
      
      return heldUntil;
    });
    
    return {
      success: true,
      heldUntil: result
    };
    
  } catch (error) {
    console.error('❌ Erreur lors de la réservation du créneau:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
    };
  }
}

/**
 * Libère un créneau réservé
 */
export async function releaseSlot(slotId: string): Promise<void> {
  try {
    const slotRef = doc(db, 'appointmentSlots', slotId);
    await updateDoc(slotRef, {
      status: 'free',
      heldUntil: null,
      updatedAt: Timestamp.now()
    });
    
    console.log(`✅ Créneau ${slotId} libéré`);
  } catch (error) {
    console.error('❌ Erreur lors de la libération du créneau:', error);
  }
}