import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, User, Calendar, AlertCircle } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { Button } from '../ui/Button';

interface EditInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoiceId: string;
}

interface InvoiceFormData {
  patientName: string;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  notes: string;
  status: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

const EditInvoiceModal: React.FC<EditInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  invoiceId,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

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
      status: 'draft'
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const watchedItems = watch('items');

  // Load invoice data
  useEffect(() => {
    const loadInvoice = async () => {
      if (!invoiceId || !auth.currentUser) return;

      try {
        setLoading(true);
        const invoiceRef = doc(db, 'invoices', invoiceId);
        const invoiceDoc = await getDoc(invoiceRef);

        if (!invoiceDoc.exists()) {
          setError('Facture non trouvée');
          setLoading(false);
          return;
        }

        const invoiceData = invoiceDoc.data();
        
        // Verify ownership
        if (invoiceData.osteopathId !== auth.currentUser.uid) {
          setError('Vous n\'avez pas accès à cette facture');
          setLoading(false);
          return;
        }

        // Reset form with invoice data
        reset({
          patientName: invoiceData.patientName,
          issueDate: invoiceData.issueDate,
          dueDate: invoiceData.dueDate,
          items: invoiceData.items || [{ description: 'Consultation standard', quantity: 1, unitPrice: 60, amount: 60 }],
          notes: invoiceData.notes || '',
          status: invoiceData.status || 'draft'
        });

      } catch (error) {
        console.error('Error loading invoice:', error);
        setError('Erreur lors du chargement de la facture');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && invoiceId) {
      loadInvoice();
    }
  }, [isOpen, invoiceId, reset]);

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

  const onSubmit = async (data: InvoiceFormData) => {
    if (!auth.currentUser) {
      setError('Vous devez être connecté pour modifier une facture');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const invoiceData = {
        patientName: data.patientName,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        items: data.items,
        subtotal,
        tax,
        total,
        status: data.status,
        notes: data.notes,
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'invoices', invoiceId), invoiceData);
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating invoice:', error);
      setError('Erreur lors de la modification de la facture: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-red-200 text-red-800'; // Rouge clair
      case 'sent':
        return 'bg-green-200 text-green-800'; // Vert clair
      case 'paid':
        return 'bg-blue-200 text-blue-800'; // Bleu clair
      default:
        return 'bg-gray-200 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Brouillon';
      case 'sent':
        return 'Envoyée';
      case 'paid':
        return 'Payée';
      default:
        return status;
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
              <h2 className="text-xl font-semibold text-gray-900">Modifier la facture</h2>
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

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : (
                <form id="editInvoiceForm" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* Patient and Status */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="patientName" className="block text-sm font-medium text-gray-700 mb-1">
                        Patient *
                      </label>
                      <input
                        type="text"
                        id="patientName"
                        className={`input w-full ${errors.patientName ? 'border-error focus:border-error focus:ring-error' : ''}`}
                        {...register('patientName', { required: 'Ce champ est requis' })}
                        readOnly
                      />
                      {errors.patientName && (
                        <p className="mt-1 text-sm text-error">{errors.patientName.message}</p>
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
                        <option value="draft">Brouillon</option>
                        <option value="sent">Envoyée</option>
                        <option value="paid">Payée</option>
                      </select>
                      {errors.status && (
                        <p className="mt-1 text-sm text-error">{errors.status.message}</p>
                      )}
                      <div className="mt-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(watch('status'))}`}>
                          {getStatusText(watch('status'))}
                        </span>
                      </div>
                    </div>
                  </div>

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
              )}
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
                form="editInvoiceForm"
                variant="primary"
                isLoading={isSubmitting}
                loadingText="Modification en cours..."
                disabled={!isValid || isSubmitting || loading}
              >
                Modifier la facture
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default EditInvoiceModal;