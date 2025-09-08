import { useState, useCallback } from 'react';
import { 
  uploadDocument, 
  deleteDocument, 
  listDocuments,
  cleanupOldFiles,
  getStorageUsage,
  UploadResult,
  UploadProgress,
  DocumentMetadata,
  createFolderStructure
} from '../utils/documentStorage';
import { auth } from '../firebase/config';

interface UseDocumentStorageOptions {
  documentType: 'patient' | 'practice' | 'invoice' | 'appointment' | 'consultation';
  entityId?: string;
  autoCleanup?: boolean;
  maxAge?: number; // en millisecondes
}

export function useDocumentStorage(options: UseDocumentStorageOptions) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageUsage, setStorageUsage] = useState<{
    totalSize: number;
    fileCount: number;
    folderSizes: Record<string, number>;
  } | null>(null);

  // Obtenir le chemin du dossier
  const getFolderPath = useCallback(() => {
    if (!auth.currentUser) throw new Error('Utilisateur non authentifié');
    return createFolderStructure(auth.currentUser.uid, options.documentType, options.entityId);
  }, [options.documentType, options.entityId]);

  // Upload d'un document
  const upload = useCallback(async (
    file: File,
    fileName?: string
  ): Promise<UploadResult> => {
    setUploading(true);
    setError(null);
    
    try {
      const folderPath = getFolderPath();
      
      const result = await uploadDocument(
        file,
        folderPath,
        fileName,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      // Nettoyer automatiquement si activé
      if (options.autoCleanup) {
        try {
          await cleanupOldFiles(folderPath, options.maxAge);
        } catch (cleanupError) {
          console.warn('Cleanup failed:', cleanupError);
        }
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de l\'upload';
      setError(errorMessage);
      throw err;
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [getFolderPath, options.autoCleanup, options.maxAge]);

  // Supprimer un document
  const remove = useCallback(async (filePath: string): Promise<void> => {
    setError(null);
    
    try {
      await deleteDocument(filePath);
      
      // Mettre à jour la liste locale
      setDocuments(prev => prev.filter(doc => `${doc.folder}/${doc.name}` !== filePath));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la suppression';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Lister les documents
  const list = useCallback(async (): Promise<DocumentMetadata[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const folderPath = getFolderPath();
      const docs = await listDocuments(folderPath);
      setDocuments(docs);
      return docs;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du chargement';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [getFolderPath]);

  // Nettoyer les anciens fichiers
  const cleanup = useCallback(async (maxAge?: number): Promise<number> => {
    setError(null);
    
    try {
      const folderPath = getFolderPath();
      const deletedCount = await cleanupOldFiles(folderPath, maxAge || options.maxAge);
      
      // Recharger la liste après nettoyage
      await list();
      
      return deletedCount;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du nettoyage';
      setError(errorMessage);
      throw err;
    }
  }, [getFolderPath, options.maxAge, list]);

  // Obtenir l'utilisation du stockage
  const getUsage = useCallback(async () => {
    if (!auth.currentUser) return;
    
    setError(null);
    
    try {
      const usage = await getStorageUsage(auth.currentUser.uid);
      setStorageUsage(usage);
      return usage;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du calcul de l\'utilisation';
      setError(errorMessage);
      throw err;
    }
  }, []);

  // Réinitialiser l'erreur
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // État
    uploading,
    uploadProgress,
    documents,
    loading,
    error,
    storageUsage,
    
    // Actions
    upload,
    remove,
    list,
    cleanup,
    getUsage,
    clearError,
    
    // Utilitaires
    getFolderPath
  };
}

export default useDocumentStorage;