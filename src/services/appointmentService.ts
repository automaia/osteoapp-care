import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  query, 
  where, 
  getDocs, 
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { AuditLogger, AuditEventType, SensitivityLevel } from '../utils/auditLogger';
import { HDSCompliance } from '../utils/hdsCompliance';

/**
 * Service pour la gestion des rendez-vous avec synchronisation bidirectionnelle
 */
export class AppointmentService {
  /**
   * Crée un nouveau rendez-vous et met à jour le dossier patient
   */
  static async createAppointment(appointmentData: any): Promise<string> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // 1. Vérifier que le patient existe
      const patientRef = doc(db, 'patients', appointmentData.patientId);
      const patientDoc = await getDoc(patientRef);
      
      if (!patientDoc.exists()) {
        throw new Error('Patient non trouvé');
      }
      
      // 2. Préparer les données du rendez-vous
      const userId = auth.currentUser.uid;
      const timestamp = Timestamp.now();
      
      const appointmentWithMetadata = {
        ...appointmentData,
        osteopathId: userId,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: userId
      };
      
      // 3. Ajouter le rendez-vous à la collection appointments
      const appointmentRef = collection(db, 'appointments');
      const docRef = await addDoc(appointmentRef, appointmentWithMetadata);
      const appointmentId = docRef.id;
      
      // 4. Mettre à jour le dossier patient avec le prochain rendez-vous
      const appointmentDate = appointmentData.date; // Fixed: removed .toDate() call
      const now = new Date();
      
      // Ne mettre à jour que si le rendez-vous est dans le futur
      if (appointmentDate > now) {
        const patientData = patientDoc.data();
        const currentNextAppointment = patientData.nextAppointment ? 
          new Date(patientData.nextAppointment) : null;
        
        // Mettre à jour seulement si c'est le prochain rendez-vous le plus proche
        if (!currentNextAppointment || appointmentDate < currentNextAppointment) {
          // Format: "YYYY-MM-DDThh:mm:00"
          const formattedDate = appointmentDate.toISOString().substring(0, 16) + ":00";
          
          await updateDoc(patientRef, {
            nextAppointment: formattedDate,
            updatedAt: timestamp
          });
          
          console.log(`✅ Patient ${appointmentData.patientId} updated with next appointment: ${formattedDate}`);
        }
      }
      
