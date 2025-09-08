import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingScreen from '../ui/LoadingScreen';
import { saveNavigationState } from '../../utils/sessionPersistence';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  adminOnly?: boolean;
  fallbackPath?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermissions = [],
  adminOnly = false,
  fallbackPath = '/login'
}) => {
  const { user, isAuthenticated, loading, hasPermission, isAdmin } = useAuth();
  const location = useLocation();

  // Save navigation state on route change
  useEffect(() => {
    if (isAuthenticated && !loading) {
      saveNavigationState();
    }
  }, [location.pathname, isAuthenticated, loading]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated || !user) {
    // Save the current location for redirect after login
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  // Vérifier si l'utilisateur est actif
  if (!user.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Compte désactivé
          </h2>
          <p className="text-gray-600 mb-4">
            Votre compte a été temporairement désactivé. 
            Veuillez contacter l'administrateur.
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="btn btn-primary"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  // Vérifier que l'utilisateur a un rôle autorisé pour accéder aux données
  const authorizedRoles = ['admin', 'osteopath', 'substitute'];
  if (!authorizedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Vérifier l'accès admin si requis
  if (adminOnly && !isAdmin()) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Vérifier les permissions requises
  if (requiredPermissions.length > 0) {
    const hasAllPermissions = requiredPermissions.every(permission => 
      hasPermission(permission)
    );
    
    if (!hasAllPermissions) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;