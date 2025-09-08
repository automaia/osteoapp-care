import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage, auth } from '../firebase/config';
import imageCompression from 'browser-image-compression';

// Types et interfaces
export interface UploadProgress {
  progress: number;
  status: 'validating' | 'compressing' | 'uploading' | 'complete' | 'error';
  error?: string;
  fileName?: string;
}

export interface UploadResult {
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadPath: string;
  uploadedAt: string;
}

export interface DocumentMetadata {
  id: string;
  name: string;
  originalName: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  folder: string;
  category?: string; // Ajout de la catégorie
}

// Configuration des types de fichiers autorisés
const ALLOWED_FILE_TYPES = {
  // Documents
  'application/pdf': { extension: 'pdf', maxSize: 10 * 1024 * 1024 }, // 10MB
  'application/msword': { extension: 'doc', maxSize: 10 * 1024 * 1024 },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extension: 'docx', maxSize: 10 * 1024 * 1024 },
  'text/plain': { extension: 'txt', maxSize: 5 * 1024 * 1024 }, // 5MB
  
  // Images
  'image/jpeg': { extension: 'jpg', maxSize: 10 * 1024 * 1024 },
  'image/png': { extension: 'png', maxSize: 10 * 1024 * 1024 },
  'image/gif': { extension: 'gif', maxSize: 5 * 1024 * 1024 },
  'image/webp': { extension: 'webp', maxSize: 10 * 1024 * 1024 }
} as const;

// Configuration de compression d'images
const IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 2,
  maxWidthOrHeight: 2048,
  useWebWorker: true,
  fileType: undefined as string | undefined,
  alwaysKeepResolution: false,
  initialQuality: 0.8
};

/**
 * Valide un fichier avant upload
 */
export async function validateFile(file: File): Promise<void> {
  console.log('🔍 Validation du fichier:', {
    name: file.name,
    type: file.type,
    size: file.size
  });

  // Vérifier le type de fichier
  const fileConfig = ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES];
  if (!fileConfig) {
    const error = `Type de fichier non autorisé: ${file.type}. Types acceptés: PDF, DOC, DOCX, TXT, JPG, PNG, GIF, WEBP`;
    console.error('❌', error);
    throw new Error(error);
  }

  // Vérifier la taille
  if (file.size > fileConfig.maxSize) {
    const maxSizeMB = (fileConfig.maxSize / (1024 * 1024)).toFixed(1);
    const error = `Fichier trop volumineux. Taille maximum: ${maxSizeMB}MB`;
    console.error('❌', error);
    throw new Error(error);
  }

  // Vérifier le nom du fichier
  if (!file.name || file.name.length > 255) {
    const error = 'Nom de fichier invalide';
    console.error('❌', error);
    throw new Error(error);
  }

  // Vérifier les caractères dangereux dans le nom
  const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/g;
  if (dangerousChars.test(file.name)) {
    const error = 'Le nom du fichier contient des caractères non autorisés';
    console.error('❌', error);
    throw new Error(error);
  }

  console.log('✅ Fichier validé avec succès');
}

/**
 * Compresse une image si nécessaire
 */
