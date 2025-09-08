import React, { useState } from 'react';
import { AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import { Button } from './Button';
import { HDSCompliance } from '../../utils/hdsCompliance';

interface HDSErrorHandlerProps {
  collectionName: string;
  documentId: string;
  fieldName: string;
  errorMessage: string;
  onRepairAttempt?: (success: boolean) => void;
}

/**
 * Composant pour gérer et afficher les erreurs de déchiffrement HDS
 */
const HDSErrorHandler: React.FC<HDSErrorHandlerProps> = ({
  collectionName,
  documentId,
  fieldName,
  errorMessage,
  onRepairAttempt
}) => {
  const [isRepairing, setIsRepairing] = useState(false);
  const [repairResult, setRepairResult] = useState<'success' | 'failure' | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleRepairAttempt = async () => {
    setIsRepairing(true);
    setRepairResult(null);
    
    try {
      const success = await HDSCompliance.repairCorruptedData(collectionName, documentId);
      
      setRepairResult(success ? 'success' : 'failure');
      if (onRepairAttempt) {
        onRepairAttempt(success);
      }
    } catch (error) {
      console.error('Error attempting repair:', error);
      setRepairResult('failure');
      if (onRepairAttempt) {
        onRepairAttempt(false);
      }
    } finally {
      setIsRepairing(false);
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <Shield className="h-5 w-5 text-yellow-400" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Problème de déchiffrement détecté
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              Les données du champ <strong>{fieldName}</strong> n'ont pas pu être déchiffrées correctement.
            </p>
            
            {showDetails && (
              <div className="mt-2 p-2 bg-yellow-100 rounded text-xs font-mono overflow-x-auto">
                {errorMessage}
              </div>
            )}
          </div>
          
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Masquer les détails' : 'Afficher les détails'}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRepairAttempt}
              isLoading={isRepairing}
              loadingText="Tentative de réparation..."
              leftIcon={isRepairing ? undefined : <RefreshCw size={14} />}
              disabled={isRepairing}
            >
              Tenter une réparation
            </Button>
          </div>
          
          {repairResult === 'success' && (
            <div className="mt-2 text-sm text-green-600">
              Réparation réussie. Veuillez actualiser la page.
            </div>
          )}
          
          {repairResult === 'failure' && (
            <div className="mt-2 text-sm text-red-600">
              La réparation a échoué. Veuillez contacter le support technique.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HDSErrorHandler;