import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Lock, Database, Eye, EyeOff, Save, RefreshCw, CheckCircle, AlertTriangle, Info, User } from 'lucide-react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db, hdsConfig } from '../firebase/config';
import { Button } from '../components/ui/Button';
import HDSComplianceBadge from '../components/ui/HDSComplianceBadge';
import HDSComplianceInfo from '../components/ui/HDSComplianceInfo';
import { AuditLogger, AuditEventType, SensitivityLevel } from '../utils/auditLogger';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [showSecurityDetails, setShowSecurityDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generalSettings, setGeneralSettings] = useState({ // Initialisation par défaut
    cabinetName: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    language: 'fr'
  });

  // Paramètres de sécurité (simulés)
  const [securitySettings, setSecuritySettings] = useState({
    mfaEnabled: false,
    sessionTimeout: 30, // minutes
    autoLogout: true,
    dataEncryption: hdsConfig.enabled,
    auditLogging: hdsConfig.auditEnabled
  });
  
  const handleGeneralSettingsChange = (field: string, value: string) => {
    // Empêcher la modification de l'email via ce formulaire
    if (field === 'email') return;
    setGeneralSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Fonction pour charger les paramètres généraux de l'utilisateur
  const loadUserSettings = async () => {
    if (!auth.currentUser) {
      console.warn('No authenticated user to load settings for.');
      setLoading(false);
      return;
    }
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setGeneralSettings(prev => ({
          ...prev,
          cabinetName: userData.cabinetName || prev.cabinetName,
          firstName: userData.firstName || prev.firstName,
          lastName: userData.lastName || prev.lastName,
          phone: userData.phone || prev.phone,
          address: userData.address || prev.address,
          language: userData.language || prev.language,
          email: auth.currentUser.email || prev.email // L'email vient de l'auth, pas du document
        }));
      } else {
        // Si le document n'existe pas, utiliser les valeurs par défaut et l'email de l'utilisateur
        setGeneralSettings(prev => ({ ...prev, email: auth.currentUser.email || prev.email }));
      }
    } catch (error) {
      console.error('Erreur lors du chargement des paramètres utilisateur:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGeneralSettings = () => {
    setShowSaveModal(true);
  };

  const confirmSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    setShowSaveModal(false);
    
    try {
      // Sauvegarde réelle des paramètres généraux dans Firestore
      if (!auth.currentUser) {
        throw new Error('Utilisateur non authentifié');
      }

      const userRef = doc(db, 'users', auth.currentUser.uid); // Cible le document utilisateur
      await updateDoc(userRef, {
        cabinetName: generalSettings.cabinetName,
        firstName: generalSettings.firstName,
        lastName: generalSettings.lastName,
        email: generalSettings.email,
        phone: generalSettings.phone,
        address: generalSettings.address,
        language: generalSettings.language, // Assurez-vous que ce champ est bien géré
        updatedAt: new Date().toISOString()
      });
      
      // Journalisation de la modification des paramètres
      await AuditLogger.log(
        AuditEventType.CONFIGURATION,
        'general_settings',
        'update',
        SensitivityLevel.SENSITIVE,
        'success',
        { changes: generalSettings }
      );
      
      setSaveSuccess(true);
      
      // Réinitialiser après 3 secondes
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (error) {
      console.error('❌ Failed to save general settings:', error);
      setSaveSuccess(false);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.CONFIGURATION,
        'general_settings',
        'update',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
    } finally {
      setIsSaving(false);
    }
  };
  
  // Fonction pour sauvegarder les paramètres de sécurité (simulation)
  const handleSaveSecuritySettings = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Journalisation de la modification des paramètres
      await AuditLogger.log(
        AuditEventType.CONFIGURATION,
        'settings',
        'update',
        SensitivityLevel.SENSITIVE,
        'success',
        { changes: securitySettings }
      );
      
      setSaveSuccess(true);
      
      // Réinitialiser après 3 secondes
      setTimeout(() => setSaveSuccess(null), 3000);
    } catch (error) {
      console.error('❌ Failed to save settings:', error);
      setSaveSuccess(false);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.CONFIGURATION,
        'settings',
        'update',
        SensitivityLevel.SENSITIVE,
        'failure',
        { error: (error as Error).message }
      );
    } finally {
      setIsSaving(false);
    }
  };
  
  // Charger les paramètres utilisateur au montage du composant
  useEffect(() => {
    loadUserSettings();
  }, [auth.currentUser]); // Dépendance à auth.currentUser pour recharger si l'utilisateur change

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <HDSComplianceBadge size="md" />
      </div>
      
      {/* Onglets */}
      <div className="flex border-b border-gray-200">
        <button
          className={`px-4 py-2 border-b-2 font-medium text-sm ${
            activeTab === 'general'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('general')}
        >
          Général
        </button>
        <button
          className={`px-4 py-2 border-b-2 font-medium text-sm ${
            activeTab === 'security'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('security')}
        >
          Sécurité
        </button>
        <button
          className={`px-4 py-2 border-b-2 font-medium text-sm ${
            activeTab === 'compliance'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab('compliance')}
        >
          Conformité HDS
        </button>
      </div>
      
      {/* Contenu des onglets */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">Paramètres généraux</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="cabinetName" className="block text-sm font-medium text-gray-700">
                  Nom du cabinet
                </label>
                <input
                  type="text"
                  id="cabinetName"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 input"
                  placeholder="Nom de votre cabinet"
                  value={generalSettings.cabinetName}
                  onChange={(e) => handleGeneralSettingsChange('cabinetName', e.target.value)}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    Prénom de l'ostéopathe
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 input"
                    placeholder="Votre prénom"
                    value={generalSettings.firstName}
                    onChange={(e) => handleGeneralSettingsChange('firstName', e.target.value)}
                  />
                </div>
                
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Nom de l'ostéopathe
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 input"
                    placeholder="Votre nom"
                    value={generalSettings.lastName}
                    onChange={(e) => handleGeneralSettingsChange('lastName', e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email de contact
                </label>
                <input
                  type="email"
                  id="email"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 input bg-gray-100"
                  value={auth.currentUser?.email || generalSettings.email} // L'email vient de l'auth
                  readOnly // L'email ne doit pas être modifiable ici
                  onChange={(e) => handleGeneralSettingsChange('email', e.target.value)}
                />
              </div>
              
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                  Téléphone
                </label>
                <input
                  type="tel"
                  id="phone"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 input"
                  placeholder="Votre numéro de téléphone"
                  value={generalSettings.phone}
                  onChange={(e) => handleGeneralSettingsChange('phone', e.target.value)}
                  placeholder="06 12 34 56 78"
                />
              </div>
              
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Adresse du cabinet
                </label>
                <textarea
                  id="address"
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 input"
                  value={generalSettings.address}
                  placeholder="Votre adresse de cabinet"
                  onChange={(e) => handleGeneralSettingsChange('address', e.target.value)}
                  placeholder="123 rue de la Santé, 75014 Paris"
                />
              </div>
              
              <div>
                <label htmlFor="language" className="block text-sm font-medium text-gray-700">
                  Langue
                </label>
                <select
                  id="language"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 input"
                  value={generalSettings.language}
                  onChange={(e) => handleGeneralSettingsChange('language', e.target.value)}
                >
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </select>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                {saveSuccess === true && (
                  <div className="flex items-center text-green-600 mr-3">
                    <CheckCircle size={16} className="mr-1" />
                    <span className="text-sm">Paramètres enregistrés</span>
                  </div>
                )}
                
                {saveSuccess === false && (
                  <div className="flex items-center text-red-600 mr-3">
                    <AlertTriangle size={16} className="mr-1" />
                    <span className="text-sm">Erreur lors de l'enregistrement</span>
                  </div>
                )}
                
                <Button
                  variant="outline"
                  onClick={() => setGeneralSettings({ // Réinitialiser aux valeurs par défaut
                    cabinetName: '',
                    firstName: '',
                    lastName: '',
                    email: auth.currentUser?.email || '', // L'email vient de l'auth
                    phone: '',
                    address: '',
                    language: "fr"
                  })}
                >
                  Réinitialiser
                </Button>
                
                <Button
                  variant="primary"
                  onClick={handleSaveGeneralSettings}
                  leftIcon={<Save size={16} />}
                >
                  Enregistrer
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Paramètres de sécurité</h2>
              <button
                onClick={() => setShowSecurityDetails(!showSecurityDetails)}
                className="text-sm text-primary-600 flex items-center"
              >
                {showSecurityDetails ? (
                  <>
                    <EyeOff size={16} className="mr-1" />
                    Masquer les détails
                  </>
                ) : (
                  <>
                    <Eye size={16} className="mr-1" />
                    Afficher les détails
                  </>
                )}
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Authentification à deux facteurs</h3>
                  <p className="text-sm text-gray-500">
                    Renforce la sécurité de votre compte avec une vérification supplémentaire
                  </p>
                  {showSecurityDetails && (
                    <p className="mt-1 text-xs text-gray-500">
                      L'authentification à deux facteurs (2FA) est recommandée par la norme HDS pour protéger l'accès aux données de santé.
                    </p>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button
                    type="button"
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      securitySettings.mfaEnabled ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                    onClick={() => setSecuritySettings(prev => ({
                      ...prev,
                      mfaEnabled: !prev.mfaEnabled
                    }))}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        securitySettings.mfaEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Déconnexion automatique</h3>
                  <p className="text-sm text-gray-500">
                    Déconnecte automatiquement après une période d'inactivité
                  </p>
                  {showSecurityDetails && (
                    <p className="mt-1 text-xs text-gray-500">
                      La déconnexion automatique est une exigence HDS pour limiter les risques d'accès non autorisés.
                    </p>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0">
                  <button
                    type="button"
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      securitySettings.autoLogout ? 'bg-primary-600' : 'bg-gray-200'
                    }`}
                    onClick={() => setSecuritySettings(prev => ({
                      ...prev,
                      autoLogout: !prev.autoLogout
                    }))}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        securitySettings.autoLogout ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
              
              <div className="py-3 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-900">Délai d'inactivité (minutes)</h3>
                  <span className="text-sm font-medium text-primary-600">{securitySettings.sessionTimeout} min</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={securitySettings.sessionTimeout}
                  onChange={(e) => setSecuritySettings(prev => ({
                    ...prev,
                    sessionTimeout: parseInt(e.target.value)
                  }))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                {showSecurityDetails && (
                  <p className="mt-1 text-xs text-gray-500">
                    La norme HDS recommande un délai d'inactivité de 15 à 30 minutes maximum.
                  </p>
                )}
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Chiffrement des données</h3>
                  <p className="text-sm text-gray-500">
                    Chiffrement AES-256 des données sensibles
                  </p>
                  {showSecurityDetails && (
                    <p className="mt-1 text-xs text-gray-500">
                      Le chiffrement AES-256 est conforme aux exigences HDS pour la protection des données de santé.
                    </p>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0">
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    securitySettings.dataEncryption ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {securitySettings.dataEncryption ? 'Activé' : 'Désactivé'}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between py-3 border-b border-gray-200">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Journalisation d'audit</h3>
                  <p className="text-sm text-gray-500">
                    Enregistrement de toutes les actions sur les données sensibles
                  </p>
                  {showSecurityDetails && (
                    <p className="mt-1 text-xs text-gray-500">
                      La journalisation d'audit est obligatoire selon la norme HDS avec une conservation de 3 ans minimum.
                    </p>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0">
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    securitySettings.auditLogging ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {securitySettings.auditLogging ? 'Activé' : 'Désactivé'}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              {saveSuccess === true && (
                <div className="flex items-center text-green-600 mr-3">
                  <CheckCircle size={16} className="mr-1" />
                  <span className="text-sm">Paramètres enregistrés</span>
                </div>
              )}
              
              {saveSuccess === false && (
                <div className="flex items-center text-red-600 mr-3">
                  <AlertTriangle size={16} className="mr-1" />
                  <span className="text-sm">Erreur lors de l'enregistrement</span>
                </div>
              )}
              
              <Button
                variant="outline"
                onClick={() => setSecuritySettings({
                  mfaEnabled: false,
                  sessionTimeout: 30,
                  autoLogout: true,
                  dataEncryption: hdsConfig.enabled,
                  auditLogging: hdsConfig.auditEnabled
                })}
              >
                Réinitialiser
              </Button>
              
              <Button
                variant="primary"
                onClick={handleSaveSecuritySettings} // Appel de la fonction de sauvegarde de sécurité
                isLoading={isSaving}
                loadingText="Enregistrement..."
                leftIcon={isSaving ? <RefreshCw size={16} /> : <Save size={16} />}
              >
                Enregistrer
              </Button>
            </div>
          </div>
        )}
        
        {activeTab === 'compliance' && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-gray-900">Conformité HDS</h2>
            
            <HDSComplianceInfo className="mb-6" />
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Info className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">À propos de la certification HDS</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      L'hébergement de données de santé (HDS) est encadré par l'article L.1111-8 du Code de la santé publique. 
                      Cette certification garantit un niveau élevé de sécurité pour les données de santé à caractère personnel.
                    </p>
                    <p className="mt-2">
                      OstheoApp implémente les mesures techniques et organisationnelles conformes au référentiel HDS :
                    </p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>Chiffrement AES-256 des données sensibles</li>
                      <li>Authentification forte des utilisateurs</li>
                      <li>Traçabilité complète des accès et modifications</li>
                      <li>Pseudonymisation des données d'identification</li>
                      <li>Hébergement des données en France</li>
                      <li>Conservation sécurisée pendant 20 ans</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-base font-medium text-gray-900 mb-4">Documentation de conformité</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <Database size={16} className="text-gray-500 mr-2" />
                    <span className="text-sm text-gray-700">Politique de sécurité des données</span>
                  </div>
                  <Button variant="outline" size="sm">
                    Télécharger
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <Lock size={16} className="text-gray-500 mr-2" />
                    <span className="text-sm text-gray-700">Attestation de conformité HDS</span>
                  </div>
                  <Button variant="outline" size="sm">
                    Télécharger
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <Shield size={16} className="text-gray-500 mr-2" />
                    <span className="text-sm text-gray-700">Analyse d'impact RGPD</span>
                  </div>
                  <Button variant="outline" size="sm">
                    Télécharger
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Modal de confirmation pour l'enregistrement */}
      <AnimatePresence>
        {showSaveModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowSaveModal(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="relative w-full max-w-md bg-white rounded-xl shadow-2xl"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                <div className="flex items-center">
                  <Save size={20} className="text-primary-600 mr-2" />
                  <h2 className="text-xl font-semibold text-gray-900">
                    Confirmer l'enregistrement
                  </h2>
                </div>
              </div>

              <div className="px-6 py-4">
                <p className="text-gray-700 mb-4">
                  Êtes-vous sûr de vouloir enregistrer ces paramètres généraux ?
                </p>
                
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Paramètres à enregistrer :</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div><strong>Cabinet :</strong> {generalSettings.cabinetName}</div>
                    <div><strong>Ostéopathe :</strong> {generalSettings.firstName} {generalSettings.lastName}</div>
                    <div><strong>Email :</strong> {generalSettings.email}</div>
                    <div><strong>Téléphone :</strong> {generalSettings.phone}</div>
                    <div><strong>Adresse :</strong> {generalSettings.address}</div>
                    <div><strong>Langue :</strong> {generalSettings.language === 'fr' ? 'Français' : 'English'}</div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                <Button
                  variant="outline"
                  onClick={() => setShowSaveModal(false)}
                  disabled={isSaving}
                >
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  onClick={confirmSaveSettings}
                  isLoading={isSaving}
                  loadingText="Enregistrement..."
                  leftIcon={<Save size={16} />}
                >
                  Confirmer l'enregistrement
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Settings;