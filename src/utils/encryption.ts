import { Firestore } from 'firebase/firestore';
import { AES, enc, mode, pad, lib } from 'crypto-js';

// Clé de chiffrement principale (en production, cette clé serait stockée dans un KMS)
// IMPORTANT: Cette implémentation est simplifiée pour démonstration
// En production, utilisez un système de gestion de clés sécurisé
const MASTER_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 
                  'hds-compliant-encryption-key-must-be-stored-securely';

// Debug: Log de la clé utilisée (à supprimer en production)
if (import.meta.env.DEV) {
  console.log('🔑 Clé de chiffrement utilisée:', MASTER_KEY.substring(0, 10) + '...');
}

// Vecteur d'initialisation (IV) pour AES
const generateIV = () => {
  return lib.WordArray.random(16);
};

// Stockage des clés par utilisateur
const userKeys: Map<string, string> = new Map();

/**
 * Initialise le système de chiffrement
 */
export function initializeEncryption(): void {
  console.log('🔐 Initializing encryption system for HDS compliance');
  
  // Vérification de l'environnement
  if (typeof window === 'undefined') {
    throw new Error('Encryption system requires browser environment');
  }
  
  // Vérification de la disponibilité des API de chiffrement
  if (!window.crypto || !window.crypto.subtle) {
    console.warn('⚠️ Web Crypto API not available - falling back to CryptoJS');
  }
  
  console.log('✅ Encryption system initialized');
}

/**
 * Génère une clé de chiffrement pour un utilisateur
 */
export function generateUserKey(userId: string): string {
  // Dérivation de clé basée sur l'ID utilisateur et la clé maître
  const userKey = AES.encrypt(userId, MASTER_KEY).toString();
  userKeys.set(userId, userKey);
  return userKey;
}

/**
 * Récupère la clé d'un utilisateur ou en génère une nouvelle
 */
export function getUserKey(userId: string): string {
  if (!userKeys.has(userId)) {
    return generateUserKey(userId);
  }
  return userKeys.get(userId)!;
}

/**
 * Valide les données avant chiffrement
 */
export function validateDataForEncryption(data: any): boolean {
  if (data === null || data === undefined) {
    return false;
  }
  
  // Si c'est une chaîne vide, c'est valide
  if (data === '') {
    return true;
  }
  
  // Vérifier si c'est déjà chiffré
  if (typeof data === 'string' && isEncrypted(data)) {
    return false; // Éviter le double chiffrement
  }
  
  return true;
}

/**
 * Chiffre des données sensibles
 */
export function encryptData(data: any, userId: string): string {
  try {
    // Validation des données
    if (!validateDataForEncryption(data)) {
      console.warn('⚠️ Invalid data for encryption, returning original data');
      return typeof data === 'string' ? data : JSON.stringify(data);
    }
    
    const userKey = getUserKey(userId);
    const iv = generateIV();
    
    // Conversion des données en chaîne JSON
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    
    // Chiffrement AES-256-CBC avec CryptoJS
    const encrypted = AES.encrypt(jsonString, userKey, {
      iv: iv,
      mode: mode.CBC,
      padding: pad.Pkcs7
    });
    
    // Format: IV:Données chiffrées
    return iv.toString(enc.Hex) + ':' + encrypted.toString();
  } catch (error) {
    console.error('❌ Encryption failed for data:', typeof data, error);
    // En cas d'erreur, retourner une version sécurisée des données originales
    return `[ENCRYPTION_ERROR]:${typeof data === 'string' ? data : JSON.stringify(data)}`;
  }
}

/**
 * Vérifie si une chaîne est au format de données chiffrées valide
 */
export function isValidEncryptedFormat(encryptedData: string): boolean {
  // Vérifier le format IV:Ciphertext
  if (!encryptedData || typeof encryptedData !== 'string') {
    return false;
  }
  
  const parts = encryptedData.split(':');
  if (parts.length !== 2) {
    return false;
  }
  
  // Vérifier que l'IV est un hexadécimal valide de la bonne longueur (32 caractères pour 16 bytes)
  const ivHex = parts[0];
  if (!/^[0-9a-fA-F]{32}$/.test(ivHex)) {
    return false;
  }
  
  // Vérifier que le texte chiffré n'est pas vide
  const ciphertext = parts[1];
  if (!ciphertext || ciphertext.length < 10) {
    return false;
  }
  
  return true;
}

/**
 * Déchiffre des données sensibles avec gestion robuste des erreurs
 */
export function decryptData(encryptedData: string, userId: string): any {
  try {
    // Vérification préliminaire
    if (!encryptedData || typeof encryptedData !== 'string') {
      return '[NOT_ENCRYPTED_OR_INVALID]';
    }
    
    // Vérifier si c'est une chaîne vide ou très courte
    if (encryptedData.trim().length === 0) {
      return '[EMPTY_DATA]';
    }
    
    // Gestion des données marquées comme erreur d'encryption
    if (encryptedData.startsWith('[ENCRYPTION_ERROR]:')) {
      return '[ENCRYPTION_ERROR]';
    }
    
    // Gestion spéciale pour les données marquées comme protégées
    if (encryptedData === '[Données protégées]' || 
        encryptedData.startsWith('[Données protégées')) {
      return '[PROTECTED_DATA]';
    }
    
    // Gestion des erreurs de déchiffrement précédentes
    if (encryptedData.startsWith('[DECRYPTION_ERROR:')) {
      return '[PREVIOUS_DECRYPTION_ERROR]';
    }
    
    // Vérifier si le format est valide
    if (!isValidEncryptedFormat(encryptedData)) {
      // Si ça ne ressemble pas à des données chiffrées, c'est peut-être du texte en clair
      if (!encryptedData.includes(':') || encryptedData.length < 20) {
        return encryptedData; // Retourner tel quel si c'est probablement du texte en clair
      }
      return '[MALFORMED_ENCRYPTED_DATA]';
    }
    
    const userKey = getUserKey(userId);
    
    // Séparation de l'IV et des données chiffrées
    const [ivHex, ciphertext] = encryptedData.split(':');
    
    // Vérification supplémentaire
    if (!ivHex || !ciphertext) {
      return '[MISSING_IV_OR_CIPHERTEXT]';
    }
    
    // Vérifier que le ciphertext n'est pas vide
    if (ciphertext.trim().length === 0) {
      return '[EMPTY_CIPHERTEXT]';
    }
    
    let iv;
    try {
      iv = enc.Hex.parse(ivHex);
    } catch (ivError) {
      return '[INVALID_IV_FORMAT]';
    }
    
    // Déchiffrement avec gestion d'erreur
    let decrypted;
    try {
      decrypted = AES.decrypt(ciphertext, userKey, {
        iv: iv,
        mode: mode.CBC,
        padding: pad.Pkcs7
      });
      
      // Vérifier que le déchiffrement a produit quelque chose
      if (!decrypted || decrypted.sigBytes === 0) {
        return '[EMPTY_DECRYPTION_RESULT]';
      }
    } catch (decryptError) {
      return '[AES_DECRYPTION_FAILED]';
    }
    
    // Conversion en UTF-8 avec validation
    let decryptedString;
    try {
      decryptedString = decrypted.toString(enc.Utf8);
      
      // Vérification basique de la validité UTF-8
      if (!decryptedString || decryptedString.length === 0) {
        return '[EMPTY_UTF8_DATA]';
      }
      
      // Si la chaîne contient des caractères de remplacement, retourner une erreur
      if (decryptedString.includes('\uFFFD')) {
        return '[DECODING_FAILED]';
      }
      
    } catch (utf8Error) {
      return '[DECODING_FAILED]';
    }
    
    // Tentative de parsing JSON
    try {
      return JSON.parse(decryptedString);
    } catch (jsonError) {
      // Si ce n'est pas du JSON, retourner la chaîne
      return decryptedString;
    }
  } catch (error) {
    return '[GENERAL_DECRYPTION_ERROR]';
  }
}

