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
 * Service pour la gestion des factures avec intégrité référentielle
 */
export class InvoiceService {
  /**
   * Crée une nouvelle facture
   */
  static async createInvoice(invoiceData: any): Promise<string> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // 1. Vérifier que le patient existe
      const patientRef = doc(db, 'patients', invoiceData.patientId);
      const patientDoc = await getDoc(patientRef);
      
      if (!patientDoc.exists()) {
        throw new Error('Le patient associé à cette facture n\'existe pas ou a été supprimé');
      }
      
      // 2. Préparer les données de la facture
      const userId = auth.currentUser.uid;
      const timestamp = Timestamp.now();
      
      const invoiceWithMetadata = {
        ...invoiceData,
        osteopathId: userId,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: userId
      };
      
      // 3. Ajouter la facture à la collection invoices
      const invoiceRef = collection(db, 'invoices');
      const docRef = await addDoc(invoiceRef, invoiceWithMetadata);
      const invoiceId = docRef.id;
      
      // 4. Journaliser l'action
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        `invoices/${invoiceId}`,
        'create',
        SensitivityLevel.SENSITIVE,
        'success',
        { patientId: invoiceData.patientId }
      );
      
      return invoiceId;
      
    } catch (error) {
      console.error('❌ Failed to create invoice:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        'invoices',
        'create',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }
  
  /**
   * Met à jour une facture
   */
  static async updateInvoice(invoiceId: string, updates: any): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // 1. Récupérer la facture actuelle
      const invoiceRef = doc(db, 'invoices', invoiceId);
      const invoiceDoc = await getDoc(invoiceRef);
      
      if (!invoiceDoc.exists()) {
        throw new Error('Facture non trouvée');
      }
      
      const invoiceData = invoiceDoc.data();
      
      // 2. Vérifier la propriété
      if (invoiceData.osteopathId !== auth.currentUser.uid) {
        throw new Error('Vous n\'avez pas les droits pour modifier cette facture');
      }
      
      // 3. Vérifier que le patient existe toujours si on change de patient
      if (updates.patientId && updates.patientId !== invoiceData.patientId) {
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
      
      // 5. Mettre à jour la facture
      await updateDoc(invoiceRef, updatesWithMetadata);
      
      // 6. Journaliser l'action
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        `invoices/${invoiceId}`,
        'update',
        SensitivityLevel.SENSITIVE,
        'success',
        { patientId: invoiceData.patientId }
      );
      
    } catch (error) {
      console.error('❌ Failed to update invoice:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        `invoices/${invoiceId}`,
        'update',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }
  
  /**
   * Supprime une facture
   */
  static async deleteInvoice(invoiceId: string): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // 1. Récupérer la facture
      const invoiceRef = doc(db, 'invoices', invoiceId);
      const invoiceDoc = await getDoc(invoiceRef);
      
      if (!invoiceDoc.exists()) {
        throw new Error('Facture non trouvée');
      }
      
      const invoiceData = invoiceDoc.data();
      
      // 2. Vérifier la propriété
      if (invoiceData.osteopathId !== auth.currentUser.uid) {
        throw new Error('Vous n\'avez pas les droits pour supprimer cette facture');
      }
      
      // 3. Récupérer le patientId avant suppression
      const patientId = invoiceData.patientId;
      
      // 4. Supprimer la facture
      await deleteDoc(invoiceRef);
      
      // 5. Journaliser l'action
      await AuditLogger.log(
        AuditEventType.DATA_DELETION,
        `invoices/${invoiceId}`,
        'delete',
        SensitivityLevel.SENSITIVE,
        'success',
        { patientId }
      );
      
    } catch (error) {
      console.error('❌ Failed to delete invoice:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_DELETION,
        'invoices',
        'delete',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }
  
  /**
   * Supprime toutes les factures d'un patient
   */
  static async deletePatientInvoices(patientId: string): Promise<number> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }
    
    try {
      // Récupération des factures du patient
      const invoicesRef = collection(db, 'invoices');
      const q = query(
        invoicesRef,
        where('patientId', '==', patientId),
        where('osteopathId', '==', auth.currentUser.uid)
      );
      
      const snapshot = await getDocs(q);
      let count = 0;
      
      // Suppression de chaque facture
      for (const docSnap of snapshot.docs) {
        await deleteDoc(docSnap.ref);
        count++;
        
        // Journalisation de chaque suppression
        await AuditLogger.log(
          AuditEventType.DATA_DELETION,
          `invoices/${docSnap.id}`,
          'delete_cascade',
          SensitivityLevel.SENSITIVE,
          'success',
          { patientId }
        );
      }
      
      return count;
    } catch (error) {
      console.error('❌ Failed to delete patient invoices:', error);
      throw error;
    }
  }
  
  /**
   * Vérifie si un patient a des factures
   */
  static async hasPatientInvoices(patientId: string): Promise<boolean> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      const invoicesRef = collection(db, 'invoices');
      const q = query(
        invoicesRef,
        where('patientId', '==', patientId),
        where('osteopathId', '==', auth.currentUser.uid)
      );
      
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.error('❌ Failed to check patient invoices:', error);
      throw error;
    }
  }
}

export default InvoiceService;