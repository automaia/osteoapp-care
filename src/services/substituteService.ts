import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  Timestamp 
} from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase/config';
import { Substitute, SubstituteFormData } from '../types/substitute';
import { AuditLogger, AuditEventType, SensitivityLevel } from '../utils/auditLogger';
import { HDSCompliance } from '../utils/hdsCompliance';

/**
 * Service pour la gestion des remplaçants
 */
export class SubstituteService {
  /**
   * Crée un nouveau remplaçant
   */
  static async createSubstitute(substituteData: SubstituteFormData): Promise<string> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // 1. Vérifier que l'ostéopathe titulaire existe
      const osteopathRef = doc(db, 'users', substituteData.linkedTo);
      const osteopathDoc = await getDoc(osteopathRef);
      
      if (!osteopathDoc.exists()) {
        throw new Error('L\'ostéopathe titulaire sélectionné n\'existe pas');
      }
      
      const osteopathData = osteopathDoc.data();
      if (osteopathData.role !== 'osteopath') {
        throw new Error('L\'utilisateur sélectionné n\'est pas un ostéopathe');
      }

      // 2. Créer l'utilisateur dans Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        substituteData.email,
        substituteData.password
      );
      
      const userId = userCredential.user.uid;

      // 3. Créer le profil remplaçant dans Firestore
      const userData: Substitute = {
        uid: userId,
        email: substituteData.email,
        firstName: substituteData.firstName,
        lastName: substituteData.lastName,
        displayName: `${substituteData.firstName} ${substituteData.lastName}`,
        role: 'substitute',
        linkedTo: substituteData.linkedTo,
        isActive: substituteData.isActive,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: auth.currentUser.uid,
        permissions: [
          'profile:read',
          'profile:write',
          'data:read',
          'data:write',
          'substitute:access'
        ]
      };

      // Préparer les données avec conformité HDS
      const compliantData = HDSCompliance.prepareDataForStorage(
        userData,
        'users',
        auth.currentUser.uid
      );

      // Enregistrer dans Firestore
      await setDoc(doc(db, 'users', userId), compliantData);

      // 4. Journaliser l'action
      await AuditLogger.log(
        AuditEventType.ADMIN_ACTION,
        'substitutes',
        'create',
        SensitivityLevel.SENSITIVE,
        'success',
        {
          substituteId: userId,
          email: substituteData.email,
          linkedTo: substituteData.linkedTo,
          osteopathName: `${osteopathData.firstName} ${osteopathData.lastName}`
        }
      );

      return userId;

    } catch (error) {
      console.error('❌ Failed to create substitute:', error);

      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.ADMIN_ACTION,
        'substitutes',
        'create',
        SensitivityLevel.SENSITIVE,
        'failure',
        { 
          email: substituteData.email,
          error: (error as Error).message 
        }
      );

      throw error;
    }
  }

  /**
   * Récupère tous les remplaçants
   */
  static async getAllSubstitutes(): Promise<Substitute[]> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('role', '==', 'substitute'));
      const snapshot = await getDocs(q);

      const substitutes: Substitute[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // Déchiffrer les données si nécessaire
        const decryptedData = HDSCompliance.decryptDataForDisplay(
          data,
          'users',
          auth.currentUser.uid
        );

        substitutes.push({
          ...decryptedData,
          uid: docSnap.id
        } as Substitute);
      }

      // Journaliser l'accès
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        'substitutes',
        'list',
        SensitivityLevel.SENSITIVE,
        'success',
        { count: substitutes.length }
      );

      return substitutes;

    } catch (error) {
      console.error('❌ Failed to get substitutes:', error);

      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.DATA_ACCESS,
        'substitutes',
        'list',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );

      throw error;
    }
  }

  /**
   * Récupère les remplaçants d'un ostéopathe spécifique
   */
  static async getSubstitutesByOsteopath(osteopathId: string): Promise<Substitute[]> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef, 
        where('role', '==', 'substitute'),
        where('linkedTo', '==', osteopathId)
      );
      const snapshot = await getDocs(q);

      const substitutes: Substitute[] = [];

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // Déchiffrer les données si nécessaire
        const decryptedData = HDSCompliance.decryptDataForDisplay(
          data,
          'users',
          auth.currentUser.uid
        );

        substitutes.push({
          ...decryptedData,
          uid: docSnap.id
        } as Substitute);
      }

      return substitutes;

    } catch (error) {
      console.error('❌ Failed to get substitutes for osteopath:', error);
      throw error;
    }
  }

  /**
   * Met à jour un remplaçant
   */
  static async updateSubstitute(substituteId: string, updates: Partial<Substitute>): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // Vérifier que le remplaçant existe
      const substituteRef = doc(db, 'users', substituteId);
      const substituteDoc = await getDoc(substituteRef);

      if (!substituteDoc.exists()) {
        throw new Error('Remplaçant non trouvé');
      }

      const substituteData = substituteDoc.data();

      if (substituteData.role !== 'substitute') {
        throw new Error('L\'utilisateur n\'est pas un remplaçant');
      }

      // Préparer les mises à jour
      const updatesWithMetadata = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Mise à jour avec chiffrement HDS
      await HDSCompliance.updateCompliantData(
        'users',
        substituteId,
        updatesWithMetadata
      );

      // Journaliser l'action
      await AuditLogger.log(
        AuditEventType.ADMIN_ACTION,
        'substitutes',
        'update',
        SensitivityLevel.SENSITIVE,
        'success',
        { 
          substituteId,
          fields: Object.keys(updates)
        }
      );

    } catch (error) {
      console.error('❌ Failed to update substitute:', error);

      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.ADMIN_ACTION,
        'substitutes',
        'update',
        SensitivityLevel.SENSITIVE,
        'failure',
        { 
          substituteId,
          error: (error as Error).message 
        }
      );

      throw error;
    }
  }

  /**
   * Supprime un remplaçant
   */
  static async deleteSubstitute(substituteId: string): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      // Vérifier que le remplaçant existe
      const substituteRef = doc(db, 'users', substituteId);
      const substituteDoc = await getDoc(substituteRef);

      if (!substituteDoc.exists()) {
        throw new Error('Remplaçant non trouvé');
      }

      const substituteData = substituteDoc.data();

      if (substituteData.role !== 'substitute') {
        throw new Error('L\'utilisateur n\'est pas un remplaçant');
      }

      // Supprimer le document
      await deleteDoc(substituteRef);

      // Journaliser l'action
      await AuditLogger.log(
        AuditEventType.ADMIN_ACTION,
        'substitutes',
        'delete',
        SensitivityLevel.SENSITIVE,
        'success',
        { 
          substituteId,
          email: substituteData.email,
          linkedTo: substituteData.linkedTo
        }
      );

    } catch (error) {
      console.error('❌ Failed to delete substitute:', error);

      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.ADMIN_ACTION,
        'substitutes',
        'delete',
        SensitivityLevel.SENSITIVE,
        'failure',
        { 
          substituteId,
          error: (error as Error).message 
        }
      );

      throw error;
    }
  }

  /**
   * Vérifie si l'utilisateur actuel est un remplaçant
   */
  static async isCurrentUserSubstitute(): Promise<boolean> {
    if (!auth.currentUser) return false;

    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) return false;

      const userData = userDoc.data();
      return userData.role === 'substitute';

    } catch (error) {
      console.error('Error checking if user is substitute:', error);
      return false;
    }
  }

  /**
   * Récupère l'ostéopathe titulaire d'un remplaçant
   */
  static async getLinkedOsteopath(substituteId: string): Promise<any> {
    if (!auth.currentUser) {
      throw new Error('Utilisateur non authentifié');
    }

    try {
      const substituteRef = doc(db, 'users', substituteId);
      const substituteDoc = await getDoc(substituteRef);

      if (!substituteDoc.exists()) {
        throw new Error('Remplaçant non trouvé');
      }

      const substituteData = substituteDoc.data();

      if (substituteData.role !== 'substitute' || !substituteData.linkedTo) {
        throw new Error('Utilisateur invalide ou non lié à un ostéopathe');
      }

      // Récupérer l'ostéopathe titulaire
      const osteopathRef = doc(db, 'users', substituteData.linkedTo);
      const osteopathDoc = await getDoc(osteopathRef);

      if (!osteopathDoc.exists()) {
        throw new Error('Ostéopathe titulaire non trouvé');
      }

      const osteopathData = osteopathDoc.data();

      // Déchiffrer les données si nécessaire
      const decryptedData = HDSCompliance.decryptDataForDisplay(
        osteopathData,
        'users',
        auth.currentUser.uid
      );

      return {
        ...decryptedData,
        uid: osteopathDoc.id
      };

    } catch (error) {
      console.error('❌ Failed to get linked osteopath:', error);
      throw error;
    }
  }
}

export default SubstituteService;