import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit, User, Mail, Link as LinkIcon, AlertCircle, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '../ui/Button';
import { Substitute } from '../../types/substitute';
import { SubstituteService } from '../../services/substituteService';

interface EditSubstituteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  substitute: Substitute;
  osteopaths: any[];
}

interface EditSubstituteFormData {
  firstName: string;
  lastName: string;
  linkedTo: string;
  isActive: boolean;
}

const EditSubstituteModal: React.FC<EditSubstituteModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  substitute,
  osteopaths
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isValid }, reset } = useForm<EditSubstituteFormData>({
    mode: 'onChange'
  });

  // Initialize form with substitute data
  useEffect(() => {
    if (isOpen && substitute) {
      reset({
        firstName: substitute.firstName,
        lastName: substitute.lastName,
        linkedTo: substitute.linkedTo,
        isActive: substitute.isActive
      });
    }
  }, [isOpen, substitute, reset]);

  const onSubmit = async (data: EditSubstituteFormData) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await SubstituteService.updateSubstitute(substitute.uid, {
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: `${data.firstName} ${data.lastName}`,
        linkedTo: data.linkedTo,
        isActive: data.isActive,
        updatedAt: new Date().toISOString()
      });
      
      setSuccess('Remplaçant modifié avec succès');
      
      // Notifier le parent et fermer après 2 secondes
      setTimeout(() => {
        onSuccess();
      }, 2000);

    } catch (error: any) {
      console.error('Error updating substitute:', error);
      setError(error.message || 'Erreur lors de la modification du remplaçant');
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
                <Edit size={20} className="text-primary-600 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Modifier le remplaçant
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

              {/* Email non modifiable */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <div className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <Mail size={16} className="text-gray-400 mr-2" />
                  <span className="text-gray-700">{substitute.email}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  L'email ne peut pas être modifié
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                      Prénom *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      className={`w-full rounded-lg border ${errors.firstName ? 'border-error' : 'border-gray-300'} focus:ring-primary-500 focus:border-primary-500`}
                      placeholder="Prénom"
                      {...register('firstName', { 
                        required: 'Ce champ est requis',
                        minLength: { value: 2, message: 'Prénom trop court' }
                      })}
                    />
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
                  <label htmlFor="linkedTo" className="block text-sm font-medium text-gray-700 mb-1">
                    Ostéopathe titulaire *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LinkIcon size={16} className="text-gray-400" />
                    </div>
                    <select
                      id="linkedTo"
                      className={`pl-10 w-full rounded-lg border ${errors.linkedTo ? 'border-error' : 'border-gray-300'} focus:ring-primary-500 focus:border-primary-500`}
                      {...register('linkedTo', { required: 'Ce champ est requis' })}
                    >
                      <option value="">Sélectionner un ostéopathe</option>
                      {osteopaths.map(osteopath => (
                        <option key={osteopath.uid} value={osteopath.uid}>
                          {osteopath.firstName} {osteopath.lastName} ({osteopath.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.linkedTo && (
                    <p className="mt-1 text-sm text-error">{errors.linkedTo.message}</p>
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
                    Modifier le remplaçant
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

export default EditSubstituteModal;