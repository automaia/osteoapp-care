import { ref, uploadBytes, getDownloadURL, getMetadata } from 'firebase/storage';
import { storage, auth } from '../firebase/config';

/**
 * Fonction de diagnostic pour Firebase Storage
 */
export async function diagnoseStorageIssues(): Promise<{
  isConfigured: boolean;
  isAuthenticated: boolean;
  canWrite: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  let isConfigured = false;
  let isAuthenticated = false;
  let canWrite = false;

  try {
    // 1. Vérifier la configuration de Storage
    if (!storage) {
      errors.push('Firebase Storage n\'est pas initialisé');
    } else {
      isConfigured = true;
      console.log('✅ Firebase Storage configuré:', storage.app.name);
    }

    // 2. Vérifier l'authentification
    if (!auth.currentUser) {
      errors.push('Utilisateur non authentifié');
    } else {
      isAuthenticated = true;
      console.log('✅ Utilisateur authentifié:', auth.currentUser.uid);
    }

    // 3. Test d'écriture simple
    if (isConfigured && isAuthenticated) {
      try {
        const testRef = ref(storage, `test/${auth.currentUser!.uid}/test.txt`);
        const testData = new Blob(['test'], { type: 'text/plain' });
        
        await uploadBytes(testRef, testData);
        const url = await getDownloadURL(testRef);
        
        canWrite = true;
        console.log('✅ Test d\'écriture réussi:', url);
      } catch (writeError: any) {
        errors.push(`Erreur d'écriture: ${writeError.code} - ${writeError.message}`);
        console.error('❌ Test d\'écriture échoué:', writeError);
      }
    }

  } catch (error: any) {
    errors.push(`Erreur générale: ${error.message}`);
    console.error('❌ Erreur de diagnostic:', error);
  }

  return {
    isConfigured,
    isAuthenticated,
    canWrite,
    errors
  };
}

/**
 * Test spécifique pour les documents patients
 */
export async function testPatientDocumentUpload(patientId: string): Promise<{
  success: boolean;
  url?: string;
  error?: string;
}> {
  if (!auth.currentUser) {
    return { success: false, error: 'Utilisateur non authentifié' };
  }

  try {
    const testFile = new Blob(['Test document patient'], { type: 'text/plain' });
    const fileName = `test_${Date.now()}.txt`;
    const filePath = `users/${auth.currentUser.uid}/patients/${patientId}/documents/${fileName}`;
    
    console.log('🔄 Test upload vers:', filePath);
    
    const fileRef = ref(storage, filePath);
    const snapshot = await uploadBytes(fileRef, testFile);
    const url = await getDownloadURL(snapshot.ref);
    
    console.log('✅ Upload test réussi:', url);
    
    return { success: true, url };
  } catch (error: any) {
    console.error('❌ Upload test échoué:', error);
    return { 
      success: false, 
      error: `${error.code}: ${error.message}` 
    };
  }
}

/**
 * Vérification des règles de sécurité
 */
export function checkStorageRules(): string[] {
  const issues: string[] = [];
  
  // Ces vérifications sont basées sur les règles dans storage.rules
  console.log('📋 Vérification des règles de sécurité Storage...');
  
  if (!auth.currentUser) {
    issues.push('Authentification requise pour accéder au Storage');
  }
  
  // Vérifier la structure des chemins
  const expectedPaths = [
    `users/${auth.currentUser?.uid}/patients/`,
    `users/${auth.currentUser?.uid}/practice/`,
    `users/${auth.currentUser?.uid}/invoices/`,
    `users/${auth.currentUser?.uid}/appointments/`
  ];
  
  console.log('📁 Chemins autorisés:', expectedPaths);
  
  // Vérifier les permissions spéciales
  if (auth.currentUser?.email === 'julie.boddaert@hotmail.fr') {
    console.log('✅ Utilisateur avec permissions étendues détecté');
  } else if (auth.currentUser) {
    // Vérifier si l'utilisateur a été créé par un admin
    console.log('🔍 Vérification si l\'utilisateur a été créé par un admin...');
  }
  
  return issues;
}

/**
 * Vérifie les permissions d'un utilisateur spécifique
 */
export async function checkUserPermissions(email: string): Promise<{
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  isAdmin: boolean;
}> {
  // Cette fonction est une simulation, car les règles de sécurité sont appliquées côté serveur
  // et ne peuvent pas être vérifiées directement depuis le client
  
  const isJulie = email === 'julie.boddaert@hotmail.fr';
  const isAdmin = email === 'grondin.stephane@gmail.com';
  
  return {
    canRead: true, // Tous les utilisateurs authentifiés peuvent lire leurs propres données
    canWrite: true, // Tous les utilisateurs authentifiés peuvent écrire leurs propres données
    canDelete: true, // Tous les utilisateurs authentifiés peuvent supprimer leurs propres données
    isAdmin: isAdmin || isJulie // Julie a des droits d'admin
  };
}

/**
 * Diagnostique les problèmes de chiffrement HDS
 */
export async function diagnoseHDSEncryption(userId: string, patientId: string): Promise<{
  encryptionEnabled: boolean;
  encryptionWorking: boolean;
  decryptionWorking: boolean;
  errors: string[];
  recommendations: string[];
}> {
  const errors: string[] = [];
  const recommendations: string[] = [];
  let encryptionEnabled = false;
  let encryptionWorking = false;
  let decryptionWorking = false;

  try {
    // Vérifier si le chiffrement HDS est activé
    const hdsConfig = await import('../firebase/config').then(module => module.hdsConfig);
    encryptionEnabled = hdsConfig.enabled;
    
    if (!encryptionEnabled) {
      recommendations.push('Activer le chiffrement HDS dans la configuration');
      return {
        encryptionEnabled,
        encryptionWorking: false,
        decryptionWorking: false,
        errors,
        recommendations
      };
    }
    
    // Test de chiffrement
    try {
      const testData = "Test de chiffrement HDS";
      const { encryptData, decryptData } = await import('../utils/encryption');
      
      const encrypted = encryptData(testData, userId);
      encryptionWorking = true;
      
      // Test de déchiffrement
      const decrypted = decryptData(encrypted, userId);
      decryptionWorking = decrypted === testData;
      
      if (!decryptionWorking) {
        errors.push('Le déchiffrement ne fonctionne pas correctement');
        recommendations.push('Vérifier la gestion des clés de chiffrement');
      }
    } catch (encryptionError: any) {
      errors.push(`Erreur de chiffrement: ${encryptionError.message}`);
      recommendations.push('Vérifier l\'implémentation du chiffrement');
    }
    
    // Vérifier les métadonnées HDS
    const { HDSCompliance } = await import('../utils/hdsCompliance');
    const patientData = await HDSCompliance.getCompliantData('patients', patientId).catch(() => null);
    
    if (!patientData) {
      errors.push('Impossible de récupérer les données du patient');
      recommendations.push('Vérifier les permissions d\'accès aux données');
    } else if (!HDSCompliance.isCompliant(patientData)) {
      errors.push('Les données du patient ne sont pas conformes HDS');
      recommendations.push('Migrer les données vers le format HDS');
    }
    
  } catch (error: any) {
    errors.push(`Erreur générale: ${error.message}`);
  }
  
  return {
    encryptionEnabled,
    encryptionWorking,
    decryptionWorking,
    errors,
    recommendations
  };
}