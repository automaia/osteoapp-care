import React from 'react';
import { Shield, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { hdsConfig } from '../../firebase/config';

interface HDSComplianceBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
  className?: string;
}

const HDSComplianceBadge: React.FC<HDSComplianceBadgeProps> = ({
  size = 'md',
  showDetails = false,
  className = ''
}) => {
  const isEnabled = hdsConfig.enabled;
  
  // Tailles des icônes selon la prop size
  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 20
  };
  
  // Classes selon la taille
  const badgeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };
  
  // Si HDS n'est pas activé, afficher un badge d'avertissement
  if (!isEnabled) {
    return (
      <div 
        className={`inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 ${badgeClasses[size]} ${className}`}
        title="Mode HDS non activé"
      >
        <AlertTriangle size={iconSizes[size]} className="mr-1" />
        <span>HDS Inactif</span>
      </div>
    );
  }
  
  // Badge simple sans détails
  if (!showDetails) {
    return (
      <div 
        className={`inline-flex items-center rounded-full bg-green-100 text-green-800 ${badgeClasses[size]} ${className}`}
        title="Hébergement de Données de Santé conforme"
      >
        <Shield size={iconSizes[size]} className="mr-1" />
        <span>HDS</span>
      </div>
    );
  }
  
  // Badge avec détails
  return (
    <div className={`inline-flex flex-col ${className}`}>
      <div 
        className={`inline-flex items-center rounded-full bg-green-100 text-green-800 ${badgeClasses[size]}`}
        title="Hébergement de Données de Santé conforme"
      >
        <Shield size={iconSizes[size]} className="mr-1" />
        <span>HDS Conforme</span>
      </div>
      
      {showDetails && (
        <div className="mt-2 text-xs bg-white border border-gray-200 rounded-lg p-2 shadow-sm">
          <div className="font-medium mb-1 text-gray-700">Conformité HDS activée</div>
          <ul className="space-y-1">
            <li className="flex items-center text-gray-600">
              <CheckCircle size={12} className="text-green-500 mr-1" />
              <span>Chiffrement {hdsConfig.encryptionLevel}</span>
            </li>
            <li className="flex items-center text-gray-600">
              <CheckCircle size={12} className="text-green-500 mr-1" />
              <span>Audit {hdsConfig.auditEnabled ? 'activé' : 'désactivé'}</span>
            </li>
            <li className="flex items-center text-gray-600">
              <CheckCircle size={12} className="text-green-500 mr-1" />
              <span>Pseudonymisation {hdsConfig.pseudonymizationEnabled ? 'activée' : 'désactivée'}</span>
            </li>
            <li className="flex items-center text-gray-600">
              <Lock size={12} className="text-green-500 mr-1" />
              <span>Version {hdsConfig.complianceVersion}</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default HDSComplianceBadge;