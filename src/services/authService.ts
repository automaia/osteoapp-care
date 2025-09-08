import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { User, LoginCredentials, ApiResponse } from '../types/auth';
import { tokenStorage, decodeJWT } from '../utils/jwt';

class AuthService {
  private readonly ADMIN_EMAIL = 'grondin.stephane@gmail.com';

  /**
   * Connexion utilisateur avec gestion des rôles
   */
  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: User; token: string }>> {
    try {
      const { email, password, rememberMe = false } = credentials;

      // Authentification Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Obtenir le token Firebase
      const token = await firebaseUser.getIdToken();

      // Créer ou récupérer le profil utilisateur
      const user = await this.createOrUpdateUserProfile(firebaseUser);

      // Stocker les tokens
      tokenStorage.setTokens(token, token, rememberMe);

      // Logger l'activité
      await this.logActivity(user.uid, 'login', 'auth', {
        email: user.email,
        rememberMe
      });

      return {
        success: true,
        data: { user, token },
        message: 'Connexion réussie'
      };
    } catch (error: any) {
      console.error('Erreur de connexion:', error);
      return {
        success: false,
        message: this.getErrorMessage(error.code),
        errors: [error.message]
      };
    }
  }

  /**
   * Déconnexion
   */
  async logout(): Promise<ApiResponse> {
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await this.logActivity(currentUser.uid, 'logout', 'auth');
      }

      await signOut(auth);
      tokenStorage.clearTokens();

      return {
        success: true,
        message: 'Déconnexion réussie'
      };
    } catch (error: any) {
      console.error('Erreur de déconnexion:', error);
      return {
        success: false,
        message: 'Erreur lors de la déconnexion',
        errors: [error.message]
      };
    }
  }

  /**
   * Réinitialisation du mot de passe
   */
  async resetPassword(email: string): Promise<ApiResponse> {
    try {
      await sendPasswordResetEmail(auth, email);
      return {
        success: true,
        message: 'Email de réinitialisation envoyé'
      };
    } catch (error: any) {
      console.error('Erreur de réinitialisation:', error);
      return {
        success: false,
        message: this.getErrorMessage(error.code),
        errors: [error.message]
      };
    }
  }

  /**
   * Vérification du token actuel
   */
  async verifyToken(): Promise<User | null> {
    try {
      const token = tokenStorage.getAccessToken();
      if (!token) return null;

      const currentUser = auth.currentUser;
      if (!currentUser) return null;

      // Vérifier si le token est encore valide
      const newToken = await currentUser.getIdToken(true);
      const payload = decodeJWT(newToken);
      
      if (!payload) return null;

      // Récupérer le profil utilisateur
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (!userDoc.exists()) return null;

      const userData = userDoc.data();
      return {
        uid: currentUser.uid,
        email: currentUser.email!,
        displayName: currentUser.displayName || userData.displayName,
        role: userData.role || (this.isAdminEmail(currentUser.email!) ? 'admin' : 'user'),
        permissions: userData.permissions || this.getDefaultPermissions(userData.role),
        lastLogin: userData.lastLogin,
        isActive: userData.isActive !== false
      };
    } catch (error) {
      console.error('Erreur de vérification du token:', error);
      return null;
    }
  }

  /**
   * Création ou mise à jour du profil utilisateur
   */
  private async createOrUpdateUserProfile(firebaseUser: FirebaseUser): Promise<User> {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userRef);

    const role = this.isAdminEmail(firebaseUser.email!) ? 'admin' : 'osteopath';
    const permissions = this.getDefaultPermissions(role);

    const userData: Partial<User> = {
      uid: firebaseUser.uid,
      email: firebaseUser.email!,
      displayName: firebaseUser.displayName || '',
      role,
      permissions,
      lastLogin: new Date().toISOString(),
      isActive: true
    };

    if (userDoc.exists()) {
      // Mettre à jour l'utilisateur existant
      await updateDoc(userRef, {
        lastLogin: userData.lastLogin,
        isActive: true
      });
      
      const existingData = userDoc.data();
      return {
        ...existingData,
        ...userData
      } as User;
    } else {
      // Créer un nouvel utilisateur
      await setDoc(userRef, userData);
      return userData as User;
    }
  }

  /**
   * Logger une activité utilisateur
   */
  private async logActivity(
    userId: string, 
    action: string, 
    resource: string, 
    details?: Record<string, any>
  ): Promise<void> {
    try {
      const logRef = doc(db, 'activity_logs', `${userId}_${Date.now()}`);
      await setDoc(logRef, {
        userId,
        action,
        resource,
        timestamp: new Date().toISOString(),
        ipAddress: await this.getClientIP(),
        userAgent: navigator.userAgent,
        details: details || {}
      });
    } catch (error) {
      console.error('Erreur lors du logging:', error);
    }
  }

  /**
   * Obtenir l'IP du client (simulation)
   */
  private async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Vérifier si l'email est celui de l'admin
   */
  private isAdminEmail(email: string): boolean {
    return email === this.ADMIN_EMAIL;
  }

  /**
   * Obtenir les permissions par défaut selon le rôle
   */
  getDefaultPermissions(role: string): string[] {
    switch (role) {
      case 'admin':
        return [
          'users:read',
          'users:write',
          'users:delete',
          'system:config',
          'logs:read',
          'analytics:read'
        ];
      case 'osteopath':
        return [
          'profile:read',
          'profile:write',
          'data:read',
          'data:write',
          'patients:read',
          'patients:write',
          'consultations:read',
          'consultations:write',
          'invoices:read',
          'invoices:write'
        ];
      case 'substitute':
        return [
          'profile:read',
          'profile:write',
          'data:read',
          'data:write',
          'substitute:access'
        ];
      case 'user':
        return [
          'profile:read',
          'profile:write',
          'data:read',
          'data:write'
        ];
      default:
        return [];
    }
  }

  /**
   * Traduire les codes d'erreur Firebase
   */
  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'Email ou mot de passe incorrect';
      case 'auth/user-not-found':
        return 'Aucun compte trouvé avec cet email';
      case 'auth/too-many-requests':
        return 'Trop de tentatives. Veuillez réessayer plus tard';
      case 'auth/network-request-failed':
        return 'Erreur de connexion réseau';
      case 'auth/user-disabled':
        return 'Ce compte a été désactivé';
      default:
        return 'Une erreur est survenue lors de la connexion';
    }
  }
}

export const authService = new AuthService();