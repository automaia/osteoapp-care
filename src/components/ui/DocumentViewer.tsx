import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  Download, 
  Trash2, 
  FileText, 
  Image as ImageIcon,
  Calendar,
  User,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Button } from './Button';
import { 
  listDocuments, 
  deleteDocument, 
  getSecureDownloadURL,
  DocumentMetadata,
  formatFileSize,
  isImageFile,
  getFileIcon
} from '../../utils/documentStorage';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DocumentViewerProps {
  folderPath: string;
  onDocumentDelete?: (document: DocumentMetadata) => void;
  onError?: (error: string) => void;
  className?: string;
  showUploadedBy?: boolean;
  allowDelete?: boolean;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  folderPath,
  onDocumentDelete,
  onError,
  className = "",
  showUploadedBy = true,
  allowDelete = true
}) => {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<DocumentMetadata | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Charger les documents
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setLoading(true);
        setError(null);
        const docs = await listDocuments(folderPath);
        setDocuments(docs);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erreur lors du chargement des documents';
        setError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (folderPath) {
      loadDocuments();
    }
  }, [folderPath, onError]);

  // Supprimer un document
  const handleDelete = async (document: DocumentMetadata) => {
    try {
      setDeletingId(document.id);
      await deleteDocument(`${document.folder}/${document.name}`);
      
      // Mettre à jour la liste locale
      setDocuments(prev => prev.filter(doc => doc.id !== document.id));
      
      onDocumentDelete?.(document);
      setShowDeleteConfirm(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la suppression';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setDeletingId(null);
    }
  };

  // Télécharger un document
  const handleDownload = async (document: DocumentMetadata) => {
    try {
      const url = await getSecureDownloadURL(`${document.folder}/${document.name}`);
      
      // Créer un lien de téléchargement
      const link = document.createElement('a');
      link.href = url;
      link.download = document.originalName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du téléchargement';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };

  // Prévisualiser un document
  const handlePreview = async (document: DocumentMetadata) => {
    try {
      const url = await getSecureDownloadURL(`${document.folder}/${document.name}`);
      setPreviewDocument({ ...document, url });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors de la prévisualisation';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  };

  // Formater la date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: fr });
    } catch {
      return 'Date invalide';
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-8 ${className}`}>
        <div className="flex items-center space-x-2 text-gray-500">
          <Loader2 className="animate-spin" size={20} />
          <span>Chargement des documents...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}>
        <div className="flex items-center">
          <AlertCircle className="text-red-500 mr-2" size={20} />
          <span className="text-red-700">{error}</span>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <FileText size={48} className="mx-auto mb-4 text-gray-300" />
        <p>Aucun document trouvé</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Liste des documents */}
      <div className="grid gap-4">
        {documents.map((document) => (
          <div
            key={document.id}
            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              {/* Icône du fichier */}
              <div className="flex-shrink-0">
                {isImageFile(document.type) ? (
                  <ImageIcon size={24} className="text-blue-500" />
                ) : (
                  <FileText size={24} className="text-gray-500" />
                )}
              </div>

              {/* Informations du document */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-gray-900 truncate">
                  {document.originalName}
                </h4>
                <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                  <span>{formatFileSize(document.size)}</span>
                  <div className="flex items-center">
                    <Calendar size={12} className="mr-1" />
                    <span>{formatDate(document.uploadedAt)}</span>
                  </div>
                  {showUploadedBy && (
                    <div className="flex items-center">
                      <User size={12} className="mr-1" />
                      <span>Par {document.uploadedBy}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePreview(document)}
                leftIcon={<Eye size={14} />}
              >
                Voir
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload(document)}
                leftIcon={<Download size={14} />}
              >
                Télécharger
              </Button>

              {allowDelete && (
                showDeleteConfirm === document.id ? (
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(null)}
                      className="border-gray-200"
                    >
                      Annuler
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(document)}
                      isLoading={deletingId === document.id}
                      disabled={deletingId === document.id}
                      className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                    >
                      Confirmer
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(document.id)}
                    leftIcon={<Trash2 size={14} />}
                    className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                  >
                    Supprimer
                  </Button>
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de prévisualisation */}
      {previewDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                {previewDocument.originalName}
              </h3>
              <button
                onClick={() => setPreviewDocument(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 max-h-[calc(90vh-120px)] overflow-auto">
              {isImageFile(previewDocument.type) ? (
                <img
                  src={previewDocument.url}
                  alt={previewDocument.originalName}
                  className="max-w-full h-auto"
                />
              ) : (
                <div className="text-center py-8">
                  <FileText size={64} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 mb-4">
                    Prévisualisation non disponible pour ce type de fichier
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => handleDownload(previewDocument)}
                    leftIcon={<Download size={16} />}
                  >
                    Télécharger pour ouvrir
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;