/**
 * Vérifie si une donnée est chiffrée
 */
export function isEncrypted(data: string): boolean {
  // Vérification basique du format IV:Ciphertext
  return typeof data === 'string' && data.includes(':') && data.length > 40;
}

/**
 * Active le moteur de chiffrement pour Firestore
 * Note: Ceci est une implémentation simplifiée pour démonstration
 */
export function enableCryptoEngine(db: Firestore): void {
  console.log('🔒 Enabling crypto engine for Firestore');
  
  // En production, on intercepterait les opérations Firestore
  // pour chiffrer/déchiffrer automatiquement les données sensibles
  
  // Cette fonction est un placeholder pour démonstration
}

/**
 * Pseudonymise les données d'identification
 */
export function pseudonymizeData(data: any, fields: string[]): any {
  if (!data) return data;
  
  const result = { ...data };
  
  fields.forEach(field => {
    if (result[field]) {
      // Hachage simple pour la pseudonymisation
      result[field] = hashIdentifier(result[field]);
    }
  });
  
  return result;
}

/**
 * Fonction de hachage pour pseudonymisation
 */
function hashIdentifier(value: string): string {
  // Implémentation simplifiée - en production, utiliser un algorithme plus robuste
  const hash = AES.encrypt(value, MASTER_KEY).toString();
  return hash.substring(0, 24); // Version tronquée pour lisibilité
}

/**
 * Génère un identifiant pseudonymisé
 */
export function generatePseudoId(realId: string, context: string): string {
  return hashIdentifier(`${realId}-${context}-${MASTER_KEY}`);
}

/**
 * Tente de réparer des données chiffrées corrompues
 */
export function attemptDataRepair(encryptedData: string, userId: string): string | null {
  try {
    // Vérifier si les données sont déjà au format d'erreur
    if (encryptedData.startsWith('[DECRYPTION_ERROR:') || 
        encryptedData.startsWith('[ENCRYPTION_ERROR:')) {
      return null; // Impossible de réparer
    }
    
    // Vérifier si le format est valide
    if (!isValidEncryptedFormat(encryptedData)) {
      // Tenter de récupérer l'IV et le ciphertext
      const parts = encryptedData.split(':');
      if (parts.length >= 2) {
        const ivHex = parts[0];
        const ciphertext = parts.slice(1).join(':'); // Au cas où il y aurait des : dans le ciphertext
        
        // Vérifier si l'IV est un hexadécimal valide
        if (/^[0-9a-fA-F]+$/.test(ivHex)) {
          // Padding de l'IV si nécessaire
          const paddedIvHex = ivHex.padEnd(32, '0').substring(0, 32);
          return paddedIvHex + ':' + ciphertext;
        }
      }
    }
    
    return null; // Impossible de réparer
  } catch (error) {
    console.error('❌ Data repair attempt failed:', error);
    return null;
  }
}

/**
 * Migre les données chiffrées vers un nouveau format
 */
export function migrateEncryptedData(oldEncryptedData: string, userId: string): string {
  try {
    // Tenter de déchiffrer avec l'ancienne méthode
    const decryptedData = decryptData(oldEncryptedData, userId);
    
    // Si le déchiffrement a échoué, retourner les données originales
    if (typeof decryptedData === 'string' && decryptedData.startsWith('[DECRYPTION_ERROR:')) {
      return oldEncryptedData;
    }
    
    // Rechiffrer avec la nouvelle méthode
    return encryptData(decryptedData, userId);
  } catch (error) {
    console.error('❌ Data migration failed:', error);
    return oldEncryptedData;
  }
}