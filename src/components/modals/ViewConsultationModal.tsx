import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, FileText, User, Stethoscope, Eye, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { ConsultationService } from '../../services/consultationService';
import { cleanDecryptedField } from '../../utils/dataCleaning';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ViewConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
  consultationId: string;
}

interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  date: Date;
  reason: string;
  treatment: string;
  notes: string;
  duration: number;
  price: number;
  status: 'draft' | 'completed' | 'cancelled';
  osteopathId: string;
  appointmentId?: string;
  examinations?: string[];
  prescriptions?: string[];
}

const ViewConsultationModal: React.FC<ViewConsultationModalProps> = ({
  isOpen,
  onClose,
  consultationId
}) => {
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load consultation data when modal opens
  useEffect(() => {
    const loadConsultation = async () => {
      if (!consultationId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔄 Loading consultation details for ID:', consultationId);
        
        const consultationData = await ConsultationService.getConsultationById(consultationId);
        
        if (!consultationData) {
          throw new Error('Consultation non trouvée');
        }
        
        console.log('✅ Consultation data loaded:', consultationData);
        setConsultation(consultationData);
        
      } catch (error) {
        console.error('Error loading consultation:', error);
        setError('Erreur lors du chargement de la consultation');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && consultationId) {
      loadConsultation();
    }
  }, [isOpen, consultationId]);

  // Format date for display
  const formatDateTime = (date: Date) => {
    try {
      return format(date, 'EEEE d MMMM yyyy à HH:mm', { locale: fr });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Date invalide';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Terminée';
      case 'draft':
        return 'En cours';
      case 'cancelled':
        return 'Annulée';
      default:
        return status;
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
              <div className="flex items-center">
                <Eye size={20} className="text-primary-600 mr-2" />
                <h2 className="text-xl font-semibold text-gray-900">
                  {consultation ? `Consultation du ${format(consultation.date, 'dd/MM/yyyy', { locale: fr })}` : 'Détails de la consultation'}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {error && (
                <div className="mb-4 p-3 bg-error/5 border border-error/20 rounded-lg flex items-center">
                  <AlertCircle size={16} className="text-error mr-2" />
                  <span className="text-error text-sm">{error}</span>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : consultation ? (
                <div className="space-y-6">
                  {/* Informations générales de la consultation */}
                  <div className="bg-primary-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-medium text-primary-900">
                        Informations générales
                      </h3>
                      <span className={`px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(consultation.status)}`}>
                        {getStatusText(consultation.status)}
                      </span>
                    </div>
                    <div className="flex items-center mb-3">
                      <User size={16} className="mr-2 text-primary-600" />
                      <span className="text-primary-700 font-medium">{consultation.patientName}</span>
                    </div>
                    <div className="flex items-center text-sm text-primary-700 space-x-4">
                      <div className="flex items-center">
                        <Calendar size={14} className="mr-1" />
                        <span>{formatDateTime(consultation.date)}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock size={14} className="mr-1" />
                        <span>{consultation.duration} min</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium">{consultation.price} €</span>
                      </div>
                    </div>
                  </div>

                  {/* Motif de consultation */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                      <FileText size={16} className="mr-2 text-gray-600" />
                      Motif de consultation
                    </h4>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-gray-900 font-medium">
                        {cleanDecryptedField(consultation.reason, false, 'Consultation ostéopathique')}
                      </p>
                    </div>
                  </div>

                  {/* Traitement */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                      <Stethoscope size={16} className="mr-2 text-gray-600" />
                      Traitement effectué
                    </h4>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <p className="text-gray-900 whitespace-pre-wrap">
                        {cleanDecryptedField(consultation.treatment, false, 'Traitement ostéopathique standard')}
                      </p>
                    </div>
                  </div>

                  {/* Notes complémentaires */}
                  {consultation.notes && cleanDecryptedField(consultation.notes, false, '') && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                        <FileText size={16} className="mr-2 text-gray-600" />
                        Notes complémentaires
                      </h4>
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <p className="text-gray-900 whitespace-pre-wrap">
                          {cleanDecryptedField(consultation.notes, false, '')}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Examens demandés */}
                  {consultation.examinations && consultation.examinations.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Examens demandés</h4>
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <ul className="list-disc list-inside space-y-1">
                          {consultation.examinations.map((exam, index) => (
                            <li key={index} className="text-gray-900">{exam}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Prescriptions */}
                  {consultation.prescriptions && consultation.prescriptions.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Prescriptions</h4>
                      <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <ul className="list-disc list-inside space-y-1">
                          {consultation.prescriptions.map((prescription, index) => (
                            <li key={index} className="text-gray-900">{prescription}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">Consultation non trouvée</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
              <Button variant="primary" onClick={onClose}>
                Fermer
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ViewConsultationModal;