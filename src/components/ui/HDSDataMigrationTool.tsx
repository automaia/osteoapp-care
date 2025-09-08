import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, CheckCircle, AlertTriangle, Database, ArrowRight } from 'lucide-react';
import { Button } from './Button';
import { HDSCompliance } from '../../utils/hdsCompliance';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';

interface HDSDataMigrationToolProps {
  onClose: () => void;
  onSuccess: () => void;
}

const HDSDataMigrationTool: React.FC<HDSDataMigrationToolProps> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<'scan' | 'confirm' | 'migrate' | 'complete'>('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [corruptedData, setCorruptedData] = useState<{
    patients: { id: string; fields: string[] }[];
    consultations: { id: string; fields: string[] }[];
    invoices: { id: string; fields: string[] }[];
  }>({
    patients: [],
    consultations: [],
    invoices: []
  });
  const [migrationStats, setMigrationStats] = useState({
    total: 0,
    success: 0,
    failed: 0
  });
  const [error, setError] = useState<string | null>(null);

  // Scan des données corrompues
  const scanForCorruptedData = async () => {
    if (!auth.currentUser) {
      setError('Utilisateur non authentifié');
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const userId = auth.currentUser.uid;
      const corruptedPatients: { id: string; fields: string[] }[] = [];
      const corruptedConsultations: { id: string; fields: string[] }[] = [];
      const corruptedInvoices: { id: string; fields: string[] }[] = [];

      // Scan des patients
      const patientsRef = collection(db, 'patients');
      const patientsQuery = query(patientsRef, where('osteopathId', '==', userId));
      const patientsSnapshot = await getDocs(patientsQuery);

      for (const docSnap of patientsSnapshot.docs) {
        const data = docSnap.data();
        const corruptedFields: string[] = [];

        // Vérifier les champs sensibles
        for (const field of ['firstName', 'lastName', 'dateOfBirth', 'socialSecurityNumber', 'email', 'phone', 'address', 'medicalHistory', 'allergies']) {
          if (data[field] && typeof data[field] === 'string' && 
              (data[field].includes('[DECRYPTION_ERROR:') || 
               data[field].includes('[ENCRYPTION_ERROR:') ||
               (data[field].includes(':') && !data[field].match(/^[0-9a-fA-F]{32}:/)))) {
            corruptedFields.push(field);
          }
        }

        if (corruptedFields.length > 0) {
          corruptedPatients.push({ id: docSnap.id, fields: corruptedFields });
        }
      }

      // Scan des consultations
      const consultationsRef = collection(db, 'consultations');
      const consultationsQuery = query(consultationsRef, where('osteopathId', '==', userId));
      const consultationsSnapshot = await getDocs(consultationsQuery);

      for (const docSnap of consultationsSnapshot.docs) {
        const data = docSnap.data();
        const corruptedFields: string[] = [];

        // Vérifier les champs sensibles
        for (const field of ['reason', 'treatment', 'notes']) {
          if (data[field] && typeof data[field] === 'string' && 
              (data[field].includes('[DECRYPTION_ERROR:') || 
               data[field].includes('[ENCRYPTION_ERROR:') ||
               (data[field].includes(':') && !data[field].match(/^[0-9a-fA-F]{32}:/)))) {
            corruptedFields.push(field);
          }
        }

        if (corruptedFields.length > 0) {
          corruptedConsultations.push({ id: docSnap.id, fields: corruptedFields });
        }
      }

      // Scan des factures
      const invoicesRef = collection(db, 'invoices');
      const invoicesQuery = query(invoicesRef, where('osteopathId', '==', userId));
      const invoicesSnapshot = await getDocs(invoicesQuery);

      for (const docSnap of invoicesSnapshot.docs) {
        const data = docSnap.data();
        const corruptedFields: string[] = [];

        // Vérifier les champs sensibles
        for (const field of ['patientName', 'notes']) {
          if (data[field] && typeof data[field] === 'string' && 
              (data[field].includes('[DECRYPTION_ERROR:') || 
               data[field].includes('[ENCRYPTION_ERROR:') ||
               (data[field].includes(':') && !data[field].match(/^[0-9a-fA-F]{32}:/)))) {
            corruptedFields.push(field);
          }
        }

        if (corruptedFields.length > 0) {
          corruptedInvoices.push({ id: docSnap.id, fields: corruptedFields });
        }
      }

      setCorruptedData({
        patients: corruptedPatients,
        consultations: corruptedConsultations,
        invoices: corruptedInvoices
      });

      const totalCorrupted = corruptedPatients.length + corruptedConsultations.length + corruptedInvoices.length;
      
      if (totalCorrupted > 0) {
        setStep('confirm');
      } else {
        setStep('complete');
        setMigrationStats({
          total: 0,
          success: 0,
          failed: 0
        });
      }

    } catch (error) {
      console.error('Error scanning for corrupted data:', error);
      setError('Erreur lors de la recherche de données corrompues');
    } finally {
      setIsScanning(false);
    }
  };

  // Migration des données corrompues
  const migrateCorruptedData = async () => {
    if (!auth.currentUser) {
      setError('Utilisateur non authentifié');
      return;
    }

    setIsMigrating(true);
    setError(null);
    setStep('migrate');

    try {
      const totalItems = 
        corruptedData.patients.length + 
        corruptedData.consultations.length + 
        corruptedData.invoices.length;
      
      let successCount = 0;
      let failedCount = 0;

      // Migrer les patients
      for (const patient of corruptedData.patients) {
        try {
          const success = await HDSCompliance.repairCorruptedData('patients', patient.id);
          if (success) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          console.error(`Error repairing patient ${patient.id}:`, error);
          failedCount++;
        }
      }

      // Migrer les consultations
      for (const consultation of corruptedData.consultations) {
        try {
          const success = await HDSCompliance.repairCorruptedData('consultations', consultation.id);
          if (success) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          console.error(`Error repairing consultation ${consultation.id}:`, error);
          failedCount++;
        }
      }

      // Migrer les factures
      for (const invoice of corruptedData.invoices) {
        try {
          const success = await HDSCompliance.repairCorruptedData('invoices', invoice.id);
          if (success) {
            successCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          console.error(`Error repairing invoice ${invoice.id}:`, error);
          failedCount++;
        }
      }

      setMigrationStats({
        total: totalItems,
        success: successCount,
        failed: failedCount
      });

      setStep('complete');
      
      if (successCount > 0) {
        onSuccess();
      }

    } catch (error) {
      console.error('Error migrating corrupted data:', error);
      setError('Erreur lors de la migration des données corrompues');
    } finally {
      setIsMigrating(false);
    }
  };

  // Lancer le scan au chargement
  useEffect(() => {
    scanForCorruptedData();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Shield className="text-primary-500 mr-2" size={24} />
          <h2 className="text-xl font-semibold text-gray-900">
            Outil de migration des données HDS
          </h2>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="text-red-500 mr-2" size={20} />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {step === 'scan' && (
        <div className="space-y-6">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center">
              <RefreshCw className={`text-primary-500 mb-4 ${isScanning ? 'animate-spin' : ''}`} size={48} />
              <p className="text-gray-700 text-lg">
                {isScanning ? 'Analyse des données en cours...' : 'Démarrage de l\'analyse...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-6">
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <AlertTriangle className="text-yellow-500 mt-0.5 mr-3" size={20} />
              <div>
                <h3 className="font-medium text-yellow-800">Données corrompues détectées</h3>
                <p className="mt-2 text-sm text-yellow-700">
                  L'analyse a détecté des données potentiellement corrompues qui nécessitent une migration.
                </p>
                
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium text-yellow-800">Résumé des problèmes :</p>
                  <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                    <li>{corruptedData.patients.length} patient(s) avec des données corrompues</li>
                    <li>{corruptedData.consultations.length} consultation(s) avec des données corrompues</li>
                    <li>{corruptedData.invoices.length} facture(s) avec des données corrompues</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <p className="text-gray-700 mb-6">
              L'outil va tenter de réparer les données corrompues. Cette opération est sécurisée et ne modifiera que les données qui présentent des problèmes de chiffrement.
            </p>
            
            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={onClose}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                onClick={migrateCorruptedData}
                leftIcon={<ArrowRight size={16} />}
              >
                Démarrer la migration
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === 'migrate' && (
        <div className="space-y-6">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center">
              <Database className="text-primary-500 mb-4" size={48} />
              <div className="flex items-center">
                <RefreshCw className="animate-spin text-primary-500 mr-2" size={20} />
                <p className="text-gray-700 text-lg">Migration des données en cours...</p>
              </div>
              
              <div className="w-full max-w-md mt-6">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="space-y-6">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start">
              <CheckCircle className="text-green-500 mt-0.5 mr-3" size={20} />
              <div>
                <h3 className="font-medium text-green-800">Analyse terminée</h3>
                
                {migrationStats.total > 0 ? (
                  <div className="mt-2">
                    <p className="text-sm text-green-700">
                      La migration des données est terminée.
                    </p>
                    
                    <div className="mt-4 grid grid-cols-3 gap-4">
                      <div className="bg-white p-3 rounded-lg shadow-sm text-center">
                        <p className="text-sm text-gray-500">Total</p>
                        <p className="text-xl font-bold text-gray-900">{migrationStats.total}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg shadow-sm text-center">
                        <p className="text-sm text-gray-500">Réussis</p>
                        <p className="text-xl font-bold text-green-600">{migrationStats.success}</p>
                      </div>
                      <div className="bg-white p-3 rounded-lg shadow-sm text-center">
                        <p className="text-sm text-gray-500">Échoués</p>
                        <p className="text-xl font-bold text-red-600">{migrationStats.failed}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-green-700">
                    Aucune donnée corrompue n'a été détectée. Votre système est en bon état.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={onClose}
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HDSDataMigrationTool;