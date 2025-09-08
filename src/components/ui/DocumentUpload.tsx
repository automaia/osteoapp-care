import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image as ImageIcon, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { 
  uploadDocument, 
  UploadProgress, 
  UploadResult,
  formatFileSize,
  getFileIcon,
  isImageFile,
  createFolderStructure
} from '../../utils/documentStorage';
import { auth } from '../../firebase/config';

interface DocumentUploadProps {
  onUploadSuccess: (result: UploadResult) => void;
  onUploadError: (error: string) => void;
  documentType: 'patient' | 'practice' | 'invoice' | 'appointment' | 'consultation';
  entityId?: string;
  accept?: string;
  maxFiles?: number;
  className?: string;
  disabled?: boolean;
}

interface UploadingFile {
  file: File;
  progress: UploadProgress;
  result?: UploadResult;
  error?: string;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onUploadSuccess,
  onUploadError,
  documentType,
  entityId,
  accept = "image/*,application/pdf,.doc,.docx,.txt",
  maxFiles = 5,
  className = "",
  disabled = false
}) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || !auth.currentUser) return;

    const fileArray = Array.from(files);
    
    // Vérifier le nombre maximum de fichiers
    if (fileArray.length > maxFiles) {
      onUploadError(`Vous ne pouvez téléverser que ${maxFiles} fichier(s) à la fois`);
      return;
    }

    // Créer la structure de dossier
    const folder = createFolderStructure(auth.currentUser.uid, documentType, entityId);

    // Initialiser les fichiers en cours d'upload
    const newUploadingFiles: UploadingFile[] = fileArray.map(file => ({
      file,
      progress: { progress: 0, status: 'validating' }
    }));

    setUploadingFiles(newUploadingFiles);

    // Uploader chaque fichier
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      
      try {
        const result = await uploadDocument(
          file,
          folder,
          undefined,
          (progress) => {
            setUploadingFiles(prev => 
              prev.map((item, index) => 
                index === i ? { ...item, progress } : item
              )
            );
          }
        );

        // Marquer comme terminé avec succès
        setUploadingFiles(prev => 
          prev.map((item, index) => 
            index === i ? { ...item, result, progress: { ...item.progress, status: 'complete' } } : item
          )
        );

        onUploadSuccess(result);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        
        // Marquer comme erreur
        setUploadingFiles(prev => 
          prev.map((item, index) => 
            index === i ? { 
              ...item, 
              error: errorMessage,
              progress: { ...item.progress, status: 'error', error: errorMessage }
            } : item
          )
        );

        onUploadError(`Erreur pour ${file.name}: ${errorMessage}`);
      }
    }

    // Nettoyer après 3 secondes
    setTimeout(() => {
      setUploadingFiles([]);
    }, 3000);

  }, [documentType, entityId, maxFiles, onUploadSuccess, onUploadError]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(event.target.files);
    // Reset input pour permettre de sélectionner le même fichier
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    handleFileSelect(event.dataTransfer.files);
  };

  const removeUploadingFile = (index: number) => {
    setUploadingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getStatusIcon = (status: UploadProgress['status']) => {
    switch (status) {
      case 'validating':
      case 'compressing':
      case 'uploading':
        return <Loader2 className="animate-spin" size={16} />;
      case 'complete':
        return <CheckCircle className="text-green-500" size={16} />;
      case 'error':
        return <AlertCircle className="text-red-500" size={16} />;
      default:
        return null;
    }
  };

  const getStatusText = (progress: UploadProgress) => {
    switch (progress.status) {
      case 'validating':
        return 'Validation...';
      case 'compressing':
        return 'Compression...';
      case 'uploading':
        return `Upload... ${Math.round(progress.progress)}%`;
      case 'complete':
        return 'Terminé';
      case 'error':
        return progress.error || 'Erreur';
      default:
        return '';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Zone de drop */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragOver
            ? 'border-primary-500 bg-primary-50'
            : disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : 'border-gray-300 hover:border-primary-500 hover:bg-gray-50 cursor-pointer'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleInputChange}
          accept={accept}
          multiple={maxFiles > 1}
          disabled={disabled}
        />

        <div className="space-y-2">
          <Upload className={`mx-auto h-12 w-12 ${disabled ? 'text-gray-300' : 'text-gray-400'}`} />
          <div>
            <p className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>
              {dragOver ? 'Déposez vos fichiers ici' : 'Cliquez ou glissez vos fichiers ici'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PDF, DOC, DOCX, TXT, JPG, PNG jusqu'à 10MB
              {maxFiles > 1 && ` (max ${maxFiles} fichiers)`}
            </p>
          </div>
        </div>
      </div>

      {/* Liste des fichiers en cours d'upload */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">Fichiers en cours de traitement</h4>
          {uploadingFiles.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3 flex-1">
                <div className="flex-shrink-0">
                  {isImageFile(item.file.type) ? (
                    <ImageIcon size={20} className="text-blue-500" />
                  ) : (
                    <FileText size={20} className="text-gray-500" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.file.name}
                  </p>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs text-gray-500">
                      {formatFileSize(item.file.size)}
                    </p>
                    <span className="text-xs text-gray-400">•</span>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(item.progress.status)}
                      <span className="text-xs text-gray-500">
                        {getStatusText(item.progress)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Barre de progression */}
                  {(item.progress.status === 'uploading' || item.progress.status === 'compressing') && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-primary-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${item.progress.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Bouton de suppression */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeUploadingFile(index);
                }}
                className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Informations d'aide */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• Types acceptés: PDF, DOC, DOCX, TXT, JPG, PNG, GIF, WEBP</p>
        <p>• Taille maximum: 10MB par fichier</p>
        <p>• Les images sont automatiquement compressées si nécessaire</p>
        {maxFiles > 1 && <p>• Maximum {maxFiles} fichiers simultanément</p>}
      </div>
    </div>
  );
};

export default DocumentUpload;