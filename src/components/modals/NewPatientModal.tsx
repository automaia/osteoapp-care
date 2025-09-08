import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, X as XIcon, User, Calendar, Trash2, CheckCircle, Upload } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { Button } from '../ui/Button';
import { Patient, PatientFormData, TreatmentHistoryEntry } from '../../types';
import { validatePatientData } from '../../utils/validation';
import AutoCapitalizeInput from '../ui/AutoCapitalizeInput';
import AutoCapitalizeTextarea from '../ui/AutoCapitalizeTextarea';
import { patientCache } from '../../utils/patientCache';
import DocumentUploadManager from '../ui/DocumentUploadManager';
import { DocumentMetadata } from '../../utils/documentStorage';
import { saveFormData, getFormData, clearFormData } from '../../utils/sessionPersistence';

interface NewPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface PastAppointment {
  date: string;
  time: string;
  notes: string;
}

const COMMON_PATHOLOGIES = [
  'Lombalgie',
  'Cervicalgie',
  'Dorsalgie',
  'Sciatique',
  'Migraine',
  'Vertiges',
  'Entorse',
  'Tendinite',
  'Arthrose',
  'Scoliose',
  'Stress',
  'Troubles digestifs',
  'Troubles du sommeil'
];

const FORM_ID = 'new_patient_form';

const NewPatientModal: React.FC<NewPatientModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pastAppointments, setPastAppointments] = useState<PastAppointment[]>([]);
  const [treatmentHistory, setTreatmentHistory] = useState<TreatmentHistoryEntry[]>([]);
  const [patientDocuments, setPatientDocuments] = useState<DocumentMetadata[]>([]);

  const { register, handleSubmit, formState: { errors, isValid, isDirty }, reset, watch, setValue, trigger } = useForm<PatientFormData>({
    mode: 'onChange',
    // Remove defaultValues to ensure completely empty form
    // Values will be set explicitly in initializeFormWithEmptyData()
  });

  // Debug form state - remove after fixing
  useEffect(() => {
    console.log('Form Debug State:', {
      isValid,
      isDirty,
      errors: Object.keys(errors),
      errorDetails: errors,
      isSubmitting,
      formValues: watch()
    });
  }, [isValid, isDirty, errors, isSubmitting, watch]);

  // Function to initialize form with empty data
  const initializeFormWithEmptyData = () => {
    console.log('Initializing form with empty data for new patient');
    
    // Initialize with completely empty data for new patient
    const emptyFormData: Partial<PatientFormData> = {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      profession: '',
      gender: '', // Ensure gender starts empty, not pre-selected
      email: '',
      address: '',
      phone: '',
      medicalHistory: '',
      insurance: '',
      insuranceNumber: '',
      notes: '',
      nextAppointment: '',
      nextAppointmentTime: '',
      currentTreatment: '',
      consultationReason: '',
      medicalAntecedents: '',
      osteopathicTreatment: ''
    };

    console.log('Setting empty form values:', emptyFormData);
    
    try {
      Object.entries(emptyFormData).forEach(([key, value]) => {
        setValue(key as any, value);
      });
    } catch (error) {
      console.error('Error setting empty form values:', error);
    }
  };

  // Load saved form data when modal opens
  useEffect(() => {
    if (isOpen) {
      // ALWAYS start with completely empty form for new patient creation
      // Clear any existing form data and initialize with empty values
      clearFormData(FORM_ID);
      initializeFormWithEmptyData();
      
      // Reset all state values to empty
      setSelectedTags([]);
      setPastAppointments([]);
      setTreatmentHistory([]);
      setPatientDocuments([]);
      
      console.log('New patient modal opened - form initialized with empty data');
    }
  }, [isOpen, trigger]);

  // Force validation trigger when form values change
  useEffect(() => {
    if (isOpen) {
      const subscription = watch(() => {
        // Trigger validation on any form change
        setTimeout(() => trigger(), 100);
      });
      return () => subscription.unsubscribe();
    }
  }, [isOpen, watch, trigger]);

  // Save form data periodically
  useEffect(() => {
    if (!isOpen) return;

    const formData = watch();
    
    const saveData = () => {
      saveFormData(FORM_ID, {
        formData,
        selectedTags,
        pastAppointments,
        treatmentHistory
      });
    };

    // Save immediately
    saveData();

    // Set up interval to save periodically
    const intervalId = setInterval(saveData, 10000); // Save every 10 seconds

    return () => {
      clearInterval(intervalId);
      saveData(); // Save on unmount
    };
  }, [isOpen, watch, selectedTags, pastAppointments, treatmentHistory]);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    // Cette fonction est conservée mais n'est plus utilisée
  }, []);

  const handleAddTag = useCallback((tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags(prev => [...prev, tag]);
    }
  }, [selectedTags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(tag => tag !== tagToRemove));
  }, []);

  const handleAddCustomTag = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && customTag.trim()) {
      e.preventDefault();
      handleAddTag(customTag.trim());
      setCustomTag('');
    }
  }, [customTag, handleAddTag]);

  // Fonctions pour gérer l'historique des traitements
  const addTreatmentHistoryEntry = () => {
    setTreatmentHistory([...treatmentHistory, { date: '', treatment: '', provider: '', notes: '' }]);
  };

  const removeTreatmentHistoryEntry = (index: number) => {
    setTreatmentHistory(treatmentHistory.filter((_, i) => i !== index));
  };

  const updateTreatmentHistoryEntry = (index: number, field: keyof TreatmentHistoryEntry, value: string) => {
    const updatedHistory = [...treatmentHistory];
    updatedHistory[index] = { ...updatedHistory[index], [field]: value };
    setTreatmentHistory(updatedHistory);
  };

  const addPastAppointment = () => {
    setPastAppointments([...pastAppointments, { date: '', time: '', notes: '' }]);
  };

  const removePastAppointment = (index: number) => {
    setPastAppointments(pastAppointments.filter((_, i) => i !== index));
  };

  const updatePastAppointment = (index: number, field: keyof PastAppointment, value: string) => {
    const updatedAppointments = [...pastAppointments];
    updatedAppointments[index] = { ...updatedAppointments[index], [field]: value };
    setPastAppointments(updatedAppointments);
  };

  const handleDocumentsUpdate = (documents: DocumentMetadata[]) => {
    setPatientDocuments(documents);
  };

  const handleDocumentError = (error: string) => {
    setError(error);
  };

  const onSubmit = async (data: any) => {
    console.log('Starting patient creation...', { data });
    
    if (!auth.currentUser) {
      setError('Vous devez être connecté pour créer un patient');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setProgress(20);

    try {
      const patientId = crypto.randomUUID();
      
      // Format past appointments
      const formattedPastAppointments = pastAppointments
        .filter(app => app.date && app.time) // Only include appointments with date and time
        .map(app => ({
          date: `${app.date}T${app.time}:00`,
          notes: app.notes,
          isHistorical: true
        }));

      // Extract address components from the full address
      const addressParts = data.address.split(',').map(part => part.trim());
      const street = data.address;
      
      const patientData: Record<string, any> = {
        id: patientId,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        profession: data.profession || '',
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        email: data.email || '',
        phone: data.phone || '',
        address: {
          street: street,
          city: '',
          state: '',
          zipCode: '',
          country: 'France'
        },
        insurance: data.insurance || '',
        insuranceNumber: data.insuranceNumber || '',
        medicalHistory: data.medicalHistory || '',
        notes: data.notes || '',
        pathologies: selectedTags,
        nextAppointment: data.nextAppointment && data.nextAppointmentTime 
          ? `${data.nextAppointment}T${data.nextAppointmentTime}:00`
          : null,
        pastAppointments: formattedPastAppointments,
        currentTreatment: data.currentTreatment || '',
        consultationReason: data.consultationReason || '',
        osteopathicTreatment: data.osteopathicTreatment || '',
        medicalAntecedents: data.medicalAntecedents || '',
        
        // Ensure this is NOT test data - explicitly set to false
        isTestData: false,
        osteopathId: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Only add treatmentHistory if it has entries to avoid undefined
      if (treatmentHistory.length > 0) {
        patientData.treatmentHistory = treatmentHistory;
      }

      // Ajouter les documents si présents
      if (patientDocuments.length > 0) {
        patientData.documents = patientDocuments;
      }

      setProgress(60);

      console.log('About to save patient to Firestore:', patientId, patientData);

      // Save to Firestore
      await setDoc(doc(db, 'patients', patientId), patientData);
      
      console.log('Patient successfully saved to Firestore');
      
      setProgress(80);

      // Update cache
      patientCache.set(patientId, patientData as Patient);

      setProgress(100);

      // Afficher le message de succès
      setSuccess('Le dossier patient a été créé avec succès');
      
      // Clear saved form data
      clearFormData(FORM_ID);
      
      console.log('Patient created with ID:', patientId, 'Data:', patientData);
      
      // Wait for Firestore to commit and then refresh the list
      setTimeout(() => {
        // Reset form
        reset();
        setSelectedTags([]);
        setPastAppointments([]);
        setTreatmentHistory([]);
        setPatientDocuments([]);
        
        console.log('Calling onSuccess to refresh patient list...');
        onSuccess();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Error creating new patient:', error);
      setError('Erreur lors de la création du nouveau dossier patient: ' + error.message);
    } finally {
      setIsSubmitting(false);
      setProgress(0);
    }
  };

  // Clear form data when modal closes
  const handleClose = () => {
    // Clear any saved form data when closing
    try {
      clearFormData(FORM_ID);
      console.log('Cleared form data on modal close');
    } catch (error) {
      console.error('Error clearing form data:', error);
    }
    
    // Reset all form state
    reset();
    setSelectedTags([]);
    setPastAppointments([]);
    setTreatmentHistory([]);
    setPatientDocuments([]);
    setError(null);
    setSuccess(null);
    
    console.log('New patient modal closed - all data cleared');
    
    // Close the modal
    onClose();
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
            className="relative w-[calc(100%-2rem)] md:w-[800px] max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Nouveau dossier patient</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {error && (
                <div className="mb-4 p-3 bg-error/5 border border-error/20 rounded-lg text-error text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center">
                  <CheckCircle size={20} className="text-green-500 mr-2" />
                  <span className="text-green-700">{success}</span>
                </div>
              )}


              {isSubmitting && progress > 0 && (
                <div className="mb-4">
                  <div className="h-2 bg-gray-200 rounded-full">
                    <div
                      className="h-2 bg-primary-500 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    {progress === 100 ? 'Terminé' : 'Création en cours...'}
                  </p>
                </div>
              )}

              <form id="newPatientForm" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                      Prénom *
                    </label>
                    <AutoCapitalizeInput
                      type="text"
                      id="firstName"
                      className={`input w-full ${errors.firstName ? 'border-error focus:border-error focus:ring-error' : ''}`}
                      {...register('firstName', { 
                        required: 'Ce champ est requis',
                        minLength: { value: 1, message: 'Le prénom est requis' },
                        validate: value => value?.trim().length > 0 || 'Le prénom ne peut pas être vide'
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
                    <AutoCapitalizeInput
                      type="text"
                      id="lastName"
                      className={`input w-full ${errors.lastName ? 'border-error focus:border-error focus:ring-error' : ''}`}
                      {...register('lastName', { 
                        required: 'Ce champ est requis',
                        minLength: { value: 1, message: 'Le nom est requis' },
                        validate: value => value?.trim().length > 0 || 'Le nom ne peut pas être vide'
                      })}
                    />
                    {errors.lastName && (
                      <p className="mt-1 text-sm text-error">{errors.lastName.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
                      Date de naissance *
                    </label>
                    <input
                      type="date"
                      id="dateOfBirth"
                      className={`input w-full ${errors.dateOfBirth ? 'border-error focus:border-error focus:ring-error' : ''}`}
                      {...register('dateOfBirth', { 
                        required: 'Ce champ est requis',
                        validate: value => {
                          if (!value) return 'La date de naissance est requise';
                          const date = new Date(value);
                          const today = new Date();
                          if (date > today) return 'La date de naissance ne peut pas être dans le futur';
                          return true;
                        }
                      })}
                    />
                    {errors.dateOfBirth && (
                      <p className="mt-1 text-sm text-error">{errors.dateOfBirth.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
                      Sexe
                    </label>
                    <select
                      id="gender"
                      className={`input w-full ${errors.gender ? 'border-error focus:border-error focus:ring-error' : ''}`}
                      {...register('gender')}
                      defaultValue="" // Ensure no default selection
                    >
                      <option value="">Sélectionner</option>
                      <option value="male">Homme</option>
                      <option value="female">Femme</option>
                      <option value="other">Autre</option>
                    </select>
                    {errors.gender && (
                      <p className="mt-1 text-sm text-error">{errors.gender.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="profession" className="block text-sm font-medium text-gray-700 mb-1">
                      Profession
                    </label>
                    <AutoCapitalizeInput
                      type="text"
                      id="profession"
                      className="input w-full"
                      {...register('profession')}
                      placeholder="Ex: Enseignant, Ingénieur, Retraité..."
                    />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                      Téléphone
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      className={`input w-full ${errors.phone ? 'border-error focus:border-error focus:ring-error' : ''}`}
                      {...register('phone', { 
                        pattern: {
                          value: /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/,
                          message: 'Numéro de téléphone invalide'
                        }
                      })}
                      placeholder="06 12 34 56 78"
                    />
                    {errors.phone && (
                      <p className="mt-1 text-sm text-error">{errors.phone.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse email
                  </label>
                  <input
                    type="email"
                    id="email"
                    className={`input w-full ${errors.email ? 'border-error focus:border-error focus:ring-error' : ''}`}
                    {...register('email', { 
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'Format d\'email invalide'
                      }
                    })}
                    placeholder="exemple@email.com"
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-error">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse postale complète
                  </label>
                  <AutoCapitalizeTextarea
                    id="address"
                    rows={3}
                    className={`input w-full resize-none ${errors.address ? 'border-error focus:border-error focus:ring-error' : ''}`}
                    {...register('address')}
                    placeholder="123 rue des Fleurs, 75001 Paris"
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-error">{errors.address.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Format : numéro, rue, code postal, ville
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="insurance" className="block text-sm font-medium text-gray-700 mb-1">
                      Mutuelle
                    </label>
                    <input
                      type="text"
                      id="insurance"
                      className="input w-full"
                      {...register('insurance')}
                    />
                  </div>

                  <div>
                    <label htmlFor="insuranceNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      Numéro d'assuré
                    </label>
                    <input
                      type="text"
                      id="insuranceNumber"
                      className="input w-full"
                      {...register('insuranceNumber')}
                    />
                  </div>
                </div>

                {/* Nouveaux champs */}
                <div>
                  <label htmlFor="consultationReason" className="block text-sm font-medium text-gray-700 mb-1">
                    Motif de consultation
                  </label>
                  <AutoCapitalizeTextarea
                    id="consultationReason"
                    rows={3}
                    className="input w-full resize-none"
                    {...register('consultationReason')}
                    placeholder="Raison principale de la consultation"
                  />
                </div>

                <div>
                  <label htmlFor="currentTreatment" className="block text-sm font-medium text-gray-700 mb-1">
                    Traitement actuel
                  </label>
                  <AutoCapitalizeTextarea
                    id="currentTreatment"
                    rows={3}
                    className="input w-full resize-none"
                    {...register('currentTreatment')}
                    placeholder="Traitements médicamenteux ou autres thérapies en cours"
                  />
                </div>

                <div>
                  <label htmlFor="medicalAntecedents" className="block text-sm font-medium text-gray-700 mb-1">
                    Antécédents médicaux
                  </label>
                  <AutoCapitalizeTextarea
                    id="medicalAntecedents"
                    rows={4}
                    className="input w-full resize-none"
                    {...register('medicalAntecedents')}
                    placeholder="Antécédents médicaux significatifs, chirurgies, etc."
                  />
                </div>

                <div>
                  <label htmlFor="medicalHistory" className="block text-sm font-medium text-gray-700 mb-1">
                    Historique médical général
                  </label>
                  <AutoCapitalizeTextarea
                    id="medicalHistory"
                    rows={4}
                    className="input w-full resize-none"
                    {...register('medicalHistory')}
                  />
                </div>

                {/* Documents médicaux */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Documents médicaux</h3>
                  <DocumentUploadManager
                    patientId="temp"
                    onUploadSuccess={handleDocumentsUpdate}
                    onUploadError={handleDocumentError}
                    disabled={isSubmitting}
                  />
                </div>

                {/* Historique des traitements */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Historique des traitements
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addTreatmentHistoryEntry}
                      leftIcon={<Plus size={16} />}
                    >
                      Ajouter un traitement
                    </Button>
                  </div>

                  {treatmentHistory.length > 0 ? (
                    <div className="space-y-4">
                      {treatmentHistory.map((entry, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 relative">
                          <button
                            type="button"
                            onClick={() => removeTreatmentHistoryEntry(index)}
                            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                          >
                            <Trash2 size={16} />
                          </button>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date
                              </label>
                              <input
                                type="date"
                                value={entry.date}
                                onChange={(e) => updateTreatmentHistoryEntry(index, 'date', e.target.value)}
                                className="input w-full"
                                max={new Date().toISOString().split('T')[0]}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Prestataire
                              </label>
                              <input
                                type="text"
                                value={entry.provider || ''}
                                onChange={(e) => updateTreatmentHistoryEntry(index, 'provider', e.target.value)}
                                className="input w-full"
                                placeholder="Nom du praticien ou établissement"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Traitement
                            </label>
                            <textarea
                              value={entry.treatment}
                              onChange={(e) => updateTreatmentHistoryEntry(index, 'treatment', e.target.value)}
                              className="input w-full resize-none"
                              rows={2}
                              placeholder="Description du traitement"
                            />
                          </div>
                          <div className="mt-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Notes
                            </label>
                            <textarea
                              value={entry.notes || ''}
                              onChange={(e) => updateTreatmentHistoryEntry(index, 'notes', e.target.value)}
                              className="input w-full resize-none"
                              rows={2}
                              placeholder="Notes complémentaires"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      Aucun historique de traitement enregistré
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Symptômes / Syndromes
                  </label>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-50 text-primary-700"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-2 text-primary-600 hover:text-primary-800"
                          >
                            <XIcon size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customTag}
                        onChange={(e) => setCustomTag(e.target.value)}
                        onKeyDown={handleAddCustomTag}
                        placeholder="Ajouter des symptômes / syndromes personnalisés"
                        className="input flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (customTag.trim()) {
                            handleAddTag(customTag.trim());
                            setCustomTag('');
                          }
                        }}
                      >
                        <Plus size={16} />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_PATHOLOGIES.map((pathology) => (
                        <button
                          key={pathology}
                          type="button"
                          onClick={() => handleAddTag(pathology)}
                          className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                            selectedTags.includes(pathology)
                              ? 'bg-primary-50 border-primary-200 text-primary-700'
                              : 'border-gray-200 hover:border-primary-200 hover:bg-primary-50'
                          }`}
                        >
                          {pathology}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Note sur le patient
                  </label>
                  <AutoCapitalizeTextarea
                    id="notes"
                    rows={4}
                    className="input w-full resize-none"
                    {...register('notes')}
                  />
                </div>

                <div>
                  <label htmlFor="osteopathicTreatment" className="block text-sm font-medium text-gray-700 mb-1">
                    Traitement ostéopathique
                  </label>
                  <AutoCapitalizeTextarea
                    id="osteopathicTreatment"
                    rows={4}
                    className="input w-full resize-none"
                    {...register('osteopathicTreatment')}
                    placeholder="Description du traitement ostéopathique effectué ou à effectuer"
                  />
                </div>

                {/* Rendez-vous passés */}
                <div className="border-t pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Rendez-vous passés
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPastAppointment}
                      leftIcon={<Plus size={16} />}
                    >
                      Ajouter un rendez-vous passé
                    </Button>
                  </div>

                  {pastAppointments.length > 0 ? (
                    <div className="space-y-4">
                      {pastAppointments.map((appointment, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 relative">
                          <button
                            type="button"
                            onClick={() => removePastAppointment(index)}
                            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                          >
                            <Trash2 size={16} />
                          </button>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Date
                              </label>
                              <input
                                type="date"
                                value={appointment.date}
                                onChange={(e) => updatePastAppointment(index, 'date', e.target.value)}
                                className="input w-full"
                                max={new Date().toISOString().split('T')[0]}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Heure
                              </label>
                              <input
                                type="time"
                                value={appointment.time}
                                onChange={(e) => updatePastAppointment(index, 'time', e.target.value)}
                                className="input w-full"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Notes
                            </label>
                            <textarea
                              value={appointment.notes}
                              onChange={(e) => updatePastAppointment(index, 'notes', e.target.value)}
                              className="input w-full resize-none"
                              rows={2}
                              placeholder="Motif du rendez-vous, traitement effectué..."
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      Aucun rendez-vous passé enregistré
                    </p>
                  )}
                </div>

                {/* Prochain rendez-vous */}
                <div>
                  <label htmlFor="nextAppointment" className="block text-sm font-medium text-gray-700 mb-1">
                    Prochaine consultation
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        type="date"
                        id="nextAppointment"
                        className={`input w-full ${errors.nextAppointment ? 'border-error focus:border-error focus:ring-error' : ''}`}
                        {...register('nextAppointment', {
                          validate: value => {
                            if (!value) return true;
                            const date = new Date(value);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            return date >= today || 'La date doit être égale ou supérieure à aujourd\'hui';
                          }
                        })}
                        min={new Date().toISOString().split('T')[0]}
                      />
                      {errors.nextAppointment && (
                        <p className="mt-1 text-sm text-error">{errors.nextAppointment.message}</p>
                      )}
                    </div>
                    <div>
                      <input
                        type="time"
                        id="nextAppointmentTime"
                        className={`input w-full ${errors.nextAppointmentTime ? 'border-error focus:border-error focus:ring-error' : ''}`}
                        {...register('nextAppointmentTime', {
                          validate: value => {
                            if (!watch('nextAppointment')) return true;
                            if (!value) return 'L\'heure est requise si une date est sélectionnée';
                            const [hours] = value.split(':').map(Number);
                            if (hours < 8 || hours >= 18) return 'Les consultations sont possibles entre 8h et 18h';
                            return true;
                          }
                        })}
                        min="08:00"
                        max="18:00"
                        step="3600"
                      />
                      {errors.nextAppointmentTime && (
                        <p className="mt-1 text-sm text-error">{errors.nextAppointmentTime.message}</p>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Note: Une première consultation sera automatiquement créée lors de l'ajout du patient
                  </p>
                </div>
              </form>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <Button
                variant="outline"
                onClick={handleClose}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                form="newPatientForm"
                variant="primary"
                isLoading={isSubmitting}
                loadingText="Création en cours..."
                disabled={!isValid || isSubmitting}
              >
                Créer le dossier
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default NewPatientModal;