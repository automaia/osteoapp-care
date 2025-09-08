import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FolderOpen, HardDrive, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import DocumentUpload from '../ui/DocumentUpload';
import DocumentViewer from '../ui/DocumentViewer';
import { useDocumentStorage } from '../../hooks/useDocumentStorage';
import { formatFileSize } from '../../utils/documentStorage';

interface DocumentManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'patient' | 'practice' | 'invoice' | 'appointment';
  entityId?: string;
  title?: string;
}

const DocumentManagerModal: React.FC<DocumentManagerModalProps> = ({
  isOpen,
  onClose,
  documentType,
  entityId,
  title
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'view' | 'manage'>('view');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const {
    uploading,
    uploadProgress,
    documents,
    loading,
    error,
    storageUsage,
    upload,
    remove,
    list,
    cleanup,
    getUsage,
    clearError
  } = useDocumentStorage({
    documentType,
    entityId,
    autoCleanup: true,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 jours
  });

  // Charger les documents et l'utilisation du stockage à l'ouverture
  useEffect(() => {
    if (isOpen) {
      list();
      getUsage();
    }
  }, [isOpen, list, getUsage]);

  // Gérer le succès d'upload
  const handleUploadSuccess = async (result: any) => {
    setSuccessMessage(`Document "${result.fileName}" téléversé avec succès`);
    await list(); // Recharger la liste
    await getUsage(); // Mettre à jour l'utilisation
    
    // Masquer le message après 3 secondes
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Gérer les erreurs d'upload
  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
  };

  // Gérer la suppression de document
  const handleDocumentDelete = async () => {
    await list(); // Recharger la liste
    await getUsage(); // Mettre à jour l'utilisation
  };

  // Nettoyer les anciens fichiers
  const handleCleanup = async () => {
    try {
      const deletedCount = await cleanup();
      setSuccessMessage(`${deletedCount} ancien(s) fichier(s) supprimé(s)`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Cleanup error:', err);
    }
  };

  const getTitle = () => {
    if (title) return title;
    
    switch (documentType) {
      case 'patient':
        return 'Documents du patient';
      case 'practice':
        return 'Documents du cabinet';
      case 'invoice':
        return 'Documents de facturation';
      case 'appointment':
        return 'Documents du rendez-vous';
      default:
        return 'Gestionnaire de documents';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-[calc(100%-2rem)] md:w-[900px] max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">{getTitle()}</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab('view')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'view'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <FolderOpen size={16} className="inline mr-2" />
                Voir ({documents.length})
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'upload'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Upload size={16} className="inline mr-2" />
                Téléverser
              </button>
              <button
                onClick={() => setActiveTab('manage')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'manage'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <HardDrive size={16} className="inline mr-2" />
                Gestion
              </button>
            </div>

            {/* Messages */}
            {successMessage && (
              <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="text-red-500 mr-2" size={16} />
                  <span className="text-red-700 text-sm">{error}</span>
                  <button
                    onClick={clearError}
                    className="ml-auto text-red-500 hover:text-red-700"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'view' && (
                <DocumentViewer
                  folderPath={`users/${entityId || 'general'}`}
                  onDocumentDelete={handleDocumentDelete}
                  onError={handleUploadError}
                />
              )}

              {activeTab === 'upload' && (
                <DocumentUpload
                  documentType={documentType}
                  entityId={entityId}
                  onUploadSuccess={handleUploadSuccess}
                  onUploadError={handleUploadError}
                  maxFiles={5}
                />
              )}

              {activeTab === 'manage' && (
                <div className="space-y-6">
                  {/* Utilisation du stockage */}
                  {storageUsage && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Utilisation du stockage
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary-600">
                            {formatFileSize(storageUsage.totalSize)}
                          </div>
                          <div className="text-sm text-gray-500">Espace utilisé</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {storageUsage.fileCount}
                          </div>
                          <div className="text-sm text-gray-500">Fichiers</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">
                            {Object.keys(storageUsage.folderSizes).length}
                          </div>
                          <div className="text-sm text-gray-500">Dossiers</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions de gestion */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Actions de maintenance
                    </h3>
                    
                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          Nettoyer les anciens fichiers
                        </h4>
                        <p className="text-sm text-gray-500">
                          Supprime automatiquement les fichiers de plus de 30 jours
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleCleanup}
                        disabled={loading}
                      >
                        Nettoyer
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          Actualiser les données
                        </h4>
                        <p className="text-sm text-gray-500">
                          Recharge la liste des documents et l'utilisation du stockage
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          list();
                          getUsage();
                        }}
                        disabled={loading}
                      >
                        Actualiser
                      </Button>
                    </div>
                  </div>

                  {/* Détails par dossier */}
                  {storageUsage && Object.keys(storageUsage.folderSizes).length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">
                        Utilisation par dossier
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(storageUsage.folderSizes).map(([folder, size]) => (
                          <div key={folder} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-700">{folder}</span>
                            <span className="text-sm font-medium text-gray-900">
                              {formatFileSize(size)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <Button variant="outline" onClick={onClose}>
                Fermer
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DocumentManagerModal;