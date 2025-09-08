import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../ui/Button';

interface DeleteConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  consultationInfo: {
    patientName: string;
    date: string;
    time: string;
  };
}

const DeleteConsultationModal: React.FC<DeleteConsultationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  consultationInfo,
}) => {
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
                <h2 className="text-xl font-semibold">Supprimer la consultation</h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 transition-colors"
                disabled={isLoading}
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-gray-700 mb-3">
                Êtes-vous sûr de vouloir supprimer définitivement cette consultation ?
              </p>
              
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <div className="text-sm">
                  <div className="font-medium text-gray-900">{consultationInfo.patientName}</div>
                  <div className="text-gray-600">
                    {consultationInfo.date} à {consultationInfo.time}
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-500">
                Cette action est irréversible et supprimera toutes les données associées à cette consultation.
              </p>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Annuler
              </Button>
              <Button
                variant="danger"
                onClick={onConfirm}
                isLoading={isLoading}
                loadingText="Suppression..."
              >
                Supprimer
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DeleteConsultationModal;