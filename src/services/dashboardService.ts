import { collection, query, where, getDocs, deleteDoc, doc, Timestamp, orderBy, limit, getCountFromServer } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { AuditLogger, AuditEventType, SensitivityLevel } from '../utils/auditLogger';
import { HDSCompliance } from '../utils/hdsCompliance';
import { trackEvent } from '../lib/clarityClient';
import { trackEvent as trackMatomoEvent } from '../lib/matomoTagManager';
import { trackEvent as trackGAEvent } from '../lib/googleAnalytics';
import { getEffectiveOsteopathId } from '../utils/substituteAuth';

/**
 * Service pour la gestion du tableau de bord
 */
export class DashboardService {
  /**
   * Récupère les statistiques du tableau de bord
   */
  static async getDashboardStats() {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // Obtenir l'ID de l'ostéopathe effectif (titulaire ou remplaçant)
      const effectiveOsteopathId = await getEffectiveOsteopathId(auth.currentUser);
      
      if (!effectiveOsteopathId) {
        throw new Error('Utilisateur non autorisé à accéder aux données');
      }
      
      // Récupération des compteurs
      const [
        patientCount,
        todayAppointments,
        pendingInvoices,
        newPatientsThisMonth,
        occupancyRate,
        invoicesThisMonth
      ] = await Promise.all([
        this.getPatientCount(effectiveOsteopathId),
        this.getTodayAppointments(effectiveOsteopathId),
        this.getPendingInvoices(effectiveOsteopathId),
        this.getNewPatientsThisMonth(effectiveOsteopathId),
        this.getOccupancyRate(effectiveOsteopathId),
        this.getInvoicesThisMonth(effectiveOsteopathId)
      ]);
      
      // Récupération des notifications récentes
      const recentNotifications = await this.getRecentNotifications(effectiveOsteopathId);
      
      // Journalisation de l'accès au tableau de bord
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        'dashboard',
        'view',
        SensitivityLevel.INTERNAL,
        'success',
        { effectiveOsteopathId }
      );
      
      // Track dashboard stats loaded
      trackEvent("dashboard_stats_loaded", {
        patient_count: patientCount,
        today_appointments: todayAppointments,
        pending_invoices: pendingInvoices
      });
      
      trackMatomoEvent('Dashboard', 'Stats Loaded');
      
      trackGAEvent('dashboard_stats_loaded', {
        patient_count: patientCount,
        today_appointments: todayAppointments,
        pending_invoices: pendingInvoices
      });
      
      return {
        patientCount,
        todayAppointments,
        pendingInvoices,
        newPatientsThisMonth,
        occupancyRate,
        invoicesThisMonth,
        recentNotifications
      };
    } catch (error) {
      console.error('❌ Failed to get dashboard stats:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        'dashboard',
        'view',
        SensitivityLevel.INTERNAL,
        'failure',
        { error: (error as Error).message }
      );
      
      // Track error
      trackEvent("dashboard_stats_error", { error: (error as Error).message });
      trackMatomoEvent('Error', 'Dashboard Stats', (error as Error).message);
      trackGAEvent('dashboard_stats_error', { error_message: (error as Error).message });
      
      throw error;
    }
  }
  
  /**
   * Récupère le nombre de patients
   */
  private static async getPatientCount(userId: string): Promise<number> {
    try {
      // Essayer d'abord getCountFromServer
      try {
        const patientsRef = collection(db, 'patients');
        const q = query(patientsRef, where('osteopathId', '==', userId));
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
      } catch (countError: any) {
        // Si getCountFromServer échoue, utiliser getDocs
        console.warn('getCountFromServer failed, using getDocs fallback:', countError.message);
        const patientsRef = collection(db, 'patients');
        const q = query(patientsRef, where('osteopathId', '==', userId));
        const snapshot = await getDocs(q);
        return snapshot.size;
      }
    } catch (error) {
      console.error('All methods failed for getting patient count:', error);
      // Retourner 0 au lieu de lancer l'erreur pour éviter de casser le dashboard
      return 0;
    }
  }
  
  /**
   * Récupère les consultations du jour
   */
  private static async getTodayAppointments(userId: string): Promise<number> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Utiliser une requête simple pour éviter l'erreur d'index manquant
      const consultationsRef = collection(db, 'consultations');
      const q = query(
        consultationsRef,
        where('osteopathId', '==', userId)
      );
      
      const snapshot = await getDocs(q);
      
      // Filtrer manuellement par date
      const todayConsultations = snapshot.docs.filter(doc => {
        const consultationDate = doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date);
        return consultationDate >= today && consultationDate < tomorrow;
      });
      
      return todayConsultations.length;
    } catch (error) {
      console.error('Error getting today consultations:', error);
      
      // Fallback: utiliser getDocs si getCountFromServer échoue
      try {
        const consultationsRef = collection(db, 'consultations');
        const q = query(
          consultationsRef,
          where('osteopathId', '==', userId)
        );
        
        const snapshot = await getDocs(q);
        
        // Filtrer manuellement par date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayConsultations = snapshot.docs.filter(doc => {
          const consultationDate = doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date);
          return consultationDate >= today && consultationDate < tomorrow;
        });
        
        return todayConsultations.length;
      } catch (fallbackError) {
        console.error('Fallback error getting today consultations:', fallbackError);
        return 0;
      }
    }
  }
  
  /**
   * Récupère les factures en attente
   */
  private static async getPendingInvoices(userId: string): Promise<number> {
    try {
      const invoicesRef = collection(db, 'invoices');
      const q = query(
        invoicesRef,
        where('osteopathId', '==', userId),
        where('status', '==', 'draft')
      );
      
      const snapshot = await getCountFromServer(q);
      return snapshot.data().count;
    } catch (error) {
      console.error('Error getting pending invoices:', error);
      
      // Fallback: utiliser getDocs si getCountFromServer échoue
      try {
        const invoicesRef = collection(db, 'invoices');
        const q = query(
          invoicesRef,
          where('osteopathId', '==', userId),
          where('status', '==', 'draft')
        );
        
        const snapshot = await getDocs(q);
        return snapshot.size;
      } catch (fallbackError) {
        console.error('Fallback error getting pending invoices:', fallbackError);
        return 0;
      }
    }
  }
  
  /**
   * Récupère les nouveaux patients du mois
   */
  private static async getNewPatientsThisMonth(userId: string): Promise<number> {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const patientsRef = collection(db, 'patients');
      
      // Tentative avec l'index composite (si disponible)
      try {
        const q = query(
          patientsRef,
          where('osteopathId', '==', userId),
          where('createdAt', '>=', firstDayOfMonth.toISOString())
        );
        
        const snapshot = await getCountFromServer(q);
        return snapshot.data().count;
      } catch (indexError: any) {
        // Si l'index n'est pas disponible, utiliser une requête simple
        if (indexError.code === 'failed-precondition' || indexError.message?.includes('index')) {
          console.warn('Index not available for patients query, using fallback method');
          
          // Requête simple sans orderBy
          const fallbackQuery = query(
            patientsRef,
            where('osteopathId', '==', userId)
          );
          
          const snapshot = await getDocs(fallbackQuery);
          
          // Filtrer manuellement par date
          const newPatients = snapshot.docs.filter(doc => {
            const createdAt = doc.data().createdAt;
            if (!createdAt) return false;
            
            try {
              const creationDate = new Date(createdAt);
              return creationDate >= firstDayOfMonth;
            } catch (e) {
              return false;
            }
          });
          
          return newPatients.length;
        }
        throw indexError;
      }
    } catch (error) {
      console.error('Error getting new patients this month:', error);
      return 0; // Retourner 0 en cas d'erreur
    }
  }
  
  /**
   * Calcule le taux d'occupation
   */
  private static async getOccupancyRate(userId: string): Promise<number> {
    try {
      // Calcul simplifié du taux d'occupation
      // En réalité, il faudrait comparer le nombre de consultations avec les plages disponibles
      
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Lundi de la semaine courante
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Dimanche
      endOfWeek.setHours(23, 59, 59, 999);
      
      const consultationsRef = collection(db, 'consultations');
      const q = query(
        consultationsRef,
        where('osteopathId', '==', userId)
      );
      
      const snapshot = await getDocs(q);
      
      // Filtrer manuellement par date
      const weekConsultations = snapshot.docs.filter(doc => {
        const consultationDate = doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date);
        return consultationDate >= startOfWeek && consultationDate <= endOfWeek;
      });
      
      // Hypothèse: 40 créneaux disponibles par semaine (8h-18h, 5 jours, créneaux d'1h)
      const totalSlots = 40;
      const bookedConsultations = weekConsultations.length;
      
      return Math.min(Math.round((bookedConsultations / totalSlots) * 100), 100);
    } catch (error) {
      console.error('Error calculating occupancy rate:', error);
      return 0; // Retourner 0 en cas d'erreur
    }
  }
  
  /**
   * Récupère les factures du mois
   */
  private static async getInvoicesThisMonth(userId: string): Promise<number> {
    try {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const invoicesRef = collection(db, 'invoices');
      
      // Requête simple sans orderBy pour éviter les problèmes d'index
      const q = query(
        invoicesRef,
        where('osteopathId', '==', userId)
      );
      
      const snapshot = await getDocs(q);
      
      // Filtrer manuellement par date
      const monthInvoices = snapshot.docs.filter(doc => {
        const issueDate = doc.data().issueDate;
        if (!issueDate) return false;
        
        try {
          const date = new Date(issueDate);
          return date >= firstDayOfMonth;
        } catch (e) {
          return false;
        }
      });
      
      return monthInvoices.length;
    } catch (error) {
      console.error('Error getting invoices this month:', error);
      return 0; // Retourner 0 en cas d'erreur
    }
  }
  
  /**
   * Récupère les notifications récentes
   */
  private static async getRecentNotifications(userId: string): Promise<any[]> {
    try {
      const notifications = [];
      
      // 1. Prochaines consultations
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      
      const consultationsRef = collection(db, 'consultations');
      
      try {
        const consultationsQuery = query(
          consultationsRef,
          where('osteopathId', '==', userId)
        );
        
        const consultationsSnapshot = await getDocs(consultationsQuery);
        
        // Filtrer manuellement pour les consultations d'aujourd'hui
        const todayConsultations = consultationsSnapshot.docs
          .filter(doc => {
            const consultationDate = doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date);
            return consultationDate >= now && consultationDate <= endOfDay;
          })
          .sort((a, b) => {
            const dateA = a.data().date?.toDate ? a.data().date.toDate() : new Date(a.data().date);
            const dateB = b.data().date?.toDate ? b.data().date.toDate() : new Date(b.data().date);
            return dateA.getTime() - dateB.getTime();
          })
          .slice(0, 3);
        
        for (const doc of todayConsultations) {
          const consultation = doc.data();
          
          // Déchiffrer les données si nécessaire
          const decryptedData = HDSCompliance.decryptDataForDisplay(
            consultation,
            'consultations',
            userId
          );
          
          const consultationDate = consultation.date?.toDate ? consultation.date.toDate() : new Date(consultation.date);
          
          notifications.push({
            id: doc.id,
            type: 'consultation',
            message: `Consultation avec ${decryptedData.patientName} à ${consultationDate.getHours()}:${String(consultationDate.getMinutes()).padStart(2, '0')}`,
            time: consultationDate,
            timeFormatted: `${consultationDate.getHours()}:${String(consultationDate.getMinutes()).padStart(2, '0')}`,
            priority: 'high'
          });
        }
      } catch (appointmentError) {
        console.warn('Could not load consultation notifications:', appointmentError);
      }
      
      // 2. Factures en attente
      const invoicesRef = collection(db, 'invoices');
      
      try {
        // Requête simple sans orderBy pour éviter les problèmes d'index
        const invoicesQuery = query(
          invoicesRef,
          where('osteopathId', '==', userId),
          where('status', '==', 'draft')
        );
        
        const invoicesSnapshot = await getDocs(invoicesQuery);
        const draftInvoices = invoicesSnapshot.docs.slice(0, 2);
        
        for (const doc of draftInvoices) {
          const invoice = doc.data();
          
          // Déchiffrer les données si nécessaire
          const decryptedData = HDSCompliance.decryptDataForDisplay(
            invoice,
            'invoices',
            userId
          );
          
          notifications.push({
            id: doc.id,
            type: 'invoice',
            message: `Facture #${decryptedData.number} en attente de paiement`,
            time: new Date(decryptedData.issueDate),
            timeFormatted: 'Hier',
            priority: 'medium'
          });
        }
      } catch (invoiceError) {
        console.warn('Could not load invoice notifications:', invoiceError);
      }
      
      // Trier par date
      notifications.sort((a, b) => a.time > b.time ? -1 : 1);
      
      return notifications.slice(0, 5); // Limiter à 5 notifications
    } catch (error) {
      console.error('Error getting recent notifications:', error);
      return []; // Retourner un tableau vide en cas d'erreur
    }
  }
  
  /**
   * Génère un rapport sur l'état des données
   */
  static async generateDataReport(userId: string): Promise<{
    patients: {
      total: number;
      test: number;
      real: number;
    };
    appointments: {
      total: number;
      test: number;
      real: number;
      upcoming: number;
      past: number;
    };
    consultations: {
      total: number;
      test: number;
      real: number;
    };
    invoices: {
      total: number;
      test: number;
      real: number;
      draft: number;
      sent: number;
      paid: number;
    };
  }> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }
    
    try {
      // Résultats du rapport
      const results = {
        patients: {
          total: 0,
          test: 0,
          real: 0
        },
        appointments: {
          total: 0,
          test: 0,
          real: 0,
          upcoming: 0,
          past: 0
        },
        consultations: {
          total: 0,
          test: 0,
          real: 0
        },
        invoices: {
          total: 0,
          test: 0,
          real: 0,
          draft: 0,
          sent: 0,
          paid: 0
        }
      };
      
      // 1. Compter les patients
      const patientsRef = collection(db, 'patients');
      const patientsQuery = query(
        patientsRef,
        where('osteopathId', '==', userId)
      );
      
      const patientsSnapshot = await getDocs(patientsQuery);
      results.patients.total = patientsSnapshot.size;
      
      for (const docSnap of patientsSnapshot.docs) {
        const patientData = docSnap.data();
        if (patientData.isTestData) {
          results.patients.test++;
        } else {
          results.patients.real++;
        }
      }
      
      // 2. Compter les rendez-vous
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('osteopathId', '==', userId)
      );
      
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      results.appointments.total = appointmentsSnapshot.size;
      
      const now = new Date();
      
      for (const docSnap of appointmentsSnapshot.docs) {
        const appointmentData = docSnap.data();
        if (appointmentData.isTestData) {
          results.appointments.test++;
        } else {
          results.appointments.real++;
        }
        
        // Vérifier si le rendez-vous est passé ou à venir
        const appointmentDate = appointmentData.date.toDate();
        if (appointmentDate > now) {
          results.appointments.upcoming++;
        } else {
          results.appointments.past++;
        }
      }
      
      // 3. Compter les consultations
      const consultationsRef = collection(db, 'consultations');
      const consultationsQuery = query(
        consultationsRef,
        where('osteopathId', '==', userId)
      );
      
      const consultationsSnapshot = await getDocs(consultationsQuery);
      results.consultations.total = consultationsSnapshot.size;
      
      for (const docSnap of consultationsSnapshot.docs) {
        const consultationData = docSnap.data();
        if (consultationData.isTestData) {
          results.consultations.test++;
        } else {
          results.consultations.real++;
        }
      }
      
      // 4. Compter les factures
      const invoicesRef = collection(db, 'invoices');
      const invoicesQuery = query(
        invoicesRef,
        where('osteopathId', '==', userId)
      );
      
      const invoicesSnapshot = await getDocs(invoicesQuery);
      results.invoices.total = invoicesSnapshot.size;
      
      for (const docSnap of invoicesSnapshot.docs) {
        const invoiceData = docSnap.data();
        if (invoiceData.isTestData) {
          results.invoices.test++;
        } else {
          results.invoices.real++;
        }
        
        // Compter par statut
        if (invoiceData.status === 'draft') {
          results.invoices.draft++;
        } else if (invoiceData.status === 'sent') {
          results.invoices.sent++;
        } else if (invoiceData.status === 'paid') {
          results.invoices.paid++;
        }
      }
      
      return results;
    } catch (error) {
      console.error('❌ Failed to generate data report:', error);
      throw error;
    }
  }
}

export default DashboardService;