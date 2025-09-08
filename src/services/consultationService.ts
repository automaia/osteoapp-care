import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Consultation, ConsultationFormData } from '../types';
import { AuditLogger, AuditEventType, SensitivityLevel } from '../utils/auditLogger';
import HDSCompliance from '../utils/hdsCompliance';

export class ConsultationService {
  /**
   * Récupère toutes les consultations
   */
  static async getAllConsultations(): Promise<Consultation[]> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      const consultationsRef = collection(db, 'consultations');
      const q = query(
        consultationsRef,
        where('osteopathId', '==', auth.currentUser.uid),
        orderBy('date', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const consultations: Consultation[] = [];
      
      for (const docSnapshot of querySnapshot.docs) {
        const data = docSnapshot.data();
        
        // Déchiffrement des données sensibles pour l'affichage
        const decryptedData = HDSCompliance.decryptDataForDisplay(data, 'consultations', auth.currentUser.uid);
        
        consultations.push({
          id: docSnapshot.id,
          ...decryptedData,
          date: data.date?.toDate?.() || new Date(data.date),
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
        } as Consultation);
      }
      
      // Journalisation de l'accès aux données
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        'consultations',
        'read_all',
        SensitivityLevel.SENSITIVE,
        'success',
        { count: consultations.length }
      );
      
      return consultations;
      
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des consultations:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        'consultations',
        'read_all',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }

  /**
   * Récupère les consultations d'un patient spécifique
   */
  static async getConsultationsByPatientId(patientId: string): Promise<Consultation[]> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      const consultationsRef = collection(db, 'consultations');
      const q = query(
        consultationsRef,
        where('osteopathId', '==', auth.currentUser.uid),
        where('patientId', '==', patientId),
        orderBy('date', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const consultations: Consultation[] = [];
      
      for (const docSnapshot of querySnapshot.docs) {
        const data = docSnapshot.data();
        
        // Déchiffrement des données sensibles pour l'affichage
        const decryptedData = HDSCompliance.decryptDataForDisplay(data, 'consultations', auth.currentUser.uid);
        
        consultations.push({
          id: docSnapshot.id,
          ...decryptedData,
          date: data.date?.toDate?.() || new Date(data.date),
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
        } as Consultation);
      }
      
      // Journalisation de l'accès aux données
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        `consultations/patient/${patientId}`,
        'read_by_patient',
        SensitivityLevel.SENSITIVE,
        'success',
        { patientId, count: consultations.length }
      );
      
      return consultations;
      
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des consultations du patient:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        `consultations/patient/${patientId}`,
        'read_by_patient',
        SensitivityLevel.SENSITIVE,
        'failure',
        { patientId, error: (error as Error).message }
      );
      
