import { collection, query, where, getDocs, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { agenda } from '../agendaAdapter';
import { createHash } from 'crypto';

interface AppointmentSlot {
  tenantId: string;
  practitionerId: string;
  serviceId: string;
  startAt: Date;
  endAt: Date;
  status: 'free' | 'held' | 'booked' | 'blocked';
  heldUntil?: Date;
}

/**
 * Génère un ID déterministe pour un créneau
 */
function generateSlotId(practitionerId: string, serviceId: string, startISO: string): string {
  const hash = createHash('sha1');
  hash.update(`${practitionerId}|${serviceId}|${startISO}`);
  return hash.digest('hex').slice(0, 28);
}

/**
 * Génère les créneaux disponibles pour les 45 prochains jours
 */
export async function generateSlots(practitionerId: string): Promise<void> {
  try {
    console.log(`🔄 Génération des créneaux pour le praticien ${practitionerId}`);
    
    const now = new Date();
    const endDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000); // 45 jours
    
    // 1. Récupérer les services du praticien
    const servicesRef = collection(db, 'services');
    const servicesQuery = query(servicesRef, where('practitionerId', '==', practitionerId), where('active', '==', true));
    const servicesSnapshot = await getDocs(servicesQuery);
    
    if (servicesSnapshot.empty) {
      console.log('Aucun service actif trouvé pour ce praticien');
      return;
    }
    
    // 2. Récupérer les fenêtres de travail
    const workingWindows = await agenda.listWorkingWindows(practitionerId, now, endDate);
    
    // 3. Récupérer les événements occupés
    const busyEvents = await agenda.listBusyEvents(practitionerId, now, endDate);
    
    // 4. Générer les créneaux pour chaque service
    for (const serviceDoc of servicesSnapshot.docs) {
      const service = serviceDoc.data();
      const serviceId = serviceDoc.id;
      const durationMin = service.durationMin || 60;
      const bufferMin = service.bufferMin || 0;
      const slotDuration = durationMin + bufferMin;
      
      for (const window of workingWindows) {
        const slots = this.generateTimeSlotsInWindow(window, slotDuration);
        
        for (const slot of slots) {
          // Vérifier si le créneau n'est pas en conflit avec un événement occupé
          const isConflict = busyEvents.some(busy => 
            slot.start < busy.end && slot.end > busy.start
          );
          
          if (!isConflict && slot.start > now) {
            const slotId = generateSlotId(practitionerId, serviceId, slot.start.toISOString());
            
            // Créer ou mettre à jour le créneau
            const slotData: AppointmentSlot = {
              tenantId: 'default', // Pour l'instant, un seul tenant
              practitionerId,
              serviceId,
              startAt: slot.start,
              endAt: slot.end,
              status: 'free'
            };
            
            await setDoc(doc(db, 'appointmentSlots', slotId), {
              ...slotData,
              startAt: Timestamp.fromDate(slot.start),
              endAt: Timestamp.fromDate(slot.end),
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now()
            });
          }
        }
      }
    }
    
    // 5. Nettoyer les créneaux passés et libérer les créneaux expirés
    await this.cleanupSlots(practitionerId);
    
    console.log(`✅ Génération des créneaux terminée pour ${practitionerId}`);
  } catch (error) {
    console.error('❌ Erreur lors de la génération des créneaux:', error);
    throw error;
  }
}

/**
 * Génère les créneaux horaires dans une fenêtre de travail
 */
function generateTimeSlotsInWindow(window: WorkingWindow, durationMin: number): Array<{ start: Date; end: Date }> {
  const slots = [];
  const current = new Date(window.start);
  
  while (current < window.end) {
    const slotEnd = new Date(current.getTime() + durationMin * 60000);
    
    if (slotEnd <= window.end) {
      slots.push({
        start: new Date(current),
        end: slotEnd
      });
    }
    
    current.setTime(current.getTime() + durationMin * 60000);
  }
  
  return slots;
}

/**
 * Nettoie les créneaux expirés et passés
 */
async function cleanupSlots(practitionerId: string): Promise<void> {
  try {
    const now = new Date();
    const slotsRef = collection(db, 'appointmentSlots');
    
    // Récupérer les créneaux du praticien
    const slotsQuery = query(slotsRef, where('practitionerId', '==', practitionerId));
    const slotsSnapshot = await getDocs(slotsQuery);
    
    for (const slotDoc of slotsSnapshot.docs) {
      const slot = slotDoc.data();
      const startAt = slot.startAt.toDate();
      
      // Supprimer les créneaux passés
      if (startAt < now) {
        await deleteDoc(slotDoc.ref);
        continue;
      }
      
      // Libérer les créneaux dont le hold a expiré
      if (slot.status === 'held' && slot.heldUntil) {
        const heldUntil = slot.heldUntil.toDate();
        if (heldUntil < now) {
          await updateDoc(slotDoc.ref, {
            status: 'free',
            heldUntil: null,
            updatedAt: Timestamp.now()
          });
        }
      }
    }
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage des créneaux:', error);
  }
}

/**
 * Fonction utilitaire pour obtenir la clé du jour
 */
function getDayKey(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}