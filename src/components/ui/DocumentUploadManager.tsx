import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image as ImageIcon, AlertCircle, CheckCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { 
  uploadDocument, 
  deleteDocument,
  formatFileSize,
  isImageFile,
  DocumentMetadata
} from '../../utils/documentStorage';
import { auth } from '../../firebase/config';

interface DocumentUploadManagerProps {
  onUploadSuccess: (documents: DocumentMetadata[]) => void;
  onUploadError: (error: string) => void;
  patientId: string;
  initialDocuments?: DocumentMetadata[];
  className?: string;
  disabled?: boolean;
}

export const DOCUMENT_CATEGORIES = [
  { value: 'prescription', label: 'Ordonnance' },
  { value: 'report', label: 'Compte-rendu' },
  { value: 'imaging', label: 'Imagerie' },
  { value: 'analysis', label: 'Analyse' },
  { value: 'certificate', label: 'Certificat' },
  { value: 'other', label: 'Autre' }
];

interface UploadingFile {
  file: File;
  progress: number;
  status: 'validating' | 'compressing' | 'uploading' | 'complete' | 'error';
  error?: string;
  category: string;
}

const DocumentUploadManager: React.FC<DocumentUploadManagerProps> = ({
  onUploadSuccess,
  onUploadError,
  patientId,
  initialDocuments = [],
  className = "",
  disabled = false
}) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [documents, setDocuments] = useState<DocumentMetadata[]>(initialDocuments);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedCategory, setSelectedCategory] = useState(DOCUMENT_CATEGORIES[0].value);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !auth.currentUser) return;
    
    const files = Array.from(event.target.files);
    
    // Ajouter les fichiers à la liste des uploads en cours
    const newUploadingFiles = files.map(file => ({
      file,
      progress: 0,
      status: 'validating' as const,
      category: selectedCategory
    }));
    
    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);
    
    // Traiter chaque fichier
    files.forEach((file, index) => {
      processFile(file, selectedCategory, newUploadingFiles.length - files.length + index);
    });
    
    // Réinitialiser l'input pour permettre de sélectionner à nouveau le même fichier
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedCategory, patientId]);

  const processFile = async (file: File, category: string, index: number) => {
    if (!auth.currentUser) return;
    
    try {
      // Créer le chemin du dossier
      const folderPath = `users/${auth.currentUser.uid}/patients/${patientId}/documents/${category}`;
      
      // Mettre à jour le statut
      updateFileStatus(index, 'uploading', 10);
      
      // Uploader le document
      const result = await uploadDocument(
        file,
        folderPath,
        undefined,
        (progress) => {
          updateFileStatus(index, progress.status, progress.progress);
          if (progress.status === 'error') {
            updateFileError(index, progress.error || 'Erreur lors du téléversement');
          }
        }
      );
      
      // Ajouter les métadonnées de catégorie
      const documentWithCategory: DocumentMetadata = {
        ...result,
        id: result.fileName,
        name: result.fileName,
        originalName: file.name,
        url: result.url,
        type: file.type,
        size: result.fileSize,
        uploadedAt: new Date().toISOString(),
        uploadedBy: auth.currentUser.uid,
        folder: folderPath,
        category
      };
      
      // Mettre à jour la liste des documents
      setDocuments(prev => [...prev, documentWithCategory]);
      
      // Notifier le parent
      onUploadSuccess([...documents, documentWithCategory]);
      
      // Marquer comme terminé
      updateFileStatus(index, 'complete', 100);
      
      // Supprimer de la liste des uploads après 3 secondes
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter((_, i) => i !== index));
      }, 3000);
      
    } catch (error) {
      console.error('Upload error:', error);
      updateFileError(index, error instanceof Error ? error.message : 'Erreur inconnue');
      onUploadError(error instanceof Error ? error.message : 'Erreur inconnue');
    }
  };

  const updateFileStatus = (index: number, status: UploadingFile['status'], progress: number) => {
    setUploadingFiles(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, status, progress } : item
      )
    );
  };

  const updateFileError = (index: number, error: string) => {
    setUploadingFiles(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, status: 'error', error } : item
      )
    );
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
    
    if (disabled || !event.dataTransfer.files.length) return;
    
    const files = Array.from(event.dataTransfer.files);
    
    // Ajouter les fichiers à la liste des uploads en cours
    const newUploadingFiles = files.map(file => ({
      file,
      progress: 0,
      status: 'validating' as const,
      category: selectedCategory
    }));
    
    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);
    
    // Traiter chaque fichier
    files.forEach((file, index) => {
      processFile(file, selectedCategory, newUploadingFiles.length - files.length + index);
    });
  };

  const handleDeleteDocument = async (document: DocumentMetadata) => {
    if (!auth.currentUser) return;
    
    setIsDeleting(document.id);
    try {
      await deleteDocument(`${document.folder}/${document.name}`);
      
      // Mettre à jour la liste des documents
      const updatedDocuments = documents.filter(doc => doc.id !== document.id);
      setDocuments(updatedDocuments);
      
      // Notifier le parent
      onUploadSuccess(updatedDocuments);
      
    } catch (error) {
      console.error('Delete error:', error);
      onUploadError(error instanceof Error ? error.message : 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(null);
      setShowDeleteConfirm(null);
    }
  };

  const getStatusIcon = (status: UploadingFile['status']) => {
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

  const getStatusText = (file: UploadingFile) => {
    switch (file.status) {
      case 'validating':
        return 'Validation...';
      case 'compressing':
        return 'Compression...';
      case 'uploading':
        return `Upload... ${Math.round(file.progress)}%`;
      case 'complete':
        return 'Terminé';
      case 'error':
        return file.error || 'Erreur';
      default:
        return '';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Sélection de catégorie et zone de drop */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Catégorie du document
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input w-full"
            disabled={disabled}
          >
            {DOCUMENT_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="w-full md:w-2/3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Téléverser un document
          </label>
          <div
            className={`relative border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
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
              onChange={handleFileSelect}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              multiple
              disabled={disabled}
            />

            <div className="space-y-2">
              <Upload className={`mx-auto h-8 w-8 ${disabled ? 'text-gray-300' : 'text-gray-400'}`} />
              <p className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>
                {dragOver ? 'Déposez vos fichiers ici' : 'Cliquez ou glissez vos fichiers ici'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                PDF, DOC, DOCX, JPG, PNG jusqu'à 10MB
              </p>
            </div>
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
                      {getStatusIcon(item.status)}
                      <span className="text-xs text-gray-500">
                        {getStatusText(item)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Barre de progression */}
                  {(item.status === 'uploading' || item.status === 'compressing') && (
                    <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                      <div
                        className="bg-primary-500 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Liste des documents déjà téléversés */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">Documents téléversés</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    {isImageFile(document.type) ? (
                      <ImageIcon size={20} className="text-blue-500" />
                    ) : (
                      <FileText size={20} className="text-gray-500" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {document.originalName || document.name}
                    </p>
                    <div className="flex items-center space-x-2">
                      <p className="text-xs text-gray-500">
                        {formatFileSize(document.size)}
                      </p>
                      <span className="text-xs text-gray-400">•</span>
                      <p className="text-xs text-gray-500">
                        {DOCUMENT_CATEGORIES.find(c => c.value === document.category)?.label || 'Document'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <a
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-700"
                    title="Voir le document"
                  >
                    <Button variant="ghost" size="sm">
                      Voir
                    </Button>
                  </a>
                  
                  {showDeleteConfirm === document.id ? (
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(null)}
                      >
                        Annuler
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteDocument(document)}
                        isLoading={isDeleting === document.id}
                        className="text-red-600 hover:text-red-700"
                      >
                        Confirmer
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(document.id)}
                      className="text-red-600 hover:text-red-700"
                      disabled={isDeleting !== null}
                    >
                      Supprimer
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Informations d'aide */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• Types acceptés: PDF, DOC, DOCX, JPG, PNG</p>
        <p>• Taille maximum: 10MB par fichier</p>
        <p>• Les images sont automatiquement compressées si nécessaire</p>
      </div>
    </div>
  );
};

export default DocumentUploadManager;