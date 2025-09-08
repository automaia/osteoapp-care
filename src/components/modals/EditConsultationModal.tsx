import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, FileText, User, Plus, Trash2, CheckCircle } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { Button } from '../ui/Button';
import { cleanDecryptedField } from '../../utils/dataCleaning';
import { HDSCompliance } from '../../utils/hdsCompliance';
import { AuditLogger, AuditEventType, SensitivityLevel } from '../../utils/auditLogger';

interface EditConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  consultationId: string;
  preselectedPatientId?: string;
  preselectedPatientName?: string;
}

interface ConsultationFormData {
  date: string;
  time: string;
  reason: string;
  treatment: string;
  notes: string;
  duration: number;
  price: number;
  status: string;
  examinations: { value: string }[];
  prescriptions: { value: string }[];
}

const EditConsultationModal: React.FC<EditConsultationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  consultationId,
  preselectedPatientId,
  preselectedPatientName
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [consultationData, setConsultationData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, formState: { errors, isValid }, reset, control } = useForm<ConsultationFormData>({
    mode: 'onChange',
    defaultValues: {
      duration: 60,
      price: 60,
      status: 'completed',
      examinations: [],
      prescriptions: []
    }
  });

  const { fields: examinationFields, append: appendExamination, remove: removeExamination } = useFieldArray({
    control,
    name: 'examinations'
  });

  const { fields: prescriptionFields, append: appendPrescription, remove: removePrescription } = useFieldArray({
    control,
    name: 'prescriptions'
  });

  // Load consultation data when modal opens
  useEffect(() => {
    const loadData = async () => {
      if (!auth.currentUser || !consultationId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔄 Loading consultation data for ID:', consultationId);
        
        // Charger directement depuis Firestore
        const consultationRef = doc(db, 'consultations', consultationId);
        const consultationDoc = await getDoc(consultationRef);
        
        if (!consultationDoc.exists()) {
          throw new Error('Consultation non trouvée');
        }
        
        const rawData = consultationDoc.data();
        console.log('📋 Raw consultation data:', rawData);
        
        // Vérifier la propriété
        if (rawData.osteopathId !== auth.currentUser.uid) {
          throw new Error('Accès non autorisé à cette consultation');
        }
        
        // Déchiffrer les données pour l'affichage
        const decryptedData = HDSCompliance.decryptDataForDisplay(
          rawData,
          'consultations',
          auth.currentUser.uid
        );
        
        console.log('🔓 Decrypted consultation data:', decryptedData);
        
        const consultation = {
          id: consultationDoc.id,
          ...decryptedData,
          date: rawData.date?.toDate?.() || new Date(rawData.date)
        };
        
        setConsultationData(consultation);
        
        console.log('✅ Final consultation data for form:', consultation);
        
        // Pre-fill form with consultation data
        const consultationDate = consultation.date?.toDate ? consultation.date.toDate() : new Date(consultation.date);
        const dateString = consultationDate.toISOString().split('T')[0];
        const timeString = consultationDate.toTimeString().slice(0, 5);
        
        // Nettoyer les champs pour l'édition
        const cleanReason = cleanDecryptedField(consultation.reason, true, '');
        const cleanTreatment = cleanDecryptedField(consultation.treatment, true, '');
        const cleanNotes = cleanDecryptedField(consultation.notes, true, '');
        
        console.log('🧹 Cleaned fields for editing:', {
          reason: { original: consultation.reason, cleaned: cleanReason },
          treatment: { original: consultation.treatment, cleaned: cleanTreatment },
          notes: { original: consultation.notes, cleaned: cleanNotes }
        });
        
        reset({
          date: dateString,
          time: timeString,
          reason: cleanReason,
          treatment: cleanTreatment,
          notes: cleanNotes,
          duration: consultation.duration || 60,
          price: consultation.price || 60,
          status: consultation.status || 'completed',
          examinations: consultation.examinations?.map((exam: string) => ({ value: exam })) || [],
          prescriptions: consultation.prescriptions?.map((presc: string) => ({ value: presc })) || []
        });
        
        console.log('📝 Form initialized with cleaned data');
      } catch (error) {
        console.error('Error loading consultation data:', error);
        setError('Erreur lors du chargement de la consultation');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && consultationId) {
      loadData();
    }
  }, [isOpen, consultationId, reset]);

  const onSubmit = async (data: ConsultationFormData) => {
    if (!auth.currentUser) {
      setError('Vous devez être connecté pour modifier une consultation');
      return;
    }

    console.log('📤 Submitting consultation update:', {
      consultationId,
      formData: data,
      currentUser: auth.currentUser.uid
    });

    setIsSubmitting(true);
    setError(null);

    try {
      const consultationDate = new Date(`${data.date}T${data.time}`);
      
      // Préparer les données de mise à jour
      const updateData = {
        date: consultationDate,
        reason: data.reason,
        treatment: data.treatment,
        notes: data.notes,
        duration: data.duration,
        price: data.price,
        status: data.status,
        examinations: data.examinations.map(item => item.value),
        prescriptions: data.prescriptions.map(item => item.value),
        updatedAt: new Date().toISOString()
      };
      
      console.log('💾 Prepared update data:', updateData);
      
      // Mettre à jour via le service
      const consultationRef = doc(db, 'consultations', consultationId);
      await updateDoc(consultationRef, {
        ...updateData,
        date: Timestamp.fromDate(consultationDate),
        updatedAt: Timestamp.now()
      });
      
      console.log('✅ Consultation updated successfully in Firestore');
      
      // Afficher le message de succès
      setSuccess('Consultation modifiée avec succès');
      
      // Attendre 2 secondes avant de fermer le modal
      setTimeout(() => {
        reset();
        onSuccess();
        onClose();
      }, 2000);
    } catch (error: any) {
      console.error('Error updating consultation:', error);
      setError('Erreur lors de la modification de la consultation: ' + error.message);
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
            className="relative w-[calc(100%-2rem)] md:w-[700px] max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Modifier la consultation</h2>
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

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : consultationData ? (
                <>
                  <div className="mb-4 p-4 bg-primary-50 rounded-lg">
                    <div className="flex items-center">
                      <User size={20} className="text-primary-600 mr-2" />
                      <span className="font-medium text-primary-900">
                        Patient: {consultationData?.patientName || preselectedPatientName || 'Patient inconnu'}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-primary-700">
                      Consultation du {consultationData.date?.toDate ? 
                        consultationData.date.toDate().toLocaleDateString('fr-FR') : 
                        new Date(consultationData.date).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  
                  {/* Debug info in development */}
                  <form id="editConsultationForm" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                          Date *
                        </label>
                        <input
                          type="date"
                          id="date"
                          className={`input w-full ${errors.date ? 'border-error focus:border-error focus:ring-error' : ''}`}
                          {...register('date', { required: 'Ce champ est requis' })}
                        />
                        {errors.date && (
                          <p className="mt-1 text-sm text-error">{errors.date.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                          Heure *
                        </label>
                        <input
                          type="time"
                          id="time"
                          className={`input w-full ${errors.time ? 'border-error focus:border-error focus:ring-error' : ''}`}
                          {...register('time', { required: 'Ce champ est requis' })}
                        />
                        {errors.time && (
                          <p className="mt-1 text-sm text-error">{errors.time.message}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                        Motif de consultation *
                      </label>
                      <input
                        type="text"
                        id="reason"
                        className={`input w-full ${errors.reason ? 'border-error focus:border-error focus:ring-error' : ''}`}
                        {...register('reason', { required: 'Ce champ est requis' })}
                        placeholder="Ex: Lombalgie, Cervicalgie..."
                      />
                      {errors.reason && (
                        <p className="mt-1 text-sm text-error">{errors.reason.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="treatment" className="block text-sm font-medium text-gray-700 mb-1">
                        Traitement effectué *
                      </label>
                      <textarea
                        id="treatment"
                        rows={4}
                        className={`input w-full resize-none ${errors.treatment ? 'border-error focus:border-error focus:ring-error' : ''}`}
                        {...register('treatment', { required: 'Ce champ est requis' })}
                        placeholder="Décrivez le traitement effectué..."
                      />
                      {errors.treatment && (
                        <p className="mt-1 text-sm text-error">{errors.treatment.message}</p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                        Statut *
                      </label>
                      <select
                        id="status"
                        className={`input w-full ${errors.status ? 'border-error focus:border-error focus:ring-error' : ''}`}
                        {...register('status', { required: 'Ce champ est requis' })}
                      >
                        <option value="completed">Effectué</option>
                        <option value="draft">En cours</option>
                        <option value="cancelled">Annulé</option>
                      </select>
                      {errors.status && (
                        <p className="mt-1 text-sm text-error">{errors.status.message}</p>
                      )}
                    </div>

                    {/* Examens demandés */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Examens demandés
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => appendExamination({ value: '' })}
                          leftIcon={<Plus size={14} />}
                        >
                          Ajouter
                        </Button>
                      </div>
                      
                      {examinationFields.length > 0 ? (
                        <div className="space-y-2">
                          {examinationFields.map((field, index) => (
                            <div key={field.id} className="flex items-center space-x-2">
                              <input
                                type="text"
                                className="input flex-1"
                                placeholder="Ex: Radiographie lombaire..."
                                {...register(`examinations.${index}.value`)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeExamination(index)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">
                          Aucun examen demandé
                        </div>
                      )}
                    </div>

                    {/* Prescriptions */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Prescriptions
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => appendPrescription({ value: '' })}
                          leftIcon={<Plus size={14} />}
                        >
                          Ajouter
                        </Button>
                      </div>
                      
                      {prescriptionFields.length > 0 ? (
                        <div className="space-y-2">
                          {prescriptionFields.map((field, index) => (
                            <div key={field.id} className="flex items-center space-x-2">
                              <input
                                type="text"
                                className="input flex-1"
                                placeholder="Ex: Antalgiques, repos..."
                                {...register(`prescriptions.${index}.value`)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removePrescription(index)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">
                          Aucune prescription
                        </div>
                      )}
                    </div>

                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                        Notes complémentaires
                      </label>
                      <textarea
                        id="notes"
                        rows={3}
                        className="input w-full resize-none"
                        {...register('notes')}
                        placeholder="Notes additionnelles..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                          Durée (minutes) *
                        </label>
                        <input
                          type="number"
                          id="duration"
                          min="15"
                          step="15"
                          className={`input w-full ${errors.duration ? 'border-error focus:border-error focus:ring-error' : ''}`}
                          {...register('duration', { 
                            required: 'Ce champ est requis',
                            min: { value: 15, message: 'Durée minimum 15 minutes' }
                          })}
                        />
                        {errors.duration && (
                          <p className="mt-1 text-sm text-error">{errors.duration.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
                          Tarif (€) *
                        </label>
                        <input
                          type="number"
                          id="price"
                          min="0"
                          step="5"
                          className={`input w-full ${errors.price ? 'border-error focus:border-error focus:ring-error' : ''}`}
                          {...register('price', { 
                            required: 'Ce champ est requis',
                            min: { value: 0, message: 'Le tarif doit être positif' }
                          })}
                        />
                        {errors.price && (
                          <p className="mt-1 text-sm text-error">{errors.price.message}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                          Statut *
                        </label>
                        <select
                          id="status"
                          className={`input w-full ${errors.status ? 'border-error focus:border-error focus:ring-error' : ''}`}
                          {...register('status', { required: 'Ce champ est requis' })}
                        >
                          <option value="completed">Effectué</option>
                          <option value="draft">En cours</option>
                          <option value="cancelled">Annulé</option>
                        </select>
                        {errors.status && (
                          <p className="mt-1 text-sm text-error">{errors.status.message}</p>
                        )}
                      </div>
                    </div>
                  </form>
                </>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">Consultation non trouvée</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                form="editConsultationForm"
                variant="primary"
                isLoading={isSubmitting}
                loadingText="Modification en cours..."
                disabled={!isValid || isSubmitting || loading}
              >
                Modifier la consultation
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default EditConsultationModal;