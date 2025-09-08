import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Database, ArrowRight, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { DataMigrationService } from '../../services/dataMigrationService';
import MigrationProgressBar from './MigrationProgressBar';
import { trackEvent } from '../../lib/clarityClient';
import { trackEvent as trackMatomoEvent } from '../../lib/matomoTagManager';
import { trackEvent as trackGAEvent } from '../../lib/googleAnalytics';

interface DataMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (stats: any) => void;
}

const DataMigrationModal: React.FC<DataMigrationModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [migrationStats, setMigrationStats] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<string>('report');
  
  const [steps, setSteps] = useState([
    { id: 'report', label: 'Analyse', status: 'pending' as const },
    { id: 'patients', label: 'Patients', status: 'pending' as const },
    { id: 'appointments', label: 'Rendez-vous', status: 'pending' as const },
    { id: 'consultations', label: 'Consultations', status: 'pending' as const },
    { id: 'invoices', label: 'Factures', status: 'pending' as const },
    { id: 'verify', label: 'Vérification', status: 'pending' as const }
  ]);
  
  // Générer le rapport initial
  useEffect(() => {
    if (isOpen) {
      generateReport();
    }
  }, [isOpen]);
  
  const generateReport = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setCurrentStep('report');
      
      // Mettre à jour le statut de l'étape
      updateStepStatus('report', 'in-progress');
      
      // Générer le rapport
      const report = await DataMigrationService.generateMigrationReport();
      
      // Mettre à jour le statut de l'étape
      updateStepStatus('report', 'completed');
      
      // Track report generation
      trackEvent("migration_report_generated", { 
        test_data_count: report.testPatients + report.testAppointments + 
                         report.testConsultations + report.testInvoices
      });
      
      trackMatomoEvent('Data Migration', 'Report Generated');
      trackGAEvent('migration_report_generated');
      
    } catch (error) {
      console.error('Error generating migration report:', error);
      setError('Erreur lors de la génération du rapport de migration');
      updateStepStatus('report', 'error', (error as Error).message);
      
      // Track error
      trackEvent("migration_report_error", { error: (error as Error).message });
      trackMatomoEvent('Error', 'Migration Report', (error as Error).message);
      trackGAEvent('migration_report_error', { error_message: (error as Error).message });
      
    } finally {
      setIsLoading(false);
    }
  };
  
  const startMigration = async () => {
    if (confirmText !== 'MIGRER') {
      setError('Veuillez saisir "MIGRER" pour confirmer');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Track migration start
      trackEvent("data_migration_start");
      trackMatomoEvent('Data Migration', 'Migration Started');
      trackGAEvent('data_migration_start');
      
      // 1. Migration des patients
      setCurrentStep('patients');
      updateStepStatus('patients', 'in-progress');
      
      // Simuler la migration des patients
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      updateStepStatus('patients', 'completed');
      
      // 2. Migration des rendez-vous
      setCurrentStep('appointments');
      updateStepStatus('appointments', 'in-progress');
      
      // Simuler la migration des rendez-vous
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      updateStepStatus('appointments', 'completed');
      
      // 3. Migration des consultations
      setCurrentStep('consultations');
      updateStepStatus('consultations', 'in-progress');
      
      // Simuler la migration des consultations
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      updateStepStatus('consultations', 'completed');
      
      // 4. Migration des factures
      setCurrentStep('invoices');
      updateStepStatus('invoices', 'in-progress');
      
      // Simuler la migration des factures
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      updateStepStatus('invoices', 'completed');
      
      // 5. Vérification finale
      setCurrentStep('verify');
      updateStepStatus('verify', 'in-progress');
      
      // Simuler la vérification
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Effectuer la migration réelle
      const results = await DataMigrationService.migrateTestData();
      setMigrationStats(results);
      
      updateStepStatus('verify', 'completed');
      
      // Track migration success
      trackEvent("data_migration_complete", results);
      trackMatomoEvent('Data Migration', 'Migration Completed');
      trackGAEvent('data_migration_complete', results);
      
      // Notifier le parent
      onSuccess(results);
      
    } catch (error) {
      console.error('Error migrating data:', error);
      setError('Erreur lors de la migration des données: ' + (error as Error).message);
      
      // Mettre à jour le statut de l'étape en cours
      updateStepStatus(currentStep, 'error', (error as Error).message);
      
      // Track migration error
      trackEvent("data_migration_error", { error: (error as Error).message });
      trackMatomoEvent('Error', 'Data Migration', (error as Error).message);
      trackGAEvent('data_migration_error', { error_message: (error as Error).message });
      
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateStepStatus = (stepId: string, status: 'pending' | 'in-progress' | 'completed' | 'error', errorMessage?: string) => {
    setSteps(prevSteps => 
      prevSteps.map(step => 
        step.id === stepId 
          ? { ...step, status, error: errorMessage } 
          : step
      )
    );
  };
  
  const handleClose = () => {
    // Réinitialiser l'état
    setConfirmText('');
    setError(null);
    setMigrationStats(null);
    setSteps(steps.map(step => ({ ...step, status: 'pending' })));
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
            className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center text-primary-600">
                <Database size={20} className="mr-2" />
                <h2 className="text-xl font-semibold">Migration des données</h2>
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
              <div className="mb-6">
                <MigrationProgressBar steps={steps} currentStep={currentStep} />
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-error/5 border border-error/20 rounded-lg text-error text-sm">
                  {error}
                </div>
              )}
              
              {currentStep === 'report' && !migrationStats && (
                <>
                  <div className="bg-primary-50 border border-primary-100 rounded-lg p-4 mb-4">
                    <h3 className="font-medium text-primary-800 flex items-center">
                      <ArrowRight size={16} className="mr-2" />
                      Migration des données de test
                    </h3>
                    <p className="mt-2 text-sm text-primary-700">
                      Cette opération va convertir toutes vos données de test en données réelles de production.
                      Les données seront conservées mais leur statut sera modifié.
                    </p>
                    <ul className="list-disc list-inside mt-2 text-sm text-primary-700 space-y-1">
                      <li>Tous les patients marqués comme "test" deviendront des patients réels</li>
                      <li>Tous les rendez-vous de test seront convertis en rendez-vous réels</li>
                      <li>Toutes les consultations et factures de test seront converties en données réelles</li>
                      <li>Les relations entre les données seront préservées</li>
                    </ul>
                  </div>
                  
                  <div className="mb-4">
                    <label htmlFor="confirmText" className="block text-sm font-medium text-gray-700 mb-1">
                      Pour confirmer, saisissez "MIGRER" en majuscules
                    </label>
                    <input
                      type="text"
                      id="confirmText"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="MIGRER"
                    />
                  </div>
                </>
              )}
              
              {migrationStats && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-4">
                  <div className="flex items-start">
                    <CheckCircle size={20} className="text-green-600 mt-0.5 mr-3" />
                    <div>
                      <h3 className="font-medium text-green-800">Migration terminée avec succès</h3>
                      <p className="text-sm text-green-700 mt-1">
                        Toutes les données de test ont été converties en données réelles.
                      </p>
                      
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div className="bg-white rounded p-2 text-center">
                          <div className="text-lg font-bold text-primary-600">{migrationStats.patientsUpdated}</div>
                          <div className="text-xs text-gray-600">Patients migrés</div>
                        </div>
                        <div className="bg-white rounded p-2 text-center">
                          <div className="text-lg font-bold text-primary-600">{migrationStats.appointmentsUpdated}</div>
                          <div className="text-xs text-gray-600">Rendez-vous migrés</div>
                        </div>
                        <div className="bg-white rounded p-2 text-center">
                          <div className="text-lg font-bold text-primary-600">{migrationStats.consultationsUpdated}</div>
                          <div className="text-xs text-gray-600">Consultations migrées</div>
                        </div>
                        <div className="bg-white rounded p-2 text-center">
                          <div className="text-lg font-bold text-primary-600">{migrationStats.invoicesUpdated}</div>
                          <div className="text-xs text-gray-600">Factures migrées</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              {!migrationStats ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={isLoading}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="primary"
                    onClick={startMigration}
                    isLoading={isLoading}
                    loadingText="Migration en cours..."
                    disabled={isLoading || confirmText !== 'MIGRER'}
                    leftIcon={isLoading ? <RefreshCw size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  >
                    Démarrer la migration
                  </Button>
                </>
              ) : (
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

export default DataMigrationModal;