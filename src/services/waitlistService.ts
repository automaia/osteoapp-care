import { httpsCallable, HttpsCallableResult } from 'firebase/functions';
import { collection, addDoc, query, where, getDocs, Timestamp, getCountFromServer } from 'firebase/firestore';
import { functions, db } from '../firebase/config';

// Types
export interface WaitlistFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profileType: 'installed' | 'graduate';
  experienceYears: string;
  city: string;
  teamSize: string;
  practiceType: string;
  hasCurrentSoftware: 'yes' | 'no';
  currentSoftware?: string;
  currentSoftwareIssues?: string;
  expectations: string;
  referralSource: string;
  newsletter: boolean;
}

export interface WaitlistResponse {
  success: boolean;
  position: number;
  entryId: string;
}

export interface SubmissionState {
  isSubmitting: boolean;
  currentAttempt: number;
  maxAttempts: number;
  lastError: string | null;
  method: 'functions' | 'firestore' | null;
}

/**
 * Service pour gérer les opérations liées à la liste d'attente
 */
export class WaitlistService {
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly BASE_DELAY = 1000;
  private static readonly MAX_DELAY = 5000;

  /**
   * Calcule la position dans la liste d'attente
   */
  private static async calculatePosition(): Promise<number> {
    try {
      const waitlistRef = collection(db, 'beta_waitlist');
      const snapshot = await getCountFromServer(query(waitlistRef));
      return snapshot.data().count + 1;
    } catch (error) {
      console.warn('⚠️ Could not calculate position, using default:', error);
      return 1;
    }
  }

  /**
   * Vérifie si un email existe déjà
   */
  private static async checkEmailExists(email: string): Promise<boolean> {
    try {
      const waitlistRef = collection(db, 'beta_waitlist');
      const q = query(waitlistRef, where('email', '==', email.toLowerCase()));
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (error) {
      console.warn('⚠️ Could not check email existence:', error);
      return false;
    }
  }

  /**
   * Fallback: Écriture directe dans Firestore
   */
  private static async submitToFirestore(
    data: WaitlistFormData,
    onProgress?: (state: SubmissionState) => void
  ): Promise<WaitlistResponse> {
    console.log('📝 Using Firestore direct fallback');
    
    onProgress?.({
      isSubmitting: true,
      currentAttempt: 1,
      maxAttempts: 1,
      lastError: null,
      method: 'firestore'
    });

    try {
      // Vérifier si l'email existe déjà
      const emailExists = await this.checkEmailExists(data.email);
      if (emailExists) {
        throw new Error('Cet email est déjà inscrit sur la liste d\'attente');
      }

      // Calculer la position
      const position = await this.calculatePosition();

      // Préparer les données
      const waitlistData = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email.toLowerCase(),
        phone: data.phone,
        profileType: data.profileType,
        experienceYears: data.experienceYears,
        city: data.city,
        teamSize: data.teamSize,
        practiceType: data.practiceType,
        hasCurrentSoftware: data.hasCurrentSoftware,
        currentSoftware: data.currentSoftware || '',
        currentSoftwareIssues: data.currentSoftwareIssues || '',
        expectations: data.expectations,
        referralSource: data.referralSource || '',
        newsletter: data.newsletter || false,
        position,
        status: 'waiting',
        submittedAt: Timestamp.now(),
        ipAddress: '',
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        utm_source: new URLSearchParams(window.location.search).get('utm_source') || '',
        utm_medium: new URLSearchParams(window.location.search).get('utm_medium') || '',
        utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign') || '',
        emailSent: false,
        emailOpenedAt: null,
        invitedAt: null,
        registeredAt: null,
        method: 'firestore_fallback'
      };

      // Ajouter à Firestore
      const docRef = await addDoc(collection(db, 'beta_waitlist'), waitlistData);

      console.log('✅ Successfully added to waitlist via Firestore:', docRef.id);

      return {
        success: true,
        position,
        entryId: docRef.id
      };

    } catch (error: any) {
      console.error('❌ Firestore fallback failed:', error);
      throw new Error(error.message || 'Erreur lors de l\'inscription via Firestore');
    }
  }