      // 5. Journaliser l'action
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        `appointments/${appointmentId}`,
        'create',
        SensitivityLevel.SENSITIVE,
        'success',
        { patientId: appointmentData.patientId }
      );
      
      return appointmentId;
      
    } catch (error) {
      console.error('❌ Failed to create appointment:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        'appointments',
        'create',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }
  
  /**
   * Met à jour un rendez-vous et synchronise avec le dossier patient
   */
  static async updateAppointment(appointmentId: string, updates: any): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // 1. Récupérer le rendez-vous actuel
      const appointmentRef = doc(db, 'appointments', appointmentId);
      const appointmentDoc = await getDoc(appointmentRef);
      
      if (!appointmentDoc.exists()) {
        throw new Error('Rendez-vous non trouvé');
      }
      
      const appointmentData = appointmentDoc.data();
      
      // 2. Vérifier la propriété
      if (appointmentData.osteopathId !== auth.currentUser.uid) {
        throw new Error('Vous n\'avez pas les droits pour modifier ce rendez-vous');
      }
      
      // 3. Vérifier que le patient existe toujours si on change de patient
      if (updates.patientId && updates.patientId !== appointmentData.patientId) {
        const newPatientRef = doc(db, 'patients', updates.patientId);
        const newPatientDoc = await getDoc(newPatientRef);
        
        if (!newPatientDoc.exists()) {
          throw new Error('Le nouveau patient sélectionné n\'existe pas');
        }
      }
      
      // 4. Préparer les mises à jour
      const updatesWithMetadata = {
        ...updates,
        updatedAt: Timestamp.now()
      };
      
      // 5. Mettre à jour le rendez-vous
      await updateDoc(appointmentRef, updatesWithMetadata);
      
      // 6. Synchroniser avec le dossier patient si la date a changé
      if (updates.date || updates.patientId) {
        // Si le patient a changé, mettre à jour les deux patients
        if (updates.patientId && updates.patientId !== appointmentData.patientId) {
          await this.syncPatientNextAppointment(appointmentData.patientId);
          await this.syncPatientNextAppointment(updates.patientId);
        } else {
          await this.syncPatientNextAppointment(appointmentData.patientId);
        }
      }
      
      // 7. Journaliser l'action
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        `appointments/${appointmentId}`,
        'update',
        SensitivityLevel.SENSITIVE,
        'success',
        { patientId: appointmentData.patientId }
      );
      
    } catch (error) {
      console.error('❌ Failed to update appointment:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        `appointments/${appointmentId}`,
        'update',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }
  
  /**
   * Supprime un rendez-vous et met à jour le dossier patient
   */
  static async deleteAppointment(appointmentId: string): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // 1. Récupérer le rendez-vous
      const appointmentRef = doc(db, 'appointments', appointmentId);
      const appointmentDoc = await getDoc(appointmentRef);
      
      if (!appointmentDoc.exists()) {
        throw new Error('Rendez-vous non trouvé');
      }
      
      const appointmentData = appointmentDoc.data();
      
      // 2. Vérifier la propriété
      if (appointmentData.osteopathId !== auth.currentUser.uid) {
        throw new Error('Vous n\'avez pas les droits pour supprimer ce rendez-vous');
      }
      
      // 3. Récupérer le patientId avant suppression
      const patientId = appointmentData.patientId;
      
      // 4. Vérifier que le patient existe toujours
      const patientRef = doc(db, 'patients', patientId);
      const patientDoc = await getDoc(patientRef);
      
      if (!patientDoc.exists()) {
        console.warn(`⚠️ Le patient ${patientId} n'existe plus, suppression du rendez-vous sans mise à jour du patient`);
      }
      
      // 5. Supprimer le rendez-vous
      await deleteDoc(appointmentRef);
      
      // 6. Mettre à jour le dossier patient s'il existe encore
      if (patientDoc.exists()) {
        await this.syncPatientNextAppointment(patientId);
      }
      
      // 7. Journaliser l'action
      await AuditLogger.log(
        AuditEventType.DATA_DELETION,
        `appointments/${appointmentId}`,
        'delete',
        SensitivityLevel.SENSITIVE,
        'success',
        { patientId }
      );
      
    } catch (error) {
      console.error('❌ Failed to delete appointment:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_DELETION,
        'appointments',
        'delete',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }
  
  /**
   * Supprime tous les rendez-vous
   */
  static async deleteAllAppointments(): Promise<{
    count: number;
    success: boolean;
    errors: number;
  }> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // Journaliser le début de l'opération
      await AuditLogger.log(
        AuditEventType.DATA_DELETION,
        'appointments',
        'delete_all',
        SensitivityLevel.HIGHLY_SENSITIVE,
        'started'
      );
      
      // Récupérer tous les rendez-vous de l'utilisateur
      const appointmentsRef = collection(db, 'appointments');
      const q = query(
        appointmentsRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );
      
      const snapshot = await getDocs(q);
      let count = 0;
      let errors = 0;
      
      // Créer un ensemble de patientIds pour la mise à jour ultérieure
      const patientIds = new Set<string>();
      
      // Supprimer chaque rendez-vous
      for (const docSnap of snapshot.docs) {
        try {
          const appointmentData = docSnap.data();
          
          // Ajouter le patientId à l'ensemble pour mise à jour ultérieure
          if (appointmentData.patientId) {
            patientIds.add(appointmentData.patientId);
          }
          
          // Supprimer le rendez-vous
          await deleteDoc(docSnap.ref);
          count++;
          
          // Journaliser chaque suppression
          await AuditLogger.log(
            AuditEventType.DATA_DELETION,
            `appointments/${docSnap.id}`,
            'delete_all',
            SensitivityLevel.SENSITIVE,
            'success'
          );
        } catch (error) {
          console.error(`❌ Failed to delete appointment ${docSnap.id}:`, error);
          errors++;
        }
      }
      
      // Mettre à jour les dossiers patients
      for (const patientId of patientIds) {
        try {
          await this.syncPatientNextAppointment(patientId);
        } catch (error) {
          console.error(`❌ Failed to sync patient ${patientId}:`, error);
        }
      }
      
      // Journaliser la fin de l'opération
      await AuditLogger.log(
        AuditEventType.DATA_DELETION,
        'appointments',
        'delete_all',
        SensitivityLevel.HIGHLY_SENSITIVE,
        'success',
        { count, errors }
      );
      
      return {
        count,
        success: true,
        errors
      };
      
    } catch (error) {
      console.error('❌ Failed to delete all appointments:', error);
      
      // Journaliser l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_DELETION,
        'appointments',
        'delete_all',
        SensitivityLevel.HIGHLY_SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }
  
  /**
   * Synchronise le prochain rendez-vous dans le dossier patient
   */
  static async syncPatientNextAppointment(patientId: string): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // 0. Vérifier que le patient existe toujours
      const patientRef = doc(db, 'patients', patientId);
      const patientDoc = await getDoc(patientRef);
      
      if (!patientDoc.exists()) {
        console.warn(`⚠️ Patient ${patientId} not found, skipping sync`);
        return;
      }
      
      // 1. Récupérer toutes les consultations futures du patient (non annulées et non terminées)
      const consultationsRef = collection(db, 'consultations');
      const now = new Date();
      
      const q = query(
        consultationsRef,
        where('patientId', '==', patientId),
        where('osteopathId', '==', auth.currentUser.uid)
      );
      
      const snapshot = await getDocs(q);
      
      // 2. Filtrer et trier les consultations futures (non terminées et non annulées)
      const futureConsultations = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            dateObj: data.date?.toDate ? data.date.toDate() : new Date(data.date)
          };
        })
        .filter(consultation => {
          // Filtrer les consultations futures qui ne sont ni annulées ni terminées
          return consultation.dateObj > now && 
                 consultation.status !== 'cancelled' && 
                 consultation.status !== 'completed';
        })
        .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
      
      // 3. Mettre à jour le dossier patient
      if (futureConsultations.length > 0) {
        // Prochaine consultation trouvée
        const nextConsultation = futureConsultations[0];
        const formattedDate = nextConsultation.dateObj.toISOString().substring(0, 16) + ":00";
        
        await updateDoc(patientRef, {
          nextAppointment: formattedDate,
          updatedAt: Timestamp.now()
        });
        
        console.log(`✅ Patient ${patientId} updated with next consultation: ${formattedDate}`);
      } else {
        // Aucune consultation future, effacer le champ nextAppointment
        await updateDoc(patientRef, {
          nextAppointment: null,
          updatedAt: Timestamp.now()
        });
        
        console.log(`✅ Patient ${patientId} updated with no next consultation`);
      }
      
    } catch (error) {
      console.error('❌ Failed to sync patient next consultation:', error);
      throw error;
    }
  }
  
  /**
   * Synchronise tous les rendez-vous avec les dossiers patients
   * Utile pour la maintenance ou la correction de données
   */
  static async syncAllPatientAppointments(): Promise<{
    processed: number,
    updated: number,
    errors: number
  }> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // 1. Récupérer tous les patients
      const patientsRef = collection(db, 'patients');
      const patientsQuery = query(
        patientsRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );
      
      const patientsSnapshot = await getDocs(patientsQuery);
      const patients = patientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`🔄 Syncing appointments for ${patients.length} patients`);
      
      // 2. Synchroniser chaque patient
      let processed = 0;
      let updated = 0;
      let errors = 0;
      
      for (const patient of patients) {
        try {
          await this.syncPatientNextAppointment(patient.id);
          processed++;
          updated++;
        } catch (error) {
          console.error(`❌ Error syncing patient ${patient.id}:`, error);
          errors++;
          processed++;
        }
      }
      
      // 3. Journaliser l'action
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        'patients',
        'sync_appointments',
        SensitivityLevel.INTERNAL,
        'success',
        { processed, updated, errors }
      );
      
      return { processed, updated, errors };
      
    } catch (error) {
      console.error('❌ Failed to sync all patient appointments:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        'patients',
        'sync_appointments',
        SensitivityLevel.INTERNAL,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }
  
  /**
   * Ajoute une consultation et met à jour le rendez-vous correspondant
   */
  static async addConsultationFromAppointment(
    appointmentId: string, 
    consultationData: any
  ): Promise<string> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // 1. Récupérer le rendez-vous
      const appointmentRef = doc(db, 'appointments', appointmentId);
      const appointmentDoc = await getDoc(appointmentRef);
      
      if (!appointmentDoc.exists()) {
        throw new Error('Rendez-vous non trouvé');
      }
      
      const appointmentData = appointmentDoc.data();
      
      // 2. Vérifier la propriété
      if (appointmentData.osteopathId !== auth.currentUser.uid) {
        throw new Error('Vous n\'avez pas les droits pour cette opération');
      }
      
      // 3. Vérifier que le patient existe toujours
      const patientRef = doc(db, 'patients', appointmentData.patientId);
      const patientDoc = await getDoc(patientRef);
      
      if (!patientDoc.exists()) {
        throw new Error('Le patient associé à ce rendez-vous n\'existe plus');
      }
      
      // 4. Préparer les données de consultation
      const consultationWithMetadata = {
        ...consultationData,
        appointmentId,
        patientId: appointmentData.patientId,
        patientName: appointmentData.patientName,
        osteopathId: auth.currentUser.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      // 5. Ajouter la consultation
      const consultationRef = collection(db, 'consultations');
      const docRef = await addDoc(consultationRef, consultationWithMetadata);
      const consultationId = docRef.id;
      
      // 6. Mettre à jour le statut du rendez-vous
      await updateDoc(appointmentRef, {
        status: 'completed',
        consultationId,
        updatedAt: Timestamp.now()
      });
      
      // 7. Journaliser l'action
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        `consultations/${consultationId}`,
        'create_from_appointment',
        SensitivityLevel.SENSITIVE,
        'success',
        { appointmentId, patientId: appointmentData.patientId }
      );
      
      return consultationId;
      
    } catch (error) {
      console.error('❌ Failed to add consultation from appointment:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        'consultations',
        'create_from_appointment',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }
  
  /**
   * Crée un rendez-vous à partir d'une consultation
   */
  static async createAppointmentFromConsultation(
    consultationId: string,
    appointmentData: any
  ): Promise<string> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // 1. Récupérer la consultation
      const consultationRef = doc(db, 'consultations', consultationId);
      const consultationDoc = await getDoc(consultationRef);
      
      if (!consultationDoc.exists()) {
        throw new Error('Consultation non trouvée');
      }
      
      const consultationData = consultationDoc.data();
      
      // 2. Vérifier la propriété
      if (consultationData.osteopathId !== auth.currentUser.uid) {
        throw new Error('Vous n\'avez pas les droits pour cette opération');
      }
      
      // 3. Vérifier que le patient existe toujours
      const patientRef = doc(db, 'patients', consultationData.patientId);
      const patientDoc = await getDoc(patientRef);
      
      if (!patientDoc.exists()) {
        throw new Error('Le patient associé à cette consultation n\'existe plus');
      }
      
      // 4. Préparer les données du rendez-vous
      const appointmentWithMetadata = {
        ...appointmentData,
        patientId: consultationData.patientId,
        patientName: consultationData.patientName,
        consultationId,
        osteopathId: auth.currentUser.uid,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };
      
      // 5. Créer le rendez-vous
      const appointmentId = await this.createAppointment(appointmentWithMetadata);
      
      // 6. Journaliser l'action
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        `appointments/${appointmentId}`,
        'create_from_consultation',
        SensitivityLevel.SENSITIVE,
        'success',
        { consultationId, patientId: consultationData.patientId }
      );
      
      return appointmentId;
      
    } catch (error) {
      console.error('❌ Failed to create appointment from consultation:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        'appointments',
        'create_from_consultation',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }
  
  /**
   * Vérifie si un patient a des rendez-vous
   */
  static async hasPatientAppointments(patientId: string): Promise<boolean> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(
        appointmentsRef,
        where('patientId', '==', patientId),
        where('osteopathId', '==', auth.currentUser.uid)
      );
      
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('❌ Failed to check patient appointments:', error);
      throw error;
    }
  }

  /**
   * Crée des rendez-vous à partir des rendez-vous passés d'un patient
   */
  static async createHistoricalAppointments(patientId: string, pastAppointments: any[]): Promise<number> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // Vérifier que le patient existe
      const patientRef = doc(db, 'patients', patientId);
      const patientDoc = await getDoc(patientRef);
      
      if (!patientDoc.exists()) {
        throw new Error('Patient non trouvé');
      }
      
      const patientData = patientDoc.data();
      let createdCount = 0;
      
      // Créer chaque rendez-vous historique
      for (const appointment of pastAppointments) {
        try {
          // Convertir la date et l'heure en objet Date
          const appointmentDate = new Date(appointment.date);
          
          // Calculer l'heure de fin (par défaut +1h)
          const endTime = new Date(appointmentDate.getTime() + 60 * 60 * 1000);
          
          // Préparer les données du rendez-vous
          const appointmentData = {
            patientId,
            patientName: `${patientData.firstName} ${patientData.lastName}`,
            practitionerId: auth.currentUser.uid,
            practitionerName: auth.currentUser.displayName || auth.currentUser.email,
            date: Timestamp.fromDate(appointmentDate),
            endTime: Timestamp.fromDate(endTime),
            duration: 60,
            type: 'Consultation historique',
            status: 'completed',
            location: {
              type: 'office',
              name: 'Cabinet principal'
            },
            notes: appointment.notes || 'Rendez-vous historique',
            isHistorical: true
          };
          
          // Ajouter le rendez-vous
          const appointmentRef = collection(db, 'appointments');
          await addDoc(appointmentRef, {
            ...appointmentData,
            osteopathId: auth.currentUser.uid,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
          });
          
          createdCount++;
        } catch (error) {
          console.error('❌ Failed to create historical appointment:', error);
        }
      }
      
      // Journaliser l'action
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        `patients/${patientId}`,
        'create_historical_appointments',
        SensitivityLevel.SENSITIVE,
        'success',
        { count: createdCount }
      );
      
      return createdCount;
    } catch (error) {
      console.error('❌ Failed to create historical appointments:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        'appointments',
        'create_historical_appointments',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }
}

export default AppointmentService;