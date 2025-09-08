import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { isAdmin } from '../../utils/adminAuth';
import AdminLoginModal from './AdminLoginModal';

const AdminLoginButton: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLoginSuccess = () => {
    console.log('✅ Redirection vers l\'admin dashboard');
    navigate('/admin');
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut(auth);
      console.log('✅ Déconnexion administrateur réussie');
      navigate('/login');
    } catch (error) {
      console.error('❌ Erreur lors de la déconnexion:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Si l'utilisateur est connecté et est admin, afficher le bouton de déconnexion
  if (user && isAdmin(user)) {
    return (
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="fixed top-4 right-4 z-40 flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Déconnexion administrateur"
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">
          {isLoggingOut ? 'Déconnexion...' : 'Déconnexion'}
        </span>
      </button>
    );
  }

  // Si aucun utilisateur connecté, afficher le bouton de connexion
  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 transition-colors"
        title="Connexion administrateur"
      >
        <Shield size={16} />
        <span>Admin</span>
      </button>

      <AdminLoginModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleLoginSuccess}
      />
    </>
  );
};

export default AdminLoginButton;