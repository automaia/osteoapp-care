import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Substitute } from '../../types/substitute';
import { SubstituteService } from '../../services/substituteService';

interface DeleteSubstituteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  substitute: Substitute;
  osteopathName: string;
}

const DeleteSubstituteModal: React.FC<DeleteSubstituteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  substitute,
  osteopathName
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      await SubstituteService.deleteSubstitute(substitute.uid);
      onSuccess();
    } catch (error: any) {
      console.error('Error deleting substitute:', error);
      setError(error.message || 'Erreur lors de la suppression du remplaçant');
    } finally {
      setIsDeleting(false);
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
            className="relative w-full max-w-md bg-white rounded-xl shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center text-error">
                <AlertTriangle size={20} className="mr-2" />
                <h2 className="text-xl font-semibold">Supprimer le remplaçant</h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 transition-colors"
                disabled={isDeleting}
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4">
              {error && (
                <div className="mb-4 p-3 bg-error/5 border border-error/20 rounded-lg text-error text-sm">
                  {error}
                </div>
              )}

              <div className="mb-4">
                <p className="text-gray-700 mb-3">
                  Êtes-vous sûr de vouloir supprimer définitivement ce remplaçant ?
                </p>
                
                <div className="bg-gray-50 rounded-lg p-4 mb-3">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      {substitute.firstName} {substitute.lastName}
                    </div>
                    <div className="text-gray-600">{substitute.email}</div>
                    <div className="text-gray-600 mt-1">
                      Remplaçant de : <span className="font-medium">{osteopathName}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start">
                    <AlertTriangle size={16} className="text-yellow-600 mt-0.5 mr-2" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium">Attention :</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Le compte utilisateur sera définitivement supprimé</li>
                        <li>Le remplaçant ne pourra plus se connecter</li>
                        <li>Cette action est irréversible</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isDeleting}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                isLoading={isDeleting}
                loadingText="Suppression..."
                leftIcon={<Trash2 size={16} />}
              >
                Supprimer définitivement
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DeleteSubstituteModal;