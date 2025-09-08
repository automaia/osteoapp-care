import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, AlertTriangle, CheckCircle, RefreshCw, Clock } from 'lucide-react';
import { Button } from './Button';
import { DashboardService } from '../../services/dashboardService';
import { auth } from '../../firebase/config';
import { trackEvent } from '../../lib/clarityClient';
import { trackEvent as trackMatomoEvent } from '../../lib/matomoTagManager';
import { trackEvent as trackGAEvent } from '../../lib/googleAnalytics';

interface DataCleanupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (stats: any) => void;
}

const DataCleanupModal: React.FC<DataCleanupModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [step, setStep] = useState(1);
  
  const handleCleanup = async () => {
    if (confirmText !== 'SUPPRIMER') {
      setError('Veuillez saisir "SUPPRIMER" pour confirmer');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Track cleanup start
      trackEvent("data_cleanup_start");
      trackMatomoEvent('Data', 'Cleanup Start', 'Test Data');
      trackGAEvent('data_cleanup_start');
      
      // Récupérer l'ID utilisateur depuis l'auth
      const userId = auth.currentUser?.uid;
      if (!userId) {
        throw new Error('Utilisateur non authentifié');
      }
      
      const result = await DashboardService.cleanTestData(userId);
      
      // Passer à l'étape de succès
      setStep(2);
      
      // Track cleanup success
      trackEvent("data_cleanup_complete", { 
        items_removed: result.patientsRemoved + result.appointmentsRemoved + 
                      result.invoicesRemoved + result.consultationsRemoved
      });
      
      trackMatomoEvent('Data', 'Cleanup Complete', 'Test Data', 
        result.patientsRemoved + result.appointmentsRemoved + 
        result.invoicesRemoved + result.consultationsRemoved);
      
      trackGAEvent('data_cleanup_complete', {
        patients_removed: result.patientsRemoved,
        appointments_removed: result.appointmentsRemoved,
        invoices_removed: result.invoicesRemoved,
        consultations_removed: result.consultationsRemoved,
        total_items_removed: result.patientsRemoved + result.appointmentsRemoved + 
                            result.invoicesRemoved + result.consultationsRemoved
      });
      
      // Notifier le parent
      onSuccess(result);
      
    } catch (error) {
      console.error('Error cleaning test data:', error);
      setError('Erreur lors du nettoyage des données de test: ' + (error as Error).message);
      
      // Track cleanup error
      trackEvent("data_cleanup_error", { error: (error as Error).message });
      trackMatomoEvent('Error', 'Data Cleanup', (error as Error).message);
      trackGAEvent('data_cleanup_error', { error_message: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleClose = () => {
    // Réinitialiser l'état
    setConfirmText('');
    setError(null);
    setStep(1);
    onClose();
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
              <div className="flex items-center text-error">
                <Trash2 size={20} className="mr-2" />
                <h2 className="text-xl font-semibold">Nettoyage des données</h2>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-500 transition-colors"
                disabled={isLoading}
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4">
              {step === 1 && (
                <>
                  <div className="flex items-start mb-4">
                    <div className="flex-shrink-0 mt-0.5">
                      <AlertTriangle size={20} className="text-warning" />
                    </div>
                    <div className="ml-3">
                      <h3 className="text-lg font-medium text-gray-900">Attention</h3>
                      <p className="mt-2 text-sm text-gray-600">
                        Cette action va supprimer définitivement toutes les données de test de votre compte.
                        Seules les vraies données saisies dans le cadre de votre activité professionnelle seront conservées.
                      </p>
                      <p className="mt-2 text-sm text-gray-600">
                        <strong>Cette action est irréversible.</strong>
                      </p>
                    </div>
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
                </>
              )}
              
              {step === 2 && (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-green-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Nettoyage terminé</h3>
                  <p className="text-sm text-gray-600">
                    Toutes les données de test ont été supprimées avec succès.
                    Votre tableau de bord affiche maintenant uniquement vos données réelles.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              {step === 1 && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={isLoading}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="danger"
                    onClick={handleCleanup}
                    isLoading={isLoading}
                    loadingText="Nettoyage en cours..."
                    disabled={isLoading || confirmText !== 'SUPPRIMER'}
                    leftIcon={isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  >
                    Nettoyer les données
                  </Button>
                </>
              )}
              
              {step === 2 && (
                <Button
                  variant="primary"
                  onClick={handleClose}
                >
                  Fermer
                </Button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DataCleanupModal;