import { doc, getDoc, updateDoc, addDoc, collection, runTransaction, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { agenda } from '../agendaAdapter';
import { z } from 'zod';

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
 * Réserve définitivement un créneau
 */
export async function book(request: BookingRequest, clientIP: string): Promise<BookingResponse> {
  try {
    // 1. Validation des données
    const validatedData = BookingSchema.parse(request);
    
    // 2. Vérification du rate limiting
    if (!checkRateLimit(clientIP, 10, 60000)) {
      return {
        success: false,
        error: 'Trop de tentatives. Veuillez patienter avant de réessayer.'
      };
    }
    
    // 3. Vérification reCAPTCHA
    const isValidCaptcha = await verifyRecaptcha(validatedData.recaptchaToken, 'book_appointment');
    if (!isValidCaptcha) {
      return {
        success: false,
        error: 'Vérification de sécurité échouée. Veuillez réessayer.'
      };
    }
    
    // 4. Transaction de réservation
    const result = await runTransaction(db, async (transaction) => {
      // 4.1. Vérifier que le créneau est toujours en hold
      const slotRef = doc(db, 'appointmentSlots', validatedData.slotId);
      const slotDoc = await transaction.get(slotRef);
      
      if (!slotDoc.exists()) {
        throw new Error('Créneau non trouvé');
      }
      
      const slotData = slotDoc.data();
      
      if (slotData.status !== 'held') {
        throw new Error('Créneau non réservé ou déjà pris');
      }
      
      if (!slotData.heldUntil || slotData.heldUntil.toDate() < new Date()) {
        throw new Error('Réservation expirée');
      }
      
      // 4.2. Re-vérifier les collisions avec l'agenda en temps réel
      const startAt = slotData.startAt.toDate();
      const endAt = slotData.endAt.toDate();
      const busyEvents = await agenda.listBusyEvents(
        validatedData.serviceId, 
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
      const agendaEvent = await agenda.createEvent({
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
        heldUntil: null,
        updatedAt: Timestamp.now()
      });
      
      // 4.5. Créer l'enregistrement de rendez-vous
      const appointmentRef = doc(collection(db, 'appointments'));
      const appointmentData = {
        tenantId: slotData.tenantId,
        practitionerId: slotData.practitionerId,
        patientId: null, // Pas de patient ID pour les réservations en ligne
        patient: validatedData.patient,
        serviceId: validatedData.serviceId,
        startAt: Timestamp.fromDate(startAt),
        endAt: Timestamp.fromDate(endAt),
        agendaEventId: agendaEvent.agendaEventId,
        status: 'confirmed',
        source: 'online',
        createdBy: 'patient',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
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
    await this.scheduleNotifications(result.appointmentId, result.startAt);
    
    // 6. Générer l'URL ICS
    const icsUrl = `/api/booking/ics/${result.appointmentId}`;
    
    return {
      success: true,
      appointmentId: result.appointmentId,
      agendaEventId: result.agendaEventId,
      icsUrl
    };
    
  } catch (error) {
    console.error('❌ Erreur lors de la réservation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur lors de la réservation'
    };
  }
}

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
        await addDoc(collection(db, 'notifications'), {
          appointmentId,
          ...notification,
          scheduledAt: Timestamp.fromDate(notification.scheduledAt),
          createdAt: Timestamp.now()
        });
      }
    }
    
    console.log(`✅ Notifications programmées pour le rendez-vous ${appointmentId}`);
  } catch (error) {
    console.error('❌ Erreur lors de la programmation des notifications:', error);
  }
}