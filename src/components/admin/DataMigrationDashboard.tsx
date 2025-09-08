import React, { useState, useEffect } from 'react';
import { 
  Database, 
  RefreshCw, 
  CheckCircle, 
  AlertTriangle, 
  ArrowRight, 
  Download,
  Users,
  Calendar,
  FileText,
  ClipboardList,
  Trash2,
  Shield,
  Loader
} from 'lucide-react';
import { Button } from '../ui/Button';
import { DataMigrationService } from '../../services/dataMigrationService';
import { DashboardService } from '../../services/dashboardService';
import { trackEvent } from '../../lib/clarityClient';
import { trackEvent as trackMatomoEvent } from '../../lib/matomoTagManager';
import { trackEvent as trackGAEvent } from '../../lib/googleAnalytics';

const DataMigrationDashboard: React.FC = () => {
  const [migrationStats, setMigrationStats] = useState<any>(null);
  const [migrationReport, setMigrationReport] = useState<any>(null);
  const [integrityReport, setIntegrityReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [integrityLoading, setIntegrityLoading] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState<'report' | 'migrate' | 'verify' | 'repair' | 'complete'>('report');
  const [cleanupStats, setCleanupStats] = useState<any>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  // Charger le rapport initial
  useEffect(() => {
    loadMigrationReport();
  }, []);

  // Charger le rapport de migration
  const loadMigrationReport = async () => {
    try {
      setReportLoading(true);
      setError(null);
      
      const report = await DataMigrationService.generateMigrationReport();
      setMigrationReport(report);
      
      // Track report generation
      trackEvent("migration_report_generated", { 
        test_data_count: report.testPatients + report.testAppointments + 
                         report.testConsultations + report.testInvoices,
        real_data_count: report.realPatients + report.realAppointments + 
                         report.realConsultations + report.realInvoices
      });
      
      trackMatomoEvent('Data Migration', 'Report Generated');
      trackGAEvent('migration_report_generated');
      
    } catch (error) {
      console.error('Error generating migration report:', error);
      setError('Erreur lors de la génération du rapport de migration');
      
      // Track error
      trackEvent("migration_report_error", { error: (error as Error).message });
      trackMatomoEvent('Error', 'Migration Report', (error as Error).message);
      trackGAEvent('migration_report_error', { error_message: (error as Error).message });
      
    } finally {
      setReportLoading(false);
    }
  };

  // Vérifier l'intégrité des données
  const verifyDataIntegrity = async () => {
    try {
      setIntegrityLoading(true);
      setError(null);
      
      const integrity = await DataMigrationService.verifyDataIntegrity();
      setIntegrityReport(integrity);
      
      // Track integrity verification
      trackEvent("data_integrity_verified", integrity);
      trackMatomoEvent('Data Migration', 'Integrity Verified');
      trackGAEvent('data_integrity_verified', integrity);
      
      setStep('verify');
      
    } catch (error) {
      console.error('Error verifying data integrity:', error);
      setError('Erreur lors de la vérification de l\'intégrité des données');
      
      // Track error
      trackEvent("data_integrity_error", { error: (error as Error).message });
      trackMatomoEvent('Error', 'Data Integrity', (error as Error).message);
      trackGAEvent('data_integrity_error', { error_message: (error as Error).message });
      
    } finally {
      setIntegrityLoading(false);
    }
  };

  // Réparer les références brisées
  const repairBrokenReferences = async () => {
    try {
      setRepairLoading(true);
      setError(null);
      
      const repairResults = await DataMigrationService.repairBrokenReferences();
      
      // Track repair
      trackEvent("data_references_repaired", repairResults);
      trackMatomoEvent('Data Migration', 'References Repaired');
      trackGAEvent('data_references_repaired', repairResults);
      
      setSuccess(`Réparation terminée : ${repairResults.fixedAppointments + repairResults.fixedConsultations + repairResults.fixedInvoices} références réparées`);
      
      // Recharger le rapport d'intégrité
      await verifyDataIntegrity();
      
    } catch (error) {
      console.error('Error repairing broken references:', error);
      setError('Erreur lors de la réparation des références brisées');
      
      // Track error
      trackEvent("data_repair_error", { error: (error as Error).message });
      trackMatomoEvent('Error', 'Data Repair', (error as Error).message);
      trackGAEvent('data_repair_error', { error_message: (error as Error).message });
      
    } finally {
      setRepairLoading(false);
    }
  };

  // Migrer les données de test vers des données réelles
  const migrateTestData = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const results = await DataMigrationService.migrateTestData();
      setMigrationStats(results);
      
      setSuccess('Migration terminée avec succès');
      setStep('migrate');
      
      // Recharger le rapport
      await loadMigrationReport();
      
    } catch (error) {
      console.error('Error migrating test data:', error);
      setError('Erreur lors de la migration des données de test');
    } finally {
      setLoading(false);
    }
  };

  // Nettoyer les données de test
  const cleanupTestData = async () => {
    try {
      setCleanupLoading(true);
      setError(null);
      
      const results = await DashboardService.cleanTestData(auth.currentUser?.uid || '');
      setCleanupStats(results);
      
      setSuccess('Nettoyage terminé avec succès');
      setStep('complete');
      
      // Recharger le rapport
      await loadMigrationReport();
      
    } catch (error) {
      console.error('Error cleaning up test data:', error);
      setError('Erreur lors du nettoyage des données de test');
    } finally {
      setCleanupLoading(false);
    }
  };

  // Exporter le rapport de migration
  const exportMigrationReport = () => {
    if (!migrationReport) return;
    
    const reportData = {
      migrationReport,
      integrityReport,
      migrationStats,
      cleanupStats,
      timestamp: new Date().toISOString(),
      generatedBy: auth.currentUser?.email || 'unknown'
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration_report_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Track export
    trackEvent("migration_report_exported");
    trackMatomoEvent('Data Migration', 'Report Exported');
    trackGAEvent('migration_report_exported');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Database size={24} className="text-primary-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Migration des données</h2>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={loadMigrationReport}
            leftIcon={<RefreshCw size={16} className={reportLoading ? "animate-spin" : ""} />}
            disabled={reportLoading}
          >
            Actualiser
          </Button>
          <Button
            variant="outline"
            onClick={exportMigrationReport}
            leftIcon={<Download size={16} />}
            disabled={!migrationReport}
          >
            Exporter
          </Button>
        </div>
      </div>

      {/* Affichage des erreurs */}
      {error && (
        <div className="p-4 bg-error/5 border border-error/20 rounded-lg flex items-center">
          <AlertTriangle size={20} className="text-error mr-3" />
          <div>
            <h3 className="font-medium text-error">Erreur</h3>
            <p className="text-error/80">{error}</p>
          </div>
        </div>
      )}

      {/* Affichage des succès */}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle size={20} className="text-green-600 mr-3" />
          <div>
            <h3 className="font-medium text-green-800">Succès</h3>
            <p className="text-green-700">{success}</p>
          </div>
        </div>
      )}

      {/* Rapport de migration */}
      {reportLoading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Loader size={32} className="animate-spin mx-auto text-primary-500 mb-4" />
          <p className="text-gray-600">Génération du rapport de migration en cours...</p>
        </div>
      ) : migrationReport ? (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Rapport de migration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="space-y-4">
              <h4 className="font-medium text-gray-800 flex items-center">
                <Users size={16} className="mr-2 text-primary-500" />
                Patients
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Total</div>
                  <div className="text-xl font-bold">{migrationReport.totalPatients}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Données test</div>
                  <div className="text-xl font-bold text-amber-600">{migrationReport.testPatients}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Données réelles</div>
                  <div className="text-xl font-bold text-green-600">{migrationReport.realPatients}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Pourcentage réel</div>
                  <div className="text-xl font-bold">
                    {migrationReport.totalPatients > 0 
                      ? Math.round((migrationReport.realPatients / migrationReport.totalPatients) * 100)
                      : 0}%
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium text-gray-800 flex items-center">
                <Calendar size={16} className="mr-2 text-primary-500" />
                Rendez-vous
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Total</div>
                  <div className="text-xl font-bold">{migrationReport.totalAppointments}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Données test</div>
                  <div className="text-xl font-bold text-amber-600">{migrationReport.testAppointments}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Données réelles</div>
                  <div className="text-xl font-bold text-green-600">{migrationReport.realAppointments}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Pourcentage réel</div>
                  <div className="text-xl font-bold">
                    {migrationReport.totalAppointments > 0 
                      ? Math.round((migrationReport.realAppointments / migrationReport.totalAppointments) * 100)
                      : 0}%
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium text-gray-800 flex items-center">
                <ClipboardList size={16} className="mr-2 text-primary-500" />
                Consultations
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Total</div>
                  <div className="text-xl font-bold">{migrationReport.totalConsultations}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Données test</div>
                  <div className="text-xl font-bold text-amber-600">{migrationReport.testConsultations}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Données réelles</div>
                  <div className="text-xl font-bold text-green-600">{migrationReport.realConsultations}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Pourcentage réel</div>
                  <div className="text-xl font-bold">
                    {migrationReport.totalConsultations > 0 
                      ? Math.round((migrationReport.realConsultations / migrationReport.totalConsultations) * 100)
                      : 0}%
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h4 className="font-medium text-gray-800 flex items-center">
                <FileText size={16} className="mr-2 text-primary-500" />
                Factures
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Total</div>
                  <div className="text-xl font-bold">{migrationReport.totalInvoices}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Données test</div>
                  <div className="text-xl font-bold text-amber-600">{migrationReport.testInvoices}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Données réelles</div>
                  <div className="text-xl font-bold text-green-600">{migrationReport.realInvoices}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="text-sm text-gray-500">Pourcentage réel</div>
                  <div className="text-xl font-bold">
                    {migrationReport.totalInvoices > 0 
                      ? Math.round((migrationReport.realInvoices / migrationReport.totalInvoices) * 100)
                      : 0}%
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Références brisées */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-800 flex items-center">
                <Shield size={16} className="mr-2 text-primary-500" />
                Intégrité des références
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={verifyDataIntegrity}
                leftIcon={<RefreshCw size={14} className={integrityLoading ? "animate-spin" : ""} />}
                disabled={integrityLoading}
              >
                Vérifier l'intégrité
              </Button>
            </div>
            
            {integrityLoading ? (
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <Loader size={20} className="animate-spin mx-auto text-primary-500 mb-2" />
                <p className="text-sm text-gray-600">Vérification de l'intégrité des données en cours...</p>
              </div>
            ) : integrityReport ? (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <div className="text-sm text-gray-500">Références brisées</div>
                    <div className={`text-xl font-bold ${integrityReport.brokenPatientReferences + 
                                                        integrityReport.brokenAppointmentReferences + 
                                                        integrityReport.brokenConsultationReferences + 
                                                        integrityReport.brokenInvoiceReferences > 0 
                                                        ? 'text-error' : 'text-green-600'}`}>
                      {integrityReport.brokenPatientReferences + 
                       integrityReport.brokenAppointmentReferences + 
                       integrityReport.brokenConsultationReferences + 
                       integrityReport.brokenInvoiceReferences}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <div className="text-sm text-gray-500">Patients manquants</div>
                    <div className={`text-xl font-bold ${integrityReport.brokenPatientReferences > 0 ? 'text-error' : 'text-green-600'}`}>
                      {integrityReport.brokenPatientReferences}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <div className="text-sm text-gray-500">Rendez-vous orphelins</div>
                    <div className={`text-xl font-bold ${integrityReport.brokenAppointmentReferences > 0 ? 'text-error' : 'text-green-600'}`}>
                      {integrityReport.brokenAppointmentReferences}
                    </div>
                  </div>
                  <div className="p-3 bg-white rounded-lg shadow-sm">
                    <div className="text-sm text-gray-500">Factures orphelines</div>
                    <div className={`text-xl font-bold ${integrityReport.brokenInvoiceReferences > 0 ? 'text-error' : 'text-green-600'}`}>
                      {integrityReport.brokenInvoiceReferences}
                    </div>
                  </div>
                </div>
                
                {(integrityReport.brokenPatientReferences + 
                  integrityReport.brokenAppointmentReferences + 
                  integrityReport.brokenConsultationReferences + 
                  integrityReport.brokenInvoiceReferences > 0) && (
                  <div className="mt-4 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={repairBrokenReferences}
                      leftIcon={<RefreshCw size={14} className={repairLoading ? "animate-spin" : ""} />}
                      disabled={repairLoading}
                    >
                      Réparer les références
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg text-center">
                <p className="text-sm text-gray-600">Cliquez sur "Vérifier l'intégrité" pour analyser les références entre les données</p>
              </div>
            )}
          </div>
          
          {/* Actions de migration */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-800">Actions de migration</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h5 className="font-medium text-gray-800 mb-2 flex items-center">
                  <ArrowRight size={16} className="mr-2 text-primary-500" />
                  Migration des données de test
                </h5>
                <p className="text-sm text-gray-600 mb-4">
                  Convertit toutes les données marquées comme "test" en données réelles de production.
                  Cette action conserve toutes les données mais change leur statut.
                </p>
                <Button
                  variant="primary"
                  onClick={migrateTestData}
                  isLoading={loading}
                  loadingText="Migration en cours..."
                  disabled={loading || migrationReport.testPatients + migrationReport.testAppointments + 
                           migrationReport.testConsultations + migrationReport.testInvoices === 0}
                  fullWidth
                >
                  Migrer les données de test
                </Button>
              </div>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <h5 className="font-medium text-gray-800 mb-2 flex items-center">
                  <Trash2 size={16} className="mr-2 text-error" />
                  Suppression des données de test
                </h5>
                <p className="text-sm text-gray-600 mb-4">
                  Supprime définitivement toutes les données marquées comme "test".
                  Cette action est irréversible et ne conserve que les données réelles.
                </p>
                <Button
                  variant="outline"
                  onClick={cleanupTestData}
                  isLoading={cleanupLoading}
                  loadingText="Suppression en cours..."
                  disabled={cleanupLoading || migrationReport.testPatients + migrationReport.testAppointments + 
                           migrationReport.testConsultations + migrationReport.testInvoices === 0}
                  fullWidth
                  className="border-error text-error hover:bg-error/5"
                >
                  Supprimer les données de test
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <Database size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun rapport disponible</h3>
          <p className="text-gray-600 mb-4">
            Cliquez sur "Actualiser" pour générer un rapport de migration.
          </p>
          <Button
            variant="primary"
            onClick={loadMigrationReport}
            leftIcon={<RefreshCw size={16} />}
          >
            Générer le rapport
          </Button>
        </div>
      )}

      {/* Résultats de migration */}
      {migrationStats && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Résultats de la migration</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Patients migrés</div>
              <div className="text-xl font-bold text-primary-600">{migrationStats.patientsUpdated}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Rendez-vous migrés</div>
              <div className="text-xl font-bold text-primary-600">{migrationStats.appointmentsUpdated}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Consultations migrées</div>
              <div className="text-xl font-bold text-primary-600">{migrationStats.consultationsUpdated}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Factures migrées</div>
              <div className="text-xl font-bold text-primary-600">{migrationStats.invoicesUpdated}</div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={verifyDataIntegrity}
              leftIcon={<RefreshCw size={16} />}
              disabled={integrityLoading}
            >
              Vérifier l'intégrité des données
            </Button>
          </div>
        </div>
      )}

      {/* Résultats de nettoyage */}
      {cleanupStats && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Résultats du nettoyage</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Patients supprimés</div>
              <div className="text-xl font-bold text-green-600">{cleanupStats.patientsRemoved}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Rendez-vous supprimés</div>
              <div className="text-xl font-bold text-green-600">{cleanupStats.appointmentsRemoved}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Consultations supprimées</div>
              <div className="text-xl font-bold text-green-600">{cleanupStats.consultationsRemoved}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-500">Factures supprimées</div>
              <div className="text-xl font-bold text-green-600">{cleanupStats.invoicesRemoved}</div>
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={loadMigrationReport}
              leftIcon={<RefreshCw size={16} />}
            >
              Actualiser le rapport
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataMigrationDashboard;