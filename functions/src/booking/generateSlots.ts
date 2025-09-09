import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface WorkingWindow {
  start: Date;
  end: Date;
}

interface BusyEvent {
  start: Date;
  end: Date;
  title?: string;
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
 * Récupère les fenêtres de travail d'un praticien
 */
async function listWorkingWindows(practitionerId: string, from: Date, to: Date): Promise<WorkingWindow[]> {
  try {
    const userDoc = await db.collection('users').doc(practitionerId).get();
    
    if (!userDoc.exists) {
      return [];
    }
    
    const userData = userDoc.data();
    const schedule = userData?.schedule || {};
    
    const windows: WorkingWindow[] = [];
    const current = new Date(from);
    
    while (current <= to) {
      const dayKey = getDayKey(current);
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
}

/**
 * Récupère les événements occupés
 */
async function listBusyEvents(practitionerId: string, from: Date, to: Date): Promise<BusyEvent[]> {
  try {
    const busyEvents: BusyEvent[] = [];
    
    // Récupérer les rendez-vous existants
    const appointmentsSnapshot = await db.collection('appointments')
      .where('osteopathId', '==', practitionerId)
      .get();
    
    for (const docSnap of appointmentsSnapshot.docs) {
      const appointment = docSnap.data();
      
      if (appointment.status === 'cancelled') continue;
      
      let startDate: Date;
      let endDate: Date;
      
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
        endDate = new Date(startDate.getTime() + (appointment.duration || 60) * 60000);
      }
      
      if (startDate <= to && endDate >= from) {
        busyEvents.push({
          start: startDate,
          end: endDate,
          title: appointment.patientName || 'Rendez-vous'
        });
      }
    }
    
    // Récupérer les consultations existantes
    const consultationsSnapshot = await db.collection('consultations')
      .where('osteopathId', '==', practitionerId)
      .get();
    
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
}

/**
 * Utilitaire pour obtenir la clé du jour
 */
function getDayKey(date: Date): string {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[date.getDay()];
}

/**
 * Génère les créneaux disponibles pour les 45 prochains jours
 */
export const generateSlots = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  console.log('🔄 Starting slot generation...');
  
  try {
    const now = new Date();
    const endDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000); // 45 jours
    
    // Récupérer tous les praticiens actifs
    const practitionersSnapshot = await db.collection('practitioners')
      .where('active', '==', true)
      .get();
    
    for (const practitionerDoc of practitionersSnapshot.docs) {
      const practitionerId = practitionerDoc.id;
      console.log(`🔄 Generating slots for practitioner ${practitionerId}`);
      
      // Récupérer les services du praticien
      const servicesSnapshot = await db.collection('services')
        .where('practitionerId', '==', practitionerId)
        .where('active', '==', true)
        .get();
      
      if (servicesSnapshot.empty) {
        console.log('No active services found for practitioner');
        continue;
      }
      
      // Récupérer les fenêtres de travail
      const workingWindows = await listWorkingWindows(practitionerId, now, endDate);
      
      // Récupérer les événements occupés
      const busyEvents = await listBusyEvents(practitionerId, now, endDate);
      
      // Générer les créneaux pour chaque service
      for (const serviceDoc of servicesSnapshot.docs) {
        const service = serviceDoc.data();
        const serviceId = serviceDoc.id;
        const durationMin = service.durationMin || 60;
        const bufferMin = service.bufferMin || 0;
        const slotDuration = durationMin + bufferMin;
        
        for (const window of workingWindows) {
          const slots = generateTimeSlotsInWindow(window, slotDuration);
          
          for (const slot of slots) {
            // Vérifier si le créneau n'est pas en conflit avec un événement occupé
            const isConflict = busyEvents.some(busy => 
              slot.start < busy.end && slot.end > busy.start
            );
            
            if (!isConflict && slot.start > now) {
              const slotId = generateSlotId(practitionerId, serviceId, slot.start.toISOString());
              
              // Créer ou mettre à jour le créneau
              const slotData = {
                tenantId: 'default',
                practitionerId,
                serviceId,
                startAt: admin.firestore.Timestamp.fromDate(slot.start),
                endAt: admin.firestore.Timestamp.fromDate(slot.end),
                status: 'free',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              };
              
              await db.collection('appointmentSlots').doc(slotId).set(slotData, { merge: true });
            }
          }
        }
      }
    }
    
    // Nettoyer les créneaux passés et libérer les créneaux expirés
    await cleanupSlots();
    
    console.log('✅ Slot generation completed');
  } catch (error) {
    console.error('❌ Error during slot generation:', error);
    throw error;
  }
});

/**
 * Nettoie les créneaux expirés et passés
 */
async function cleanupSlots(): Promise<void> {
  try {
    const now = new Date();
    
    // Supprimer les créneaux passés
    const pastSlotsSnapshot = await db.collection('appointmentSlots')
      .where('startAt', '<', admin.firestore.Timestamp.fromDate(now))
      .get();
    
    const batch = db.batch();
    pastSlotsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Libérer les créneaux dont le hold a expiré
    const heldSlotsSnapshot = await db.collection('appointmentSlots')
      .where('status', '==', 'held')
      .where('heldUntil', '<', admin.firestore.Timestamp.fromDate(now))
      .get();
    
    heldSlotsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'free',
        heldUntil: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    await batch.commit();
    console.log(`✅ Cleaned up ${pastSlotsSnapshot.size} past slots and ${heldSlotsSnapshot.size} expired holds`);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
}