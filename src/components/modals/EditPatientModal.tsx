import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, X as XIcon, Trash2, CheckCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { Button } from '../ui/Button';
import AutoCapitalizeInput from '../ui/AutoCapitalizeInput';
import AutoCapitalizeTextarea from '../ui/AutoCapitalizeTextarea';
import { Patient, PatientFormData, TreatmentHistoryEntry } from '../../types';
import DocumentUploadManager from '../ui/DocumentUploadManager';
import { DocumentMetadata } from '../../utils/documentStorage';
import { saveFormData, getFormData, clearFormData } from '../../utils/sessionPersistence';

interface EditPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  patient: Patient;
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

const EditPatientModal: React.FC<EditPatientModalProps> = ({ isOpen, onClose, onSuccess, patient }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(patient.tags || []);
  const [customTag, setCustomTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [treatmentHistory, setTreatmentHistory] = useState<TreatmentHistoryEntry[]>(
    patient.treatmentHistory || []
  );
  const [patientDocuments, setPatientDocuments] = useState<DocumentMetadata[]>(
    patient.documents || []
  );
  const formId = `edit_patient_${patient.id}`;

  const handleAddTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags(prev => [...prev, tag]);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleAddCustomTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && customTag.trim()) {
      e.preventDefault();
      handleAddTag(customTag.trim());
      setCustomTag('');
    }
  };

  const { register, handleSubmit, formState: { errors, isValid }, reset, trigger, watch, setValue } = useForm({
    mode: 'onChange',
    defaultValues: {
      firstName: patient.firstName || '',
      lastName: patient.lastName || '',
      dateOfBirth: patient.dateOfBirth || '',
      profession: patient.profession || '',
      gender: patient.gender || '',
      email: patient.email || '',
      address: patient.address?.street || '',
      phone: patient.phone || '',
      medicalHistory: patient.medicalHistory || '',
      insurance: patient.insurance?.provider || '',
      insuranceNumber: patient.insurance?.policyNumber || '',
      notes: patient.notes || '',
      nextAppointment: patient.nextAppointment ? patient.nextAppointment.split('T')[0] : '',
      nextAppointmentTime: patient.nextAppointment ? patient.nextAppointment.split('T')[1]?.slice(0, 5) : '',
      currentTreatment: patient.currentTreatment || '',
      consultationReason: patient.consultationReason || '',
      medicalAntecedents: patient.medicalAntecedents || '',
      osteopathicTreatment: patient.osteopathicTreatment || ''
    }
  });

  // Load saved form data when modal opens
  useEffect(() => {
    if (isOpen) {
      try {
        console.log('Modal opened, initializing form with patient data:', patient);
        
        // Directly initialize with patient data
        initializeFormWithPatientData();
        
        // Set other state values
        setSelectedTags(patient.tags || []);
        setTreatmentHistory(patient.treatmentHistory || []);
        setPatientDocuments(patient.documents || []);
        
        // Trigger validation after initialization
        setTimeout(() => {
          trigger();
        }, 100);
      } catch (error) {
        console.error('Error initializing form with patient data:', error);
      }
    }
  }, [isOpen, patient.id]);

  // Function to initialize form with patient data
  const initializeFormWithPatientData = () => {
    console.log('Initializing form with patient data:', patient);
    
    let nextAppointmentTime = '';
    if (patient.nextAppointment && typeof patient.nextAppointment === 'string' && patient.nextAppointment.includes('T')) {
      const [, time] = patient.nextAppointment.split('T');
      nextAppointmentTime = time ? time.slice(0, 5) : '';
    }

    try {
      // Ensure we're working with the latest patient data
      const formData: Partial<PatientFormData> = {
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        dateOfBirth: patient.dateOfBirth || '',
        profession: patient.profession || '',
        gender: patient.gender || '',
        email: patient.email || '',
        address: patient.address?.street || '',
        phone: patient.phone || '',
        medicalHistory: patient.medicalHistory || '',
        insurance: patient.insurance?.provider || '',
        insuranceNumber: patient.insurance?.policyNumber || '',
        notes: patient.notes || '',
        nextAppointment: patient.nextAppointment ? patient.nextAppointment.split('T')[0] : '',
        nextAppointmentTime,
        // Nouveaux champs
        currentTreatment: patient.currentTreatment || '',
        consultationReason: patient.consultationReason || '',
        medicalAntecedents: patient.medicalAntecedents || '',
        osteopathicTreatment: patient.osteopathicTreatment || '' // Nouveau champ
      };

      console.log('Setting form values:', formData);
      
      // Use setValue for each field to ensure proper initialization
      Object.entries(formData).forEach(([key, value]) => {
        setValue(key as any, value);
      });
      
      // Also use reset to ensure form state is properly updated
      reset(formData);
    } catch (error) {
      console.error('Error setting form values:', error);
    }
  };

  // Save form data periodically
  useEffect(() => {
    if (!isOpen) return;

    const formData = watch();
    
    const saveData = () => {
      saveFormData(formId, {
        formData,
        selectedTags,
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
  }, [isOpen, watch, selectedTags, treatmentHistory, formId]);

  // Fonction pour ajouter un traitement à l'historique
  const addTreatmentHistoryEntry = () => {
    setTreatmentHistory([...treatmentHistory, { date: '', treatment: '', provider: '', notes: '' }]);
  };

  // Fonction pour supprimer un traitement de l'historique
  const removeTreatmentHistoryEntry = (index: number) => {
    setTreatmentHistory(treatmentHistory.filter((_, i) => i !== index));
  };

  // Fonction pour mettre à jour un traitement dans l'historique
  const updateTreatmentHistoryEntry = (index: number, field: keyof TreatmentHistoryEntry, value: string) => {
    const updatedHistory = [...treatmentHistory];
    updatedHistory[index] = { ...updatedHistory[index], [field]: value };
    setTreatmentHistory(updatedHistory);
  };

  const handleDocumentsUpdate = (documents: DocumentMetadata[]) => {
    setPatientDocuments(documents);
  };

  const handleDocumentError = (error: string) => {
    setError(error);
  };

  const onSubmit = async (data: any) => {
    console.log('Starting patient update...', { patientId: patient.id, data });
    
    if (!auth.currentUser || !patient) {
      console.error('No authenticated user found');
      setError('Vous devez être connecté pour modifier un patient ou les données patient sont manquantes');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const timestamp = Timestamp.now();
      const updatedData: Record<string, any> = {
        firstName: data.firstName?.trim() || '',
        lastName: data.lastName?.trim() || '', 
        dateOfBirth: data.dateOfBirth,
        profession: data.profession || '',
        gender: data.gender,
        email: data.email,
        phone: data.phone,
        address: {
          street: data.address,
          city: '',
          state: '',
          zipCode: '',
          country: 'France'
        },
        insurance: {
          provider: data.insurance,
          policyNumber: data.insuranceNumber
        },
        medicalHistory: data.medicalHistory,
        notes: data.notes,
        osteopathicTreatment: data.osteopathicTreatment, // Nouveau champ
        tags: selectedTags,
        nextAppointment: data.nextAppointment ? `${data.nextAppointment}T${data.nextAppointmentTime || '00:00'}:00` : null,
        updatedAt: timestamp.toDate().toISOString(),
        // Nouveaux champs
        currentTreatment: data.currentTreatment,
        consultationReason: data.consultationReason,
        medicalAntecedents: data.medicalAntecedents,
      };
      
      // Only add treatmentHistory if it has entries to avoid undefined
      if (treatmentHistory.length > 0) {
        updatedData.treatmentHistory = treatmentHistory;
      }

      // Ajouter les documents si présents
      if (patientDocuments.length > 0) {
        updatedData.documents = patientDocuments.map(doc => ({
          ...doc
        }));
      }

      console.log('Updating patient document...', { patientId: patient.id, updatedData });
      
      const patientRef = doc(db, 'patients', patient.id);
      
      try {
        await updateDoc(patientRef, updatedData);
        console.log('Patient updated successfully:', patient.id);

        // Afficher le message de succès
        setSuccess('Les modifications ont été enregistrées avec succès');
        
        // Clear saved form data
        clearFormData(formId);
        
        // Attendre 2 secondes avant de fermer le modal
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } catch (updateError: any) {
        console.error('Error updating patient document:', updateError);
        setError(`Erreur lors de la mise à jour du document patient: ${updateError.message}`);
      }
    } catch (error: any) {
      console.error('Error updating patient:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      setError('Erreur lors de la mise à jour du dossier patient: ' + error.message);
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
            className="relative w-[calc(100%-2rem)] md:w-[800px] max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Modifier le dossier patient</h2>
              <button
                onClick={() => {
                  // Keep form data on close
                  onClose();
                }}
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

              <form id="editPatientForm" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                      Prénom *
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      className={`input w-full ${errors.firstName ? 'border-error focus:border-error focus:ring-error' : ''}`}
                      {...register('firstName', { required: 'Ce champ est requis' })}
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
                      className={`input w-full ${errors.lastName ? 'border-error focus:border-error focus:ring-error' : ''}`}
                      {...register('lastName', { required: 'Ce champ est requis' })}
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
                      {...register('dateOfBirth', { required: 'Ce champ est requis' })}
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
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-error">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                    Adresse postale complète
                  </label>
                  <textarea
                    id="address"
                    rows={3}
                    className={`input w-full resize-none ${errors.address ? 'border-error focus:border-error focus:ring-error' : ''}`}
                    {...register('address')}
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
                  <textarea
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
                  <textarea
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
                  <textarea
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
                  <textarea
                    id="medicalHistory"
                    rows={4}
                    className="input w-full resize-none"
                    {...register('medicalHistory')}
                  />
                </div>

                {/* Gestionnaire de documents */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Documents médicaux</h3>
                  <DocumentUploadManager
                    patientId={patient.id}
                    initialDocuments={patientDocuments}
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
                  <textarea
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
                  <textarea
                    id="osteopathicTreatment"
                    rows={4}
                    className="input w-full resize-none"
                    {...register('osteopathicTreatment')}
                    placeholder="Description du traitement ostéopathique effectué ou à effectuer"
                  />
                </div>

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
                </div>
              </form>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <Button
                variant="outline"
                onClick={() => {
                  // Keep form data on cancel
                  onClose();
                }}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                form="editPatientForm"
                variant="primary"
                isLoading={isSubmitting}
                loadingText="Mise à jour en cours..."
                disabled={!isValid || isSubmitting}
              >
                Mettre à jour
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default EditPatientModal;