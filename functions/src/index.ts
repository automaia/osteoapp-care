import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';

admin.initializeApp();

// Configuration email (à adapter selon votre fournisseur)
const transporter = nodemailer.createTransporter({
  service: 'gmail', // ou votre fournisseur SMTP
  auth: {
    user: functions.config().email.user,
    pass: functions.config().email.password
  }
});

// Template email de confirmation pour la liste d'attente
const generateWaitlistEmail = (firstName: string, position: number) => {
  return {
    subject: '🎉 Bienvenue dans la Beta d\'OsthéoApp !',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenue dans la Beta OsthéoApp</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #0A84FF, #30D158); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .position-badge { background: #0A84FF; color: white; padding: 15px 25px; border-radius: 50px; font-size: 24px; font-weight: bold; display: inline-block; margin: 20px 0; }
          .steps { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .step { margin: 15px 0; padding-left: 30px; position: relative; }
          .step::before { content: counter(step-counter); counter-increment: step-counter; position: absolute; left: 0; top: 0; background: #0A84FF; color: white; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
          .steps { counter-reset: step-counter; }
          .cta { background: #0A84FF; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; margin: 20px 0; font-weight: bold; }
          .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🩺 OsthéoApp Beta</h1>
            <p>Bienvenue dans l'avenir de la gestion de cabinet !</p>
          </div>
          
          <div class="content">
            <h2>Bonjour ${firstName} ! 👋</h2>
            
            <p>Merci de votre intérêt pour OsthéoApp ! Nous sommes ravis de vous compter parmi les futurs utilisateurs de notre plateforme révolutionnaire.</p>
            
            <div style="text-align: center;">
              <div class="position-badge">
                Position #${position}
              </div>
              <p><strong>Votre position dans la liste d'attente Beta</strong></p>
            </div>
            
            <div class="steps">
              <h3>📋 Prochaines étapes :</h3>
              <div class="step">
                <strong>Confirmation reçue</strong><br>
                Votre inscription est confirmée et votre place est réservée
              </div>
              <div class="step">
                <strong>Invitation personnalisée</strong><br>
                Nous vous contacterons dès qu'une place se libère (généralement sous 2-3 semaines)
              </div>
              <div class="step">
                <strong>Accès complet</strong><br>
                Formation personnalisée et accès à toutes les fonctionnalités Beta
              </div>
            </div>
            
            <h3>🎯 Pourquoi la Beta ?</h3>
            <ul>
              <li><strong>Accès anticipé</strong> : Découvrez toutes les fonctionnalités avant tout le monde</li>
              <li><strong>Influence directe</strong> : Votre feedback façonne l'évolution du produit</li>
              <li><strong>Support prioritaire</strong> : Assistance dédiée et formation personnalisée</li>
              <li><strong>Tarif préférentiel</strong> : Conditions avantageuses pour les Beta testeurs</li>
            </ul>
            
            <div style="text-align: center;">
              <a href="https://osteoapp.com/beta-updates" class="cta">
                📧 Suivre les actualités Beta
              </a>
            </div>
            
            <p><strong>Questions ?</strong> Répondez simplement à cet email, notre équipe vous répondra rapidement !</p>
            
            <p>À très bientôt,<br>
            <strong>L'équipe OsthéoApp</strong> 🚀</p>
          </div>
          
          <div class="footer">
            <p>OsthéoApp - La nouvelle génération de gestion de cabinet</p>
            <p>
              <a href="https://osteoapp.com">Site web</a> | 
              <a href="https://osteoapp.com/privacy">Confidentialité</a> | 
              <a href="mailto:contact@osteoapp.com">Contact</a>
            </p>
            
            <!-- Pixel de tracking d'ouverture -->
            <img src="https://osteoapp.com/email-tracking/open?id={{ENTRY_ID}}" width="1" height="1" style="display:none;" />
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Bonjour ${firstName} !
      
      Merci de votre intérêt pour OsthéoApp ! Vous êtes maintenant en position #${position} dans notre liste d'attente Beta.
      
      Prochaines étapes :
      1. Confirmation reçue - Votre place est réservée
      2. Invitation personnalisée - Nous vous contacterons sous 2-3 semaines
      3. Accès complet - Formation et accès à toutes les fonctionnalités
      
      Pourquoi la Beta ?
      - Accès anticipé à toutes les fonctionnalités
      - Influence directe sur l'évolution du produit
      - Support prioritaire et formation personnalisée
      - Tarif préférentiel pour les Beta testeurs
      
      Questions ? Répondez à cet email !
      
      À très bientôt,
      L'équipe OsthéoApp
    `
  };
};

// New Cloud Function to handle waitlist submission
export const submitWaitlistEntry = functions.https.onCall(async (data, context) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      profileType,
      experienceYears,
      city,
      teamSize,
      practiceType,
      hasCurrentSoftware,
      currentSoftware,
      currentSoftwareIssues,
      expectations,
      referralSource,
      newsletter,
      userAgent,
      referrer,
      utm_source,
      utm_medium,
      utm_campaign
    } = data;

    const normalizedEmail = email.toLowerCase();

    // Check if email already exists
    const existingQuery = await admin.firestore()
      .collection('beta_waitlist')
      .where('email', '==', normalizedEmail)
      .get();

    if (!existingQuery.empty) {
      throw new functions.https.HttpsError('already-exists', 'Cet email est déjà inscrit sur la liste d\'attente');
    }

    // Calculate position in waitlist
    const allWaitlistQuery = await admin.firestore()
      .collection('beta_waitlist')
      .get();
    const position = allWaitlistQuery.size + 1;

    // Create waitlist entry
    const waitlistData = {
      firstName,
      lastName,
      email: normalizedEmail,
      phone,
      profileType,
      experienceYears,
      city,
      teamSize,
      practiceType,
      hasCurrentSoftware,
      currentSoftware: currentSoftware || '',
      currentSoftwareIssues: currentSoftwareIssues || '',
      expectations,
      referralSource: referralSource || '',
      newsletter: newsletter || false,
      position,
      status: 'waiting',
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      ipAddress: '',
      userAgent: userAgent || '',
      referrer: referrer || '',
      utm_source: utm_source || '',
      utm_medium: utm_medium || '',
      utm_campaign: utm_campaign || '',
      emailSent: false,
      emailOpenedAt: null,
      invitedAt: null,
      registeredAt: null
    };

    // Add to Firestore
    const docRef = await admin.firestore()
      .collection('beta_waitlist')
      .add(waitlistData);

    console.log(`Waitlist entry created for ${normalizedEmail} at position ${position}`);

    return {
      success: true,
      position: position,
      entryId: docRef.id
    };

  } catch (error) {
    console.error('Error in submitWaitlistEntry:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Une erreur est survenue lors de l\'inscription');
  }
});

// Fonction Cloud pour envoyer l'email de confirmation
export const sendWaitlistConfirmationEmail = functions.firestore
  .document('beta_waitlist/{entryId}')
  .onCreate(async (snap, context) => {
    const entryData = snap.data();
    const entryId = context.params.entryId;
    
    try {
      const emailContent = generateWaitlistEmail(entryData.firstName, entryData.position);
      
      // Remplacer le placeholder du tracking
      const htmlWithTracking = emailContent.html.replace('{{ENTRY_ID}}', entryId);
      
      const mailOptions = {
        from: '"OsthéoApp" <noreply@osteoapp.com>',
        to: entryData.email,
        subject: emailContent.subject,
        html: htmlWithTracking,
        text: emailContent.text
      };
      
      await transporter.sendMail(mailOptions);
      
      // Marquer l'email comme envoyé
      await snap.ref.update({
        emailSent: true,
        emailSentAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`Email de confirmation envoyé à ${entryData.email}`);
      
    } catch (error) {
      console.error('Erreur lors de l\'envoi de l\'email:', error);
      
      // Marquer l'erreur
      await snap.ref.update({
        emailSent: false,
        emailError: error.message
      });
    }
  });

// Endpoint pour tracker l'ouverture des emails
export const trackEmailOpen = functions.https.onRequest(async (req, res) => {
  const entryId = req.query.id as string;
  
  if (entryId) {
    try {
      await admin.firestore()
        .collection('beta_waitlist')
        .doc(entryId)
        .update({
          emailOpenedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
      console.error('Erreur tracking email:', error);
    }
  }
  
  // Retourner un pixel transparent
  res.set('Content-Type', 'image/gif');
  res.send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
});

// Fonction pour envoyer des invitations en lot
export const sendBatchInvitations = functions.https.onCall(async (data, context) => {
  // Vérifier l'authentification admin
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentification requise');
  }
  
  const { entryIds } = data;
  
  try {
    const batch = admin.firestore().batch();
    const promises = [];
    
    for (const entryId of entryIds) {
      const entryRef = admin.firestore().collection('beta_waitlist').doc(entryId);
      
      // Mettre à jour le statut
      batch.update(entryRef, {
        status: 'invited',
        invitedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Envoyer l'email d'invitation (à implémenter)
      // promises.push(sendInvitationEmail(entryId));
    }
    
    await batch.commit();
    await Promise.all(promises);
    
    return { success: true, count: entryIds.length };
    
  } catch (error) {
    console.error('Erreur envoi invitations:', error);
    throw new functions.https.HttpsError('internal', 'Erreur lors de l\'envoi des invitations');
  }
});

// Analytics pour la liste d'attente
export const getWaitlistAnalytics = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentification requise');
  }
  
  try {
    const snapshot = await admin.firestore().collection('beta_waitlist').get();
    const entries = snapshot.docs.map(doc => doc.data());
    
    const analytics = {
      total: entries.length,
      byStatus: {
        waiting: entries.filter(e => e.status === 'waiting').length,
        invited: entries.filter(e => e.status === 'invited').length,
        registered: entries.filter(e => e.status === 'registered').length,
        declined: entries.filter(e => e.status === 'declined').length
      },
      byProfession: entries.reduce((acc, entry) => {
        acc[entry.profession] = (acc[entry.profession] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      bySource: entries.reduce((acc, entry) => {
        const source = entry.utm_source || 'direct';
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      conversionRate: entries.length > 0 ? 
        (entries.filter(e => e.status === 'registered').length / entries.length * 100) : 0,
      emailOpenRate: entries.filter(e => e.emailSent).length > 0 ?
        (entries.filter(e => e.emailOpenedAt).length / entries.filter(e => e.emailSent).length * 100) : 0
    };
    
    return analytics;
    
  } catch (error) {
    console.error('Erreur analytics:', error);
    throw new functions.https.HttpsError('internal', 'Erreur lors de la récupération des analytics');
  }
});