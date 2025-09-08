import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Trash2, CheckCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { PatientService } from '../../services/patientService';

interface DeletePatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  patientName: string;
  patientId: string;
}

const DeletePatientModal: React.FC<DeletePatientModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  patientName,
  patientId,
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [deleteStats, setDeleteStats] = useState<any>(null);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'processing' | 'complete'>('confirm');
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (confirmText !== 'SUPPRIMER') {
      setError('Veuillez saisir "SUPPRIMER" pour confirmer');
      return;
    }

    setError(null);
    setDeleteStep('processing');

    try {
      // Utiliser le service pour supprimer le patient et toutes ses données associées
      const result = await PatientService.deletePatient(patientId);
      
      // Afficher les statistiques de suppression
      setDeleteStats(result);
      setDeleteStep('complete');
      
      // Attendre 2 secondes avant de fermer le modal et notifier le parent
      setTimeout(() => {
        onConfirm();
      }, 2000);
      
    } catch (error: any) {
      // Si le patient n'est pas trouvé, traiter cela comme un succès
      // car le résultat final est le même (le patient n'existe plus)
      if (error.message === 'Patient non trouvé') {
        setDeleteStats({
          appointments: 0,
          consultations: 0,
          invoices: 0,
          documents: 0
        });
        setDeleteStep('complete');
        
        // Attendre 2 secondes avant de fermer le modal et notifier le parent
        setTimeout(() => {
          onConfirm();
        }, 2000);
      } else {
        setError(error.message || 'Une erreur est survenue lors de la suppression');
        setDeleteStep('confirm');
      }
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
            onClick={deleteStep === 'processing' ? undefined : onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-md bg-white rounded-xl shadow-2xl"
          >
            {deleteStep === 'confirm' && (
              <>
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center text-error">
                    <AlertTriangle size={20} className="mr-2" />
                    <h2 className="text-xl font-semibold">Supprimer le patient</h2>
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
                  <div className="bg-error/5 border border-error/20 rounded-lg p-4 mb-4">
                    <h3 className="font-medium text-error flex items-center">
                      <AlertTriangle size={16} className="mr-2" />
                      Attention : Suppression définitive
                    </h3>
                    <p className="mt-2 text-sm text-gray-700">
                      Vous êtes sur le point de supprimer définitivement le dossier de{' '}
                      <span className="font-medium">{patientName}</span> ainsi que toutes les données associées :
                    </p>
                    <ul className="list-disc list-inside mt-2 text-sm text-gray-700 space-y-1">
                      <li>Dossier patient complet</li>
                      <li>Tous les rendez-vous passés et futurs</li>
                      <li>Toutes les consultations et leur historique</li>
                      <li>Toutes les factures liées au patient</li>
                      <li>Tous les documents et fichiers associés</li>
                    </ul>
                    <p className="mt-2 text-sm font-medium text-error">
                      Cette action est irréversible et ne peut pas être annulée.
                    </p>
                  </div>

                  {error && (
                    <div className="mb-4 p-3 bg-error/5 border border-error/20 rounded-lg text-error text-sm">
                      {error}
                    </div>
                  )}

                  <div className="mb-4">
                    <label htmlFor="confirmText" className="block text-sm font-medium text-gray-700 mb-1">
                      Pour confirmer, saisissez "SUPPRIMER" en majuscules
                    </label>
                    <input
                      type="text"
                      id="confirmText"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="SUPPRIMER"
                    />
                  </div>
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
                    onClick={handleDelete}
                    isLoading={isLoading}
                    loadingText="Suppression..."
                    disabled={confirmText !== 'SUPPRIMER' || isLoading}
                    leftIcon={<Trash2 size={16} />}
                  >
                    Supprimer définitivement
                  </Button>
                </div>
              </>
            )}

            {deleteStep === 'processing' && (
              <div className="p-6">
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Suppression en cours</h3>
                  <p className="text-gray-600">
                    Suppression du patient et de toutes les données associées...
                  </p>
                </div>
              </div>
            )}

            {deleteStep === 'complete' && deleteStats && (
              <div className="p-6">
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Suppression terminée</h3>
                  <p className="text-gray-600 mb-4">
                    Le patient et toutes ses données associées ont été supprimés avec succès.
                  </p>
                  
                  <div className="bg-gray-50 rounded-lg p-4 text-left">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Récapitulatif :</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Dossier patient : supprimé</li>
                      <li>• {deleteStats.appointments} rendez-vous supprimés</li>
                      <li>• {deleteStats.consultations} consultations supprimées</li>
                      <li>• {deleteStats.invoices} factures supprimées</li>
                      <li>• {deleteStats.documents} documents supprimés</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DeletePatientModal;