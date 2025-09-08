import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/adminAuth';
import LoadingScreen from '../ui/LoadingScreen';

interface AdminGuardProps {
  children: React.ReactNode;
  fallbackPath?: string;
}

const AdminGuard: React.FC<AdminGuardProps> = ({ 
  children, 
  fallbackPath = '/login' 
}) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (loading) return;

      if (!user) {
        console.log('❌ Aucun utilisateur connecté');
        navigate(fallbackPath, { replace: true });
        return;
      }

      if (!isAdmin(user)) {
        console.log('❌ Accès refusé pour:', user.email);
        
        // Déconnexion automatique
        try {
          await signOut(auth);
          alert('Accès réservé à l\'administrateur.');
        } catch (error) {
          console.error('Erreur lors de la déconnexion:', error);
        }
        
        navigate(fallbackPath, { replace: true });
        return;
      }

      console.log('✅ Accès administrateur autorisé pour:', user.email);
      setIsChecking(false);
    };

    checkAdminAccess();
  }, [user, loading, navigate, fallbackPath]);

  if (loading || isChecking) {
    return <LoadingScreen />;
  }

  if (!user || !isAdmin(user)) {
    return null;
  }

  return <>{children}</>;
};

export default AdminGuard;