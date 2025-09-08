import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, User, Calendar, AlertCircle } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { collection, doc, getDoc, getDocs, query, where, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { Button } from '../ui/Button';
import { Patient } from '../../types';
import { InvoiceService } from '../../services/invoiceService';

interface NewInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedPatientId?: string;
}

interface InvoiceFormData {
  patientId: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  notes: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

const NewInvoiceModal: React.FC<NewInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedPatientId,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientError, setPatientError] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [isPatientPreselected, setIsPatientPreselected] = useState(false);

  // Track window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { register, handleSubmit, formState: { errors, isValid }, reset, control, watch, setValue } = useForm<InvoiceFormData>({
    mode: 'onChange',
    defaultValues: {
      items: [{ description: 'Consultation standard', quantity: 1, unitPrice: 60, amount: 60 }],
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const watchedItems = watch('items');
  const watchedPatientId = watch('patientId');

  // Load patients
  useEffect(() => {
    const loadPatients = async () => {
      if (!auth.currentUser) return;

      try {
        const patientsRef = collection(db, 'patients');
        const q = query(patientsRef, where('osteopathId', '==', auth.currentUser.uid));
        const snapshot = await getDocs(q);
        
        const patientsList = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id,
        })) as Patient[];
        
        setPatients(patientsList);

        // Set preselected patient
        if (preselectedPatientId) {
          setIsPatientPreselected(true);
          setValue('patientId', preselectedPatientId);
          const patient = patientsList.find(p => p.id === preselectedPatientId);
          if (patient) {
            setSelectedPatient(patient);
          }
        } else {
          setIsPatientPreselected(false);
        }
      } catch (error) {
        console.error('Error loading patients:', error);
        setError('Erreur lors du chargement des patients');
      }
    };

    if (isOpen) {
      loadPatients();
    }
  }, [isOpen, preselectedPatientId, setValue]);

  // Update selected patient when patientId changes
  useEffect(() => {
    if (watchedPatientId) {
      const patient = patients.find(p => p.id === watchedPatientId);
      setSelectedPatient(patient || null);
      
      // Vérifier si le patient existe toujours
      const verifyPatient = async () => {
        try {
          const patientRef = doc(db, 'patients', watchedPatientId);
          const patientDoc = await getDoc(patientRef);
          
          if (!patientDoc.exists()) {
            setPatientError('Ce patient n\'existe plus dans la base de données');
          } else {
            setPatientError(null);
          }
        } catch (error) {
          console.error('Error verifying patient:', error);
        }
      };
      
      verifyPatient();
    }
  }, [watchedPatientId, patients]);

  // Calculate totals
  const subtotal = watchedItems?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
  const tax = 0; // No VAT for healthcare services in France
  const total = subtotal + tax;

  // Update item amount when quantity or unit price changes
  const updateItemAmount = (index: number) => {
    const quantity = watchedItems[index]?.quantity || 0;
    const unitPrice = watchedItems[index]?.unitPrice || 0;
    const amount = quantity * unitPrice;
    setValue(`items.${index}.amount`, amount);
  };

  const addItem = () => {
    append({ description: '', quantity: 1, unitPrice: 0, amount: 0 });
  };

  const removeItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const generateInvoiceNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    return `F-${year}${month}${day}-${time}`;
  };

  const onSubmit = async (data: InvoiceFormData) => {
    if (!auth.currentUser || !selectedPatient) {
      setError('Informations manquantes pour créer la facture');
      return;
    }

    // Vérifier si le patient existe toujours
    try {
      const patientRef = doc(db, 'patients', data.patientId);
      const patientDoc = await getDoc(patientRef);
      
      if (!patientDoc.exists()) {
        setError('Le patient sélectionné n\'existe plus dans la base de données');
        return;
      }
    } catch (error) {
      console.error('Error verifying patient:', error);
      setError('Erreur lors de la vérification du patient');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const invoiceNumber = generateInvoiceNumber();
      
      const invoiceData = {
        number: invoiceNumber,
        patientId: data.patientId,
        patientName: `${selectedPatient.firstName} ${selectedPatient.lastName}`,
        osteopathId: auth.currentUser.uid,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        items: data.items,
        subtotal,
        tax,
        total,
        status: 'draft',
        notes: data.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Utiliser le service pour créer la facture
      await InvoiceService.createInvoice(invoiceData);
      
      reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      setError('Erreur lors de la création de la facture: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSmallScreen = windowWidth < 768;

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
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Nouvelle facture</h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              {error && (
                <div className="mb-4 p-3 bg-error/5 border border-error/20 rounded-lg text-error text-sm">
                  {error}
                </div>
              )}

              <form id="invoiceForm" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Patient Selection */}
                {/* Patient Selection - Conditionnel */}
                {!isPatientPreselected ? (
                  <div>
                    <label htmlFor="patientId" className="block text-sm font-medium text-gray-700 mb-1">
                      Patient *
                    </label>
                    <select
                      id="patientId"
                      className={`input w-full ${errors.patientId || patientError ? 'border-error focus:border-error focus:ring-error' : ''}`}
                      {...register('patientId', { required: 'Veuillez sélectionner un patient' })}
                    >
                      <option value="">Sélectionner un patient</option>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.firstName} {patient.lastName}
                        </option>
                      ))}
                    </select>
                    {errors.patientId && (
                      <p className="mt-1 text-sm text-error">{errors.patientId.message}</p>
                    )}
                    {patientError && (
                      <p className="mt-1 text-sm text-error">{patientError}</p>
                    )}
                    
                    {/* Selected Patient Info */}
                    {selectedPatient && (
                      <div className="mt-4 p-4 bg-primary-50 rounded-lg">
                        <div className="flex items-center">
                          <User size={20} className="text-primary-600 mr-2" />
                          <div>
                            <div className="font-medium text-primary-900">
                              {selectedPatient.firstName} {selectedPatient.lastName}
                            </div>
                            <div className="text-sm text-primary-700">
                              {selectedPatient.phone} • {selectedPatient.email}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Patient
                    </label>
                    <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                      <div className="flex items-center">
                        <User size={20} className="text-primary-600 mr-2" />
                        <div>
                          <div className="font-medium text-primary-900">
                            {selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : 'Patient inconnu'}
                          </div>
                          <div className="text-sm text-primary-700">
                            Facture pour ce patient
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="issueDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Date d'émission *
                    </label>
                    <input
                      type="date"
                      id="issueDate"
                      className={`input w-full ${errors.issueDate ? 'border-error focus:border-error focus:ring-error' : ''}`}
                      {...register('issueDate', { required: 'Ce champ est requis' })}
                    />
                    {errors.issueDate && (
                      <p className="mt-1 text-sm text-error">{errors.issueDate.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Date d'échéance *
                    </label>
                    <input
                      type="date"
                      id="dueDate"
                      className={`input w-full ${errors.dueDate ? 'border-error focus:border-error focus:ring-error' : ''}`}
                      {...register('dueDate', { required: 'Ce champ est requis' })}
                    />
                    {errors.dueDate && (
                      <p className="mt-1 text-sm text-error">{errors.dueDate.message}</p>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Prestations *
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addItem}
                      leftIcon={<Plus size={16} />}
                    >
                      Ajouter une ligne
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {fields.map((field, index) => (
                      <div key={field.id} className={`grid ${isSmallScreen ? 'grid-cols-1 gap-3' : 'grid-cols-12 gap-2'} items-start`}>
                        {isSmallScreen ? (
                          <>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Description</label>
                              <input
                                type="text"
                                placeholder="Description"
                                className="input w-full"
                                {...register(`items.${index}.description`, { required: true })}
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Qté</label>
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="Qté"
                                  className="input w-full"
                                  {...register(`items.${index}.quantity`, { 
                                    required: true,
                                    min: 1,
                                    onChange: () => updateItemAmount(index)
                                  })}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Prix</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Prix"
                                  className="input w-full"
                                  {...register(`items.${index}.unitPrice`, { 
                                    required: true,
                                    min: 0,
                                    onChange: () => updateItemAmount(index)
                                  })}
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Total</label>
                                <div className="flex items-center">
                                  <input
                                    type="number"
                                    placeholder="Total"
                                    className="input w-full bg-gray-50"
                                    {...register(`items.${index}.amount`)}
                                    readOnly
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItem(index)}
                                    disabled={fields.length === 1}
                                    className="ml-1"
                                  >
                                    <Trash2 size={16} className="text-gray-400 hover:text-error" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="col-span-5">
                              <input
                                type="text"
                                placeholder="Description"
                                className="input w-full"
                                {...register(`items.${index}.description`, { required: true })}
                              />
                            </div>
                            <div className="col-span-2">
                              <input
                                type="number"
                                min="1"
                                placeholder="Qté"
                                className="input w-full"
                                {...register(`items.${index}.quantity`, { 
                                  required: true,
                                  min: 1,
                                  onChange: () => updateItemAmount(index)
                                })}
                              />
                            </div>
                            <div className="col-span-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Prix unitaire"
                                className="input w-full"
                                {...register(`items.${index}.unitPrice`, { 
                                  required: true,
                                  min: 0,
                                  onChange: () => updateItemAmount(index)
                                })}
                              />
                            </div>
                            <div className="col-span-2">
                              <input
                                type="number"
                                placeholder="Montant"
                                className="input w-full bg-gray-50"
                                {...register(`items.${index}.amount`)}
                                readOnly
                              />
                            </div>
                            <div className="col-span-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => removeItem(index)}
                                disabled={fields.length === 1}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t pt-4">
                  <div className="flex justify-end">
                    <div className="w-full sm:w-64 space-y-2">
                      <div className="flex justify-between">
                        <span>Sous-total:</span>
                        <span>{subtotal.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between">
                        <span>TVA:</span>
                        <span>{tax.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2">
                        <span>Total:</span>
                        <span>{total.toFixed(2)} €</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    className="input w-full resize-none"
                    {...register('notes')}
                    placeholder="Notes additionnelles..."
                  />
                </div>
              </form>
            </div>

            <div className="flex justify-end gap-3 px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                form="invoiceForm"
                variant="primary"
                isLoading={isSubmitting}
                loadingText="Création en cours..."
                disabled={!isValid || isSubmitting || !!patientError}
              >
                Créer la facture
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default NewInvoiceModal;