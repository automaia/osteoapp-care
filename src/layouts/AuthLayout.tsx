import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Star, Shield } from 'lucide-react';
import HDSComplianceBadge from '../components/ui/HDSComplianceBadge';

const AuthLayout: React.FC = () => {
  const { user } = useAuth();

  // Redirect if user is already logged in
  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left sidebar with animated gradient background - hidden on small screens */}
      <div className="hidden md:flex md:w-1/2 animated-gradient-bg text-white flex-col justify-center items-center p-6 md:p-10 relative overflow-hidden">
        {/* Beta Badge */}
        <div className="absolute top-6 right-6">
          <div className="bg-white/20 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium flex items-center">
            <Star size={14} className="mr-1" />
            BETA
          </div>
        </div>

        <div className="max-w-md relative z-10">
          <div className="flex items-center space-x-2 mb-8">
            <img src="/Icon-logo-osteoapp-blanc.png" alt="OsteoApp Logo" width={40} height={40} />
            <h1 className="text-3xl font-bold">OsteoApp</h1>
          </div>
          
          <h2 className="text-xl md:text-2xl font-semibold mb-4">
            Gérez votre cabinet d'osteopathie en toute simplicité
          </h2>
          
          <p className="text-base md:text-lg opacity-90 mb-10">
            Une solution complète et intuitive pour les osteopathes qui souhaitent se concentrer sur leurs patients.
          </p>
          
          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white bg-opacity-10 p-4 rounded-xl backdrop-blur-sm">
              <h3 className="font-semibold text-lg md:text-xl mb-2">Gestion patients</h3>
              <p className="opacity-80 text-sm md:text-base">Dossiers médicaux complets et accessibles</p>
            </div>
            <div className="bg-white bg-opacity-10 p-4 rounded-xl backdrop-blur-sm">
              <h3 className="font-semibold text-lg md:text-xl mb-2">Agenda intégré</h3>
              <p className="opacity-80 text-sm md:text-base">Planifiez et suivez vos rendez-vous</p>
            </div>
            <div className="bg-white bg-opacity-10 p-4 rounded-xl backdrop-blur-sm">
              <h3 className="font-semibold text-lg md:text-xl mb-2">Facturation</h3>
              <p className="opacity-80 text-sm md:text-base">Factures professionnelles en quelques clics</p>
            </div>
            <div className="bg-white bg-opacity-10 p-4 rounded-xl backdrop-blur-sm">
              <h3 className="font-semibold text-lg md:text-xl mb-2">Statistiques</h3>
              <p className="opacity-80 text-sm md:text-base">Suivez l'évolution de votre activité</p>
            </div>
          </div>
          
          {/* HDS Badge */}
          <div className="mt-8 flex justify-center">
            <div className="bg-white/20 backdrop-blur-sm text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center">
              <Shield size={16} className="mr-2" />
              Conforme Hébergement de Données de Santé (HDS)
            </div>
          </div>
        </div>

        {/* Background decoration with subtle animation */}
        <div className="absolute inset-0 opacity-10">
          <div className="floating-element-1 absolute top-20 left-20 w-32 h-32 bg-white rounded-full"></div>
          <div className="floating-element-2 absolute bottom-20 right-20 w-24 h-24 bg-white rounded-full"></div>
          <div className="floating-element-3 absolute top-1/2 left-10 w-16 h-16 bg-white rounded-full"></div>
        </div>
      </div>

      {/* Right side with auth forms */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-6 lg:p-10 bg-gray-50 relative">
        <div className="w-full max-w-md">
          <div className="md:hidden flex items-center justify-center mb-8">
            <img src="/Icon-logo-osteoapp-bleu.png" alt="OsteoApp Logo" width={32} height={32} className="mr-2" />
            <h1 className="text-2xl font-bold text-primary-500 ml-2">OsteoApp</h1>
            <div className="ml-2 bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center">
              <Star size={10} className="mr-1" />
              BETA
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
            <Outlet />
          </div>
          
          {/* HDS Compliance Badge */}
          <div className="mt-4 flex justify-center">
            <HDSComplianceBadge size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;