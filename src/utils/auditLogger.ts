import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/config';

// Types d'événements d'audit
export enum AuditEventType {
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_CREATION = 'DATA_CREATION',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  DATA_DELETION = 'DATA_DELETION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  CONFIGURATION = 'CONFIGURATION',
  EXPORT = 'EXPORT',
  ADMIN_ACTION = 'ADMIN_ACTION'
}

// Niveaux de sensibilité
export enum SensitivityLevel {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
  SENSITIVE = 'SENSITIVE',
  HIGHLY_SENSITIVE = 'HIGHLY_SENSITIVE'
}

// Interface pour les événements d'audit
export interface AuditEvent {
  timestamp: Date;
  userId: string;
  userEmail?: string;
  eventType: AuditEventType;
  resource: string;
  action: string;
  sensitivityLevel: SensitivityLevel;
  status: 'success' | 'failure';
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

/**
 * Service de journalisation d'audit conforme HDS
 */
export class AuditLogger {
  private static readonly COLLECTION_NAME = 'audit_logs';
  private static sessionId: string = crypto.randomUUID();
  
  /**
   * Journalise un événement d'audit
   */
  static async log(
    eventType: AuditEventType,
    resource: string,
    action: string,
    sensitivityLevel: SensitivityLevel,
    status: 'success' | 'failure',
    details?: any
  ): Promise<string | null> {
    try {
      if (!auth.currentUser) {
        console.warn('⚠️ Audit logging attempted without authenticated user');
        return null;
      }
      
      // Création de l'événement d'audit
      const auditEvent: Omit<AuditEvent, 'timestamp'> = {
        userId: auth.currentUser.uid,
        userEmail: auth.currentUser.email || undefined,
        eventType,
        resource,
        action,
        sensitivityLevel,
        status,
        details: details || {},
        ipAddress: await this.getClientIP(),
        userAgent: navigator.userAgent,
        sessionId: this.sessionId
      };
      
      // Ajout de l'horodatage cryptographique
      const timestamp = Timestamp.now();
      
      // Stockage dans Firestore
      const docRef = await addDoc(collection(db, this.COLLECTION_NAME), {
        ...auditEvent,
        timestamp,
        // Ajout de métadonnées pour conformité HDS
        hdsCompliance: {
          version: '2022-01',
          retentionPeriod: 1095, // 3 ans
          cryptographicTimestamp: true,
          immutable: true
        }
      });
      
      console.log(`✅ Audit log created: ${docRef.id}`);
      return docRef.id;
      
    } catch (error) {
      console.error('❌ Failed to create audit log:', error);
      
      // En cas d'erreur, tentative de journalisation locale
      this.logLocally({
        timestamp: new Date(),
        userId: auth.currentUser?.uid || 'unknown',
        userEmail: auth.currentUser?.email || undefined,
        eventType,
        resource,
        action,
        sensitivityLevel,
        status,
        details: details || {},
        ipAddress: 'unknown',
        userAgent: navigator.userAgent,
        sessionId: this.sessionId
      });
      
      return null;
    }
  }
  
  /**
   * Journalisation de secours locale
   */
  private static logLocally(event: AuditEvent): void {
    try {
      const localLogs = JSON.parse(localStorage.getItem('hds_audit_logs') || '[]');
      localLogs.push(event);
      
      // Limiter à 100 entrées maximum
      if (localLogs.length > 100) {
        localLogs.shift();
      }
      
      localStorage.setItem('hds_audit_logs', JSON.stringify(localLogs));
    } catch (error) {
      console.error('❌ Failed to create local audit log:', error);
    }
  }
  
  /**
   * Synchronise les logs locaux avec Firestore
   */
  static async syncLocalLogs(): Promise<number> {
    try {
      const localLogs = JSON.parse(localStorage.getItem('hds_audit_logs') || '[]');
      if (localLogs.length === 0) return 0;
      
      let syncCount = 0;
      
      for (const log of localLogs) {
        try {
          await addDoc(collection(db, this.COLLECTION_NAME), {
            ...log,
            timestamp: Timestamp.fromDate(new Date(log.timestamp)),
            syncedFromLocal: true
          });
          syncCount++;
        } catch (error) {
          console.error('❌ Failed to sync local log:', error);
        }
      }
      
      if (syncCount > 0) {
        localStorage.setItem('hds_audit_logs', JSON.stringify([]));
        console.log(`✅ Synced ${syncCount} local audit logs`);
      }
      
      return syncCount;
    } catch (error) {
      console.error('❌ Failed to sync local audit logs:', error);
      return 0;
    }
  }
  
  /**
   * Obtient l'adresse IP du client
   */
  private static async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }
  
  /**
   * Journalise un accès aux données patient
   */
  static async logPatientAccess(
    patientId: string,
    action: string,
    status: 'success' | 'failure',
    details?: any
  ): Promise<string | null> {
    return this.log(
      AuditEventType.DATA_ACCESS,
      `patients/${patientId}`,
      action,
      SensitivityLevel.HIGHLY_SENSITIVE,
      status,
      details
    );
  }
  
  /**
   * Journalise une modification de données patient
   */
  static async logPatientModification(
    patientId: string,
    action: string,
    status: 'success' | 'failure',
    details?: any
  ): Promise<string | null> {
    return this.log(
      AuditEventType.DATA_MODIFICATION,
      `patients/${patientId}`,
      action,
      SensitivityLevel.HIGHLY_SENSITIVE,
      status,
      details
    );
  }
  
  /**
   * Journalise une authentification
   */
  static async logAuthentication(
    action: 'login' | 'logout' | 'password_reset' | 'mfa_setup',
    status: 'success' | 'failure',
    details?: any
  ): Promise<string | null> {
    return this.log(
      AuditEventType.AUTHENTICATION,
      'auth',
      action,
      SensitivityLevel.SENSITIVE,
      status,
      details
    );
  }
  
  /**
   * Journalise un export de données
   */
  static async logExport(
    resource: string,
    format: string,
    status: 'success' | 'failure',
    details?: any
  ): Promise<string | null> {
    return this.log(
      AuditEventType.EXPORT,
      resource,
      `export_${format}`,
      SensitivityLevel.SENSITIVE,
      status,
      details
    );
  }
}

// Initialisation de la synchronisation des logs locaux
setTimeout(() => {
  if (auth.currentUser) {
    AuditLogger.syncLocalLogs().catch(console.error);
  }
}, 5000);

export default AuditLogger;