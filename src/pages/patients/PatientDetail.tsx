import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  User, 
  FileText, 
  Plus,
  Clock,
  AlertCircle,
  CheckCircle,
  Eye,
  Download,
  Upload,
  History,
  Stethoscope,
  CreditCard,
  Tag,
  Info,
  RefreshCw,
  Shield,
  Pill,
  AlertTriangle
} from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { Button } from '../../components/ui/Button';
import EditPatientModal from '../../components/modals/EditPatientModal';
import DeletePatientModal from '../../components/modals/DeletePatientModal';
import AddDocumentModal from '../../components/modals/AddDocumentModal';
import NewInvoiceModal from '../../components/modals/NewInvoiceModal';
import EditInvoiceModal from '../../components/modals/EditInvoiceModal';
import DeleteInvoiceModal from '../../components/modals/DeleteInvoiceModal';
import NewConsultationModal from '../../components/modals/NewConsultationModal';
import EditConsultationModal from '../../components/modals/EditConsultationModal';
import ViewConsultationModal from '../../components/modals/ViewConsultationModal';
import DeleteConsultationModal from '../../components/modals/DeleteConsultationModal';
import { Patient, Consultation, Invoice } from '../../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { HDSCompliance } from '../../utils/hdsCompliance';
import { cleanDecryptedField } from '../../utils/dataCleaning';
import { PatientService } from '../../services/patientService';
import { ConsultationService } from '../../services/consultationService';
import { InvoiceService } from '../../services/invoiceService';
import { AppointmentService } from '../../services/appointmentService';
import { patientCache } from '../../utils/patientCache';
import { trackEvent } from '../../lib/clarityClient';
import { trackEvent as trackMatomoEvent } from '../../lib/matomoTagManager';
import { trackEvent as trackGAEvent } from '../../lib/googleAnalytics';

const PatientDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAddDocumentModalOpen, setIsAddDocumentModalOpen] = useState(false);
  const [isNewInvoiceModalOpen, setIsNewInvoiceModalOpen] = useState(false);
  const [isEditInvoiceModalOpen, setIsEditInvoiceModalOpen] = useState(false);
  const [isDeleteInvoiceModalOpen, setIsDeleteInvoiceModalOpen] = useState(false);
  const [isNewConsultationModalOpen, setIsNewConsultationModalOpen] = useState(false);
  const [isEditConsultationModalOpen, setIsEditConsultationModalOpen] = useState(false);
  const [isViewConsultationModalOpen, setIsViewConsultationModalOpen] = useState(false);
  const [isDeleteConsultationModalOpen, setIsDeleteConsultationModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<{ id: string; number: string } | null>(null);
  const [consultationToDelete, setConsultationToDelete] = useState<{
    id: string;
    patientName: string;
    date: string;
    time: string;
  } | null>(null);
  const [isDeletingPatient, setIsDeletingPatient] = useState(false);
  const [isDeletingInvoice, setIsDeletingInvoice] = useState(false);
  const [isDeletingConsultation, setIsDeletingConsultation] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());

  // Mise à jour de l'heure actuelle toutes les secondes
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    
    return () => clearInterval(clockInterval);
  }, []);

  // Rafraîchissement automatique des données toutes les 3 secondes
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      handleRefresh(false);
    }, 3000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Load patient data
  const loadPatientData = useCallback(async () => {
    if (!id || !auth.currentUser) {
      setError('ID patient manquant ou utilisateur non authentifié');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Check cache first
      const cachedPatient = patientCache.get(id);
      if (cachedPatient) {
        console.log('Using cached patient data');
        setPatient(cachedPatient);
        setLoading(false);
      }

      // Load from Firestore
      const patientRef = doc(db, 'patients', id);
      const patientDoc = await getDoc(patientRef);

      if (!patientDoc.exists()) {
        setError('Patient non trouvé');
        setLoading(false);
        return;
      }

      const patientData = patientDoc.data();
      
      // Verify ownership
      if (patientData.osteopathId !== auth.currentUser.uid) {
        setError('Vous n\'avez pas accès à ce patient');
        setLoading(false);
        return;
      }

      // Decrypt data for display
      const decryptedData = HDSCompliance.decryptDataForDisplay(
        patientData,
        'patients',
        auth.currentUser.uid
      );

      const patient: Patient = {
        ...decryptedData,
        id: patientDoc.id
      };

      setPatient(patient);
      
      // Update cache
      patientCache.set(id, patient);
      
      console.log('Patient data loaded:', patient);
      
    } catch (error) {
      console.error('Error loading patient:', error);
      setError('Erreur lors du chargement du patient');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Load consultations
  const loadConsultations = useCallback(async () => {
    if (!id || !auth.currentUser) return;

    try {
      const consultationsRef = collection(db, 'consultations');
      const q = query(
        consultationsRef,
        where('patientId', '==', id),
        where('osteopathId', '==', auth.currentUser.uid)
      );

      const snapshot = await getDocs(q);
      const consultationsData: Consultation[] = [];

      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        
        // Decrypt data for display
        const decryptedData = HDSCompliance.decryptDataForDisplay(
          data,
          'consultations',
          auth.currentUser.uid
        );

        consultationsData.push({
          id: docSnapshot.id,
          ...decryptedData,
          date: data.date?.toDate?.() || new Date(data.date),
          createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt)
        } as Consultation);
      }

      // Sort by date (most recent first)
      consultationsData.sort((a, b) => b.date.getTime() - a.date.getTime());
      setConsultations(consultationsData);
      
    } catch (error) {
      console.error('Error loading consultations:', error);
    }
  }, [id]);

  // Load invoices
  const loadInvoices = useCallback(async () => {
    if (!id || !auth.currentUser) return;

    try {
      const invoicesRef = collection(db, 'invoices');
      const q = query(
        invoicesRef,
        where('patientId', '==', id),
        where('osteopathId', '==', auth.currentUser.uid)
      );

      const snapshot = await getDocs(q);
      const invoicesData: Invoice[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Validation des données
        if (data.number && data.patientName && data.issueDate && data.total !== undefined) {
          invoicesData.push({
            id: doc.id,
            number: data.number,
            patientId: data.patientId || '',
            patientName: data.patientName,
            issueDate: data.issueDate,
            dueDate: data.dueDate || '',
            total: data.total,
            status: data.status || 'draft',
            items: data.items || [],
            subtotal: data.subtotal || 0,
            tax: data.tax || 0,
            notes: data.notes || '',
            osteopathId: data.osteopathId
          });
        }
      });

      // Sort by issue date (most recent first)
      invoicesData.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
      setInvoices(invoicesData);
      
    } catch (error) {
      console.error('Error loading invoices:', error);
    }
  }, [id]);

  // Initial load
  useEffect(() => {
    if (id) {
      loadPatientData();
      loadConsultations();
      loadInvoices();
      
      // Track page view
      trackEvent("patient_detail_view", { patient_id: id });
      trackMatomoEvent('Patient', 'Detail View', id);
      trackGAEvent('view_patient_detail', { patient_id: id });
    }
  }, [id, loadPatientData, loadConsultations, loadInvoices]);

  // Set up real-time listeners
  useEffect(() => {
    if (!id || !auth.currentUser) return;

    // Consultations listener
    const consultationsRef = collection(db, 'consultations');
    const consultationsQuery = query(
      consultationsRef,
      where('patientId', '==', id),
      where('osteopathId', '==', auth.currentUser.uid)
    );

    const consultationsUnsubscribe = onSnapshot(consultationsQuery, () => {
      if (!loading) {
        loadConsultations();
      }
    });

    // Invoices listener
    const invoicesRef = collection(db, 'invoices');
    const invoicesQuery = query(
      invoicesRef,
      where('patientId', '==', id),
      where('osteopathId', '==', auth.currentUser.uid)
    );

    const invoicesUnsubscribe = onSnapshot(invoicesQuery, () => {
      if (!loading) {
        loadInvoices();
      }
    });

    return () => {
      consultationsUnsubscribe();
      invoicesUnsubscribe();
    };
  }, [id, loading, loadConsultations, loadInvoices]);

  // Fonction de rafraîchissement manuel
  const handleRefresh = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setRefreshing(true);
    }
    try {
      await Promise.all([loadPatientData(), loadConsultations(), loadInvoices()]);
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
    } finally {
      if (showLoading) {
        setRefreshing(false);
      }
    }
  }, [loadPatientData, loadConsultations, loadInvoices]);

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    // Invalidate cache and reload
    if (id) {
      patientCache.invalidate(id);
      loadPatientData();
    }
  };

  const handleDeletePatient = async () => {
    if (!patient) return;

    setIsDeletingPatient(true);
    try {
      await PatientService.deletePatient(patient.id);
      
      // Track deletion
      trackEvent("patient_deleted", { patient_id: patient.id });
      trackMatomoEvent('Patient', 'Deleted', patient.id);
      trackGAEvent('delete_patient', { patient_id: patient.id });
      
      navigate('/patients');
    } catch (error) {
      console.error('Error deleting patient:', error);
      setError('Erreur lors de la suppression du patient');
    } finally {
      setIsDeletingPatient(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handleDocumentSuccess = (documentUrl: string) => {
    setIsAddDocumentModalOpen(false);
    // Reload patient data to show new document
    loadPatientData();
  };

  // Invoice handlers
  const handleEditInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setIsEditInvoiceModalOpen(true);
  };

  const handleDeleteInvoice = (invoiceId: string, invoiceNumber: string) => {
    setInvoiceToDelete({ id: invoiceId, number: invoiceNumber });
    setIsDeleteInvoiceModalOpen(true);
  };

  const confirmInvoiceDeletion = async () => {
    if (!invoiceToDelete) return;

    setIsDeletingInvoice(true);
    try {
      await InvoiceService.deleteInvoice(invoiceToDelete.id);
      
      setIsDeleteInvoiceModalOpen(false);
      setInvoiceToDelete(null);
      
      // Reload invoices
      loadInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      setError('Erreur lors de la suppression de la facture');
    } finally {
      setIsDeletingInvoice(false);
    }
  };

  const handleInvoiceSuccess = async () => {
    setIsNewInvoiceModalOpen(false);
    setIsEditInvoiceModalOpen(false);
    setSelectedInvoiceId(null);
    
    // Reload invoices
    loadInvoices();
  };

  // Consultation handlers
  const handleEditConsultation = (consultationId: string) => {
    setSelectedConsultationId(consultationId);
    setIsEditConsultationModalOpen(true);
  };

  const handleViewConsultation = (consultationId: string) => {
    setSelectedConsultationId(consultationId);
    setIsViewConsultationModalOpen(true);
  };

  const handleDeleteConsultation = (consultationId: string) => {
    const consultation = consultations.find(c => c.id === consultationId);
    if (consultation) {
      setConsultationToDelete({
        id: consultation.id,
        patientName: consultation.patientName,
        date: format(consultation.date, 'dd/MM/yyyy', { locale: fr }),
        time: format(consultation.date, 'HH:mm')
      });
      setIsDeleteConsultationModalOpen(true);
    }
  };

  const confirmConsultationDeletion = async () => {
    if (!consultationToDelete) return;

    setIsDeletingConsultation(true);
    try {
      await ConsultationService.deleteConsultation(consultationToDelete.id);
      
      setIsDeleteConsultationModalOpen(false);
      setConsultationToDelete(null);
      
      // Reload consultations
      loadConsultations();
    } catch (error) {
      console.error('Error deleting consultation:', error);
      setError('Erreur lors de la suppression de la consultation');
    } finally {
      setIsDeletingConsultation(false);
    }
  };

  const handleConsultationSuccess = () => {
    setIsNewConsultationModalOpen(false);
    setIsEditConsultationModalOpen(false);
    setIsViewConsultationModalOpen(false);
    setSelectedConsultationId(null);
    
    // Reload consultations
    loadConsultations();
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('fr-FR');
    } catch (error) {
      console.error('Error formatting date:', dateString);
      return 'Date invalide';
    }
  };

  const formatDateTime = (date: Date) => {
    try {
      return format(date, 'dd/MM/yyyy à HH:mm', { locale: fr });
    } catch (error) {
      console.error('Error formatting date:', date);
      return 'Date invalide';
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  const calculateAge = (dateOfBirth: string) => {
    try {
      const today = new Date();
      const birthDate = new Date(dateOfBirth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      return age;
    } catch (error) {
      console.error('Error calculating age:', dateOfBirth);
      return 'N/A';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-red-200 text-red-800';
      case 'sent':
        return 'bg-green-200 text-green-800';
      case 'paid':
        return 'bg-blue-200 text-blue-800';
      case 'overdue':
        return 'bg-error/10 text-error';
      default:
        return 'bg-gray-100 text-gray-800';
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
      case 'overdue':
        return 'En retard';
      default:
        return status;
    }
  };

  const getConsultationStatusColor = (status: string) => {
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

  const getConsultationStatusText = (status: string) => {
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

  // Formatage de la date et de l'heure
  const formatCurrentDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatCurrentTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/patients')}
            leftIcon={<ArrowLeft size={16} />}
          >
            Patients
          </Button>
        </div>
        
        <div className="p-6 bg-error/5 border border-error/20 rounded-xl">
          <div className="flex items-center">
            <AlertCircle className="text-error mr-3" size={24} />
            <div>
              <h3 className="font-medium text-error">Erreur</h3>
              <p className="text-error/80">{error || 'Une erreur est survenue'}</p>
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => navigate('/patients')}
            >
              Retour aux patients
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/patients')}
            leftIcon={<ArrowLeft size={16} />}
            className="mr-2"
          >
            Patients
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">
            {patient.firstName} {patient.lastName}
          </h1>
          {patient.isTestData && (
            <span className="ml-3 px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
              Donnée test
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <div className="text-sm text-gray-500">
            {formatCurrentDate(currentDateTime)} - {formatCurrentTime(currentDateTime)}
          </div>
          <div className="text-xs text-gray-400">
            Dernière mise à jour: {formatCurrentTime(lastRefreshTime)}
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => handleRefresh(true)}
            leftIcon={<RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />}
            disabled={refreshing}
            className="hidden"
          >
            Actualiser
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            leftIcon={<Edit size={16} />}
            onClick={() => setIsEditModalOpen(true)}
          >
            Modifier
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            leftIcon={<Trash2 size={16} />}
            onClick={() => setIsDeleteModalOpen(true)}
          >
            Supprimer
          </Button>
        </div>
      </div>

      {/* Patient overview card */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex items-start space-x-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-primary-700 ${
            patient.isTestData ? 'bg-yellow-100' : 'bg-primary-100'
          }`}>
            {getInitials(patient.firstName, patient.lastName)}
          </div>
          
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Informations personnelles</h3>
              <div className="space-y-1">
                <p className="text-gray-900">
                  <span className="font-medium">Âge:</span> {calculateAge(patient.dateOfBirth)} ans
                </p>
                <p className="text-gray-900">
                  <span className="font-medium">Né(e) le:</span> {formatDate(patient.dateOfBirth)}
                </p>
                <p className="text-gray-900">
                  <span className="font-medium">Sexe:</span> {
                    patient.gender === 'male' ? 'Homme' : 
                    patient.gender === 'female' ? 'Femme' : 
                    patient.gender === 'other' ? 'Autre' : 'Non spécifié'
                  }
                </p>
                {patient.profession && (
                  <p className="text-gray-900">
                    <span className="font-medium">Profession:</span> {cleanDecryptedField(patient.profession, false, 'Non spécifiée')}
                  </p>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Contact</h3>
              <div className="space-y-1">
                {patient.phone && (
                  <div className="flex items-center">
                    <Phone size={16} className="text-gray-400 mr-2" />
                    <span className="text-gray-900">{cleanDecryptedField(patient.phone, false, 'Non renseigné')}</span>
                  </div>
                )}
                {patient.email && (
                  <div className="flex items-center">
                    <Mail size={16} className="text-gray-400 mr-2" />
                    <span className="text-gray-900">{cleanDecryptedField(patient.email, false, 'Non renseigné')}</span>
                  </div>
                )}
                {patient.address && (
                  <div className="flex items-start">
                    <MapPin size={16} className="text-gray-400 mr-2 mt-0.5" />
                    <span className="text-gray-900">
                      {typeof patient.address === 'object' && patient.address.street 
                        ? cleanDecryptedField(patient.address.street, false, 'Adresse non disponible')
                        : typeof patient.address === 'string' 
                        ? cleanDecryptedField(patient.address, false, 'Adresse non disponible')
                        : 'Adresse non disponible'
                      }
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-1">Prochaine consultation</h3>
              {patient.nextAppointment ? (
                <div className="flex items-center">
                  <Calendar size={16} className="text-primary-500 mr-2" />
                  <span className="text-primary-600 font-medium">
                    {formatDate(patient.nextAppointment.split('T')[0])} à {patient.nextAppointment.split('T')[1]?.slice(0, 5)}
                  </span>
                </div>
              ) : (
                <span className="text-gray-500">Aucune consultation prévue</span>
              )}
            </div>
          </div>
        </div>
        
        {/* Tags */}
        {patient.tags && patient.tags.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Symptômes / Syndromes</h3>
            <div className="flex flex-wrap gap-2">
              {patient.tags.map((tag, index) => (
                <span
                  key={index}
                  className={`px-3 py-1 text-sm rounded-full ${
                    patient.isTestData 
                      ? 'bg-yellow-50 text-yellow-700' 
                      : 'bg-primary-50 text-primary-700'
                  }`}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        <button
          className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('overview')}
        >
          Vue d'ensemble
        </button>
        <button
          className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'consultations'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('consultations')}
        >
          Consultations ({consultations.length})
        </button>
        <button
          className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'invoices'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('invoices')}
        >
          Factures ({invoices.length})
        </button>
        <button
          className={`px-6 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
            activeTab === 'documents'
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setActiveTab('documents')}
        >
          Documents
        </button>
      </div>

      {/* Tab content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AJOUT: Résumé rapide des statistiques du patient */}
            <div className="bg-white rounded-xl shadow p-6 lg:col-span-2">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Résumé du dossier</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-primary-50 rounded-lg">
                  <div className="text-2xl font-bold text-primary-600">{consultations.length}</div>
                  <div className="text-sm text-gray-600">Consultations</div>
                </div>
                <div className="text-center p-3 bg-secondary-50 rounded-lg">
                  <div className="text-2xl font-bold text-secondary-600">{invoices.length}</div>
                  <div className="text-sm text-gray-600">Factures</div>
                </div>
                <div className="text-center p-3 bg-accent-50 rounded-lg">
                  <div className="text-2xl font-bold text-accent-600">
                    {invoices.filter(i => i.status === 'paid').length}
                  </div>
                  <div className="text-sm text-gray-600">Factures payées</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {consultations.filter(c => c.status === 'completed').length}
                  </div>
                  <div className="text-sm text-gray-600">Consultations terminées</div>
                </div>
              </div>
            </div>

            {/* AJOUT : Section Profession - Champ manquant dans la vue d'ensemble */}
            {patient.profession && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User size={20} className="mr-2 text-gray-600" />
                  Profession
                </h3>
                <p className="text-gray-700">{patient.profession}</p>
              </div>
            )}

            {/* AJOUT : Section Traitement actuel - Champ manquant dans la vue d'ensemble */}
            {patient.currentTreatment && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Pill size={20} className="mr-2 text-gray-600" />
                  Traitement actuel
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap">{patient.currentTreatment}</p>
              </div>
            )}

            {/* AJOUT : Section Motif de consultation - Champ manquant dans la vue d'ensemble */}
            {patient.consultationReason && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText size={20} className="mr-2 text-gray-600" />
                  Motif de consultation
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap">{patient.consultationReason}</p>
              </div>
            )}

            {/* AJOUT : Section Antécédents médicaux - Champ manquant dans la vue d'ensemble */}
            {patient.medicalAntecedents && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <AlertTriangle size={20} className="mr-2 text-gray-600" />
                  Antécédents médicaux
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap">{patient.medicalAntecedents}</p>
              </div>
            )}

            {/* AJOUT : Section Traitement ostéopathique - Champ manquant dans la vue d'ensemble */}
            {patient.osteopathicTreatment && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Stethoscope size={20} className="mr-2 text-gray-600" />
                  Traitement ostéopathique
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap">{patient.osteopathicTreatment}</p>
              </div>
            )}

            {/* AJOUT : Section Historique des traitements - Champ manquant dans la vue d'ensemble */}
            {patient.treatmentHistory && patient.treatmentHistory.length > 0 && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <History size={20} className="mr-2 text-gray-600" />
                  Historique des traitements
                </h3>
                <div className="space-y-4">
                  {patient.treatmentHistory.map((treatment, index) => (
                    <div key={index} className="border-l-4 border-primary-200 pl-4 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">
                          {treatment.date ? new Date(treatment.date).toLocaleDateString('fr-FR') : 'Date non spécifiée'}
                        </span>
                        {treatment.provider && (
                          <span className="text-sm text-gray-500">{treatment.provider}</span>
                        )}
                      </div>
                      <p className="text-gray-700">{treatment.treatment}</p>
                      {treatment.notes && (
                        <p className="text-sm text-gray-600 mt-1">{treatment.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AJOUT : Section Rendez-vous passés - Champ manquant dans la vue d'ensemble */}
            {patient.pastAppointments && patient.pastAppointments.length > 0 && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Calendar size={20} className="mr-2 text-gray-600" />
                  Rendez-vous passés
                </h3>
                <div className="space-y-3">
                  {patient.pastAppointments.map((appointment, index) => (
                    <div key={index} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">
                          {appointment.date ? new Date(appointment.date).toLocaleDateString('fr-FR') : 'Date non spécifiée'}
                        </div>
                        {appointment.notes && (
                          <p className="text-sm text-gray-600 mt-1">{appointment.notes}</p>
                        )}
                      </div>
                      {appointment.isHistorical && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          Historique
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AJOUT : Section Tags/Symptômes - Champ manquant dans la vue d'ensemble */}
            {patient.tags && patient.tags.length > 0 && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Tag size={20} className="mr-2 text-gray-600" />
                  Symptômes / Syndromes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {patient.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-50 text-primary-700 border border-primary-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AJOUT : Section Documents médicaux - Champ manquant dans la vue d'ensemble */}
            {patient.documents && patient.documents.length > 0 && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText size={20} className="mr-2 text-gray-600" />
                  Documents médicaux ({patient.documents.length})
                </h3>
                <div className="space-y-2">
                  {patient.documents.slice(0, 3).map((document, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <FileText size={16} className="mr-2 text-gray-500" />
                        <div>
                          <div className="font-medium text-gray-900">{document.originalName || document.name}</div>
                          <div className="text-sm text-gray-500">
                            {document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString('fr-FR') : 'Date inconnue'}
                          </div>
                        </div>
                      </div>
                      <a
                        href={document.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700 text-sm"
                      >
                        Voir
                      </a>
                    </div>
                  ))}
                  {patient.documents.length > 3 && (
                    <div className="text-center">
                      <button
                        onClick={() => setActiveTab('documents')}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        Voir tous les documents ({patient.documents.length})
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AJOUT : Section Métadonnées du dossier - Informations système manquantes */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Info size={20} className="mr-2 text-gray-600" />
                Informations du dossier
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Dossier créé le</div>
                  <div className="font-medium text-gray-900">
                    {patient.createdAt ? new Date(patient.createdAt).toLocaleDateString('fr-FR') : 'Date inconnue'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Dernière modification</div>
                  <div className="font-medium text-gray-900">
                    {patient.updatedAt ? new Date(patient.updatedAt).toLocaleDateString('fr-FR') : 'Date inconnue'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Statut du dossier</div>
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    <span className="font-medium text-green-700">Actif</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">ID du dossier</div>
                  <div className="font-mono text-sm text-gray-600">{patient.id}</div>
                </div>
              </div>
            </div>

            {/* AJOUT: Section Profession - Information manquante */}
            {patient.profession && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <User size={20} className="mr-2 text-gray-600" />
                  Profession
                </h3>
                <p className="text-gray-900">{patient.profession}</p>
              </div>
            )}

            {/* AJOUT: Section Assurance - Informations manquantes */}
            {(patient.insurance?.provider || patient.insurance?.policyNumber) && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Shield size={20} className="mr-2 text-gray-600" />
                  Informations d'assurance
                </h3>
                <div className="space-y-2">
                  {patient.insurance?.provider && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">Mutuelle: </span>
                      <span className="text-gray-900">{patient.insurance.provider}</span>
                    </div>
                  )}
                  {patient.insurance?.policyNumber && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">Numéro d'assuré: </span>
                      <span className="text-gray-900">{patient.insurance.policyNumber}</span>
                    </div>
                  )}
                  {patient.insurance?.expiryDate && (
                    <div>
                      <span className="text-sm font-medium text-gray-500">Date d'expiration: </span>
                      <span className="text-gray-900">{new Date(patient.insurance.expiryDate).toLocaleDateString('fr-FR')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AJOUT: Section Traitement ostéopathique - Information manquante */}
            {patient.osteopathicTreatment && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Stethoscope size={20} className="mr-2 text-gray-600" />
                  Traitement ostéopathique
                </h3>
                <p className="text-gray-900 whitespace-pre-wrap">
                  {cleanDecryptedField(patient.osteopathicTreatment, false, 'Aucun traitement ostéopathique spécifique renseigné')}
                </p>
              </div>
            )}

            {/* AJOUT: Section Historique des traitements - Information manquante */}
            {patient.treatmentHistory && patient.treatmentHistory.length > 0 && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <History size={20} className="mr-2 text-gray-600" />
                  Historique des traitements
                </h3>
                <div className="space-y-4">
                  {patient.treatmentHistory.map((treatment, index) => (
                    <div key={index} className="border-l-4 border-primary-200 pl-4 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">{treatment.treatment}</span>
                        {treatment.date && (
                          <span className="text-sm text-gray-500">
                            {new Date(treatment.date).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                      </div>
                      {treatment.provider && (
                        <p className="text-sm text-gray-600">Prestataire: {treatment.provider}</p>
                      )}
                      {treatment.notes && (
                        <p className="text-sm text-gray-600 mt-1">{treatment.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AJOUT: Section Rendez-vous passés - Information manquante */}
            {patient.pastAppointments && patient.pastAppointments.length > 0 && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Calendar size={20} className="mr-2 text-gray-600" />
                  Rendez-vous passés
                </h3>
                <div className="space-y-3">
                  {patient.pastAppointments.slice(0, 5).map((appointment, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-gray-900">
                          {new Date(appointment.date).toLocaleDateString('fr-FR')} à{' '}
                          {new Date(appointment.date).toLocaleTimeString('fr-FR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                        {appointment.notes && (
                          <p className="text-sm text-gray-600 mt-1">{appointment.notes}</p>
                        )}
                      </div>
                      {appointment.isHistorical && (
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">
                          Historique
                        </span>
                      )}
                    </div>
                  ))}
                  {patient.pastAppointments.length > 5 && (
                    <p className="text-sm text-gray-500 text-center">
                      ... et {patient.pastAppointments.length - 5} autre(s) rendez-vous
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* AJOUT: Section Tags/Symptômes - Information manquante */}
            {patient.tags && patient.tags.length > 0 && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <Tag size={20} className="mr-2 text-gray-600" />
                  Symptômes / Syndromes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {patient.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-primary-50 text-primary-700 border border-primary-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AJOUT: Section Documents - Information manquante */}
            {patient.documents && patient.documents.length > 0 && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                  <FileText size={20} className="mr-2 text-gray-600" />
                  Documents médicaux ({patient.documents.length})
                </h3>
                <div className="space-y-2">
                  {patient.documents.slice(0, 3).map((document, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <FileText size={16} className="text-gray-500 mr-2" />
                        <div>
                          <div className="font-medium text-gray-900">{document.originalName || document.name}</div>
                          <div className="text-sm text-gray-500">
                            {document.category && `${document.category} • `}
                            {new Date(document.uploadedAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      </div>
                      <a
                        href={document.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700"
                      >
                        <Eye size={16} />
                      </a>
                    </div>
                  ))}
                  {patient.documents.length > 3 && (
                    <p className="text-sm text-gray-500 text-center">
                      ... et {patient.documents.length - 3} autre(s) document(s)
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* AJOUT: Section Métadonnées du dossier - Informations manquantes */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Info size={20} className="mr-2 text-gray-600" />
                Informations du dossier
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-500">Créé le: </span>
                  <span className="text-gray-900">
                    {patient.createdAt ? new Date(patient.createdAt).toLocaleDateString('fr-FR') : 'Date inconnue'}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">Dernière modification: </span>
                  <span className="text-gray-900">
                    {patient.updatedAt ? new Date(patient.updatedAt).toLocaleDateString('fr-FR') : 'Date inconnue'}
                  </span>
                </div>
                {patient.createdBy && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Créé par: </span>
                    <span className="text-gray-900">{patient.createdBy}</span>
                  </div>
                )}
                {patient.isTestData && (
                  <div>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Données de test
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* AJOUT: Dernières consultations (aperçu rapide) */}
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Dernières consultations</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('consultations')}
                  rightIcon={<ArrowLeft className="rotate-180" size={14} />}
                >
                  Voir tout
                </Button>
              </div>
              {consultations.length > 0 ? (
                <div className="space-y-3">
                  {consultations.slice(0, 3).map((consultation) => (
                    <div key={consultation.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          {formatDateTime(consultation.date)}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getConsultationStatusColor(consultation.status)}`}>
                          {getConsultationStatusText(consultation.status)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 truncate">
                        {cleanDecryptedField(consultation.reason, false, 'Consultation ostéopathique')}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">{consultation.duration || 60} min</span>
                        <span className="text-xs font-medium text-gray-700">{consultation.price || 60} €</span>
                      </div>
                    </div>
                  ))}
                  {consultations.length > 3 && (
                    <p className="text-sm text-gray-500 text-center">
                      +{consultations.length - 3} autres consultations
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 italic text-center py-4">Aucune consultation enregistrée</p>
              )}
            </div>

            {/* AJOUT: Factures récentes (aperçu rapide) */}
            <div className="bg-white rounded-xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Factures récentes</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('invoices')}
                  rightIcon={<ArrowLeft className="rotate-180" size={14} />}
                >
                  Voir tout
                </Button>
              </div>
              {invoices.length > 0 ? (
                <div className="space-y-3">
                  {invoices.slice(0, 3).map((invoice) => (
                    <div key={invoice.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          {invoice.number}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                          {getStatusText(invoice.status)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          {formatDate(invoice.issueDate)}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{invoice.total} €</span>
                      </div>
                    </div>
                  ))}
                  {invoices.length > 3 && (
                    <p className="text-sm text-gray-500 text-center">
                      +{invoices.length - 3} autres factures
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 italic text-center py-4">Aucune facture créée</p>
              )}
            </div>

            {/* AJOUT: Alertes et informations importantes */}
            <div className="bg-white rounded-xl shadow p-6 lg:col-span-2">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Alertes et informations importantes</h3>
              <div className="space-y-3">
                {/* Alerte pour prochain rendez-vous */}
                {patient.nextAppointment && (
                  <div className="flex items-center p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <Calendar size={16} className="text-blue-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">Prochain rendez-vous programmé</p>
                      <p className="text-sm text-blue-700">
                        {formatDate(patient.nextAppointment.split('T')[0])} à {patient.nextAppointment.split('T')[1]?.slice(0, 5)}
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Alerte pour factures impayées */}
                {invoices.filter(i => i.status === 'draft' || i.status === 'sent').length > 0 && (
                  <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <AlertCircle size={16} className="text-yellow-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-yellow-900">
                        {invoices.filter(i => i.status === 'draft' || i.status === 'sent').length} facture(s) en attente de paiement
                      </p>
                      <p className="text-sm text-yellow-700">
                        Total: {invoices.filter(i => i.status === 'draft' || i.status === 'sent').reduce((sum, i) => sum + i.total, 0)} €
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Alerte si aucune consultation récente */}
                {consultations.length === 0 && (
                  <div className="flex items-center p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <Stethoscope size={16} className="text-gray-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Aucune consultation enregistrée</p>
                      <p className="text-sm text-gray-600">Commencez par ajouter une première consultation</p>
                    </div>
                  </div>
                )}
                
                {/* Message si tout va bien */}
                {patient.nextAppointment && 
                 invoices.filter(i => i.status === 'draft' || i.status === 'sent').length === 0 && 
                 consultations.length > 0 && (
                  <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle size={16} className="text-green-600 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Dossier à jour</p>
                      <p className="text-sm text-green-700">Toutes les informations sont complètes</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Medical History */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Historique médical</h3>
              {patient.medicalHistory ? (
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {cleanDecryptedField(patient.medicalHistory, false, 'Aucun historique médical renseigné')}
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 italic">Aucun historique médical renseigné</p>
              )}
            </div>

            {/* AJOUT: Actions rapides */}
            <div className="bg-white rounded-xl shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Actions rapides</h3>
              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  fullWidth
                  leftIcon={<Plus size={16} />}
                  onClick={() => setIsNewConsultationModalOpen(true)}
                >
                  Nouvelle consultation
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  leftIcon={<FileText size={16} />}
                  onClick={() => setIsNewInvoiceModalOpen(true)}
                >
                  Nouvelle facture
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  leftIcon={<Upload size={16} />}
                  onClick={() => setIsAddDocumentModalOpen(true)}
                >
                  Ajouter un document
                </Button>
                <Button
                  variant="outline"
                  fullWidth
                  leftIcon={<Edit size={16} />}
                  onClick={() => setIsEditModalOpen(true)}
                >
                  Modifier le dossier
                </Button>
              </div>
            </div>

            {/* Current Treatment */}
            {patient.currentTreatment && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Traitement actuel</h3>
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {cleanDecryptedField(patient.currentTreatment, false, 'Aucun traitement actuel')}
                  </p>
                </div>
              </div>
            )}

            {/* Consultation Reason */}
            {patient.consultationReason && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Motif de consultation</h3>
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {cleanDecryptedField(patient.consultationReason, false, 'Aucun motif spécifique')}
                  </p>
                </div>
              </div>
            )}

            {/* Medical Antecedents */}
            {patient.medicalAntecedents && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Antécédents médicaux</h3>
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {cleanDecryptedField(patient.medicalAntecedents, false, 'Aucun antécédent médical renseigné')}
                  </p>
                </div>
              </div>
            )}

            {/* Osteopathic Treatment */}
            {patient.osteopathicTreatment && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Traitement ostéopathique</h3>
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {cleanDecryptedField(patient.osteopathicTreatment, false, 'Aucun traitement ostéopathique spécifique')}
                  </p>
                </div>
              </div>
            )}

            {/* Notes */}
            {patient.notes && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Notes</h3>
                <div className="prose prose-sm max-w-none">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {cleanDecryptedField(patient.notes, false, 'Aucune note')}
                  </p>
                </div>
              </div>
            )}

            {/* Insurance */}
            {patient.insurance && (
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Assurance</h3>
                <div className="space-y-2">
                  <p className="text-gray-700">
                    <span className="font-medium">Mutuelle:</span> {cleanDecryptedField(patient.insurance.provider, false, 'Non renseignée')}
                  </p>
                  {patient.insurance.policyNumber && (
                    <p className="text-gray-700">
                      <span className="font-medium">Numéro:</span> {cleanDecryptedField(patient.insurance.policyNumber, false, 'Non renseigné')}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Treatment History */}
            {patient.treatmentHistory && patient.treatmentHistory.length > 0 && (
              <div className="bg-white rounded-xl shadow p-6 lg:col-span-2">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Historique des traitements</h3>
                <div className="space-y-4">
                  {patient.treatmentHistory.map((treatment, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          {formatDate(treatment.date)}
                        </span>
                        {treatment.provider && (
                          <span className="text-sm text-gray-500">{treatment.provider}</span>
                        )}
                      </div>
                      <p className="text-gray-700 mb-2">{treatment.treatment}</p>
                      {treatment.notes && (
                        <p className="text-sm text-gray-500">{treatment.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past Appointments */}
            {patient.pastAppointments && patient.pastAppointments.length > 0 && (
              <div className="bg-white rounded-xl shadow p-6 lg:col-span-2">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Rendez-vous passés</h3>
                <div className="space-y-3">
                  {patient.pastAppointments.map((appointment, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center">
                        <History size={16} className="text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(appointment.date.split('T')[0])} à {appointment.date.split('T')[1]?.slice(0, 5)}
                          </div>
                          {appointment.notes && (
                            <div className="text-sm text-gray-500">{appointment.notes}</div>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">Historique</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'consultations' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Consultations</h3>
              <Button
                variant="primary"
                leftIcon={<Plus size={16} />}
                onClick={() => setIsNewConsultationModalOpen(true)}
              >
                Nouvelle consultation
              </Button>
            </div>

            {consultations.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow">
                <Stethoscope size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">Aucune consultation</h3>
                <p className="text-gray-500 mb-4">
                  Aucune consultation n'a encore été enregistrée pour ce patient.
                </p>
                <Button
                  variant="primary"
                  leftIcon={<Plus size={16} />}
                  onClick={() => setIsNewConsultationModalOpen(true)}
                >
                  Ajouter une consultation
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {consultations.map((consultation) => (
                  <div key={consultation.id} className="bg-white rounded-xl shadow p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-lg font-medium text-gray-900">
                            {formatDateTime(consultation.date)}
                          </h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getConsultationStatusColor(consultation.status)}`}>
                            {getConsultationStatusText(consultation.status)}
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-gray-500 space-x-4">
                          <div className="flex items-center">
                            <Clock size={14} className="mr-1" />
                            <span>{consultation.duration || 60} min</span>
                          </div>
                          <div className="flex items-center">
                            <CreditCard size={14} className="mr-1" />
                            <span>{consultation.price || 60} €</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Eye size={16} />}
                          onClick={() => handleViewConsultation(consultation.id)}
                        >
                          Voir
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Edit size={16} />}
                          onClick={() => handleEditConsultation(consultation.id)}
                        >
                          Modifier
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Trash2 size={16} />}
                          onClick={() => handleDeleteConsultation(consultation.id)}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-1">Motif</h5>
                        <p className="text-gray-900">
                          {cleanDecryptedField(consultation.reason, false, 'Consultation ostéopathique')}
                        </p>
                      </div>

                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-1">Traitement</h5>
                        <p className="text-gray-900 whitespace-pre-wrap">
                          {cleanDecryptedField(consultation.treatment, false, 'Traitement ostéopathique standard')}
                        </p>
                      </div>

                      {consultation.notes && cleanDecryptedField(consultation.notes, false, '') && (
                        <div>
                          <h5 className="text-sm font-medium text-gray-700 mb-1">Notes</h5>
                          <p className="text-gray-900 whitespace-pre-wrap">
                            {cleanDecryptedField(consultation.notes, false, '')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Factures</h3>
              <Button
                variant="primary"
                leftIcon={<Plus size={16} />}
                onClick={() => setIsNewInvoiceModalOpen(true)}
              >
                Nouvelle facture
              </Button>
            </div>

            {invoices.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl shadow">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">Aucune facture</h3>
                <p className="text-gray-500 mb-4">
                  Aucune facture n'a encore été créée pour ce patient.
                </p>
                <Button
                  variant="primary"
                  leftIcon={<Plus size={16} />}
                  onClick={() => setIsNewInvoiceModalOpen(true)}
                >
                  Créer une facture
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="bg-white rounded-xl shadow p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h4 className="text-lg font-medium text-gray-900">
                            Facture {invoice.number}
                          </h4>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                            {getStatusText(invoice.status)}
                          </span>
                        </div>
                        <div className="flex items-center text-sm text-gray-500 space-x-4">
                          <div className="flex items-center">
                            <Calendar size={14} className="mr-1" />
                            <span>Émise le {formatDate(invoice.issueDate)}</span>
                          </div>
                          <div className="flex items-center">
                            <CreditCard size={14} className="mr-1" />
                            <span className="font-medium">{invoice.total} €</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Link to={`/invoices/${invoice.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<Eye size={16} />}
                          >
                            Voir
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Edit size={16} />}
                          onClick={() => handleEditInvoice(invoice.id)}
                        >
                          Modifier
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Trash2 size={16} />}
                          onClick={() => handleDeleteInvoice(invoice.id, invoice.number)}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </div>

                    {invoice.notes && (
                      <div>
                        <h5 className="text-sm font-medium text-gray-700 mb-1">Notes</h5>
                        <p className="text-gray-900">{invoice.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-gray-900">Documents</h3>
              <Button
                variant="primary"
                leftIcon={<Upload size={16} />}
                onClick={() => setIsAddDocumentModalOpen(true)}
              >
                Ajouter un document
              </Button>
            </div>

            {patient.documents && patient.documents.length > 0 ? (
              <div className="space-y-4">
                {patient.documents.map((document, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center">
                      <FileText size={20} className="text-gray-400 mr-3" />
                      <div>
                        <div className="font-medium text-gray-900">{document.name}</div>
                        <div className="text-sm text-gray-500">
                          Ajouté le {formatDate(document.uploadedAt)}
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Eye size={16} />}
                        onClick={() => window.open(document.url, '_blank')}
                      >
                        Voir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Download size={16} />}
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = document.url;
                          link.download = document.originalName;
                          link.click();
                        }}
                      >
                        Télécharger
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-1">Aucun document</h3>
                <p className="text-gray-500 mb-4">
                  Aucun document n'a encore été ajouté pour ce patient.
                </p>
                <Button
                  variant="primary"
                  leftIcon={<Upload size={16} />}
                  onClick={() => setIsAddDocumentModalOpen(true)}
                >
                  Ajouter le premier document
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <EditPatientModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        patient={patient}
      />

      <DeletePatientModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeletePatient}
        isLoading={isDeletingPatient}
        patientName={`${patient.firstName} ${patient.lastName}`}
        patientId={patient.id}
      />

      <AddDocumentModal
        isOpen={isAddDocumentModalOpen}
        onClose={() => setIsAddDocumentModalOpen(false)}
        onSuccess={handleDocumentSuccess}
        patientId={patient.id}
      />

      <NewInvoiceModal
        isOpen={isNewInvoiceModalOpen}
        onClose={() => setIsNewInvoiceModalOpen(false)}
        onSuccess={handleInvoiceSuccess}
        preselectedPatientId={patient.id}
      />

      {selectedInvoiceId && (
        <EditInvoiceModal
          isOpen={isEditInvoiceModalOpen}
          onClose={() => {
            setIsEditInvoiceModalOpen(false);
            setSelectedInvoiceId(null);
          }}
          onSuccess={handleInvoiceSuccess}
          invoiceId={selectedInvoiceId}
        />
      )}

      <DeleteInvoiceModal
        isOpen={isDeleteInvoiceModalOpen}
        onClose={() => {
          setIsDeleteInvoiceModalOpen(false);
          setInvoiceToDelete(null);
        }}
        onConfirm={confirmInvoiceDeletion}
        isLoading={isDeletingInvoice}
        invoiceNumber={invoiceToDelete?.number || ''}
      />

      <NewConsultationModal
        isOpen={isNewConsultationModalOpen}
        onClose={() => setIsNewConsultationModalOpen(false)}
        onSuccess={handleConsultationSuccess}
        preselectedPatientId={patient.id}
        preselectedPatientName={`${patient.firstName} ${patient.lastName}`}
      />

      {selectedConsultationId && (
        <>
          <EditConsultationModal
            isOpen={isEditConsultationModalOpen}
            onClose={() => {
              setIsEditConsultationModalOpen(false);
              setSelectedConsultationId(null);
            }}
            onSuccess={handleConsultationSuccess}
            consultationId={selectedConsultationId}
          />

          <ViewConsultationModal
            isOpen={isViewConsultationModalOpen}
            onClose={() => {
              setIsViewConsultationModalOpen(false);
              setSelectedConsultationId(null);
            }}
            consultationId={selectedConsultationId}
          />
        </>
      )}

      <DeleteConsultationModal
        isOpen={isDeleteConsultationModalOpen}
        onClose={() => {
          setIsDeleteConsultationModalOpen(false);
          setConsultationToDelete(null);
        }}
        onConfirm={confirmConsultationDeletion}
        isLoading={isDeletingConsultation}
        consultationInfo={consultationToDelete || {
          id: '',
          patientName: '',
          date: '',
          time: ''
        }}
      />
    </div>
  );
};

export default PatientDetail;