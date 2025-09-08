# Guide d'Intégration du SDK OsteoApp

## Vue d'ensemble

Ce SDK permet d'intégrer facilement des outils externes avec votre système OsteoApp pour la prise de rendez-vous et la gestion des consultations.

## Architecture

```
Outil Externe → SDK OsteoApp → Cloud Functions → Firestore
```

### Sécurité

- **Pas d'accès direct à Firestore** : L'outil externe ne communique jamais directement avec votre base de données
- **API sécurisée** : Toutes les requêtes passent par des Cloud Functions authentifiées
- **Chiffrement HDS** : Les données sensibles restent chiffrées selon les normes HDS
- **Validation** : Toutes les données sont validées côté serveur

## Fonctions Cloud Functions requises

Vous devez créer ces fonctions dans votre projet Firebase :

### 1. `getOsteopaths` - Récupérer les ostéopathes

```typescript
// functions/src/external-api/getOsteopaths.ts
export const getOsteopaths = functions.https.onCall(async (data, context) => {
  // Vérifier l'authentification API
  if (!context.auth && !isValidApiKey(data.apiKey)) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentification requise');
  }

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'osteopath'), where('isActive', '==', true));
    const snapshot = await getDocs(q);

    const osteopaths = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        firstName: data.firstName,
        lastName: data.lastName,
        specialties: data.specialties || [],
        schedule: data.schedule || {},
        rates: data.rates || []
      };
    });

    return { success: true, data: osteopaths };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Erreur lors de la récupération des ostéopathes');
  }
});
```

### 2. `checkAvailability` - Vérifier la disponibilité

```typescript
// functions/src/external-api/checkAvailability.ts
export const checkAvailability = functions.https.onCall(async (data, context) => {
  const { osteopathId, date, duration = 60 } = data;

  try {
    // 1. Récupérer le planning de l'ostéopathe
    const userDoc = await getDoc(doc(db, 'users', osteopathId));
    if (!userDoc.exists()) {
      throw new functions.https.HttpsError('not-found', 'Ostéopathe non trouvé');
    }

    const userData = userDoc.data();
    const schedule = userData.schedule || {};
    
    // 2. Vérifier si le cabinet est ouvert ce jour-là
    const dayKey = getDayKey(new Date(date));
    const daySchedule = schedule[dayKey];
    
    if (!daySchedule || !daySchedule.isOpen) {
      return {
        success: true,
        data: {
          date,
          isOpen: false,
          slots: []
        }
      };
    }

    // 3. Générer les créneaux théoriques
    const theoreticalSlots = [];
    for (const workingSlot of daySchedule.slots) {
      const slots = generateTimeSlots(workingSlot.start, workingSlot.end, duration);
      theoreticalSlots.push(...slots);
    }

    // 4. Récupérer les rendez-vous existants
    const appointmentsRef = collection(db, 'appointments');
    const appointmentsQuery = query(
      appointmentsRef,
      where('osteopathId', '==', osteopathId),
      where('date', '>=', startOfDay(new Date(date))),
      where('date', '<=', endOfDay(new Date(date))),
      where('status', 'in', ['scheduled', 'confirmed'])
    );
    
    const appointmentsSnapshot = await getDocs(appointmentsQuery);
    const bookedSlots = appointmentsSnapshot.docs.map(doc => {
      const appointment = doc.data();
      return {
        start: format(appointment.date.toDate(), 'HH:mm'),
        end: format(appointment.endTime.toDate(), 'HH:mm')
      };
    });

    // 5. Marquer les créneaux disponibles
    const availableSlots = theoreticalSlots.map(time => {
      const endTime = calculateEndTime(time, duration);
      const isBooked = bookedSlots.some(booked => 
        slotsOverlap(time, endTime, booked.start, booked.end)
      );

      return {
        start: time,
        end: endTime,
        available: !isBooked && isFutureSlot(new Date(date), time)
      };
    });

    return {
      success: true,
      data: {
        date,
        isOpen: true,
        slots: availableSlots
      }
    };

  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Erreur lors de la vérification de disponibilité');
  }
});
```

### 3. `createExternalAppointment` - Créer un rendez-vous