      throw error;
    }
  }

  /**
   * Récupère une consultation par son ID
   */
  static async getConsultationById(id: string): Promise<Consultation | null> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      const docRef = doc(db, 'consultations', id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        return null;
      }
      
      const data = docSnap.data();
      
      // Vérification de propriété
      if (data.osteopathId !== auth.currentUser.uid) {
        throw new Error('Accès non autorisé à cette consultation');
      }
      
      // Déchiffrement des données sensibles pour l'affichage
      const decryptedData = HDSCompliance.decryptDataForDisplay(data, 'consultations', auth.currentUser.uid);
      
      const consultation: Consultation = {
        id: docSnap.id,
        ...decryptedData,
        date: data.date?.toDate?.() || new Date(data.date),
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
      } as Consultation;
      
      // Journalisation de l'accès aux données
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        `consultations/${id}`,
        'read_single',
        SensitivityLevel.SENSITIVE,
        'success'
      );
      
      return consultation;
      
    } catch (error) {
      console.error('❌ Erreur lors de la récupération de la consultation:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        `consultations/${id}`,
        'read_single',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }

  /**
   * Crée une nouvelle consultation
   */
  static async createConsultation(consultationData: ConsultationFormData): Promise<string> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      const userId = auth.currentUser.uid;
      const now = new Date();
      
      // Préparation des données avec chiffrement HDS
      const dataToStore = HDSCompliance.prepareDataForStorage({
        ...consultationData,
        osteopathId: userId,
        date: Timestamp.fromDate(new Date(consultationData.date)),
        createdAt: Timestamp.fromDate(now),
        updatedAt: Timestamp.fromDate(now)
      }, 'consultations', userId);
      
      const docRef = await addDoc(collection(db, 'consultations'), dataToStore);
      
      // Synchroniser le prochain rendez-vous du patient après création
      if (consultationData.patientId) {
        try {
          const { AppointmentService } = await import('./appointmentService');
          await AppointmentService.syncPatientNextAppointment(consultationData.patientId);
          
          // Si la consultation est terminée, l'ajouter à l'historique du patient
          if (consultationData.status === 'completed') {
            await this.addConsultationToPatientHistory(consultationData.patientId, {
              date: new Date(consultationData.date).toISOString(),
              notes: `${consultationData.reason} - ${consultationData.treatment}`,
              isHistorical: true
            });
          }
        } catch (syncError) {
          console.warn('⚠️ Erreur lors de la synchronisation du patient:', syncError);
        }
      }
      
      // Journalisation de la création
      await AuditLogger.log(
        AuditEventType.DATA_CREATION,
        `consultations/${docRef.id}`,
        'create',
        SensitivityLevel.SENSITIVE,
        'success',
        { patientId: consultationData.patientId }
      );
      
      return docRef.id;
      
    } catch (error) {
      console.error('❌ Erreur lors de la création de la consultation:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_CREATION,
        'consultations',
        'create',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }

  /**
   * Met à jour une consultation existante
   */
  static async updateConsultation(id: string, consultationData: Partial<ConsultationFormData>): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      console.log('🔄 ConsultationService.updateConsultation called with:', { id, consultationData });
      
      const docRef = doc(db, 'consultations', id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Consultation non trouvée');
      }
      
      const existingData = docSnap.data();
      console.log('📋 Existing consultation data:', existingData);
      
      // Vérification de propriété
      if (existingData.osteopathId !== auth.currentUser.uid) {
        throw new Error('Accès non autorisé à cette consultation');
      }
      
      const userId = auth.currentUser.uid;
      const updateData = {
        ...consultationData,
        updatedAt: Timestamp.fromDate(new Date())
      };
      
      // Si la date est modifiée, la convertir en Timestamp
      if (consultationData.date) {
        updateData.date = consultationData.date instanceof Date ? 
          Timestamp.fromDate(consultationData.date) : 
          Timestamp.fromDate(new Date(consultationData.date));
      }
      
      console.log('💾 Prepared update data:', updateData);
      
      // Préparation des données avec chiffrement HDS
      const dataToStore = HDSCompliance.prepareDataForStorage(updateData, 'consultations', userId);
      console.log('🔐 Data prepared for storage:', dataToStore);
      
      await updateDoc(docRef, dataToStore);
      console.log('✅ Consultation updated successfully in Firestore');
      
      // Synchroniser le prochain rendez-vous du patient après modification
      if (existingData.patientId) {
        try {
          const { AppointmentService } = await import('./appointmentService');
          await AppointmentService.syncPatientNextAppointment(existingData.patientId);
          console.log('🔄 Patient next appointment synced');
          
          // Si la consultation est maintenant terminée, l'ajouter à l'historique du patient
          if (consultationData.status === 'completed' && existingData.status !== 'completed') {
            await this.addConsultationToPatientHistory(existingData.patientId, {
              date: consultationData.date ? new Date(consultationData.date).toISOString() : existingData.date.toDate().toISOString(),
              notes: `${consultationData.reason || existingData.reason} - ${consultationData.treatment || existingData.treatment}`,
              isHistorical: true
            });
            console.log('📚 Consultation added to patient history');
          }
        } catch (syncError) {
          console.warn('⚠️ Erreur lors de la synchronisation du patient:', syncError);
        }
      }
      
      // Journalisation de la modification
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        `consultations/${id}`,
        'update',
        SensitivityLevel.SENSITIVE,
        'success',
        { fields: Object.keys(consultationData) }
      );
      
      console.log('📊 Audit log created for consultation update');
      
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour de la consultation:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        `consultations/${id}`,
        'update',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }

  /**
   * Supprime une consultation
   */
  static async deleteConsultation(id: string): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      const docRef = doc(db, 'consultations', id);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        throw new Error('Consultation non trouvée');
      }
      
      const data = docSnap.data();
      
      // Vérification de propriété
      if (data.osteopathId !== auth.currentUser.uid) {
        throw new Error('Accès non autorisé à cette consultation');
      }
      
      // Récupérer le patientId avant suppression
      const patientId = data.patientId;
      
      await deleteDoc(docRef);
      
      // Synchroniser le prochain rendez-vous du patient après suppression
      if (patientId) {
        try {
          const { AppointmentService } = await import('./appointmentService');
          await AppointmentService.syncPatientNextAppointment(patientId);
        } catch (syncError) {
          console.warn('⚠️ Erreur lors de la synchronisation du patient:', syncError);
        }
      }
      
      // Journalisation de la suppression
      await AuditLogger.log(
        AuditEventType.DATA_DELETION,
        `consultations/${id}`,
        'delete',
        SensitivityLevel.SENSITIVE,
        'success',
        { patientId }
      );
      
    } catch (error) {
      console.error('❌ Erreur lors de la suppression de la consultation:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_DELETION,
        `consultations/${id}`,
        'delete',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }

  /**
   * Ajoute une consultation à l'historique des rendez-vous passés du patient
   */
  private static async addConsultationToPatientHistory(
    patientId: string,
    appointmentData: {
      date: string;
      notes: string;
      isHistorical: boolean;
    }
  ): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      const patientRef = doc(db, 'patients', patientId);
      const patientDoc = await getDoc(patientRef);
      
      if (!patientDoc.exists()) {
        console.warn(`⚠️ Patient ${patientId} non trouvé pour mise à jour de l'historique`);
        return;
      }
      
      const patientData = patientDoc.data();
      const currentPastAppointments = patientData.pastAppointments || [];
      
      // Vérifier si cette consultation n'est pas déjà dans l'historique
      const existingAppointment = currentPastAppointments.find((app: any) => 
        app.date === appointmentData.date
      );
      
      if (!existingAppointment) {
        // Ajouter la nouvelle consultation à l'historique
        const updatedPastAppointments = [...currentPastAppointments, appointmentData];
        
        // Trier par date décroissante (plus récent en premier)
        updatedPastAppointments.sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        
        await updateDoc(patientRef, {
          pastAppointments: updatedPastAppointments,
          updatedAt: new Date().toISOString()
        });
        
        console.log(`✅ Consultation ajoutée à l'historique du patient ${patientId}`);
      }
    } catch (error) {
      console.error('❌ Erreur lors de l\'ajout à l\'historique du patient:', error);
    }
  }
  /**
   * Récupère les statistiques des consultations
   */
  static async getConsultationStats(): Promise<{
    total: number;
    thisMonth: number;
    completed: number;
    pending: number;
  }> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      const consultationsRef = collection(db, 'consultations');
      const q = query(
        consultationsRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );
      
      const querySnapshot = await getDocs(q);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      let total = 0;
      let thisMonth = 0;
      let completed = 0;
      let pending = 0;
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const consultationDate = data.date?.toDate?.() || new Date(data.date);
        
        total++;
        
        if (consultationDate >= startOfMonth) {
          thisMonth++;
        }
        
        if (data.status === 'completed') {
          completed++;
        } else {
          pending++;
        }
      });
      
      // Journalisation de l'accès aux statistiques
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        'consultations/stats',
        'read_stats',
        SensitivityLevel.LOW,
        'success'
      );
      
      return {
        total,
        thisMonth,
        completed,
        pending
      };
      
    } catch (error) {
      console.error('❌ Erreur lors de la récupération des statistiques:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        'consultations/stats',
        'read_stats',
        SensitivityLevel.LOW,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }
}