import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Search,
  X,
  AlertCircle,
  Loader2,
  Filter,
  Calendar as CalendarIcon,
  Clock,
  User,
  Edit,
  Trash2,
  RefreshCw,
  Plus,
  FileText
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import CalendarView from '../../components/calendar/CalendarView';
import NewConsultationModal from '../../components/modals/NewConsultationModal';
import EditConsultationModal from '../../components/modals/EditConsultationModal';
import DeleteConsultationModal from '../../components/modals/DeleteConsultationModal';
import { 
  format, 
  isFuture,
  parseISO
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, doc, getDoc, getDocs, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { ConsultationService } from '../../services/consultationService';
import { AppointmentService } from '../../services/appointmentService';

interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  practitionerId: string;
  practitionerName: string;
  date: Date;
  endTime: Date;
  duration: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'completed';
  type: string;
  location: {
    type: 'office' | 'hospital';
    name: string;
  };
  notes?: string;
  osteopathId: string;
  consultationId?: string;
}

interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  date: Date;
  reason: string;
  treatment: string;
  notes: string;
  status: 'draft' | 'completed';
  appointmentId?: string;
  osteopathId: string;
}

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

const Consultations: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [patientNotFound, setPatientNotFound] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [mappedConsultationsForCalendar, setMappedConsultationsForCalendar] = useState<Appointment[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  
  // Modal states
  const [isNewConsultationModalOpen, setIsNewConsultationModalOpen] = useState(false);
  const [isEditConsultationModalOpen, setIsEditConsultationModalOpen] = useState(false);
  const [isDeleteConsultationModalOpen, setIsDeleteConsultationModalOpen] = useState(false);
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);
  const [consultationToDelete, setConsultationToDelete] = useState<{
    id: string;
    patientName: string;
    date: string;
    time: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Track window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // Check for action parameter to open new consultation modal
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'new') {
      setIsNewConsultationModalOpen(true);
      // Clean up URL without causing a page reload
      window.history.replaceState({}, '', '/consultations');
    }
  }, [location]);

  // Chargement des rendez-vous (pour l'agenda)
  const loadAppointments = useCallback(async () => {
    if (!auth.currentUser) {
      console.log('No authenticated user, skipping appointments load');
      return;
    }

    console.log('🔄 Loading appointments for user:', auth.currentUser.uid);
    setError(null);

    try {
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );

      console.log('📡 Executing appointments query...');
      const snapshot = await getDocs(appointmentsQuery);
      console.log('📊 Query returned', snapshot.docs.length, 'documents');

      const appointmentsData: Appointment[] = [];
      for (const docSnapshot of snapshot.docs) {
        try {
          const appointmentData = docSnapshot.data();
          
          if (!appointmentData.patientId || !appointmentData.date || !appointmentData.osteopathId) {
            continue;
          }

          if (appointmentData.osteopathId !== auth.currentUser!.uid) {
            continue;
          }

          let appointmentDate: Date;
          let endTime: Date;

          try {
            if (appointmentData.date?.toDate) {
              appointmentDate = appointmentData.date.toDate();
            } else if (appointmentData.date?.seconds) {
              appointmentDate = new Date(appointmentData.date.seconds * 1000);
            } else if (typeof appointmentData.date === 'string') {
              appointmentDate = new Date(appointmentData.date);
            } else if (appointmentData.date instanceof Date) {
              appointmentDate = appointmentData.date;
            } else {
              throw new Error('Invalid date format');
            }

            if (isNaN(appointmentDate.getTime())) {
              throw new Error('Invalid date value');
            }

            // Calculer endTime à partir de la durée
            const duration = appointmentData.duration || 60;
            endTime = new Date(appointmentDate.getTime() + duration * 60000);

            // Validation de endTime
            if (isNaN(endTime.getTime())) {
              const duration = appointmentData.duration || 60;
              endTime = new Date(appointmentDate.getTime() + duration * 60000);
            }

          } catch (dateError) {
            console.error('❌ Error parsing dates for appointment:', docSnapshot.id, dateError);
            continue;
          }

          let patientName = appointmentData.patientName || 'Patient inconnu';

          if (appointmentData.patientId) {
            try {
              const patientDoc = await getDoc(doc(db, 'patients', appointmentData.patientId));
              if (patientDoc.exists()) {
                const patientData = patientDoc.data();
                patientName = `${patientData.firstName} ${patientData.lastName}`;
              } else {
                patientName = appointmentData.patientName || 'Patient supprimé';
              }
            } catch (patientError) {
              patientName = appointmentData.patientName || 'Patient inaccessible';
            }
          }

          const appointment: Appointment = {
            id: docSnapshot.id,
            patientId: appointmentData.patientId || '',
            patientName: patientName,
            practitionerId: appointmentData.practitionerId || appointmentData.osteopathId || auth.currentUser!.uid,
            practitionerName: appointmentData.practitionerName || auth.currentUser!.displayName || 'Ostéopathe',
            date: appointmentDate,
            endTime: endTime,
            duration: appointmentData.duration || 60,
            status: appointmentData.status || 'confirmed',
            type: appointmentData.type || 'Consultation standard',
            location: appointmentData.location || {
              type: 'office',
              name: 'Cabinet principal'
            },
            notes: appointmentData.notes || '',
            osteopathId: appointmentData.osteopathId,
            consultationId: appointmentData.consultationId || undefined
          };

          appointmentsData.push(appointment);

        } catch (error) {
          console.error('❌ Error processing appointment:', docSnapshot.id, error);
        }
      }

      appointmentsData.sort((a, b) => a.date.getTime() - b.date.getTime());
      setAppointments(appointmentsData);
      return appointmentsData;

    } catch (error) {
      console.error('❌ Error loading appointments:', error);
      setError('Erreur lors du chargement des rendez-vous: ' + (error as Error).message);
      throw error;
    }
  }, []);

  // Chargement des consultations (pour l'agenda)
  const loadConsultationsForCalendar = useCallback(async () => {
    if (!auth.currentUser) {
      console.log('No authenticated user, skipping consultations load');
      return;
    }

    console.log('🔄 Loading consultations for calendar for user:', auth.currentUser.uid);
    setError(null);

    try {
      const consultationsRef = collection(db, 'consultations');
      const consultationsQuery = query(
        consultationsRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );

      console.log('📡 Executing consultations query...');
      const snapshot = await getDocs(consultationsQuery);
      console.log('📊 Query returned', snapshot.docs.length, 'documents');

      const mappedConsultationsData: Appointment[] = [];
      const invalidConsultations: any[] = [];
      for (const docSnapshot of snapshot.docs) {
        try {
          const consultationData = docSnapshot.data();
          
          if (!consultationData.patientId) {
            console.warn('❌ Missing patientId for consultation:', docSnapshot.id);
            invalidConsultations.push({ id: docSnapshot.id, reason: 'Missing patientId' });
            continue;
          }

          if (!consultationData.date) {
            console.warn('❌ Missing date for consultation:', docSnapshot.id);
            invalidConsultations.push({ id: docSnapshot.id, reason: 'Missing date' });
            continue;
          }

          if (!consultationData.osteopathId) {
            console.warn('❌ Missing osteopathId for consultation:', docSnapshot.id);
            invalidConsultations.push({ id: docSnapshot.id, reason: 'Missing osteopathId' });
            continue;
          }

          if (consultationData.osteopathId !== auth.currentUser!.uid) {
            console.warn('❌ Consultation does not belong to current user:', docSnapshot.id);
            continue;
          }

          let consultationDate: Date;
          let endTime: Date;

          try {
            if (consultationData.date?.toDate) {
              consultationDate = consultationData.date.toDate();
            } else if (consultationData.date?.seconds) {
              consultationDate = new Date(consultationData.date.seconds * 1000);
            } else if (typeof consultationData.date === 'string') {
              consultationDate = new Date(consultationData.date);
            } else if (consultationData.date instanceof Date) {
              consultationDate = consultationData.date;
            } else {
              throw new Error('Invalid date format');
            }

            if (isNaN(consultationDate.getTime())) {
              throw new Error('Invalid date value');
            }

            // Calculer endTime à partir de la durée de la consultation
            const duration = consultationData.duration || 60;
            endTime = new Date(consultationDate.getTime() + duration * 60000);

            // Validation de endTime
            if (isNaN(endTime.getTime())) {
              const duration = consultationData.duration || 60;
              endTime = new Date(consultationDate.getTime() + duration * 60000);
            }

          } catch (dateError) {
            console.error('❌ Error parsing dates for consultation:', docSnapshot.id, dateError);
            invalidConsultations.push({ id: docSnapshot.id, reason: 'Invalid date format', error: dateError });
            continue;
          }

          // ✅ Validation optionnelle du patient (ne pas bloquer si le patient n'existe plus)
          let patientExists = true;
          let patientName = consultationData.patientName || 'Patient inconnu';

          if (consultationData.patientId) {
            try {
              const patientDoc = await getDoc(doc(db, 'patients', consultationData.patientId));
              if (patientDoc.exists()) {
                const patientData = patientDoc.data();
                patientName = `${patientData.firstName} ${patientData.lastName}`;
              } else {
                console.warn('⚠️ Patient not found for consultation:', docSnapshot.id, consultationData.patientId);
                patientExists = false;
                // Ne pas exclure la consultation, juste marquer le patient comme inconnu
                patientName = consultationData.patientName || 'Patient supprimé';
              }
            } catch (patientError) {
              console.warn('⚠️ Error checking patient for consultation:', docSnapshot.id, patientError);
              patientExists = false;
              patientName = consultationData.patientName || 'Patient inaccessible';
            }
          }

          // ✅ Création de l'objet rendez-vous mappé depuis la consultation
          const mappedAppointment: Appointment = {
            id: docSnapshot.id,
            patientId: consultationData.patientId || '',
            patientName: patientName,
            practitionerId: consultationData.osteopathId || auth.currentUser!.uid,
            practitionerName: auth.currentUser!.displayName || 'Ostéopathe',
            date: consultationDate,
            endTime: endTime,
            duration: consultationData.duration || 60,
            status: consultationData.status === 'completed' ? 'completed' : 'confirmed',
            type: consultationData.reason || 'Consultation standard',
            location: {
              type: 'office',
              name: 'Cabinet principal'
            },
            notes: consultationData.notes || '',
            osteopathId: consultationData.osteopathId,
            consultationId: docSnapshot.id // Référence vers la consultation
          };

          mappedConsultationsData.push(mappedAppointment);
          console.log('✅ Successfully processed consultation:', mappedAppointment.id, {
            patient: mappedAppointment.patientName,
            date: mappedAppointment.date.toISOString(),
            status: mappedAppointment.status,
            patientExists
          });

        } catch (error) {
          console.error('❌ Error processing consultation:', docSnapshot.id, error);
          invalidConsultations.push({ id: docSnapshot.id, reason: 'Processing error', error });
        }
      }

      // ✅ Tri par date (ascendant pour un meilleur affichage dans le calendrier)
      mappedConsultationsData.sort((a, b) => a.date.getTime() - b.date.getTime());

      console.log('📈 Final consultations summary:', {
        total: mappedConsultationsData.length,
        valid: mappedConsultationsData.length,
        invalid: invalidConsultations.length,
        byStatus: {
          confirmed: mappedConsultationsData.filter(a => a.status === 'confirmed').length,
          pending: mappedConsultationsData.filter(a => a.status === 'pending').length,
          cancelled: mappedConsultationsData.filter(a => a.status === 'cancelled').length,
          completed: mappedConsultationsData.filter(a => a.status === 'completed').length
        }
      });

      if (invalidConsultations.length > 0) {
        console.warn('⚠️ Invalid consultations found:', invalidConsultations);
      }

      setMappedConsultationsForCalendar(mappedConsultationsData);
      return mappedConsultationsData;

    } catch (error) {
      console.error('❌ Error loading consultations for calendar:', error);
      setError('Erreur lors du chargement des consultations: ' + (error as Error).message);
      throw error;
    }
  }, []);

  // Chargement des consultations
  const loadConsultations = useCallback(async () => {
    if (!auth.currentUser) {
      console.log('No authenticated user, skipping consultations load');
      return;
    }

    try {
      const consultationsRef = collection(db, 'consultations');
      const consultationsQuery = query(
        consultationsRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );

      const snapshot = await getDocs(consultationsQuery);
      const consultationsData: Consultation[] = [];

      for (const docSnapshot of snapshot.docs) {
        try {
          const consultationData = docSnapshot.data();
          console.log('📋 Processing consultation:', docSnapshot.id, {
            patientId: consultationData.patientId,
            date: consultationData.date,
            status: consultationData.status,
            osteopathId: consultationData.osteopathId
          });

          let consultationDate: Date;

          try {
            if (consultationData.date?.toDate) {
              consultationDate = consultationData.date.toDate();
            } else if (consultationData.date?.seconds) {
              consultationDate = new Date(consultationData.date.seconds * 1000);
            } else if (typeof consultationData.date === 'string') {
              consultationDate = new Date(consultationData.date);
            } else if (consultationData.date instanceof Date) {
              consultationDate = consultationData.date;
            } else {
              throw new Error('Invalid date format');
            }

            if (isNaN(consultationDate.getTime())) {
              throw new Error('Invalid date value');
            }

          } catch (dateError) {
            console.error('❌ Error parsing dates for consultation:', docSnapshot.id, dateError);
            continue;
          }

          let patientName = consultationData.patientName || 'Patient inconnu';

          if (consultationData.patientId) {
            try {
              const patientDoc = await getDoc(doc(db, 'patients', consultationData.patientId));
              if (patientDoc.exists()) {
                const patientData = patientDoc.data();
                patientName = `${patientData.firstName} ${patientData.lastName}`;
              } else {
                patientName = consultationData.patientName || 'Patient supprimé';
              }
            } catch (patientError) {
              patientName = consultationData.patientName || 'Patient inaccessible';
            }
          }

          const consultation: Consultation = {
            id: docSnapshot.id,
            patientId: consultationData.patientId || '',
            patientName: patientName,
            date: consultationDate,
            reason: consultationData.reason || '',
            treatment: consultationData.treatment || '',
            notes: consultationData.notes || '',
            status: consultationData.status || 'draft',
            appointmentId: consultationData.appointmentId || undefined,
            osteopathId: consultationData.osteopathId
          };

          consultationsData.push(consultation);

        } catch (error) {
          console.error('❌ Error processing consultation:', docSnapshot.id, error);
        }
      }

      consultationsData.sort((a, b) => b.date.getTime() - a.date.getTime());
      setConsultations(consultationsData);
      return consultationsData;

    } catch (error) {
      console.error('❌ Error loading consultations:', error);
      setError('Erreur lors du chargement des consultations: ' + (error as Error).message);
      throw error;
    }
  }, []);

  // Chargement initial et configuration du listener en temps réel
  useEffect(() => {
    if (!auth.currentUser) {
      console.log('No authenticated user');
      setLoading(false);
      return;
    }

    console.log('🚀 Setting up consultations sync for user:', auth.currentUser.uid);
    setLoading(true);
    setError(null);

    // Chargement initial
    Promise.all([loadAppointments(), loadConsultations()])
      .then(() => {
        console.log('✅ Initial data load completed');
        setLoading(false);
      })
      .catch((error) => {
        console.error('❌ Initial data load failed:', error);
        setLoading(false);
      });

    // Configuration du listener en temps réel pour les rendez-vous
    try {
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );

      const appointmentsUnsubscribe = onSnapshot(
        appointmentsQuery,
        (snapshot) => {
          console.log('🔄 Appointments real-time update received, docs count:', snapshot.docs.length);
          if (!loading) {
            loadAppointments().catch(console.error);
          }
        },
        (error) => {
          console.error('❌ Appointments real-time listener error:', error);
          setError('Erreur de synchronisation en temps réel: ' + error.message);
        }
      );

      // Configuration du listener en temps réel pour les consultations
      const consultationsRef = collection(db, 'consultations');
      const consultationsQuery = query(
        consultationsRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );

      const consultationsUnsubscribe = onSnapshot(
        consultationsQuery,
        (snapshot) => {
          console.log('🔄 Consultations real-time update received, docs count:', snapshot.docs.length);
          if (!loading) {
            loadConsultations().catch(console.error);
          }
        },
        (error) => {
          console.error('❌ Consultations real-time listener error:', error);
          setError('Erreur de synchronisation en temps réel: ' + error.message);
        }
      );

      // Chargement des patients pour la recherche
      const loadPatients = async () => {
        try {
          console.log('👥 Loading patients...');
          const patientsRef = collection(db, 'patients');
          const patientsQuery = query(
            patientsRef,
            where('osteopathId', '==', auth.currentUser!.uid)
          );

          const patientsSnapshot = await getDocs(patientsQuery);
          const patientsData: Patient[] = patientsSnapshot.docs.map(doc => ({
            id: doc.id,
            firstName: doc.data().firstName,
            lastName: doc.data().lastName,
            phone: doc.data().phone || '',
            email: doc.data().email || ''
          }));

          patientsData.sort((a, b) => a.lastName.localeCompare(b.lastName));
          console.log('✅ Loaded patients:', patientsData.length);
          setPatients(patientsData);
        } catch (err) {
          console.error('❌ Error loading patients:', err);
        }
      };

      loadPatients();

      return () => {
        console.log('🔌 Cleaning up listeners');
        appointmentsUnsubscribe();
        consultationsUnsubscribe();
      };
    } catch (err) {
      console.error('❌ Error setting up sync:', err);
      setError('Erreur lors de la configuration de la synchronisation');
      setLoading(false);
    }
  }, []);

  // Fonction de rafraîchissement manuel
  const handleRefresh = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setRefreshing(true);
    }
    try {
      await Promise.all([loadAppointments(), loadConsultations()]);
      console.log('✅ Manual refresh completed');
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
    } finally {
      if (showLoading) {
        setRefreshing(false);
      }
    }
  }, [loadAppointments, loadConsultations]);

  // Handle patient link click
  const handlePatientClick = async (e: React.MouseEvent, patientId: string, patientName: string) => {
    e.preventDefault();
    
    if (!patientId) {
      setPatientNotFound(patientName);
      setTimeout(() => setPatientNotFound(null), 5000);
      return;
    }
    
    try {
      const patientDoc = await getDoc(doc(db, 'patients', patientId));
      
      if (patientDoc.exists()) {
        navigate(`/patients/${patientId}`);
      } else {
        setPatientNotFound(patientName);
        setTimeout(() => setPatientNotFound(null), 5000);
      }
    } catch (error) {
      console.error('Error checking patient:', error);
      setPatientNotFound(patientName);
    }
  };

  // Handle time slot click
  const handleTimeSlotClick = (day: Date, hour: number) => {
    // Ouvrir le modal de nouvelle consultation
    setIsNewConsultationModalOpen(true);
  };

  // Handle appointment edit (now consultation edit)
  const handleAppointmentEdit = (appointmentId: string) => {
    // Dans le contexte des consultations, appointmentId est en fait consultationId
    const consultation = consultations.find(c => c.id === appointmentId);
    if (consultation) {
      // Éditer directement la consultation
      setSelectedConsultationId(appointmentId);
      setIsEditConsultationModalOpen(true);
    } else {
      // Si pas trouvé dans les consultations, créer une nouvelle consultation
      setIsNewConsultationModalOpen(true);
    }
  };

  // Handle appointment delete
  const handleAppointmentDelete = (appointmentId: string) => {
    // Dans le contexte des consultations, appointmentId est en fait consultationId
    const consultation = consultations.find(c => c.id === appointmentId);
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

  // Handle consultation creation success
  const handleConsultationSuccess = () => {
    setIsNewConsultationModalOpen(false);
    setIsEditConsultationModalOpen(false);
    setSelectedConsultationId(null);
    // Le listener onSnapshot va automatiquement recharger les données
  };

  // Confirm consultation deletion
  const confirmConsultationDeletion = async () => {
    if (!consultationToDelete) return;

    setIsDeleting(true);
    try {
      await ConsultationService.deleteConsultation(consultationToDelete.id);
      
      setIsDeleteConsultationModalOpen(false);
      setConsultationToDelete(null);
      
      // Le listener onSnapshot va automatiquement recharger les données
    } catch (error) {
      console.error('Error deleting consultation:', error);
      setError('Erreur lors de la suppression de la consultation');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle appointment drag and drop
  const handleAppointmentDrop = async (appointmentId: string, newDate: Date, newTime: string) => {
    try {
      const appointment = appointments.find(a => a.id === appointmentId);
      if (!appointment) return;

      const [hours, minutes] = newTime.split(':').map(Number);
      const newDateTime = new Date(newDate);
      newDateTime.setHours(hours, minutes, 0, 0);
      const newEndTime = new Date(newDateTime.getTime() + appointment.duration * 60000);

      // Mettre à jour le rendez-vous
      await AppointmentService.updateAppointment(appointmentId, {
        date: newDateTime,
        endTime: newEndTime
      });

      // Si il y a une consultation liée, mettre à jour sa date aussi
      if (appointment.consultationId) {
        await ConsultationService.updateConsultation(appointment.consultationId, {
          date: newDateTime
        });
      }

    } catch (error) {
      console.error('Error moving appointment:', error);
      setError('Erreur lors du déplacement du rendez-vous');
    }
  };

  // Formatage de la date et de l'heure
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const isSmallScreen = windowWidth < 768;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-12">
        <div className="flex items-center space-x-2 text-gray-500">
          <Loader2 className="animate-spin" size={20} />
          <span>Chargement des consultations...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-error/5 border border-error/20 rounded-xl text-error">
        <AlertCircle className="mb-2" size={24} />
        <h3 className="font-medium">Erreur</h3>
        <p>{error}</p>
        <div className="mt-4 space-x-2">
          <Button
            variant="outline"
            onClick={() => handleRefresh(true)}
            leftIcon={<RefreshCw size={16} />}
            isLoading={refreshing}
          >
            Réessayer
          </Button>
          <Button
            variant="outline"
            onClick={() => setError(null)}
          >
            Masquer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-gray-900">Consultations & Agenda</h1>
          <div className="text-sm text-gray-500">
            {formatDate(currentDateTime)} - {formatTime(currentDateTime)}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="text-xs text-gray-400 self-center">
            Dernière mise à jour: {formatTime(lastRefreshTime)}
          </div>
          <Button 
            variant="primary" 
            leftIcon={<Plus size={16} />}
            onClick={() => setIsNewConsultationModalOpen(true)}
          >
            {isSmallScreen ? "Nouvelle" : "Nouvelle consultation"}
          </Button>
        </div>
      </div>

      {/* Patient not found error message */}
      {patientNotFound && (
        <div className="bg-error/5 border border-error/20 rounded-xl p-4 flex items-start">
          <AlertCircle className="text-error shrink-0 mt-0.5 mr-3" size={20} />
          <div className="flex-1">
            <h3 className="font-medium text-error">Patient non trouvé</h3>
            <p className="text-sm text-error/80 mt-1">
              Le patient "{patientNotFound}" n'a pas été trouvé dans la base de données.
            </p>
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigate('/patients?action=new');
                }}
              >
                Créer une nouvelle fiche patient
              </Button>
            </div>
          </div>
          <button 
            className="shrink-0 ml-3 text-error/60 hover:text-error"
            onClick={() => setPatientNotFound(null)}
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <div className="flex space-x-8">
          <div className="pb-2 px-1 border-b-2 border-primary-500 text-primary-600">
            <div className="flex items-center space-x-2">
              <CalendarIcon size={16} />
              <span className="font-medium text-sm">Agenda</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <CalendarView
        appointments={mappedConsultationsForCalendar}
        currentDate={currentDate}
        view={view}
        onDateChange={setCurrentDate}
        onViewChange={setView}
        onTimeSlotClick={handleTimeSlotClick}
        onAppointmentEdit={handleAppointmentEdit}
        onAppointmentDelete={handleAppointmentDelete}
        onAppointmentDrop={handleAppointmentDrop}
        preselectedPatientId={undefined}
        preselectedPatientName={undefined}
        onAddConsultation={handleAppointmentEdit}
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center">
            <CalendarIcon size={20} className="text-primary-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{appointments.length}</div>
              <div className="text-sm text-gray-500">Rendez-vous</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center">
            <FileText size={20} className="text-secondary-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{consultations.length}</div>
              <div className="text-sm text-gray-500">Consultations</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center">
            <Clock size={20} className="text-green-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {consultations.filter(c => c.status === 'completed').length}
              </div>
              <div className="text-sm text-gray-500">Terminées</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center">
            <AlertCircle size={20} className="text-yellow-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {consultations.filter(c => c.status === 'draft').length}
              </div>
              <div className="text-sm text-gray-500">En cours</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <NewConsultationModal
        isOpen={isNewConsultationModalOpen}
        onClose={() => {
          setIsNewConsultationModalOpen(false);
        }}
        onSuccess={handleConsultationSuccess}
      />

      {selectedConsultationId && (
        <EditConsultationModal
          isOpen={isEditConsultationModalOpen}
          onClose={() => {
            setIsEditConsultationModalOpen(false);
            setSelectedConsultationId(null);
          }}
          onSuccess={handleConsultationSuccess}
          consultationId={selectedConsultationId}
        />
      )}

      <DeleteConsultationModal
        isOpen={isDeleteConsultationModalOpen}
        onClose={() => {
          setIsDeleteConsultationModalOpen(false);
          setConsultationToDelete(null);
        }}
        onConfirm={confirmConsultationDeletion}
        isLoading={isDeleting}
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

export default Consultations;