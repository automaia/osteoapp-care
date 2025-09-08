import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage, auth } from '../firebase/config';
import imageCompression from 'browser-image-compression';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = {
  'application/pdf': true,
  'image/jpeg': true,
  'image/png': true,
  'image/gif': true,
  'image/webp': true,
  'application/msword': true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
  'text/plain': true,
};

const ALLOWED_IMAGE_TYPES = {
  'image/jpeg': true,
  'image/png': true,
  'image/gif': true,
  'image/webp': true,
};

// HDS compliance configuration
const hdsConfig = {
  enabled: true,
  complianceVersion: '1.0',
};

export interface UploadResult {
  url: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export interface UploadProgress {
  progress: number;
  status: 'compressing' | 'uploading' | 'complete' | 'error';
  error?: string;
}

function createHDSMetadata(sensitivity: 'HIGHLY_SENSITIVE' | 'SENSITIVE' | 'NORMAL' = 'HIGHLY_SENSITIVE') {
  return {
    customMetadata: {
      hdsCompliance: JSON.stringify({
        version: hdsConfig.complianceVersion,
        sensitivity,
        encryptionStatus: hdsConfig.enabled ? 'ENCRYPTED' : 'NONE',
        uploadedAt: new Date().toISOString(),
        userId: auth.currentUser?.uid || 'unknown'
      })
    }
  };
}

export async function validateFile(file: File): Promise<void> {
  if (!ALLOWED_FILE_TYPES[file.type as keyof typeof ALLOWED_FILE_TYPES]) {
    throw new Error('Format de fichier non supporté (PDF, JPG, PNG, GIF, WEBP, DOC, DOCX ou TXT uniquement)');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Fichier trop volumineux (max 10MB)');
  }
}

export async function validateImageFile(file: File): Promise<void> {
  if (!ALLOWED_IMAGE_TYPES[file.type as keyof typeof ALLOWED_IMAGE_TYPES]) {
    throw new Error('Format d\'image non supporté (JPG, PNG, GIF ou WEBP uniquement)');
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Fichier trop volumineux (max 10MB)');
  }
}

export async function compressImageIfNeeded(file: File): Promise<File> {
  // Only compress if image is larger than 1MB
  if (!file.type.startsWith('image/') || file.size <= 1024 * 1024) {
    return file;
  }

  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 2048,
    useWebWorker: true,
    fileType: file.type,
    alwaysKeepResolution: true,
  };

  try {
    return await imageCompression(file, options);
  } catch (error) {
    console.error('Error compressing image:', error);
    return file;
  }
}

export async function uploadProfileImage(
  file: File,
  patientId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  if (!auth.currentUser) {
    throw new Error('Utilisateur non authentifié');
  }

  try {
    onProgress?.({ progress: 0, status: 'compressing' });
    
    await validateImageFile(file);
    const processedFile = await compressImageIfNeeded(file);
    
    onProgress?.({ progress: 30, status: 'uploading' });

    const extension = file.name.split('.').pop() || 'jpg';
    const fileName = `profile.${extension}`;
    const filePath = `users/${auth.currentUser.uid}/patients/${patientId}/profile/${fileName}`;
    const fileRef = ref(storage, filePath);

    // Create metadata with HDS compliance information
    const metadata = createHDSMetadata('HIGHLY_SENSITIVE');

    // Upload file
    onProgress?.({ progress: 50, status: 'uploading' });
    const snapshot = await uploadBytes(fileRef, processedFile, metadata);
    
    onProgress?.({ progress: 80, status: 'uploading' });
    const url = await getDownloadURL(snapshot.ref);

    onProgress?.({ progress: 100, status: 'complete' });

    return {
      url,
      fileName: file.name,
      fileType: file.type,
      fileSize: processedFile.size,
    };
  } catch (error) {
    console.error('Error uploading profile image:', error);
    onProgress?.({ 
      progress: 0, 
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur lors du téléversement de l\'image de profil'
    });
    throw error;
  }
}

export async function uploadPatientFile(
  file: File, 
  patientId: string,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  if (!auth.currentUser) {
    throw new Error('Utilisateur non authentifié');
  }

  try {
    onProgress?.({ progress: 0, status: 'compressing' });
    
    await validateFile(file);
    const processedFile = await compressImageIfNeeded(file);
    
    onProgress?.({ progress: 30, status: 'uploading' });

    const fileName = `document_${Date.now()}_${file.name}`;
    const filePath = `users/${auth.currentUser.uid}/patients/${patientId}/documents/${fileName}`;
    const fileRef = ref(storage, filePath);

    // Create metadata with HDS compliance information
    const metadata = createHDSMetadata('SENSITIVE');

    // Upload file
    onProgress?.({ progress: 50, status: 'uploading' });
    const snapshot = await uploadBytes(fileRef, processedFile, metadata);
    
    onProgress?.({ progress: 80, status: 'uploading' });
    const url = await getDownloadURL(snapshot.ref);

    onProgress?.({ progress: 100, status: 'complete' });

    return {
      url,
      fileName: file.name,
      fileType: file.type,
      fileSize: processedFile.size,
    };
  } catch (error) {
    console.error('Error uploading file:', error);
    onProgress?.({ 
      progress: 0, 
      status: 'error',
      error: error instanceof Error ? error.message : 'Erreur lors du téléversement du fichier'
    });
    throw error;
  }
}

export async function deletePatientFile(fileUrl: string): Promise<void> {
  if (!auth.currentUser) {
    throw new Error('Utilisateur non authentifié');
  }

  try {
    const fileRef = ref(storage, fileUrl);
    await deleteObject(fileRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error('Erreur lors de la suppression du fichier');
  }
}