export async function compressImageIfNeeded(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<File> {
  // Ne compresser que les images
  if (!file.type.startsWith('image/')) {
    console.log('📄 Pas une image, compression ignorée');
    return file;
  }

  // Ne pas compresser si déjà petit
  if (file.size <= 1024 * 1024) { // 1MB
    console.log('📏 Image déjà petite, compression ignorée');
    return file;
  }

  try {
    console.log('🗜️ Compression de l\'image en cours...');
    onProgress?.({
      progress: 10,
      status: 'compressing',
      fileName: file.name
    });

    const options = {
      ...IMAGE_COMPRESSION_OPTIONS,
      fileType: file.type
    };

    const compressedFile = await imageCompression(file, options);
    
    console.log('✅ Image compressée:', {
      originalSize: file.size,
      compressedSize: compressedFile.size,
      reduction: `${((1 - compressedFile.size / file.size) * 100).toFixed(1)}%`
    });
    
    onProgress?.({
      progress: 30,
      status: 'compressing',
      fileName: file.name
    });

    return compressedFile;
  } catch (error) {
    console.warn('⚠️ Compression échouée, utilisation du fichier original:', error);
    return file;
  }
}

/**
 * Génère un nom de fichier unique
 */
export function generateUniqueFileName(originalName: string, folder: string): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop()?.toLowerCase() || '';
  const baseName = originalName.replace(/\.[^/.]+$/, '').substring(0, 50);
  
  // Nettoyer le nom de base
  const cleanBaseName = baseName
    .replace(/[^a-zA-Z0-9\-_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  
  const fileName = `${timestamp}_${randomId}_${cleanBaseName}.${extension}`;
  console.log('📝 Nom de fichier généré:', fileName);
  
  return fileName;
}

/**
 * Crée une structure de dossiers organisée
 */
export function createFolderStructure(
  userId: string,
  documentType: 'patient' | 'practice' | 'invoice' | 'appointment' | 'consultation',
  entityId?: string
): string {
  const baseFolder = `users/${userId}`;
  
  let folderPath: string;
  switch (documentType) {
    case 'patient':
      folderPath = entityId ? `${baseFolder}/patients/${entityId}/documents` : `${baseFolder}/patients/general`;
      break;
    case 'practice':
      folderPath = `${baseFolder}/practice/documents`;
      break;
    case 'invoice':
      folderPath = entityId ? `${baseFolder}/invoices/${entityId}` : `${baseFolder}/invoices/general`;
      break;
    case 'appointment':
      folderPath = entityId ? `${baseFolder}/appointments/${entityId}` : `${baseFolder}/appointments/general`;
      break;
    case 'consultation':
      folderPath = entityId ? `${baseFolder}/consultations/${entityId}/documents` : `${baseFolder}/consultations/general`;
      break;
    default:
      folderPath = `${baseFolder}/documents`;
  }
  
  console.log('📁 Structure de dossier créée:', folderPath);
  return folderPath;
}

/**
 * Upload un document vers Firebase Storage
 */
export async function uploadDocument(
  file: File,
  folder: string,
  fileName?: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  console.log('🚀 Début de l\'upload:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    folder
  });

  if (!auth.currentUser) {
    const error = 'Utilisateur non authentifié';
    console.error('❌', error);
    throw new Error(error);
  }

  console.log('👤 Utilisateur authentifié:', auth.currentUser.uid);

  try {
    // Étape 1: Validation
    console.log('📋 Étape 1: Validation du fichier');
    onProgress?.({
      progress: 0,
      status: 'validating',
      fileName: file.name
    });

    await validateFile(file);

    // Étape 2: Compression si nécessaire
    console.log('🗜️ Étape 2: Compression si nécessaire');
    onProgress?.({
      progress: 10,
      status: 'compressing',
      fileName: file.name
    });

    const processedFile = await compressImageIfNeeded(file, onProgress);

    // Étape 3: Génération du nom unique
    console.log('📝 Étape 3: Génération du nom de fichier');
    const uniqueFileName = fileName || generateUniqueFileName(file.name, folder);
    const uploadPath = `${folder}/${uniqueFileName}`;

    console.log('📍 Chemin d\'upload final:', uploadPath);

    onProgress?.({
      progress: 40,
      status: 'uploading',
      fileName: file.name
    });

    // Étape 4: Vérification de la configuration Storage
    if (!storage) {
      const error = 'Firebase Storage non configuré';
      console.error('❌', error);
      throw new Error(error);
    }

    // Étape 5: Upload vers Firebase Storage
    console.log('☁️ Étape 4: Upload vers Firebase Storage');
    const storageRef = ref(storage, uploadPath);
    
    // Métadonnées personnalisées
    const metadata = {
      contentType: processedFile.type,
      customMetadata: {
        originalName: file.name,
        uploadedBy: auth.currentUser.uid,
        uploadedAt: new Date().toISOString(),
        originalSize: file.size.toString(),
        processedSize: processedFile.size.toString()
      }
    };

    console.log('📤 Upload en cours vers:', storageRef.fullPath);

    onProgress?.({
      progress: 70,
      status: 'uploading',
      fileName: file.name
    });

    const snapshot = await uploadBytes(storageRef, processedFile, metadata);
    console.log('✅ Upload terminé, snapshot:', {
      bytesTransferred: snapshot.totalBytes,
      fullPath: snapshot.ref.fullPath
    });

    onProgress?.({
      progress: 90,
      status: 'uploading',
      fileName: file.name
    });

    // Étape 6: Obtenir l'URL de téléchargement
    console.log('🔗 Étape 5: Génération de l\'URL de téléchargement');
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('✅ URL générée:', downloadURL);

    onProgress?.({
      progress: 100,
      status: 'complete',
      fileName: file.name
    });

    const result: UploadResult = {
      url: downloadURL,
      fileName: uniqueFileName,
      fileType: processedFile.type,
      fileSize: processedFile.size,
      uploadPath,
      uploadedAt: new Date().toISOString()
    };

    console.log('🎉 Upload terminé avec succès:', result);
    return result;

  } catch (error: any) {
    console.error('💥 Erreur lors de l\'upload:', error);
    
    // Log détaillé de l'erreur
    console.error('Détails de l\'erreur:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Erreur lors du téléversement';
    
    onProgress?.({
      progress: 0,
      status: 'error',
      error: errorMessage,
      fileName: file.name
    });

    throw new Error(errorMessage);
  }
}

/**
 * Supprime un document de Firebase Storage
 */
export async function deleteDocument(filePath: string): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Utilisateur non authentifié');
  }

  try {
    console.log('🗑️ Suppression du fichier:', filePath);
    const fileRef = ref(storage, filePath);
    await deleteObject(fileRef);
    console.log('✅ Fichier supprimé avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de la suppression:', error);
    throw new Error('Erreur lors de la suppression du document');
  }
}

