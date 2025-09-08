import React from 'react';
import { Shield, Info } from 'lucide-react';

interface RealDataIndicatorProps {
  count: number;
  type: 'patients' | 'appointments' | 'invoices' | 'consultations';
  className?: string;
  showZeroState?: boolean;
}

const RealDataIndicator: React.FC<RealDataIndicatorProps> = ({
  count,
  type,
  className = '',
  showZeroState = true
}) => {
  // Si le compteur est à zéro et qu'on ne veut pas afficher l'état zéro
  if (count === 0 && !showZeroState) {
    return null;
  }
  
  // Labels selon le type
  const getTypeLabel = () => {
    switch (type) {
      case 'patients':
        return 'patients réels';
      case 'appointments':
        return 'rendez-vous réels';
      case 'invoices':
        return 'factures réelles';
      case 'consultations':
        return 'consultations réelles';
      default:
        return 'données réelles';
    }
  };
  
  return (
    <div className={`inline-flex items-center ${className}`}>
      {count > 0 ? (
        <div className="flex items-center bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
          <Shield size={12} className="mr-1" />
          <span>{count} {getTypeLabel()}</span>
        </div>
      ) : (
        <div className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
          <Info size={12} className="mr-1" />
          <span>Aucune donnée réelle</span>
        </div>
      )}
    </div>
  );
};

export default RealDataIndicator;