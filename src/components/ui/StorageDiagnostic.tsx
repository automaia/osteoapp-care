import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Upload } from 'lucide-react';
import { Button } from './Button';
import { diagnoseStorageIssues, testPatientDocumentUpload, checkStorageRules, checkUserPermissions } from '../../utils/storageDebug';

interface DiagnosticResult {
  isConfigured: boolean;
  isAuthenticated: boolean;
  canWrite: boolean;
  errors: string[];
}

interface StorageDiagnosticProps {
  patientId?: string;
  onClose?: () => void;
}

export const StorageDiagnostic: React.FC<StorageDiagnosticProps> = ({ patientId, onClose }) => {
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [userPermissions, setUserPermissions] = useState<any>(null);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  const runDiagnostic = async () => {
    setLoading(true);
    try {
      const result = await diagnoseStorageIssues();
      setDiagnostic(result);
      
      // Vérifier les règles
      const ruleIssues = checkStorageRules();
      if (ruleIssues.length > 0) {
        result.errors.push(...ruleIssues);
      }
      
      console.log('📊 Résultat du diagnostic:', result);
    } catch (error) {
      console.error('Erreur lors du diagnostic:', error);
    } finally {
      setLoading(false);
    }
  };

  const runUploadTest = async () => {
    if (!patientId) return;
    
    setTestLoading(true);
    try {
      const result = await testPatientDocumentUpload(patientId);
      setTestResult(result);
      console.log('📊 Résultat du test d\'upload:', result);
    } catch (error) {
      console.error('Erreur lors du test d\'upload:', error);
      setTestResult({ success: false, error: 'Erreur inattendue' });
    } finally {
      setTestLoading(false);
    }
  };

  const checkPermissions = async () => {
    setPermissionsLoading(true);
    try {
      const auth = await import('../../firebase/config').then(module => module.auth);
      if (auth.currentUser?.email) {
        const permissions = await checkUserPermissions(auth.currentUser.email);
        setUserPermissions(permissions);
        console.log('📊 Permissions utilisateur:', permissions);
      } else {
        setUserPermissions({ error: 'Utilisateur non authentifié ou email non disponible' });
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des permissions:', error);
      setUserPermissions({ error: 'Erreur lors de la vérification des permissions' });
    } finally {
      setPermissionsLoading(false);
    }
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="text-green-500" size={20} />
    ) : (
      <XCircle className="text-red-500" size={20} />
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Diagnostic Firebase Storage
        </h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ×
          </button>
        )}
      </div>

      {/* Diagnostic général */}
      <div className="space-y-4 mb-6">
        <h3 className="text-lg font-medium text-gray-800">État du système</h3>
        
        {loading ? (
          <div className="flex items-center space-x-2">
            <RefreshCw className="animate-spin" size={20} />
            <span>Diagnostic en cours...</span>
          </div>
        ) : diagnostic ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              {getStatusIcon(diagnostic.isConfigured)}
              <span>Configuration Firebase Storage</span>
            </div>
            
            <div className="flex items-center space-x-3">
              {getStatusIcon(diagnostic.isAuthenticated)}
              <span>Authentification utilisateur</span>
            </div>
            
            <div className="flex items-center space-x-3">
              {getStatusIcon(diagnostic.canWrite)}
              <span>Permissions d'écriture</span>
            </div>
          </div>
        ) : null}

        {/* Erreurs */}
        {diagnostic?.errors && diagnostic.errors.length > 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center mb-2">
              <AlertCircle className="text-red-500 mr-2" size={20} />
              <h4 className="font-medium text-red-800">Erreurs détectées</h4>
            </div>
            <ul className="list-disc list-inside space-y-1 text-red-700 text-sm">
              {diagnostic.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Vérification des permissions utilisateur */}
      <div className="border-t pt-6 mb-6">
        <h3 className="text-lg font-medium text-gray-800 mb-4">
          Permissions utilisateur
        </h3>
        
        <div className="flex items-center space-x-4 mb-4">
          <Button
            variant="outline"
            onClick={checkPermissions}
            disabled={permissionsLoading}
            leftIcon={permissionsLoading ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          >
            {permissionsLoading ? 'Vérification...' : 'Vérifier les permissions'}
          </Button>
        </div>

        {userPermissions && !userPermissions.error ? (
          <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Lecture:</span>
              <span className={`text-sm ${userPermissions.canRead ? 'text-green-600' : 'text-red-600'}`}>
                {userPermissions.canRead ? 'Autorisé' : 'Non autorisé'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Écriture:</span>
              <span className={`text-sm ${userPermissions.canWrite ? 'text-green-600' : 'text-red-600'}`}>
                {userPermissions.canWrite ? 'Autorisé' : 'Non autorisé'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Suppression:</span>
              <span className={`text-sm ${userPermissions.canDelete ? 'text-green-600' : 'text-red-600'}`}>
                {userPermissions.canDelete ? 'Autorisé' : 'Non autorisé'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Droits administrateur:</span>
              <span className={`text-sm ${userPermissions.isAdmin ? 'text-green-600' : 'text-gray-600'}`}>
                {userPermissions.isAdmin ? 'Oui' : 'Non'}
              </span>
            </div>
          </div>
        ) : userPermissions?.error ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            <strong>Erreur:</strong> {userPermissions.error}
          </div>
        ) : null}
      </div>

      {/* Test d'upload spécifique */}
      {patientId && (
        <div className="border-t pt-6">
          <h3 className="text-lg font-medium text-gray-800 mb-4">
            Test d'upload patient
          </h3>
          
          <div className="flex items-center space-x-4 mb-4">
            <Button
              variant="outline"
              onClick={runUploadTest}
              disabled={testLoading || !diagnostic?.canWrite}
              leftIcon={testLoading ? <RefreshCw className="animate-spin" size={16} /> : <Upload size={16} />}
            >
              {testLoading ? 'Test en cours...' : 'Tester l\'upload'}
            </Button>
            
            {testResult && (
              <div className="flex items-center space-x-2">
                {getStatusIcon(testResult.success)}
                <span className={testResult.success ? 'text-green-700' : 'text-red-700'}>
                  {testResult.success ? 'Upload réussi' : 'Upload échoué'}
                </span>
              </div>
            )}
          </div>

          {testResult && !testResult.success && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              <strong>Erreur:</strong> {testResult.error}
            </div>
          )}

          {testResult && testResult.success && testResult.url && (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
              <strong>Succès:</strong> Fichier uploadé à{' '}
              <a href={testResult.url} target="_blank" rel="noopener noreferrer" className="underline">
                {testResult.url.substring(0, 50)}...
              </a>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
        <Button
          variant="outline"
          onClick={runDiagnostic}
          leftIcon={<RefreshCw size={16} />}
          disabled={loading}
        >
          Relancer le diagnostic
        </Button>
        
        {onClose && (
          <Button variant="primary" onClick={onClose}>
            Fermer
          </Button>
        )}
      </div>

      {/* Informations de débogage */}
      {import.meta.env.DEV && diagnostic && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium text-gray-800 mb-2">Informations de débogage</h4>
          <pre className="text-xs text-gray-600 overflow-auto">
            {JSON.stringify(diagnostic, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default StorageDiagnostic;