```typescript
// functions/src/external-api/createExternalAppointment.ts
export const createExternalAppointment = functions.https.onCall(async (data, context) => {
  const { osteopathId, patient, date, time, duration = 60, type = 'Consultation standard', notes } = data;

  try {
    // 1. Validation des données
    if (!osteopathId || !patient || !date || !time) {
      throw new functions.https.HttpsError('invalid-argument', 'Données manquantes');
    }

    // 2. Vérifier que l'ostéopathe existe
    const osteopathDoc = await getDoc(doc(db, 'users', osteopathId));
    if (!osteopathDoc.exists()) {
      throw new functions.https.HttpsError('not-found', 'Ostéopathe non trouvé');
    }

    // 3. Vérifier la disponibilité une dernière fois
    const appointmentDateTime = new Date(`${date}T${time}`);
    const endDateTime = new Date(appointmentDateTime.getTime() + duration * 60000);

    const conflictQuery = query(
      collection(db, 'appointments'),
      where('osteopathId', '==', osteopathId),
      where('date', '>=', appointmentDateTime),
      where('date', '<', endDateTime),
      where('status', 'in', ['scheduled', 'confirmed'])
    );

    const conflictSnapshot = await getDocs(conflictQuery);
    if (!conflictSnapshot.empty) {
      throw new functions.https.HttpsError('already-exists', 'Créneau déjà réservé');
    }

    // 4. Créer ou récupérer le patient
    let patientId = '';
    const existingPatientQuery = query(
      collection(db, 'patients'),
      where('email', '==', patient.email.toLowerCase()),
      where('osteopathId', '==', osteopathId)
    );

    const existingPatientSnapshot = await getDocs(existingPatientQuery);
    
    if (!existingPatientSnapshot.empty) {
      patientId = existingPatientSnapshot.docs[0].id;
    } else {
      // Créer un nouveau patient
      const newPatientRef = doc(collection(db, 'patients'));
      const patientData = {
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email.toLowerCase(),
        phone: patient.phone || '',
        dateOfBirth: patient.dateOfBirth || '',
        gender: patient.gender || '',
        address: patient.address || {},
        osteopathId: osteopathId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: 'external-booking',
        isTestData: false
      };

      await setDoc(newPatientRef, patientData);
      patientId = newPatientRef.id;
    }

    // 5. Créer le rendez-vous
    const appointmentRef = doc(collection(db, 'appointments'));
    const appointmentData = {
      patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      practitionerId: osteopathId,
      practitionerName: osteopathDoc.data()?.displayName || 'Ostéopathe',
      date: Timestamp.fromDate(appointmentDateTime),
      endTime: Timestamp.fromDate(endDateTime),
      duration,
      status: 'confirmed',
      type,
      notes: notes || '',
      osteopathId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: 'external-booking',
      source: 'external-tool'
    };

    await setDoc(appointmentRef, appointmentData);

    // 6. Mettre à jour le prochain rendez-vous du patient
    await updateDoc(doc(db, 'patients', patientId), {
      nextAppointment: appointmentDateTime.toISOString(),
      updatedAt: Timestamp.now()
    });

    // 7. Générer un numéro de confirmation
    const confirmationNumber = `RDV-${Date.now().toString().slice(-6)}`;

    return {
      success: true,
      data: {
        appointmentId: appointmentRef.id,
        patientId,
        confirmationNumber,
        scheduledDate: appointmentDateTime,
        osteopathName: osteopathDoc.data()?.displayName || 'Ostéopathe'
      }
    };

  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Erreur lors de la création du rendez-vous');
  }
});
```

## Configuration des règles Firestore

Ajoutez ces règles pour permettre l'accès aux fonctions externes :

```javascript
// Dans firestore.rules
match /external_bookings/{bookingId} {
  allow create: if isAuthenticated();
  allow read: if isAdmin() || isOwner(resource);
}
```

## Variables d'environnement

Configurez ces variables dans Firebase Functions :

```bash
firebase functions:config:set external.api_key="your-secure-api-key"
firebase functions:config:set external.allowed_origins="https://your-booking-site.com"
```

## Déploiement

1. Compilez le SDK : `npm run build`
2. Publiez sur npm : `npm publish`
3. Déployez les Cloud Functions : `firebase deploy --only functions`

## Exemple d'utilisation complète

Voir les fichiers d'exemple dans le dossier `examples/` pour des implémentations complètes en JavaScript vanilla et React.