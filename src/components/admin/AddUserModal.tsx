import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Eye, EyeOff, Mail, User, Shield, AlertCircle, CheckCircle } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';
import { Button } from '../ui/Button';
import { AuditLogger, AuditEventType, SensitivityLevel } from '../../utils/auditLogger';
import { HDSCompliance } from '../../utils/hdsCompliance';

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddUserModal: React.FC<AddUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'osteopath',
    isActive: true
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = (): boolean => {
    if (!formData.email.trim()) {
      setError('L\'email est requis');
      return false;
    }
    
    if (!formData.password.trim() || formData.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return false;
    }
    
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('Le prénom et le nom sont requis');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      // 1. Créer l'utilisateur dans Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      
      const userId = userCredential.user.uid;
      
      // 2. Créer le profil utilisateur dans Firestore
      const userData = {
        uid: userId,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        displayName: `${formData.firstName} ${formData.lastName}`,
        role: formData.role,
        isActive: formData.isActive,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: 'admin', // Marquer comme créé par admin pour les permissions
        permissions: formData.role === 'admin' 
          ? ['users:read', 'users:write', 'users:delete', 'system:config', 'logs:read', 'analytics:read']
          : ['profile:read', 'profile:write', 'data:read', 'data:write'],
        lastLogin: null
      };
      
      // Préparer les données avec conformité HDS
      const compliantData = HDSCompliance.prepareDataForStorage(
        userData,
        'users',
        auth.currentUser?.uid || 'system'
      );
      
      // Enregistrer dans Firestore
      await setDoc(doc(db, 'users', userId), compliantData);
      
      // Journaliser l'action
      await AuditLogger.log(
        AuditEventType.ADMIN_ACTION,
        'users',
        'create',
        SensitivityLevel.SENSITIVE,
        'success',
        {
          newUserId: userId,
          email: formData.email,
          role: formData.role
        }
      );
      
      setSuccess(`Utilisateur ${formData.email} créé avec succès`);
      
      // Réinitialiser le formulaire
      setFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        role: 'osteopath',
        isActive: true
      });
      
      // Notifier le parent
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
      
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      let errorMessage = 'Erreur lors de la création de l\'utilisateur';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Cet email est déjà utilisé';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Format d\'email invalide';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Le mot de passe est trop faible';
      }
      
      setError(errorMessage);
      
      // Journaliser l'erreur
      await AuditLogger.log(
        AuditEventType.ADMIN_ACTION,
        'users',
        'create',
        SensitivityLevel.SENSITIVE,
        'failure',
        {
          email: formData.email,
          error: error.message
        }
      );
      
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
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
                <UserPlus size={20} className="text-primary-600 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Ajouter un utilisateur
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-error/5 border border-error/20 rounded-lg flex items-center">
                  <AlertCircle size={16} className="text-error mr-2" />
                  <span className="text-error text-sm">{error}</span>
                </div>
              )}
              
              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
                  <CheckCircle size={16} className="text-green-600 mr-2" />
                  <span className="text-green-700 text-sm">{success}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                        Prénom *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User size={16} className="text-gray-400" />
                        </div>
                        <input
                          type="text"
                          id="firstName"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          className="pl-10 w-full rounded-lg border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                          placeholder="Prénom"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                        Nom *
                      </label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="Nom"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail size={16} className="text-gray-400" />
                      </div>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="pl-10 w-full rounded-lg border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                        placeholder="email@exemple.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                      Mot de passe *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 focus:ring-primary-500 focus:border-primary-500 pr-10"
                        placeholder="Mot de passe"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff size={16} className="text-gray-400" />
                        ) : (
                          <Eye size={16} className="text-gray-400" />
                        )}
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Minimum 8 caractères, incluant lettres, chiffres et caractères spéciaux
                    </p>
                  </div>

                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                      Rôle
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Shield size={16} className="text-gray-400" />
                      </div>
                      <select
                        id="role"
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        className="pl-10 w-full rounded-lg border border-gray-300 focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="osteopath">Ostéopathe</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                      Compte actif
                    </label>
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    isLoading={isSubmitting}
                    loadingText="Création en cours..."
                    leftIcon={<UserPlus size={16} />}
                  >
                    Créer l'utilisateur
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddUserModal;