import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { z } from 'zod';

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Schéma de validation avec Zod
const BookingSchema = z.object({
  slotId: z.string().min(1),
  patientTempId: z.string().min(1),
  patient: z.object({
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    email: z.string().email().optional(),
    phone: z.string().regex(/^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/).optional()
  }),
  serviceId: z.string().min(1),
  recaptchaToken: z.string().min(1),
  consentGiven: z.boolean().refine(val => val === true, {
    message: "Le consentement RGPD est requis"
  })
});

interface BookingRequest extends z.infer<typeof BookingSchema> {}

interface BookingResponse {
  success: boolean;
  appointmentId?: string;
  agendaEventId?: string;
  icsUrl?: string;
  error?: string;
}

/**
 * Vérifie le reCAPTCHA Enterprise
 */
async function verifyRecaptcha(token: string, expectedAction: string): Promise<boolean> {
  try {
    // En production, utiliser l'API reCAPTCHA Enterprise
    // Pour le développement, on simule une vérification réussie
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    
    const response = await fetch(`https://recaptchaenterprise.googleapis.com/v1/projects/${process.env.RECAPTCHA_PROJECT_ID}/assessments?key=${process.env.RECAPTCHA_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: {
          token,
          expectedAction,
          siteKey: process.env.RECAPTCHA_SITE_KEY
        }
      })
    });
    
    const result = await response.json();
    return result.riskAnalysis?.score > 0.5; // Seuil de confiance
  } catch (error) {
    console.error('❌ Erreur de vérification reCAPTCHA:', error);
    return false;
  }
}

/**
 * Vérifie les limites de taux par IP
 */
const rateLimits = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip);
  
  if (!limit) {
    rateLimits.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (now > limit.resetTime) {
    rateLimits.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (limit.count >= maxRequests) {
    return false;
  }
  
  limit.count++;
  return true;
}

/**
 * Crée un événement dans l'agenda existant
 */
async function createAgendaEvent(params: {
  practitionerId: string;
  start: Date;
  end: Date;
  patient: { firstName: string; lastName: string; email?: string; phone?: string };
  serviceId?: string;
  source: 'online' | 'staff';
}): Promise<{ agendaEventId: string }> {
  try {
    // Créer un rendez-vous dans la collection appointments existante
    const appointmentData = {
      patientId: null, // Pas de patient ID pour les réservations en ligne
      patientName: `${params.patient.firstName} ${params.patient.lastName}`,
      practitionerId: params.practitionerId,
      practitionerName: '', // Sera rempli par la fonction
      date: admin.firestore.Timestamp.fromDate(params.start),
      endTime: admin.firestore.Timestamp.fromDate(params.end),
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      // Informations patient pour les réservations en ligne
      onlineBooking: {
        firstName: params.patient.firstName,
        lastName: params.patient.lastName,
        email: params.patient.email,
        phone: params.patient.phone,
        serviceId: params.serviceId
      }
    };
    
    const docRef = await db.collection('appointments').add(appointmentData);
    
    return { agendaEventId: docRef.id };
  } catch (error) {
    console.error('Error creating agenda event:', error);
    throw error;
  }
}

/**
 * Réserve définitivement un créneau
 */
export const book = functions.https.onCall(async (data: BookingRequest, context) => {
  try {
    // 1. Validation des données
    const validatedData = BookingSchema.parse(data);
    
    // 2. Vérification du rate limiting
    const clientIP = context.rawRequest.ip || 'unknown';
    if (!checkRateLimit(clientIP, 10, 60000)) {
      throw new functions.https.HttpsError('resource-exhausted', 'Trop de tentatives. Veuillez patienter avant de réessayer.');
    }
    
    // 3. Vérification reCAPTCHA
    const isValidCaptcha = await verifyRecaptcha(validatedData.recaptchaToken, 'book_appointment');
    if (!isValidCaptcha) {
      throw new functions.https.HttpsError('permission-denied', 'Vérification de sécurité échouée. Veuillez réessayer.');
    }
    
    // 4. Transaction de réservation
    const result = await db.runTransaction(async (transaction) => {
      // 4.1. Vérifier que le créneau est toujours en hold
      const slotRef = db.collection('appointmentSlots').doc(validatedData.slotId);
      const slotDoc = await transaction.get(slotRef);
      
      if (!slotDoc.exists) {
        throw new Error('Créneau non trouvé');
      }
      
      const slotData = slotDoc.data()!;
      
      if (slotData.status !== 'held') {
        throw new Error('Créneau non réservé ou déjà pris');
      }
      
      if (!slotData.heldUntil || slotData.heldUntil.toDate() < new Date()) {
        throw new Error('Réservation expirée');
      }
      
      // 4.2. Re-vérifier les collisions avec l'agenda en temps réel
      const startAt = slotData.startAt.toDate();
      const endAt = slotData.endAt.toDate();
      const busyEvents = await listBusyEvents(
        slotData.practitionerId, 
        new Date(startAt.getTime() - 60000), // 1 minute avant
        new Date(endAt.getTime() + 60000)    // 1 minute après
      );
      
      const hasCollision = busyEvents.some(busy => 
        startAt < busy.end && endAt > busy.start
      );
      
      if (hasCollision) {
        throw new Error('Conflit détecté avec un autre rendez-vous');
      }
      
      // 4.3. Créer l'événement dans l'agenda existant
      const agendaEvent = await createAgendaEvent({
        practitionerId: slotData.practitionerId,
        start: startAt,
        end: endAt,
        patient: validatedData.patient,
        serviceId: validatedData.serviceId,
        source: 'online'
      });
      
      // 4.4. Marquer le créneau comme réservé
      transaction.update(slotRef, {
        status: 'booked',
        heldUntil: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 4.5. Créer l'enregistrement de rendez-vous
      const appointmentRef = db.collection('appointments').doc();
      const appointmentData = {
        tenantId: slotData.tenantId,
        practitionerId: slotData.practitionerId,
        patientId: null, // Pas de patient ID pour les réservations en ligne
        patient: validatedData.patient,
        serviceId: validatedData.serviceId,
        startAt: slotData.startAt,
        endAt: slotData.endAt,
        agendaEventId: agendaEvent.agendaEventId,
        status: 'confirmed',
        source: 'online',
        createdBy: 'patient',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      transaction.set(appointmentRef, appointmentData);
      
      return {
        appointmentId: appointmentRef.id,
        agendaEventId: agendaEvent.agendaEventId,
        startAt,
        endAt
      };
    });
    
    // 5. Programmer les notifications
    await scheduleNotifications(result.appointmentId, result.startAt);
    
    // 6. Générer l'URL ICS
    const icsUrl = `/api/booking/ics/${result.appointmentId}`;
    
    return {
      success: true,
      appointmentId: result.appointmentId,
      agendaEventId: result.agendaEventId,
      icsUrl
    };
    
  } catch (error: any) {
    console.error('❌ Erreur lors de la réservation:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', error.message || 'Erreur lors de la réservation');
  }
});

/**
 * Programme les notifications pour un rendez-vous
 */
async function scheduleNotifications(appointmentId: string, startAt: Date): Promise<void> {
  try {
    const notifications = [
      {
        type: 'confirm',
        scheduledAt: new Date(), // Immédiatement
        channel: 'email'
      },
      {
        type: 'reminder',
        scheduledAt: new Date(startAt.getTime() - 24 * 60 * 60 * 1000), // 24h avant
        channel: 'email'
      },
      {
        type: 'reminder',
        scheduledAt: new Date(startAt.getTime() - 2 * 60 * 60 * 1000), // 2h avant
        channel: 'sms'
      }
    ];
    
    for (const notification of notifications) {
      if (notification.scheduledAt > new Date()) {
        await db.collection('notifications').add({
          appointmentId,
          ...notification,
          scheduledAt: admin.firestore.Timestamp.fromDate(notification.scheduledAt),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }
    
    console.log(`✅ Notifications programmées pour le rendez-vous ${appointmentId}`);
  } catch (error) {
    console.error('❌ Erreur lors de la programmation des notifications:', error);
  }
}

/**
 * Récupère les événements occupés
 */
async function listBusyEvents(practitionerId: string, from: Date, to: Date): Promise<Array<{ start: Date; end: Date }>> {
  try {
    const busyEvents: Array<{ start: Date; end: Date }> = [];
    
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
          end: endDate
        });
      }
    }
    
    return busyEvents;
  } catch (error) {
    console.error('Error listing busy events:', error);
    return [];
  }
}