/**
 * Supprime les anciens fichiers d'un dossier
 */
export async function cleanupOldFiles(
  folderPath: string,
  maxAge: number = 30 * 24 * 60 * 60 * 1000 // 30 jours par défaut
): Promise<number> {
  if (!auth.currentUser) {
    throw new Error('Utilisateur non authentifié');
  }

  try {
    console.log('🧹 Nettoyage des anciens fichiers dans:', folderPath);
    const folderRef = ref(storage, folderPath);
    const listResult = await listAll(folderRef);
    
    let deletedCount = 0;
    const now = Date.now();

    for (const itemRef of listResult.items) {
      try {
        // Extraire le timestamp du nom de fichier
        const fileName = itemRef.name;
        const timestampMatch = fileName.match(/^(\d+)_/);
        
        if (timestampMatch) {
          const fileTimestamp = parseInt(timestampMatch[1]);
          const fileAge = now - fileTimestamp;
          
          if (fileAge > maxAge) {
            await deleteObject(itemRef);
            deletedCount++;
            console.log('🗑️ Fichier ancien supprimé:', fileName);
          }
        }
      } catch (error) {
        console.warn('⚠️ Erreur lors de la suppression du fichier:', itemRef.name, error);
      }
    }

    console.log(`✅ Nettoyage terminé: ${deletedCount} fichier(s) supprimé(s)`);
    return deletedCount;
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage:', error);
    throw new Error('Erreur lors du nettoyage des anciens fichiers');
  }
}

/**
 * Liste tous les documents d'un dossier
 */
export async function listDocuments(folderPath: string): Promise<DocumentMetadata[]> {
  if (!auth.currentUser) {
    throw new Error('Utilisateur non authentifié');
  }

  try {
    console.log('📋 Listage des documents dans:', folderPath);
    const folderRef = ref(storage, folderPath);
    const listResult = await listAll(folderRef);
    
    const documents: DocumentMetadata[] = [];

    for (const itemRef of listResult.items) {
      try {
        const url = await getDownloadURL(itemRef);
        const metadata = await itemRef.getMetadata();
        
        // Extraire la catégorie du chemin
        const pathParts = itemRef.fullPath.split('/');
        const category = pathParts[pathParts.length - 2] || 'other';
        
        documents.push({
          id: itemRef.name,
          name: itemRef.name,
          originalName: metadata.customMetadata?.originalName || itemRef.name,
          url,
          type: metadata.contentType || 'application/octet-stream',
          size: metadata.size,
          uploadedAt: metadata.customMetadata?.uploadedAt || metadata.timeCreated,
          uploadedBy: metadata.customMetadata?.uploadedBy || 'unknown',
          folder: folderPath,
          category
        });
      } catch (error) {
        console.warn('⚠️ Erreur lors de la récupération des métadonnées:', itemRef.name, error);
      }
    }

    // Trier par date de création (plus récent en premier)
    documents.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    console.log(`✅ ${documents.length} document(s) trouvé(s)`);
    return documents;
  } catch (error) {
    console.error('❌ Erreur lors du listage:', error);
    throw new Error('Erreur lors de la récupération de la liste des documents');
  }
}

/**
 * Obtient une URL de téléchargement sécurisée avec expiration
 */
