import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, RefreshCw, Key, Database } from 'lucide-react';
import { Button } from './Button';
import { auth } from '../../firebase/config';
import { encryptData, decryptData, isEncrypted, isValidEncryptedFormat } from '../../utils/encryption';
import { HDSCompliance } from '../../utils/hdsCompliance';

interface EncryptionDiagnosticProps {
  onClose?: () => void;
}

const EncryptionDiagnostic: React.FC<EncryptionDiagnosticProps> = ({ onClose }) => {
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostic = async () => {
    if (!auth.currentUser) {
      setError('Utilisateur non authentifié');
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const userId = auth.currentUser.uid;
      const results: any = {
        encryptionKey: {
          exists: !!import.meta.env.VITE_ENCRYPTION_KEY,
          value: import.meta.env.VITE_ENCRYPTION_KEY ? 
            import.meta.env.VITE_ENCRYPTION_KEY.substring(0, 10) + '...' : 
            'Clé par défaut utilisée',
          isDefault: !import.meta.env.VITE_ENCRYPTION_KEY || 
            import.meta.env.VITE_ENCRYPTION_KEY === 'hds-compliant-encryption-key-must-be-stored-securely'
        },
        encryptionTest: {
          success: false,
          error: null
        },
        decryptionTest: {
          success: false,
          error: null
        },
        hdsCompliance: {
          enabled: HDSCompliance.isEnabled(),
          version: null
        }
      };

      // Test de chiffrement
      try {
        const testData = "Test de chiffrement - " + new Date().toISOString();
        const encrypted = encryptData(testData, userId);
        
        if (encrypted && encrypted !== testData && isEncrypted(encrypted)) {
          results.encryptionTest.success = true;
          
          // Test de déchiffrement
          try {
            const decrypted = decryptData(encrypted, userId);
            
            if (decrypted === testData) {
              results.decryptionTest.success = true;
            } else {
              results.decryptionTest.error = `Données déchiffrées incorrectes: "${decrypted}" au lieu de "${testData}"`;
            }
          } catch (decryptError) {
            results.decryptionTest.error = `Erreur de déchiffrement: ${decryptError.message}`;
          }
        } else {
          results.encryptionTest.error = "Le chiffrement n'a pas fonctionné correctement";
        }
      } catch (encryptError) {
        results.encryptionTest.error = `Erreur de chiffrement: ${encryptError.message}`;
      }

      setDiagnosticResults(results);
    } catch (error) {
      setError(`Erreur lors du diagnostic: ${error.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="text-green-500" size={20} />
    ) : (
      <AlertTriangle className="text-red-500" size={20} />
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <Shield size={24} className="mr-2 text-primary-600" />
          Diagnostic du Chiffrement HDS
        </h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
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

      {isRunning ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center">
            <RefreshCw className="animate-spin text-primary-500 mb-4" size={48} />
            <p className="text-gray-700">Diagnostic en cours...</p>
          </div>
        </div>
      ) : diagnosticResults ? (
        <div className="space-y-6">
          {/* Configuration de la clé */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center">
              <Key size={16} className="mr-2" />
              Configuration de la Clé de Chiffrement
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Clé d'environnement définie:</span>
                <div className="flex items-center">
                  {getStatusIcon(diagnosticResults.encryptionKey.exists)}
                  <span className="ml-2 text-sm">
                    {diagnosticResults.encryptionKey.exists ? 'Oui' : 'Non (clé par défaut)'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Valeur de la clé:</span>
                <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                  {diagnosticResults.encryptionKey.value}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Utilise la clé par défaut:</span>
                <div className="flex items-center">
                  {getStatusIcon(!diagnosticResults.encryptionKey.isDefault)}
                  <span className="ml-2 text-sm">
                    {diagnosticResults.encryptionKey.isDefault ? 'Oui (problématique)' : 'Non (bon)'}
                  </span>
                </div>
              </div>
            </div>
            
            {diagnosticResults.encryptionKey.isDefault && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Attention:</strong> Votre application utilise la clé de chiffrement par défaut. 
                  Cela peut causer des problèmes de déchiffrement si la clé a été modifiée récemment.
                </p>
              </div>
            )}
          </div>

          {/* Tests de chiffrement */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center">
              <Database size={16} className="mr-2" />
              Tests de Chiffrement/Déchiffrement
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Test de chiffrement:</span>
                <div className="flex items-center">
                  {getStatusIcon(diagnosticResults.encryptionTest.success)}
                  <span className="ml-2 text-sm">
                    {diagnosticResults.encryptionTest.success ? 'Succès' : 'Échec'}
                  </span>
                </div>
              </div>
              
              {diagnosticResults.encryptionTest.error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {diagnosticResults.encryptionTest.error}
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Test de déchiffrement:</span>
                <div className="flex items-center">
                  {getStatusIcon(diagnosticResults.decryptionTest.success)}
                  <span className="ml-2 text-sm">
                    {diagnosticResults.decryptionTest.success ? 'Succès' : 'Échec'}
                  </span>
                </div>
              </div>
              
              {diagnosticResults.decryptionTest.error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {diagnosticResults.decryptionTest.error}
                </div>
              )}
            </div>
          </div>

          {/* Recommandations */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">Recommandations</h3>
            
            {!diagnosticResults.encryptionTest.success || !diagnosticResults.decryptionTest.success ? (
              <div className="space-y-3">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-800 mb-2">Problème détecté</h4>
                  <p className="text-sm text-red-700">
                    Le système de chiffrement ne fonctionne pas correctement. Cela explique pourquoi 
                    vos consultations affichent "[Données protégées]".
                  </p>
                </div>
                
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">Solution recommandée</h4>
                  <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
                    <li>Vérifiez que la variable VITE_ENCRYPTION_KEY est correctement définie</li>
                    <li>Assurez-vous qu'elle n'a pas été modifiée récemment</li>
                    <li>Redémarrez votre serveur de développement</li>
                    <li>Si le problème persiste, utilisez l'outil de réparation des données</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="text-green-500 mr-2" size={16} />
                  <span className="text-green-700">
                    Le système de chiffrement fonctionne correctement. 
                    Le problème pourrait venir de données chiffrées avec une clé différente.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex justify-end space-x-3 mt-6">
        <Button
          variant="outline"
          onClick={runDiagnostic}
          leftIcon={<RefreshCw size={16} />}
          disabled={isRunning}
        >
          Relancer le diagnostic
        </Button>
        
        {onClose && (
          <Button variant="primary" onClick={onClose}>
            Fermer
          </Button>
        )}
      </div>
    </div>
  );
};

export default EncryptionDiagnostic;