  /**
   * Tentative via Firebase Functions
   */
  private static async submitToFunctions(
    data: WaitlistFormData,
    attempt: number,
    onProgress?: (state: SubmissionState) => void
  ): Promise<WaitlistResponse> {
    console.log(`🔥 Attempting Firebase Functions (attempt ${attempt})`);
    
    onProgress?.({
      isSubmitting: true,
      currentAttempt: attempt,
      maxAttempts: this.MAX_ATTEMPTS,
      lastError: null,
      method: 'functions'
    });

    const submitWaitlistEntry = httpsCallable(functions, 'submitWaitlistEntry');
    
    const enrichedData = {
      ...data,
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      utm_source: new URLSearchParams(window.location.search).get('utm_source') || '',
      utm_medium: new URLSearchParams(window.location.search).get('utm_medium') || '',
      utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign') || ''
    };

    // Timeout de 15 secondes
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), 15000);
    });

    try {
      const result = await Promise.race([
        submitWaitlistEntry(enrichedData),
        timeoutPromise
      ]) as HttpsCallableResult<WaitlistResponse>;

      console.log('✅ Firebase Functions success:', result.data);
      return result.data;

    } catch (error: any) {
      const errorCode = error.code || error.message || 'unknown';
      const errorMessage = this.getErrorMessage(errorCode, attempt);
      
      console.error(`❌ Firebase Functions attempt ${attempt} failed:`, {
        code: errorCode,
        message: error.message,
        details: error
      });

      onProgress?.({
        isSubmitting: true,
        currentAttempt: attempt,
        maxAttempts: this.MAX_ATTEMPTS,
        lastError: errorMessage,
        method: 'functions'
      });

      throw new Error(errorMessage);
    }
  }

  /**
   * Soumission avec retry et fallback
   */
  static async submitEntry(
    data: WaitlistFormData,
    onProgress?: (state: SubmissionState) => void
  ): Promise<WaitlistResponse> {
    console.log('🚀 Starting waitlist submission process');

    // Validation côté client
    this.validateFormData(data);

    // Tentatives avec Firebase Functions
    for (let attempt = 1; attempt <= this.MAX_ATTEMPTS; attempt++) {
      try {
        const result = await this.submitToFunctions(data, attempt, onProgress);
        console.log('✅ Submission successful via Firebase Functions');
        return result;

      } catch (error: any) {
        const errorCode = error.code || error.message || 'unknown';
        
        // Erreurs qui ne nécessitent pas de retry
        const noRetryErrors = [
          'functions/already-exists',
          'functions/invalid-argument',
          'functions/permission-denied',
          'functions/not-found'
        ];

        if (noRetryErrors.includes(errorCode)) {
          console.log('❌ Non-retryable error, stopping attempts');
          throw error;
        }

        // Si c'est la dernière tentative, passer au fallback
        if (attempt === this.MAX_ATTEMPTS) {
          console.log('⚠️ All Firebase Functions attempts failed, trying Firestore fallback');
          break;
        }

        // Backoff exponentiel
        const delay = Math.min(this.BASE_DELAY * Math.pow(2, attempt - 1), this.MAX_DELAY);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Fallback vers Firestore direct
    try {
      const result = await this.submitToFirestore(data, onProgress);
      console.log('✅ Submission successful via Firestore fallback');
      return result;
    } catch (error: any) {
      console.error('❌ Both Firebase Functions and Firestore fallback failed');
      throw new Error('Impossible de traiter votre inscription. Veuillez réessayer plus tard.');
    }
  }

  /**
   * Validation des données du formulaire
   */
  private static validateFormData(data: WaitlistFormData): void {
    const errors: string[] = [];

    if (!data.firstName?.trim()) errors.push('Le prénom est requis');
    if (!data.lastName?.trim()) errors.push('Le nom est requis');
    if (!data.email?.trim()) errors.push('L\'email est requis');
    if (!data.phone?.trim()) errors.push('Le téléphone est requis');
    if (!data.city?.trim()) errors.push('La ville est requise');
    if (!data.expectations?.trim()) errors.push('Vos attentes sont requises');

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (data.email && !emailRegex.test(data.email)) {
      errors.push('Format d\'email invalide');
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }

  /**
   * Messages d'erreur contextuels
   */
  private static getErrorMessage(errorCode: string, attempt: number = 0): string {
    const errorMessages: Record<string, string> = {
      'functions/internal': attempt < this.MAX_ATTEMPTS 
        ? `Erreur temporaire du serveur. Nouvelle tentative (${attempt}/${this.MAX_ATTEMPTS})...`
        : 'Erreur serveur persistante. Veuillez réessayer plus tard.',
      'functions/unauthenticated': 'Problème d\'authentification. Veuillez rafraîchir la page.',
      'functions/invalid-argument': 'Données invalides. Vérifiez vos informations.',
      'functions/unavailable': 'Service temporairement indisponible. Réessayez dans quelques minutes.',
      'functions/deadline-exceeded': 'Délai d\'attente dépassé. Vérifiez votre connexion internet.',
      'functions/resource-exhausted': 'Trop de demandes simultanées. Attendez un moment avant de réessayer.',
      'functions/already-exists': 'Cet email est déjà inscrit sur la liste d\'attente.',
      'functions/permission-denied': 'Accès refusé. Veuillez contacter le support.',
      'functions/not-found': 'Service non disponible. Veuillez contacter le support.',
      'network-error': 'Problème de connexion réseau. Vérifiez votre connexion internet.',
      'timeout': 'Délai d\'attente dépassé. Veuillez réessayer.'
    };

    return errorMessages[errorCode] || `Erreur inconnue (${errorCode}). Veuillez réessayer.`;
  }
}

export default WaitlistService;