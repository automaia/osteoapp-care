import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit, User as UserIcon, Mail, Shield, AlertCircle, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { Button } from '../ui/Button';
import { User } from '../../types/auth';
import { AuditLogger, AuditEventType, SensitivityLevel } from '../../utils/auditLogger';
import { authService } from '../../services/authService';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: User;
}

interface EditUserFormData {
  firstName: string;
  lastName: string;
  role: 'admin' | 'osteopath' | 'substitute' | 'user';
  isActive: boolean;
}

const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  user
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isValid }, reset, watch } = useForm<EditUserFormData>({
    mode: 'onChange'
  });

  const watchedRole = watch('role');

  // Initialize form with user data
  useEffect(() => {
    if (isOpen && user) {
      reset({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role,
        isActive: user.isActive
      });
    }
  }, [isOpen, user, reset]);

  // Get default permissions for a role
  const getDefaultPermissions = (role: string): string[] => {
    switch (role) {
      case 'admin':
        return [
          'users:read',
          'users:write',
          'users:delete',
          'system:config',
          'logs:read',
          'analytics:read'
        ];
      case 'osteopath':
        return [
          'profile:read',
          'profile:write',
          'data:read',
          'data:write',
          'patients:read',
          'patients:write',
          'consultations:read',
          'consultations:write',
          'invoices:read',
          'invoices:write'
        ];
      case 'substitute':
        return [
          'profile:read',
          'profile:write',
          'data:read',
          'data:write',
          'substitute:access'
        ];
      case 'user':
        return [
          'profile:read',
          'profile:write',
          'data:read',
          'data:write'
        ];
      default:
        return [];
    }
  };

  const onSubmit = async (data: EditUserFormData) => {
    if (!auth.currentUser) {
      setError('Vous devez être connecté pour modifier un utilisateur');
      return;
    }

    // Prevent admin from changing their own role to non-admin
    if (user.uid === auth.currentUser.uid && data.role !== 'admin') {
      setError('Vous ne pouvez pas modifier votre propre rôle d\'administrateur');
      return;
    }

    // Prevent admin from deactivating themselves
    if (user.uid === auth.currentUser.uid && !data.isActive) {
      setError('Vous ne pouvez pas désactiver votre propre compte');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const userRef = doc(db, 'users', user.uid);
      
      // Prepare update data
      const updateData: any = {
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: `${data.firstName} ${data.lastName}`,
        role: data.role,
        isActive: data.isActive,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser.uid
      };

      // Update permissions if role changed
      if (data.role !== user.role) {
        updateData.permissions = getDefaultPermissions(data.role);
      }

      // Update user document
      await updateDoc(userRef, updateData);

      // Log the action
      await AuditLogger.log(
        AuditEventType.ADMIN_ACTION,
        'users',
        'update',
        SensitivityLevel.SENSITIVE,
        'success',
        {
          userId: user.uid,
          email: user.email,
          oldRole: user.role,
          newRole: data.role,
          changes: Object.keys(data)
        }
      );

      setSuccess('Utilisateur modifié avec succès');

      // Close modal after 2 seconds
      setTimeout(() => {
        onSuccess();
      }, 2000);

    } catch (error: any) {
      console.error('Error updating user:', error);
      setError(error.message || 'Erreur lors de la modification de l\'utilisateur');

      // Log the error
      await AuditLogger.log(
        AuditEventType.ADMIN_ACTION,
        'users',
        'update',
        SensitivityLevel.SENSITIVE,
        'failure',
        {
          userId: user.uid,
          error: error.message
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrateur';
      case 'osteopath':
        return 'Ostéopathe';
      case 'substitute':
        return 'Remplaçant';
      case 'user':
        return 'Utilisateur';
      default:
        return role;
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
                <Edit size={20} className="text-primary-600 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Modifier l'utilisateur
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

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                      Prénom *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <UserIcon size={16} className="text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="firstName"
                        className={`pl-10 w-full rounded-lg border ${errors.firstName ? 'border-error' : 'border-gray-300'} focus:ring-primary-500 focus:border-primary-500`}
                        placeholder="Prénom"
                        {...register('firstName', { 
                          required: 'Ce champ est requis',
                          minLength: { value: 2, message: 'Prénom trop court' }
                        })}
                      />
                    </div>
                    {errors.firstName && (
                      <p className="mt-1 text-sm text-error">{errors.firstName.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                      Nom *
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      className={`w-full rounded-lg border ${errors.lastName ? 'border-error' : 'border-gray-300'} focus:ring-primary-500 focus:border-primary-500`}
                      placeholder="Nom"
                      {...register('lastName', { 
                        required: 'Ce champ est requis',
                        minLength: { value: 2, message: 'Nom trop court' }
                      })}
                    />
                    {errors.lastName && (
                      <p className="mt-1 text-sm text-error">{errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail size={16} className="text-gray-400" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      value={user.email}
                      className="pl-10 w-full rounded-lg border border-gray-300 bg-gray-50 text-gray-500"
                      disabled
                      readOnly
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    L'email ne peut pas être modifié
                  </p>
                </div>

                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                    Rôle *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Shield size={16} className="text-gray-400" />
                    </div>
                    <select
                      id="role"
                      className={`pl-10 w-full rounded-lg border ${errors.role ? 'border-error' : 'border-gray-300'} focus:ring-primary-500 focus:border-primary-500`}
                      {...register('role', { required: 'Ce champ est requis' })}
                    >
                      <option value="user">Utilisateur</option>
                      <option value="osteopath">Ostéopathe</option>
                      <option value="substitute">Remplaçant</option>
                      <option value="admin">Administrateur</option>
                    </select>
                  </div>
                  {errors.role && (
                    <p className="mt-1 text-sm text-error">{errors.role.message}</p>
                  )}
                  {watchedRole && (
                    <p className="mt-1 text-xs text-gray-500">
                      Rôle sélectionné : {getRoleText(watchedRole)}
                    </p>
                  )}
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    {...register('isActive')}
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">
                    Compte actif
                  </label>
                </div>

                {/* Warning for role changes */}
                {watchedRole && watchedRole !== user.role && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle size={16} className="text-yellow-600 mt-0.5 mr-2" />
                      <div className="text-sm text-yellow-800">
                        <p className="font-medium">Changement de rôle détecté</p>
                        <p>
                          L'utilisateur passera de "{getRoleText(user.role)}" à "{getRoleText(watchedRole)}".
                          Les permissions seront automatiquement mises à jour.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    isLoading={isSubmitting}
                    loadingText="Modification en cours..."
                    disabled={!isValid || isSubmitting}
                    leftIcon={<Edit size={16} />}
                  >
                    Modifier l'utilisateur
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

export default EditUserModal;