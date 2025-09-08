import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc,
  writeBatch,
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { AuditLogger, AuditEventType, SensitivityLevel } from '../utils/auditLogger';
import { HDSCompliance } from '../utils/hdsCompliance';
import { AppointmentService } from './appointmentService';
import { ConsultationService } from './consultationService';
import { InvoiceService } from './invoiceService';
import { trackEvent } from '../lib/clarityClient';
import { trackEvent as trackMatomoEvent } from '../lib/matomoTagManager';
import { trackEvent as trackGAEvent } from '../lib/googleAnalytics';

/**
 * Service pour la migration des données de test vers des données réelles
 */
export class DataMigrationService {
  /**
   * Migre toutes les données de test vers des données réelles
   */
  static async migrateTestData(): Promise<{
    patientsUpdated: number;
    appointmentsUpdated: number;
    consultationsUpdated: number;
    invoicesUpdated: number;
    errors: number;
  }> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // Journaliser le début de la migration
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        'all',
        'migrate_test_data',
        SensitivityLevel.HIGHLY_SENSITIVE,
        'started'
      );
      
      // Tracking analytics
      trackEvent("data_migration_started");
      trackMatomoEvent('Data', 'Migration Started', 'Test to Production');
      trackGAEvent('data_migration_started');
      
      // Résultats de la migration
      const results = {
        patientsUpdated: 0,
        appointmentsUpdated: 0,
        consultationsUpdated: 0,
        invoicesUpdated: 0,
        errors: 0
      };
      
      // 1. Migrer les patients
      const patientsResult = await this.migratePatients();
      results.patientsUpdated = patientsResult.updated;
      results.errors += patientsResult.errors;
      
      // 2. Migrer les rendez-vous
      const appointmentsResult = await this.migrateAppointments();
      results.appointmentsUpdated = appointmentsResult.updated;
      results.errors += appointmentsResult.errors;
      
      // 3. Migrer les consultations
      const consultationsResult = await this.migrateConsultations();
      results.consultationsUpdated = consultationsResult.updated;
      results.errors += consultationsResult.errors;
      
      // 4. Migrer les factures
      const invoicesResult = await this.migrateInvoices();
      results.invoicesUpdated = invoicesResult.updated;
      results.errors += invoicesResult.errors;
      
      // 5. Synchroniser les rendez-vous des patients
      await AppointmentService.syncAllPatientAppointments();
      
      // Journaliser la fin de la migration
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        'all',
        'migrate_test_data',
        SensitivityLevel.HIGHLY_SENSITIVE,
        'success',
        results
      );
      
      // Tracking analytics
      trackEvent("data_migration_completed", results);
      trackMatomoEvent('Data', 'Migration Completed', 'Test to Production', 
        results.patientsUpdated + results.appointmentsUpdated + 
        results.consultationsUpdated + results.invoicesUpdated);
      trackGAEvent('data_migration_completed', results);
      
      return results;
    } catch (error) {
      console.error('❌ Failed to migrate test data:', error);
      
      // Journaliser l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        'all',
        'migrate_test_data',
        SensitivityLevel.HIGHLY_SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      // Tracking analytics
      trackEvent("data_migration_error", { error: (error as Error).message });
      trackMatomoEvent('Data', 'Migration Error', (error as Error).message);
      trackGAEvent('data_migration_error', { error_message: (error as Error).message });
      
      throw error;
    }
  }
  
  /**
   * Migre les patients de test vers des patients réels
   */
  private static async migratePatients(): Promise<{
    updated: number;
    errors: number;
  }> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }
    
    try {
      // Récupérer tous les patients de test
      const patientsRef = collection(db, 'patients');
      const q = query(
        patientsRef,
        where('osteopathId', '==', auth.currentUser.uid),
        where('isTestData', '==', true)
      );
      
      const snapshot = await getDocs(q);
      let updated = 0;
      let errors = 0;
      
      // Traiter chaque patient
      for (const docSnap of snapshot.docs) {
        try {
          const patientData = docSnap.data();
          
          // Mettre à jour le patient pour le marquer comme réel
          await updateDoc(doc(db, 'patients', docSnap.id), {
            isTestData: false,
            updatedAt: new Date().toISOString(),
            migratedAt: new Date().toISOString(),
            migratedBy: auth.currentUser.uid
          });
          
          updated++;
          
          // Journaliser la migration
          await AuditLogger.log(
            AuditEventType.DATA_MODIFICATION,
            `patients/${docSnap.id}`,
            'migrate_to_production',
            SensitivityLevel.SENSITIVE,
            'success',
            { patientName: `${patientData.firstName} ${patientData.lastName}` }
          );
        } catch (error) {
          console.error(`❌ Failed to migrate patient ${docSnap.id}:`, error);
          errors++;
        }
      }
      
      return { updated, errors };
    } catch (error) {
      console.error('❌ Failed to migrate patients:', error);
      throw error;
    }
  }
  
  /**
   * Migre les rendez-vous de test vers des rendez-vous réels
   */
  private static async migrateAppointments(): Promise<{
    updated: number;
    errors: number;
  }> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }
    
    try {
      // Récupérer tous les rendez-vous de test
      const appointmentsRef = collection(db, 'appointments');
      const q = query(
        appointmentsRef,
        where('osteopathId', '==', auth.currentUser.uid),
        where('isTestData', '==', true)
      );
      
      const snapshot = await getDocs(q);
      let updated = 0;
      let errors = 0;
      
      // Traiter chaque rendez-vous
      for (const docSnap of snapshot.docs) {
        try {
          // Mettre à jour le rendez-vous pour le marquer comme réel
          await updateDoc(doc(db, 'appointments', docSnap.id), {
            isTestData: false,
            updatedAt: Timestamp.now(),
            migratedAt: Timestamp.now(),
            migratedBy: auth.currentUser.uid
          });
          
          updated++;
          
          // Journaliser la migration
          await AuditLogger.log(
            AuditEventType.DATA_MODIFICATION,
            `appointments/${docSnap.id}`,
            'migrate_to_production',
            SensitivityLevel.SENSITIVE,
            'success'
          );
        } catch (error) {
          console.error(`❌ Failed to migrate appointment ${docSnap.id}:`, error);
          errors++;
        }
      }
      
      return { updated, errors };
    } catch (error) {
      console.error('❌ Failed to migrate appointments:', error);
      throw error;
    }
  }
  
  /**
   * Migre les consultations de test vers des consultations réelles
   */
  private static async migrateConsultations(): Promise<{
    updated: number;
    errors: number;
  }> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }
    
    try {
      // Récupérer toutes les consultations de test
      const consultationsRef = collection(db, 'consultations');
      const q = query(
        consultationsRef,
        where('osteopathId', '==', auth.currentUser.uid),
        where('isTestData', '==', true)
      );
      
      const snapshot = await getDocs(q);
      let updated = 0;
      let errors = 0;
      
      // Traiter chaque consultation
      for (const docSnap of snapshot.docs) {
        try {
          // Mettre à jour la consultation pour la marquer comme réelle
          await updateDoc(doc(db, 'consultations', docSnap.id), {
            isTestData: false,
            updatedAt: Timestamp.now(),
            migratedAt: Timestamp.now(),
            migratedBy: auth.currentUser.uid
          });
          
          updated++;
          
          // Journaliser la migration
          await AuditLogger.log(
            AuditEventType.DATA_MODIFICATION,
            `consultations/${docSnap.id}`,
            'migrate_to_production',
            SensitivityLevel.HIGHLY_SENSITIVE,
            'success'
          );
        } catch (error) {
          console.error(`❌ Failed to migrate consultation ${docSnap.id}:`, error);
          errors++;
        }
      }
      
      return { updated, errors };
    } catch (error) {
      console.error('❌ Failed to migrate consultations:', error);
      throw error;
    }
  }
  
  /**
   * Migre les factures de test vers des factures réelles
   */
  private static async migrateInvoices(): Promise<{
    updated: number;
    errors: number;
  }> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }
    
    try {
      // Récupérer toutes les factures de test
      const invoicesRef = collection(db, 'invoices');
      const q = query(
        invoicesRef,
        where('osteopathId', '==', auth.currentUser.uid),
        where('isTestData', '==', true)
      );
      
      const snapshot = await getDocs(q);
      let updated = 0;
      let errors = 0;
      
      // Traiter chaque facture
      for (const docSnap of snapshot.docs) {
        try {
          // Mettre à jour la facture pour la marquer comme réelle
          await updateDoc(doc(db, 'invoices', docSnap.id), {
            isTestData: false,
            updatedAt: new Date().toISOString(),
            migratedAt: new Date().toISOString(),
            migratedBy: auth.currentUser.uid
          });
          
          updated++;
          
          // Journaliser la migration
          await AuditLogger.log(
            AuditEventType.DATA_MODIFICATION,
            `invoices/${docSnap.id}`,
            'migrate_to_production',
            SensitivityLevel.SENSITIVE,
            'success'
          );
        } catch (error) {
          console.error(`❌ Failed to migrate invoice ${docSnap.id}:`, error);
          errors++;
        }
      }
      
      return { updated, errors };
    } catch (error) {
      console.error('❌ Failed to migrate invoices:', error);
      throw error;
    }
  }
  
  /**
   * Vérifie l'intégrité des données
   */
  static async verifyDataIntegrity(): Promise<{
    brokenPatientReferences: number;
    brokenAppointmentReferences: number;
    brokenConsultationReferences: number;
    brokenInvoiceReferences: number;
    fixedReferences: number;
  }> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }
    
    try {
      // Journaliser le début de la vérification
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        'all',
        'verify_integrity',
        SensitivityLevel.INTERNAL,
        'started'
      );
      
      // Résultats de la vérification
      const results = {
        brokenPatientReferences: 0,
        brokenAppointmentReferences: 0,
        brokenConsultationReferences: 0,
        brokenInvoiceReferences: 0,
        fixedReferences: 0
      };
      
      // 1. Récupérer tous les patients
      const patientsRef = collection(db, 'patients');
      const patientsQuery = query(
        patientsRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );
      
      const patientsSnapshot = await getDocs(patientsQuery);
      const patientIds = new Set(patientsSnapshot.docs.map(doc => doc.id));
      
      // 2. Vérifier les références dans les rendez-vous
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );
      
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      
      for (const docSnap of appointmentsSnapshot.docs) {
        const appointmentData = docSnap.data();
        
        // Vérifier si le patient existe
        if (appointmentData.patientId && !patientIds.has(appointmentData.patientId)) {
          results.brokenPatientReferences++;
          
          // Marquer le rendez-vous comme orphelin
          await updateDoc(doc(db, 'appointments', docSnap.id), {
            patientMissing: true,
            updatedAt: Timestamp.now()
          });
          
          results.fixedReferences++;
        }
      }
      
      // 3. Vérifier les références dans les consultations
      const consultationsRef = collection(db, 'consultations');
      const consultationsQuery = query(
        consultationsRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );
      
      const consultationsSnapshot = await getDocs(consultationsQuery);
      
      for (const docSnap of consultationsSnapshot.docs) {
        const consultationData = docSnap.data();
        
        // Vérifier si le patient existe
        if (consultationData.patientId && !patientIds.has(consultationData.patientId)) {
          results.brokenConsultationReferences++;
          
          // Marquer la consultation comme orpheline
          await updateDoc(doc(db, 'consultations', docSnap.id), {
            patientMissing: true,
            updatedAt: Timestamp.now()
          });
          
          results.fixedReferences++;
        }
      }
      
      // 4. Vérifier les références dans les factures
      const invoicesRef = collection(db, 'invoices');
      const invoicesQuery = query(
        invoicesRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );
      
      const invoicesSnapshot = await getDocs(invoicesQuery);
      
      for (const docSnap of invoicesSnapshot.docs) {
        const invoiceData = docSnap.data();
        
        // Vérifier si le patient existe
        if (invoiceData.patientId && !patientIds.has(invoiceData.patientId)) {
          results.brokenInvoiceReferences++;
          
          // Marquer la facture comme orpheline
          await updateDoc(doc(db, 'invoices', docSnap.id), {
            patientMissing: true,
            updatedAt: Timestamp.now()
          });
          
          results.fixedReferences++;
        }
      }
      
      // Journaliser la fin de la vérification
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        'all',
        'verify_integrity',
        SensitivityLevel.INTERNAL,
        'success',
        results
      );
      
      return results;
    } catch (error) {
      console.error('❌ Failed to verify data integrity:', error);
      
      // Journaliser l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        'all',
        'verify_integrity',
        SensitivityLevel.INTERNAL,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }
  
  /**
   * Répare les références brisées
   */
  static async repairBrokenReferences(): Promise<{
    fixedAppointments: number;
    fixedConsultations: number;
    fixedInvoices: number;
    errors: number;
  }> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }
    
    try {
      // Journaliser le début de la réparation
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        'all',
        'repair_references',
        SensitivityLevel.HIGHLY_SENSITIVE,
        'started'
      );
      
      // Résultats de la réparation
      const results = {
        fixedAppointments: 0,
        fixedConsultations: 0,
        fixedInvoices: 0,
        errors: 0
      };
      
      // 1. Réparer les rendez-vous orphelins
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('osteopathId', '==', auth.currentUser.uid),
        where('patientMissing', '==', true)
      );
      
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      
      for (const docSnap of appointmentsSnapshot.docs) {
        try {
          // Supprimer le rendez-vous orphelin
          await deleteDoc(docSnap.ref);
          results.fixedAppointments++;
        } catch (error) {
          console.error(`❌ Failed to fix appointment ${docSnap.id}:`, error);
          results.errors++;
        }
      }
      
      // 2. Réparer les consultations orphelines
      const consultationsRef = collection(db, 'consultations');
      const consultationsQuery = query(
        consultationsRef,
        where('osteopathId', '==', auth.currentUser.uid),
        where('patientMissing', '==', true)
      );
      
      const consultationsSnapshot = await getDocs(consultationsQuery);
      
      for (const docSnap of consultationsSnapshot.docs) {
        try {
          // Supprimer la consultation orpheline
          await deleteDoc(docSnap.ref);
          results.fixedConsultations++;
        } catch (error) {
          console.error(`❌ Failed to fix consultation ${docSnap.id}:`, error);
          results.errors++;
        }
      }
      
      // 3. Réparer les factures orphelines
      const invoicesRef = collection(db, 'invoices');
      const invoicesQuery = query(
        invoicesRef,
        where('osteopathId', '==', auth.currentUser.uid),
        where('patientMissing', '==', true)
      );
      
      const invoicesSnapshot = await getDocs(invoicesQuery);
      
      for (const docSnap of invoicesSnapshot.docs) {
        try {
          // Supprimer la facture orpheline
          await deleteDoc(docSnap.ref);
          results.fixedInvoices++;
        } catch (error) {
          console.error(`❌ Failed to fix invoice ${docSnap.id}:`, error);
          results.errors++;
        }
      }
      
      // Journaliser la fin de la réparation
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        'all',
        'repair_references',
        SensitivityLevel.HIGHLY_SENSITIVE,
        'success',
        results
      );
      
      return results;
    } catch (error) {
      console.error('❌ Failed to repair broken references:', error);
      
      // Journaliser l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_MODIFICATION,
        'all',
        'repair_references',
        SensitivityLevel.HIGHLY_SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }
  
  /**
   * Génère un rapport de migration
   */
  static async generateMigrationReport(): Promise<{
    totalPatients: number;
    totalAppointments: number;
    totalConsultations: number;
    totalInvoices: number;
    testPatients: number;
    testAppointments: number;
    testConsultations: number;
    testInvoices: number;
    realPatients: number;
    realAppointments: number;
    realConsultations: number;
    realInvoices: number;
    brokenReferences: number;
  }> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }
    
    try {
      // Journaliser le début du rapport
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        'all',
        'migration_report',
        SensitivityLevel.INTERNAL,
        'started'
      );
      
      // Résultats du rapport
      const results = {
        totalPatients: 0,
        totalAppointments: 0,
        totalConsultations: 0,
        totalInvoices: 0,
        testPatients: 0,
        testAppointments: 0,
        testConsultations: 0,
        testInvoices: 0,
        realPatients: 0,
        realAppointments: 0,
        realConsultations: 0,
        realInvoices: 0,
        brokenReferences: 0
      };
      
      // 1. Compter les patients
      const patientsRef = collection(db, 'patients');
      const patientsQuery = query(
        patientsRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );
      
      const patientsSnapshot = await getDocs(patientsQuery);
      results.totalPatients = patientsSnapshot.size;
      
      for (const docSnap of patientsSnapshot.docs) {
        const patientData = docSnap.data();
        if (patientData.isTestData) {
          results.testPatients++;
        } else {
          results.realPatients++;
        }
      }
      
      // 2. Compter les rendez-vous
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );
      
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      results.totalAppointments = appointmentsSnapshot.size;
      
      for (const docSnap of appointmentsSnapshot.docs) {
        const appointmentData = docSnap.data();
        if (appointmentData.isTestData) {
          results.testAppointments++;
        } else {
          results.realAppointments++;
        }
        
        // Vérifier si le patient existe
        if (appointmentData.patientId) {
          const patientRef = doc(db, 'patients', appointmentData.patientId);
          const patientDoc = await getDoc(patientRef);
          if (!patientDoc.exists()) {
            results.brokenReferences++;
          }
        }
      }
      
      // 3. Compter les consultations
      const consultationsRef = collection(db, 'consultations');
      const consultationsQuery = query(
        consultationsRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );
      
      const consultationsSnapshot = await getDocs(consultationsQuery);
      results.totalConsultations = consultationsSnapshot.size;
      
      for (const docSnap of consultationsSnapshot.docs) {
        const consultationData = docSnap.data();
        if (consultationData.isTestData) {
          results.testConsultations++;
        } else {
          results.realConsultations++;
        }
      }
      
      // 4. Compter les factures
      const invoicesRef = collection(db, 'invoices');
      const invoicesQuery = query(
        invoicesRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );
      
      const invoicesSnapshot = await getDocs(invoicesQuery);
      results.totalInvoices = invoicesSnapshot.size;
      
      for (const docSnap of invoicesSnapshot.docs) {
        const invoiceData = docSnap.data();
        if (invoiceData.isTestData) {
          results.testInvoices++;
        } else {
          results.realInvoices++;
        }
      }
      
      // Journaliser la fin du rapport
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        'all',
        'migration_report',
        SensitivityLevel.INTERNAL,
        'success',
        results
      );
      
      return results;
    } catch (error) {
      console.error('❌ Failed to generate migration report:', error);
      
      // Journaliser l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        'all',
        'migration_report',
        SensitivityLevel.INTERNAL,
        'failure',
        { error: (error as Error).message }
      );
      
      throw error;
    }
  }
}

export default DataMigrationService;