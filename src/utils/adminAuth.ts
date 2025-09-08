import { User } from 'firebase/auth';

// Email autorisé pour l'administration
const ADMIN_EMAIL = 'grondin.stephane@gmail.com';

/**
 * Vérifie si l'utilisateur est un administrateur autorisé
 */
export function isAdmin(user: User | null): boolean {
  return user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/**
 * Vérifie si l'email est celui de l'administrateur
 */
export function isAdminEmail(email: string): boolean {
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/**
 * Hook pour vérifier l'accès administrateur
 */
export function checkAdminAccess(user: User | null): {
  isAuthorized: boolean;
  shouldRedirect: boolean;
} {
  if (!user) {
    return { isAuthorized: false, shouldRedirect: true };
  }
  
  if (!isAdmin(user)) {
    return { isAuthorized: false, shouldRedirect: true };
  }
  
  return { isAuthorized: true, shouldRedirect: false };
}