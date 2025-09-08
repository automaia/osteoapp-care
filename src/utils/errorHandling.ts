/**
 * Utilitaires pour la gestion des erreurs Firebase
 */

// Types d'erreurs Firebase
export type FirebaseErrorCode = 
  | 'functions/ok'
  | 'functions/cancelled'
  | 'functions/unknown'
  | 'functions/invalid-argument'
  | 'functions/deadline-exceeded'
  | 'functions/not-found'
  | 'functions/already-exists'
  | 'functions/permission-denied'
  | 'functions/resource-exhausted'
  | 'functions/failed-precondition'
  | 'functions/aborted'
  | 'functions/out-of-range'
  | 'functions/unimplemented'
  | 'functions/internal'
  | 'functions/unavailable'
  | 'functions/data-loss'
  | 'functions/unauthenticated'
  | 'network-error'
  | 'timeout';

// Configuration des erreurs qui peuvent être réessayées
export const RETRYABLE_ERRORS: FirebaseErrorCode[] = [
  'functions/internal',
  'functions/unavailable',
  'functions/deadline-exceeded',
  'functions/resource-exhausted',
  'functions/aborted',
  'network-error',
  'timeout'
];

// Messages d'erreur utilisateur-friendly
export const ERROR_MESSAGES: Record<FirebaseErrorCode, string> = {
  'functions/ok': 'Opération réussie',
  'functions/cancelled': 'Opération annulée',
  'functions/unknown': 'Une erreur inconnue est survenue',
  'functions/invalid-argument': 'Données invalides. Vérifiez vos informations.',
  'functions/deadline-exceeded': 'Délai d\'attente dépassé. Vérifiez votre connexion internet.',
  'functions/not-found': 'Service non disponible. Veuillez contacter le support.',
  'functions/already-exists': 'Cette information existe déjà dans notre système.',
  'functions/permission-denied': 'Accès refusé. Vous n\'avez pas les permissions nécessaires.',
  'functions/resource-exhausted': 'Trop de demandes simultanées. Attendez un moment avant de réessayer.',
  'functions/failed-precondition': 'Opération impossible dans l\'état actuel.',
  'functions/aborted': 'Opération interrompue. Veuillez réessayer.',
  'functions/out-of-range': 'Valeur hors limites acceptables.',
  'functions/unimplemented': 'Fonctionnalité non disponible.',
  'functions/internal': 'Erreur temporaire du serveur. Veuillez réessayer.',
  'functions/unavailable': 'Service temporairement indisponible. Réessayez dans quelques minutes.',
  'functions/data-loss': 'Perte de données critique. Contactez le support.',
  'functions/unauthenticated': 'Authentification requise. Veuillez vous reconnecter.',
  'network-error': 'Problème de connexion réseau. Vérifiez votre connexion internet.',
  'timeout': 'Délai d\'attente dépassé. Veuillez réessayer.'
};

/**
 * Détermine si une erreur peut être réessayée
 */
export function isRetryableError(errorCode: string): boolean {
  return RETRYABLE_ERRORS.includes(errorCode as FirebaseErrorCode);
}

/**
 * Obtient un message d'erreur utilisateur-friendly
 */
export function getFriendlyErrorMessage(errorCode: string, attempt: number = 0, maxAttempts: number = 0): string {
  const baseMessage = ERROR_MESSAGES[errorCode as FirebaseErrorCode] || 
                     `Erreur inconnue (${errorCode}). Veuillez réessayer.`;
  
  if (attempt > 0 && maxAttempts > 0 && isRetryableError(errorCode)) {
    if (attempt < maxAttempts) {
      return `${baseMessage} Nouvelle tentative (${attempt}/${maxAttempts})...`;
    } else {
      return `${baseMessage} Toutes les tentatives ont échoué. Veuillez réessayer plus tard.`;
    }
  }
  
  return baseMessage;
}

/**
 * Calcule le délai pour le backoff exponentiel
 */
export function getExponentialBackoffDelay(attempt: number, baseDelay: number = 1000, maxDelay: number = 10000): number {
  return Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
}

/**
 * Fonction générique pour réessayer une opération avec backoff exponentiel
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    retryableErrors?: string[];
    onAttempt?: (attempt: number, maxAttempts: number, error?: any) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    retryableErrors = RETRYABLE_ERRORS,
    onAttempt = () => {}
  } = options;

  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      onAttempt(attempt, maxAttempts);
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errorCode = error.code || error.message || 'unknown';
      
      onAttempt(attempt, maxAttempts, error);
      
      // Si l'erreur n'est pas retryable ou c'est la dernière tentative, lancer l'erreur
      if (!retryableErrors.includes(errorCode as FirebaseErrorCode) || attempt === maxAttempts) {
        throw error;
      }
      
      // Backoff exponentiel
      const delay = getExponentialBackoffDelay(attempt, baseDelay, maxDelay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Ce code ne devrait jamais être atteint, mais TypeScript l'exige
  throw lastError;
}