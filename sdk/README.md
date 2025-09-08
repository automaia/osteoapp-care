# OsteoApp SDK

SDK JavaScript/TypeScript pour intégrer des outils externes avec l'application OsteoApp.

## Installation

```bash
npm install @osteoapp/sdk
```

## Configuration

```typescript
import { OsteoAppSDK } from '@osteoapp/sdk';

const sdk = new OsteoAppSDK({
  apiUrl: 'https://your-osteoapp-api.com',
  apiKey: 'your-api-key', // Optionnel
  timeout: 10000, // 10 secondes
  retries: 3
});
```

## Utilisation

### Vérifier la connexion

```typescript
const isConnected = await sdk.testConnection();
if (!isConnected) {
  console.error('Impossible de se connecter à l\'API OsteoApp');
}
```

### Récupérer les ostéopathes disponibles

```typescript
const osteopaths = await sdk.getOsteopaths();
console.log('Ostéopathes disponibles:', osteopaths);
```

### Vérifier la disponibilité

```typescript
const availability = await sdk.appointments.getAvailableSlots(
  'osteopath-id',
  new Date('2024-01-15'),
  60 // durée en minutes
);

console.log('Créneaux disponibles:', availability.slots);
```

### Créer un rendez-vous

```typescript
try {
  const appointment = await sdk.bookAppointment({
    osteopathId: 'osteopath-id',
    patient: {
      firstName: 'Jean',
      lastName: 'Dupont',
      email: 'jean.dupont@email.com',
      phone: '06 12 34 56 78'
    },
    date: new Date('2024-01-15'),
    time: '14:00',
    duration: 60,
    type: 'Consultation standard',
    notes: 'Première consultation'
  });

  console.log('Rendez-vous créé:', appointment);
} catch (error) {
  console.error('Erreur lors de la création:', error.message);
}
```

### Annuler un rendez-vous

```typescript
const cancelled = await sdk.appointments.cancelAppointment(
  'appointment-id',
  'Annulation demandée par le patient'
);

if (cancelled) {
  console.log('Rendez-vous annulé avec succès');
}
```

### Rechercher un patient

```typescript
const patient = await sdk.patients.findByEmail('patient@email.com');
if (patient) {
  console.log('Patient trouvé:', patient);
} else {
  console.log('Patient non trouvé');
}
```

### Trouver les prochains créneaux disponibles

```typescript
const nextSlots = await sdk.findNextAvailableSlots(
  'osteopath-id',
  5, // nombre de créneaux
  60 // durée
);

console.log('Prochains créneaux:', nextSlots);
```

## Gestion des erreurs

Le SDK utilise des erreurs typées pour faciliter la gestion :

```typescript
import { OsteoAppSDKError } from '@osteoapp/sdk';

try {
  await sdk.bookAppointment(/* ... */);
} catch (error) {
  if (error instanceof OsteoAppSDKError) {
    switch (error.code) {
      case 'SLOT_UNAVAILABLE':
        console.log('Créneau non disponible');
        break;
      case 'INVALID_PATIENT_DATA':
        console.log('Données patient invalides:', error.details);
        break;
      case 'CONNECTION_ERROR':
        console.log('Problème de connexion');
        break;
      default:
        console.log('Erreur:', error.message);
    }
  }
}
```

## Types disponibles

Le SDK exporte tous les types TypeScript nécessaires :

```typescript
import { 
  Appointment, 
  Patient, 
  Osteopath, 
  DaySchedule, 
  TimeSlot,
  CreateAppointmentRequest,
  CreateAppointmentResponse 
} from '@osteoapp/sdk';
```

## Utilitaires de date

```typescript
import { DateHelpers } from '@osteoapp/sdk';

// Formater une date
const formatted = DateHelpers.formatDate(new Date(), 'dd/MM/yyyy');

// Générer des créneaux horaires
const slots = DateHelpers.generateTimeSlots('09:00', '18:00', 60);

// Vérifier si un créneau est dans le futur
const isFuture = DateHelpers.isFutureSlot(new Date(), '14:00');
```

## Exemple d'intégration complète

```typescript
import { OsteoAppSDK, DateHelpers } from '@osteoapp/sdk';

class AppointmentBooking {
  private sdk: OsteoAppSDK;

  constructor() {
    this.sdk = new OsteoAppSDK({
      apiUrl: process.env.OSTEOAPP_API_URL!,
      apiKey: process.env.OSTEOAPP_API_KEY
    });
  }

  async bookAppointmentFlow() {
    try {
      // 1. Vérifier la connexion
      const isConnected = await this.sdk.testConnection();
      if (!isConnected) {
        throw new Error('Service indisponible');
      }

      // 2. Récupérer les ostéopathes
      const osteopaths = await this.sdk.getOsteopaths();
      const selectedOsteopath = osteopaths[0]; // Sélection par l'utilisateur

      // 3. Vérifier la disponibilité
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const availability = await this.sdk.appointments.getAvailableSlots(
        selectedOsteopath.id,
        tomorrow,
        60
      );

      // 4. Sélectionner un créneau disponible
      const availableSlot = availability.slots.find(slot => slot.available);
      if (!availableSlot) {
        throw new Error('Aucun créneau disponible');
      }

      // 5. Créer le rendez-vous
      const appointment = await this.sdk.bookAppointment({
        osteopathId: selectedOsteopath.id,
        patient: {
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'jean.dupont@email.com',
          phone: '06 12 34 56 78'
        },
        date: tomorrow,
        time: availableSlot.start,
        type: 'Consultation standard'
      });

      console.log('Rendez-vous créé avec succès:', appointment);
      return appointment;

    } catch (error) {
      console.error('Erreur lors de la prise de rendez-vous:', error);
      throw error;
    }
  }
}
```

## Support

Pour toute question ou problème avec le SDK, contactez l'équipe OsteoApp à support@osteoapp.com.