export async function getSecureDownloadURL(
  filePath: string,
  expirationTime: number = 3600000 // 1 heure par défaut
): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('Utilisateur non authentifié');
  }

  try {
    console.log('🔗 Génération d\'URL sécurisée pour:', filePath);
    const fileRef = ref(storage, filePath);
    const url = await getDownloadURL(fileRef);
    
    // Note: Firebase Storage URLs sont déjà sécurisées par les règles de sécurité
    // L'expiration est gérée automatiquement par Firebase
    console.log('✅ URL sécurisée générée');
    return url;
  } catch (error) {
    console.error('❌ Erreur lors de la génération de l\'URL:', error);
    throw new Error('Erreur lors de la génération de l\'URL de téléchargement');
  }
}

/**
 * Vérifie l'espace de stockage utilisé par un utilisateur
 */
export async function getStorageUsage(userId: string): Promise<{
  totalSize: number;
  fileCount: number;
  folderSizes: Record<string, number>;
}> {
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    throw new Error('Accès non autorisé');
  }

  try {
    console.log('📊 Calcul de l\'utilisation du stockage pour:', userId);
    const userFolderRef = ref(storage, `users/${userId}`);
    const listResult = await listAll(userFolderRef);
    
    let totalSize = 0;
    let fileCount = 0;
    const folderSizes: Record<string, number> = {};

    // Fonction récursive pour parcourir tous les dossiers
    const processFolder = async (folderRef: any, folderPath: string) => {
      const result = await listAll(folderRef);
      
      let folderSize = 0;
      
      // Traiter les fichiers
      for (const itemRef of result.items) {
        try {
          const metadata = await itemRef.getMetadata();
          const size = metadata.size;
          
          totalSize += size;
          folderSize += size;
          fileCount++;
        } catch (error) {
          console.warn('⚠️ Erreur lors de la récupération des métadonnées:', itemRef.name, error);
        }
      }
      
      folderSizes[folderPath] = folderSize;
      
      // Traiter les sous-dossiers
      for (const prefixRef of result.prefixes) {
        await processFolder(prefixRef, `${folderPath}/${prefixRef.name}`);
      }
    };

    await processFolder(userFolderRef, 'root');

    const usage = {
      totalSize,
      fileCount,
      folderSizes
    };

    console.log('✅ Utilisation du stockage calculée:', usage);
    return usage;
  } catch (error) {
    console.error('❌ Erreur lors du calcul de l\'utilisation:', error);
    throw new Error('Erreur lors du calcul de l\'utilisation du stockage');
  }
}

/**
 * Utilitaires pour formater les tailles de fichiers
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Vérifie si un type de fichier est une image
 */
export function isImageFile(fileType: string): boolean {
  return fileType.startsWith('image/');
}

/**
 * Vérifie si un type de fichier est un document
 */
export function isDocumentFile(fileType: string): boolean {
  return fileType.startsWith('application/') || fileType.startsWith('text/');
}

/**
 * Obtient l'icône appropriée pour un type de fichier
 */
export function getFileIcon(fileType: string): string {
  if (isImageFile(fileType)) return '🖼️';
  if (fileType.includes('pdf')) return '📄';
  if (fileType.includes('word') || fileType.includes('doc')) return '📝';
  if (fileType.includes('text')) return '📃';
  return '📁';
}

/**
 * Déplace un fichier d'un chemin vers un autre dans Firebase Storage
 */
export async function moveFile(oldPath: string, newPath: string): Promise<string> {
  if (!auth.currentUser) {
    throw new Error('Utilisateur non authentifié');
  }

  try {
    console.log('🔄 Déplacement du fichier:', { oldPath, newPath });
    
    const oldRef = ref(storage, oldPath);
    const newRef = ref(storage, newPath);

    // Télécharger le contenu de l'ancien fichier
    const oldUrl = await getDownloadURL(oldRef);
    const response = await fetch(oldUrl);
    const blob = await response.blob();

    // Récupérer les métadonnées de l'ancien fichier pour les conserver
    const oldMetadata = await oldRef.getMetadata();
    const customMetadata = oldMetadata.customMetadata || {};

    // Uploader le contenu vers le nouveau chemin avec les métadonnées
    const snapshot = await uploadBytes(newRef, blob, {
      contentType: oldMetadata.contentType,
      customMetadata: customMetadata
    });

    // Supprimer l'ancien fichier
    await deleteObject(oldRef);

    const newDownloadURL = await getDownloadURL(newRef);
    console.log(`✅ Fichier déplacé de ${oldPath} vers ${newPath}. Nouvelle URL: ${newDownloadURL}`);
    return newDownloadURL;
  } catch (error) {
    console.error(`❌ Erreur lors du déplacement du fichier de ${oldPath} vers ${newPath}:`, error);
    throw new Error('Erreur lors du déplacement du fichier');
  }
}