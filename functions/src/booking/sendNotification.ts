import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface NotificationData {
  appointmentId: string;
  type: 'confirm' | 'reminder' | 'cancel' | 'reschedule';
  channel: 'email' | 'sms';
  scheduledAt: Date;
  sentAt?: Date;
}

/**
 * Envoie une notification (email ou SMS)
 */
export const sendNotification = functions.firestore
  .document('notifications/{notificationId}')
  .onCreate(async (snap, context) => {
    const notificationId = context.params.notificationId;
    const notification = snap.data() as NotificationData;
    
    try {
      // 1. Vérifier si déjà envoyée (idempotence)
      if (notification.sentAt) {
        console.log('📧 Notification déjà envoyée:', notificationId);
        return;
      }
      
      // 2. Récupérer les détails du rendez-vous
      const appointmentDoc = await db.collection('appointments').doc(notification.appointmentId).get();
      
      if (!appointmentDoc.exists) {
        console.warn('⚠️ Rendez-vous non trouvé pour la notification:', notification.appointmentId);
        return;
      }
      
      const appointment = appointmentDoc.data()!;
      
      // 3. Récupérer les détails du service
      const serviceDoc = await db.collection('services').doc(appointment.serviceId).get();
      const service = serviceDoc.exists ? serviceDoc.data() : null;
      
      // 4. Récupérer les détails du praticien
      const practitionerDoc = await db.collection('practitioners').doc(appointment.practitionerId).get();
      const practitioner = practitionerDoc.exists ? practitionerDoc.data() : null;
      
      // 5. Préparer le contenu de la notification
      const startAt = appointment.startAt.toDate();
      const content = generateNotificationContent(
        notification.type,
        notification.channel,
        {
          appointment,
          service,
          practitioner,
          startAt
        }
      );
      
      // 6. Envoyer la notification
      if (notification.channel === 'email' && appointment.patient.email) {
        await sendEmail(appointment.patient.email, content);
      } else if (notification.channel === 'sms' && appointment.patient.phone) {
        await sendSMS(appointment.patient.phone, content);
      }
      
      // 7. Marquer comme envoyée
      await snap.ref.update({
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ Notification ${notification.type} envoyée via ${notification.channel}`);
      
    } catch (error: any) {
      console.error('❌ Erreur lors de l\'envoi de la notification:', error);
      
      // Marquer l'erreur
      await snap.ref.update({
        error: error.message || 'Erreur inconnue',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  });

/**
 * Génère le contenu d'une notification
 */
function generateNotificationContent(
  type: string,
  channel: string,
  context: any
): { subject?: string; text: string; html?: string } {
  const { appointment, service, practitioner, startAt } = context;
  const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
  const dateStr = startAt.toLocaleDateString('fr-FR');
  const timeStr = startAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  
  switch (type) {
    case 'confirm':
      if (channel === 'email') {
        return {
          subject: 'Confirmation de votre rendez-vous - OsteoApp',
          text: `Bonjour ${patientName},\n\nVotre rendez-vous est confirmé :\n\nDate : ${dateStr}\nHeure : ${timeStr}\nService : ${service?.name || 'Consultation'}\nPraticien : ${practitioner?.displayName || 'Ostéopathe'}\n\nCordialement,\nL'équipe OsteoApp`,
          html: `
            <h2>Rendez-vous confirmé</h2>
            <p>Bonjour ${patientName},</p>
            <p>Votre rendez-vous est confirmé :</p>
            <ul>
              <li><strong>Date :</strong> ${dateStr}</li>
              <li><strong>Heure :</strong> ${timeStr}</li>
              <li><strong>Service :</strong> ${service?.name || 'Consultation'}</li>
              <li><strong>Praticien :</strong> ${practitioner?.displayName || 'Ostéopathe'}</li>
            </ul>
            <p>Cordialement,<br>L'équipe OsteoApp</p>
          `
        };
      } else {
        return {
          text: `OsteoApp: Rendez-vous confirmé le ${dateStr} à ${timeStr} avec ${practitioner?.displayName || 'votre ostéopathe'}.`
        };
      }
      
    case 'reminder':
      if (channel === 'email') {
        return {
          subject: 'Rappel de votre rendez-vous - OsteoApp',
          text: `Bonjour ${patientName},\n\nRappel de votre rendez-vous :\n\nDate : ${dateStr}\nHeure : ${timeStr}\nService : ${service?.name || 'Consultation'}\nPraticien : ${practitioner?.displayName || 'Ostéopathe'}\n\nÀ bientôt,\nL'équipe OsteoApp`,
          html: `
            <h2>Rappel de rendez-vous</h2>
            <p>Bonjour ${patientName},</p>
            <p>Rappel de votre rendez-vous :</p>
            <ul>
              <li><strong>Date :</strong> ${dateStr}</li>
              <li><strong>Heure :</strong> ${timeStr}</li>
              <li><strong>Service :</strong> ${service?.name || 'Consultation'}</li>
              <li><strong>Praticien :</strong> ${practitioner?.displayName || 'Ostéopathe'}</li>
            </ul>
            <p>À bientôt,<br>L'équipe OsteoApp</p>
          `
        };
      } else {
        return {
          text: `OsteoApp: Rappel de votre rendez-vous demain ${dateStr} à ${timeStr} avec ${practitioner?.displayName || 'votre ostéopathe'}.`
        };
      }
      
    case 'cancel':
      if (channel === 'email') {
        return {
          subject: 'Annulation de votre rendez-vous - OsteoApp',
          text: `Bonjour ${patientName},\n\nVotre rendez-vous du ${dateStr} à ${timeStr} a été annulé.\n\nPour reprendre rendez-vous, visitez notre site.\n\nCordialement,\nL'équipe OsteoApp`,
          html: `
            <h2>Rendez-vous annulé</h2>
            <p>Bonjour ${patientName},</p>
            <p>Votre rendez-vous du ${dateStr} à ${timeStr} a été annulé.</p>
            <p>Pour reprendre rendez-vous, visitez notre site.</p>
            <p>Cordialement,<br>L'équipe OsteoApp</p>
          `
        };
      } else {
        return {
          text: `OsteoApp: Votre rendez-vous du ${dateStr} à ${timeStr} a été annulé.`
        };
      }
      
    default:
      return {
        text: `OsteoApp: Notification concernant votre rendez-vous du ${dateStr} à ${timeStr}.`
      };
  }
}

/**
 * Envoie un email (à implémenter avec votre fournisseur)
 */
async function sendEmail(to: string, content: { subject?: string; text: string; html?: string }): Promise<void> {
  try {
    // Utiliser votre fournisseur d'email (Mailjet, Sendinblue, etc.)
    console.log(`📧 Envoi d'email à ${to}:`, content.subject);
    
    // Exemple avec l'API email existante
    const response = await fetch('/api/email-sender', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to,
        subject: content.subject,
        text: content.text,
        html: content.html
      })
    });
    
    if (!response.ok) {
      throw new Error('Erreur lors de l\'envoi de l\'email');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email:', error);
    throw error;
  }
}

/**
 * Envoie un SMS (à implémenter avec votre fournisseur)
 */
async function sendSMS(to: string, content: { text: string }): Promise<void> {
  try {
    // Utiliser votre fournisseur SMS (Twilio, OVH, etc.)
    console.log(`📱 Envoi de SMS à ${to}:`, content.text);
    
    // Exemple d'implémentation
    // const response = await fetch('https://api.sms-provider.com/send', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.SMS_PROVIDER_API_KEY}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({
    //     to,
    //     message: content.text
    //   })
    // });
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi du SMS:', error);
    throw error;
  }
}