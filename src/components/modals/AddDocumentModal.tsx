import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileText, Image as ImageIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { uploadPatientFile, UploadProgress } from '../../utils/fileUpload';

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (documentUrl: string) => void;
  patientId: string;
}

const AddDocumentModal: React.FC<AddDocumentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  patientId,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    progress: 0,
    status: 'uploading'
  });

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset states
    setError(null);
    setUploadProgress({ progress: 0, status: 'uploading' });
    setPreview(null);

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile || !patientId) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await uploadPatientFile(
        selectedFile, 
        patientId,
        (progress) => {
          setUploadProgress(progress);
          if (progress.status === 'error') {
            setError(progress.error || 'Erreur lors du téléversement');
          }
        }
      );
      
      onSuccess(result.url);
      onClose();
    } catch (error: any) {
      console.error('Upload error:', error);
      setError(error.message || 'Une erreur est survenue lors du téléversement du fichier');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = useCallback(() => {
    if (!isUploading) {
      setSelectedFile(null);
      setPreview(null);
      setError(null);
      setUploadProgress({ progress: 0, status: 'uploading' });
      onClose();
    }
  }, [isUploading, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-md bg-white rounded-xl shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Ajouter un document</h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-500 transition-colors"
                disabled={isUploading}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-error/5 border border-error/20 rounded-lg text-error text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center ${
                    selectedFile ? 'bg-primary-50 border-primary-200' : 'border-gray-300 hover:border-primary-500'
                  }`}
                >
                  {selectedFile ? (
                    <div className="space-y-2">
                      {preview ? (
                        <img
                          src={preview}
                          alt="Aperçu"
                          className="max-h-48 mx-auto rounded-lg"
                        />
                      ) : (
                        <div className="flex items-center justify-center">
                          <FileText size={32} className="text-primary-500" />
                        </div>
                      )}
                      <div className="text-sm font-medium text-gray-900">{selectedFile.name}</div>
                      <div className="text-xs text-gray-500">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setPreview(null);
                        }}
                        className="text-sm text-primary-600 hover:text-primary-700"
                        disabled={isUploading}
                      >
                        Changer de fichier
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center">
                        <Upload size={32} className="text-gray-400" />
                      </div>
                      <div className="text-sm text-gray-500">
                        Cliquez ou glissez un fichier ici
                      </div>
                      <div className="text-xs text-gray-400">
                        PDF, JPG ou PNG jusqu'à 10MB
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleFileSelect}
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={isUploading}
                  />
                </div>

                {isUploading && (
                  <div className="space-y-2">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 transition-all duration-300"
                        style={{ width: `${uploadProgress.progress}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-500 text-center">
                      {uploadProgress.status === 'compressing' && 'Compression en cours...'}
                      {uploadProgress.status === 'uploading' && `Téléversement en cours... ${Math.round(uploadProgress.progress)}%`}
                      {uploadProgress.status === 'complete' && 'Téléversement terminé'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isUploading}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                onClick={handleUpload}
                isLoading={isUploading}
                loadingText="Téléversement..."
                disabled={!selectedFile || isUploading}
              >
                Téléverser
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddDocumentModal;