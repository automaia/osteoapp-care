import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  Database, 
  Shield, 
  Mail, 
  Globe,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Button } from '../ui/Button';

interface SystemConfig {
  maintenance: {
    enabled: boolean;
    message: string;
    allowedUsers: string[];
  };
  security: {
    maxLoginAttempts: number;
    sessionTimeout: number;
    requireEmailVerification: boolean;
    passwordMinLength: number;
  };
  email: {
    provider: string;
    fromAddress: string;
    replyToAddress: string;
  };
  features: {
    betaSignup: boolean;
    userRegistration: boolean;
    passwordReset: boolean;
  };
}

const SystemConfig: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig>({
    maintenance: {
      enabled: false,
      message: 'Le système est temporairement en maintenance. Veuillez réessayer plus tard.',
      allowedUsers: ['grondin.stephane@gmail.com']
    },
    security: {
      maxLoginAttempts: 5,
      sessionTimeout: 3600,
      requireEmailVerification: false,
      passwordMinLength: 8
    },
    email: {
      provider: 'firebase',
      fromAddress: 'noreply@osteoapp.com',
      replyToAddress: 'support@osteoapp.com'
    },
    features: {
      betaSignup: true,
      userRegistration: false,
      passwordReset: true
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const configDoc = await getDoc(doc(db, 'system', 'config'));
      if (configDoc.exists()) {
        setConfig({ ...config, ...configDoc.data() });
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await setDoc(doc(db, 'system', 'config'), config);
      setMessage({ type: 'success', text: 'Configuration sauvegardée avec succès' });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      setMessage({ type: 'error', text: 'Erreur lors de la sauvegarde de la configuration' });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (section: keyof SystemConfig, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Configuration système</h2>
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={loadConfig}
            leftIcon={<RefreshCw size={16} />}
          >
            Recharger
          </Button>
          <Button
            variant="primary"
            onClick={saveConfig}
            leftIcon={<Save size={16} />}
            isLoading={saving}
            loadingText="Sauvegarde..."
          >
            Sauvegarder
          </Button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg flex items-center ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle size={16} className="text-green-500 mr-2" />
          ) : (
            <AlertTriangle size={16} className="text-red-500 mr-2" />
          )}
          <span className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
            {message.text}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Maintenance */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Settings size={20} className="text-gray-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Mode maintenance</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="maintenance-enabled"
                checked={config.maintenance.enabled}
                onChange={(e) => updateConfig('maintenance', 'enabled', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="maintenance-enabled" className="ml-2 text-sm text-gray-900">
                Activer le mode maintenance
              </label>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message de maintenance
              </label>
              <textarea
                value={config.maintenance.message}
                onChange={(e) => updateConfig('maintenance', 'message', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Shield size={20} className="text-gray-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Sécurité</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tentatives de connexion max
              </label>
              <input
                type="number"
                value={config.security.maxLoginAttempts}
                onChange={(e) => updateConfig('security', 'maxLoginAttempts', parseInt(e.target.value))}
                min="1"
                max="10"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timeout de session (secondes)
              </label>
              <input
                type="number"
                value={config.security.sessionTimeout}
                onChange={(e) => updateConfig('security', 'sessionTimeout', parseInt(e.target.value))}
                min="300"
                max="86400"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Longueur minimum du mot de passe
              </label>
              <input
                type="number"
                value={config.security.passwordMinLength}
                onChange={(e) => updateConfig('security', 'passwordMinLength', parseInt(e.target.value))}
                min="6"
                max="20"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="email-verification"
                checked={config.security.requireEmailVerification}
                onChange={(e) => updateConfig('security', 'requireEmailVerification', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="email-verification" className="ml-2 text-sm text-gray-900">
                Vérification email obligatoire
              </label>
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Mail size={20} className="text-gray-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Configuration email</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse expéditeur
              </label>
              <input
                type="email"
                value={config.email.fromAddress}
                onChange={(e) => updateConfig('email', 'fromAddress', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse de réponse
              </label>
              <input
                type="email"
                value={config.email.replyToAddress}
                onChange={(e) => updateConfig('email', 'replyToAddress', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Globe size={20} className="text-gray-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Fonctionnalités</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="beta-signup"
                checked={config.features.betaSignup}
                onChange={(e) => updateConfig('features', 'betaSignup', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="beta-signup" className="ml-2 text-sm text-gray-900">
                Inscription Beta activée
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="user-registration"
                checked={config.features.userRegistration}
                onChange={(e) => updateConfig('features', 'userRegistration', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="user-registration" className="ml-2 text-sm text-gray-900">
                Inscription utilisateur activée
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="password-reset"
                checked={config.features.passwordReset}
                onChange={(e) => updateConfig('features', 'passwordReset', e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="password-reset" className="ml-2 text-sm text-gray-900">
                Réinitialisation mot de passe activée
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemConfig;