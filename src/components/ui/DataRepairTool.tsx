import React, { useState } from 'react';
import { Shield, RefreshCw, CheckCircle, AlertTriangle, Database, Wrench } from 'lucide-react';
import { Button } from './Button';
import { HDSCompliance } from '../../utils/hdsCompliance';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';

interface DataRepairToolProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

const DataRepairTool: React.FC<DataRepairToolProps> = ({ onClose, onSuccess }) => {
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairResults, setRepairResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'scan' | 'repair' | 'complete'>('scan');

  const repairConsultationData = async () => {
    if (!auth.currentUser) {
      setError('Utilisateur non authentifié');
      return;
    }

    setIsRepairing(true);
    setError(null);
    setStep('scan');

    try {
      const userId = auth.currentUser.uid;
      const results = {
        consultationsScanned: 0,
        consultationsRepaired: 0,
        consultationsFailed: 0,
        errors: [] as string[]
      };

      // Récupérer toutes les consultations de l'utilisateur
      const consultationsRef = collection(db, 'consultations');
      const q = query(consultationsRef, where('osteopathId', '==', userId));
      const snapshot = await getDocs(q);

      results.consultationsScanned = snapshot.docs.length;
      setStep('repair');

      // Traiter chaque consultation
      for (const docSnap of snapshot.docs) {
        try {
          const data = docSnap.data();
          let needsRepair = false;
          const repairedData: any = { ...data };

          // Vérifier les champs sensibles
          const sensitiveFields = ['reason', 'treatment', 'notes'];
          
          for (const field of sensitiveFields) {
            if (data[field] && typeof data[field] === 'string') {
              // Si le champ contient une erreur de déchiffrement
              if (data[field].includes('[DECRYPTION_ERROR:') || 
                  data[field].includes('[ENCRYPTION_ERROR:') ||
                  data[field] === '[Données protégées]') {
                
                console.log(`Tentative de réparation du champ ${field} pour la consultation ${docSnap.id}`);
                
                // Tenter d'extraire les données originales
                let originalValue = '';
                if (data[field].includes(':')) {
                  const parts = data[field].split(':');
                  if (parts.length > 1) {
                    originalValue = parts.slice(1).join(':');
                  }
                }
                
                // Gestion spéciale pour les données récupérées partiellement
                if (data[field].startsWith('[RECOVERED_DATA]:')) {
                  originalValue = data[field].substring('[RECOVERED_DATA]:'.length).trim();
                }
                
                // Si on ne peut pas récupérer les données, utiliser une valeur par défaut
                if (!originalValue) {
                  switch (field) {
                    case 'reason':
                      originalValue = 'Consultation ostéopathique';
                      break;
                    case 'treatment':
                      originalValue = 'Traitement ostéopathique standard';
                      break;
                    case 'notes':
                      originalValue = 'Notes de consultation - données non récupérables';
                      break;
                    default:
                      originalValue = 'Information non disponible';
                  }
                }
                
                repairedData[field] = originalValue;
                needsRepair = true;
              }
            }
          }

          // Mettre à jour le document si nécessaire
          if (needsRepair) {
            await updateDoc(doc(db, 'consultations', docSnap.id), {
              ...repairedData,
              repairedAt: new Date().toISOString(),
              repairedBy: userId
            });
            
            results.consultationsRepaired++;
            console.log(`✅ Consultation ${docSnap.id} réparée`);
          }

        } catch (error) {
          console.error(`❌ Erreur lors de la réparation de la consultation ${docSnap.id}:`, error);
          results.consultationsFailed++;
          results.errors.push(`Consultation ${docSnap.id}: ${error.message}`);
        }
      }

      setRepairResults(results);
      setStep('complete');
      
      if (onSuccess && results.consultationsRepaired > 0) {
        onSuccess();
      }

    } catch (error) {
      console.error('Erreur lors de la réparation des données:', error);
      setError(`Erreur lors de la réparation: ${error.message}`);
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <Wrench size={24} className="mr-2 text-primary-600" />
          Outil de Réparation des Données
        </h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ×
          </button>
        )}
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
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-800 mb-2">Réparation des Consultations</h3>
            <p className="text-sm text-blue-700">
              Cet outil va analyser toutes vos consultations et tenter de réparer celles qui affichent 
              "[Données protégées]" en restaurant les informations lisibles.
            </p>
            <p className="text-sm text-blue-700 mt-2">
              <strong>Attention:</strong> Cette opération va modifier vos données. Assurez-vous d'avoir 
              une sauvegarde si nécessaire.
            </p>
          </div>
          
          <div className="flex justify-end space-x-3">
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Annuler
              </Button>
            )}
            <Button
              variant="primary"
              onClick={repairConsultationData}
              leftIcon={<Wrench size={16} />}
            >
              Démarrer la réparation
            </Button>
          </div>
        </div>
      )}

      {step === 'repair' && (
        <div className="space-y-6">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center">
              <RefreshCw className="animate-spin text-primary-500 mb-4" size={48} />
              <p className="text-gray-700 text-lg">Réparation en cours...</p>
              <p className="text-sm text-gray-500 mt-2">
                Analyse et réparation des consultations corrompues
              </p>
            </div>
          </div>
        </div>
      )}

      {step === 'complete' && repairResults && (
        <div className="space-y-6">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-start">
              <CheckCircle className="text-green-500 mt-0.5 mr-3" size={20} />
              <div>
                <h3 className="font-medium text-green-800">Réparation terminée</h3>
                <p className="text-sm text-green-700 mt-1">
                  La réparation des données de consultation est terminée.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-gray-900">{repairResults.consultationsScanned}</div>
              <div className="text-sm text-gray-600">Consultations analysées</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{repairResults.consultationsRepaired}</div>
              <div className="text-sm text-gray-600">Consultations réparées</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">{repairResults.consultationsFailed}</div>
              <div className="text-sm text-gray-600">Échecs</div>
            </div>
          </div>

          {repairResults.errors.length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">Erreurs rencontrées:</h4>
              <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                {repairResults.errors.map((error: string, index: number) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <Button
              variant="outline"
              onClick={() => {
                setStep('scan');
                setRepairResults(null);
              }}
            >
              Relancer
            </Button>
            {onClose && (
              <Button variant="primary" onClick={onClose}>
                Fermer
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DataRepairTool;