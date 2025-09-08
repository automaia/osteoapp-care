import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeft, Home } from 'lucide-react';
import { Button } from '../components/ui/Button';

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 p-4 rounded-full">
            <Shield size={32} className="text-red-600" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Accès non autorisé
        </h1>
        
        <p className="text-gray-600 mb-6">
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
        </p>
        
        <div className="space-y-3">
          <Button
            variant="primary"
            fullWidth
            onClick={() => navigate('/')}
            leftIcon={<Home size={16} />}
          >
            Retour à l'accueil
          </Button>
          
          <Button
            variant="outline"
            fullWidth
            onClick={() => navigate(-1)}
            leftIcon={<ArrowLeft size={16} />}
          >
            Page précédente
          </Button>
        </div>
        
        <p className="text-xs text-gray-500 mt-6">
          Si vous pensez qu'il s'agit d'une erreur, contactez l'administrateur.
        </p>
      </div>
    </div>
  );
};

export default Unauthorized;