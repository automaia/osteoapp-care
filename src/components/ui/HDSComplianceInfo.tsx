import React, { useState } from 'react';
import { Shield, Lock, Info, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { hdsConfig } from '../../firebase/config';
import { Button } from './Button';
import HDSDataMigrationTool from './HDSDataMigrationTool';

interface HDSComplianceInfoProps {
  className?: string;
}

const HDSComplianceInfo: React.FC<HDSComplianceInfoProps> = ({
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMigrationTool, setShowMigrationTool] = useState(false);
  const [migrationSuccess, setMigrationSuccess] = useState(false);
  const isEnabled = hdsConfig.enabled;
  
  const handleMigrationSuccess = () => {
    setMigrationSuccess(true);
    // Masquer le message de succès après 5 secondes
    setTimeout(() => {
      setMigrationSuccess(false);
    }, 5000);
  };
  
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {/* En-tête */}
      <div className={`p-4 ${isEnabled ? 'bg-green-50' : 'bg-yellow-50'} flex items-center justify-between`}>
        <div className="flex items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isEnabled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            <Shield size={20} />
          </div>
          <div className="ml-3">
            <h3 className="font-medium text-gray-900">
              {isEnabled ? 'Conformité HDS activée' : 'Mode HDS non activé'}
            </h3>
            <p className="text-sm text-gray-600">
              {isEnabled 
                ? 'Vos données de santé sont protégées selon les normes HDS' 
                : 'Les protections HDS ne sont pas actives'}
            </p>
          </div>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
      </div>
      
      {/* Contenu détaillé */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-100">
          <div className="space-y-4">
            {/* Statut général */}
            <div className="flex items-start">
              <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                isEnabled ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
              }`}>
                {isEnabled ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-gray-900">
                  {isEnabled ? 'Protection active' : 'Protection inactive'}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  {isEnabled 
                    ? 'Toutes les données sensibles sont chiffrées et protégées' 
                    : 'Les données ne bénéficient pas des protections HDS'}
                </p>
              </div>
            </div>
            
            {/* Chiffrement */}
            <div className="flex items-start">
              <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                isEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
              }`}>
                <Lock size={14} />
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-gray-900">Chiffrement</h4>
                <p className="text-xs text-gray-500 mt-1">
                  {isEnabled 
                    ? `Chiffrement ${hdsConfig.encryptionLevel} au repos et en transit` 
                    : 'Chiffrement HDS non activé'}
                </p>
              </div>
            </div>
            
            {/* Audit */}
            <div className="flex items-start">
              <div className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                isEnabled && hdsConfig.auditEnabled ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
              }`}>
                <Info size={14} />
              </div>
              <div className="ml-3">
                <h4 className="text-sm font-medium text-gray-900">Traçabilité</h4>
                <p className="text-xs text-gray-500 mt-1">
                  {isEnabled && hdsConfig.auditEnabled
                    ? `Journalisation complète des accès (conservation ${hdsConfig.auditRetentionDays} jours)` 
                    : 'Journalisation HDS non activée'}
                </p>
              </div>
            </div>
            
            {/* Outil de migration */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-900">Outils de maintenance</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMigrationTool(true)}
                  leftIcon={<RefreshCw size={14} />}
                >
                  Vérifier les données
                </Button>
              </div>
              
              {migrationSuccess && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircle className="text-green-500 mr-2" size={14} />
                    <span className="text-xs text-green-700">Migration des données réussie</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Informations légales */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                L'hébergement de données de santé (HDS) est encadré par l'article L.1111-8 du Code de la santé publique. 
                Les données de santé à caractère personnel sont hébergées dans le respect des dispositions du RGPD et 
                de la loi Informatique et Libertés.
              </p>
              
              {isEnabled && (
                <p className="text-xs text-gray-500 mt-2">
                  Version de conformité: {hdsConfig.complianceVersion} | 
                  Localisation des données: {hdsConfig.dataResidency}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Modal de l'outil de migration */}
      {showMigrationTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <HDSDataMigrationTool 
            onClose={() => setShowMigrationTool(false)}
            onSuccess={handleMigrationSuccess}
          />
        </div>
      )}
    </div>
  );
};

export default HDSComplianceInfo;