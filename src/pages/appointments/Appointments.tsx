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
  RefreshCw
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import CalendarView from '../../components/calendar/CalendarView';
import EditAppointmentModal from '../../components/modals/EditAppointmentModal';
import DeleteAppointmentModal from '../../components/modals/DeleteAppointmentModal';
import AddConsultationModal from '../../components/modals/AddConsultationModal';
import { 
  format, 
  isFuture,
  parseISO
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { collection, doc, getDoc, getDocs, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
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

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

const Appointments: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPatientSearch, setShowPatientSearch] = useState(false);
  const [patientNotFound, setPatientNotFound] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  
  // Modal states
  const [isEditAppointmentModalOpen, setIsEditAppointmentModalOpen] = useState(false);
  const [isDeleteAppointmentModalOpen, setIsDeleteAppointmentModalOpen] = useState(false);
  const [isAddConsultationModalOpen, setIsAddConsultationModalOpen] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [appointmentToDelete, setAppointmentToDelete] = useState<{
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

  // Check for action parameter to open new appointment modal
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'new') {
      // Clean up URL without causing a page reload
      window.history.replaceState({}, '', '/appointments');
    }
  }, [location]);

  // FIXED: Fonction de chargement des rendez-vous avec gestion d'erreur améliorée
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
      const invalidAppointments: any[] = [];

      for (const docSnapshot of snapshot.docs) {
        try {
          const appointmentData = docSnapshot.data();
          console.log('📋 Processing appointment:', docSnapshot.id, {
            patientId: appointmentData.patientId,
            patientName: appointmentData.patientName,
            date: appointmentData.date,
            status: appointmentData.status,
            osteopathId: appointmentData.osteopathId
          });

          // ✅ Validation stricte des champs requis
          if (!appointmentData.patientId) {
            console.warn('❌ Missing patientId for appointment:', docSnapshot.id);
            invalidAppointments.push({ id: docSnapshot.id, reason: 'Missing patientId' });
            continue;
          }

          if (!appointmentData.date) {
            console.warn('❌ Missing date for appointment:', docSnapshot.id);
            invalidAppointments.push({ id: docSnapshot.id, reason: 'Missing date' });
            continue;
          }

          if (!appointmentData.osteopathId) {
            console.warn('❌ Missing osteopathId for appointment:', docSnapshot.id);
            invalidAppointments.push({ id: docSnapshot.id, reason: 'Missing osteopathId' });
            continue;
          }

          // ✅ Vérification de la propriété
          if (appointmentData.osteopathId !== auth.currentUser!.uid) {
            console.warn('❌ Appointment does not belong to current user:', docSnapshot.id);
            continue;
          }

          // ✅ Conversion des dates avec gestion d'erreur robuste
          let appointmentDate: Date;
          let endTime: Date;

          try {
            // Gestion des Timestamps Firestore
            if (appointmentData.date?.toDate) {
              appointmentDate = appointmentData.date.toDate();
            } else if (appointmentData.date?.seconds) {
              // Timestamp object avec seconds
              appointmentDate = new Date(appointmentData.date.seconds * 1000);
            } else if (typeof appointmentData.date === 'string') {
              appointmentDate = new Date(appointmentData.date);
            } else if (appointmentData.date instanceof Date) {
              appointmentDate = appointmentData.date;
            } else {
              throw new Error('Invalid date format');
            }

            // Validation de la date
            if (isNaN(appointmentDate.getTime())) {
              throw new Error('Invalid date value');
            }

            // Gestion de endTime
            if (appointmentData.endTime?.toDate) {
              endTime = appointmentData.endTime.toDate();
            } else if (appointmentData.endTime?.seconds) {
              endTime = new Date(appointmentData.endTime.seconds * 1000);
            } else if (typeof appointmentData.endTime === 'string') {
              endTime = new Date(appointmentData.endTime);
            } else if (appointmentData.endTime instanceof Date) {
              endTime = appointmentData.endTime;
            } else {
              // Calculer endTime à partir de la durée
              const duration = appointmentData.duration || 60;
              endTime = new Date(appointmentDate.getTime() + duration * 60000);
            }

            // Validation de endTime
            if (isNaN(endTime.getTime())) {
              const duration = appointmentData.duration || 60;
              endTime = new Date(appointmentDate.getTime() + duration * 60000);
            }

          } catch (dateError) {
            console.error('❌ Error parsing dates for appointment:', docSnapshot.id, dateError);
            invalidAppointments.push({ id: docSnapshot.id, reason: 'Invalid date format', error: dateError });
            continue;
          }

          // ✅ Validation optionnelle du patient (ne pas bloquer si le patient n'existe plus)
          let patientExists = true;
          let patientName = appointmentData.patientName || 'Patient inconnu';

          if (appointmentData.patientId) {
            try {
              const patientDoc = await getDoc(doc(db, 'patients', appointmentData.patientId));
              if (patientDoc.exists()) {
                const patientData = patientDoc.data();
                patientName = `${patientData.firstName} ${patientData.lastName}`;
              } else {
                console.warn('⚠️ Patient not found for appointment:', docSnapshot.id, appointmentData.patientId);
                patientExists = false;
                // Ne pas exclure le rendez-vous, juste marquer le patient comme inconnu
                patientName = appointmentData.patientName || 'Patient supprimé';
              }
            } catch (patientError) {
              console.warn('⚠️ Error checking patient for appointment:', docSnapshot.id, patientError);
              patientExists = false;
              patientName = appointmentData.patientName || 'Patient inaccessible';
            }
          }

          // ✅ Création de l'objet rendez-vous avec valeurs par défaut robustes
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
          console.log('✅ Successfully processed appointment:', appointment.id, {
            patient: appointment.patientName,
            date: appointment.date.toISOString(),
            status: appointment.status,
            patientExists
          });

        } catch (error) {
          console.error('❌ Error processing appointment:', docSnapshot.id, error);
          invalidAppointments.push({ id: docSnapshot.id, reason: 'Processing error', error });
        }
      }

      // ✅ Tri par date (ascendant pour un meilleur affichage dans le calendrier)
      appointmentsData.sort((a, b) => a.date.getTime() - b.date.getTime());

      console.log('📈 Final appointments summary:', {
        total: appointmentsData.length,
        valid: appointmentsData.length,
        invalid: invalidAppointments.length,
        byStatus: {
          confirmed: appointmentsData.filter(a => a.status === 'confirmed').length,
          pending: appointmentsData.filter(a => a.status === 'pending').length,
          cancelled: appointmentsData.filter(a => a.status === 'cancelled').length,
          completed: appointmentsData.filter(a => a.status === 'completed').length
        }
      });

      if (invalidAppointments.length > 0) {
        console.warn('⚠️ Invalid appointments found:', invalidAppointments);
      }

      setAppointments(appointmentsData);
      return appointmentsData;

    } catch (error) {
      console.error('❌ Error loading appointments:', error);
      setError('Erreur lors du chargement des rendez-vous: ' + (error as Error).message);
      throw error;
    }
  }, []);

  // FIXED: Chargement initial et configuration du listener en temps réel
  useEffect(() => {
    if (!auth.currentUser) {
      console.log('No authenticated user');
      setLoading(false);
      return;
    }

    console.log('🚀 Setting up appointments sync for user:', auth.currentUser.uid);
    setLoading(true);
    setError(null);

    // Chargement initial
    loadAppointments()
      .then(() => {
        console.log('✅ Initial appointments load completed');
        setLoading(false);
      })
      .catch((error) => {
        console.error('❌ Initial appointments load failed:', error);
        setLoading(false);
      });

    // Configuration du listener en temps réel
    try {
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(
        appointmentsRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );

      console.log('📡 Setting up real-time listener...');
      const unsubscribe = onSnapshot(
        appointmentsQuery,
        (snapshot) => {
          console.log('🔄 Real-time update received, docs count:', snapshot.docs.length);
          
          // Ne recharger que si ce n'est pas le chargement initial
          if (!loading) {
            loadAppointments().catch(console.error);
          }
        },
        (error) => {
          console.error('❌ Real-time listener error:', error);
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
        console.log('🔌 Cleaning up appointments listener');
        unsubscribe();
      };
    } catch (err) {
      console.error('❌ Error setting up appointments sync:', err);
      setError('Erreur lors de la configuration de la synchronisation');
      setLoading(false);
    }
  }, []); // Pas de dépendances pour éviter les rechargements inutiles

  // Fonction de rafraîchissement manuel
  const handleRefresh = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setRefreshing(true);
    }
    try {
      await loadAppointments();
      console.log('✅ Manual refresh completed');
      setLastRefreshTime(new Date());
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
    } finally {
      if (showLoading) {
        setRefreshing(false);
      }
    }
  }, [loadAppointments]);

  // Handle patient link click
  const handlePatientClick = async (e: React.MouseEvent, patientId: string, appointment: Appointment) => {
    e.preventDefault();
    
    if (!patientId) {
      setPatientNotFound(appointment.patientName);
      setTimeout(() => setPatientNotFound(null), 5000);
      return;
    }
    
    try {
      const patientDoc = await getDoc(doc(db, 'patients', patientId));
      
      if (patientDoc.exists()) {
        navigate(`/patients/${patientId}`);
      } else {
        setPatientNotFound(appointment.patientName);
        setTimeout(() => setPatientNotFound(null), 5000);
      }
    } catch (error) {
      console.error('Error checking patient:', error);
      setPatientNotFound(appointment.patientName);
    }
  };

  // Handle time slot click
  const handleTimeSlotClick = (day: Date, hour: number) => {
    // This is now handled by the CalendarView component
  };

  // Handle appointment edit
  const handleAppointmentEdit = (appointmentId: string) => {
    console.log('Editing appointment:', appointmentId);
    setSelectedAppointmentId(appointmentId);
    setIsEditAppointmentModalOpen(true);
  };

  // Handle appointment delete
  const handleAppointmentDelete = (appointmentId: string) => {
    const appointment = appointments.find(a => a.id === appointmentId);
    if (appointment) {
      setAppointmentToDelete({
        id: appointmentId,
        patientName: appointment.patientName,
        date: format(appointment.date, 'dd/MM/yyyy', { locale: fr }),
        time: format(appointment.date, 'HH:mm')
      });
      setIsDeleteAppointmentModalOpen(true);
    }
  };

  // Handle appointment consultation
  const handleAddConsultation = (appointmentId: string) => {
    const appointment = appointments.find(a => a.id === appointmentId);
    if (appointment) {
      if (appointment.consultationId) {
        // Si une consultation existe déjà, naviguer vers celle-ci
        navigate(`/patients/${appointment.patientId}?tab=consultations&consultationId=${appointment.consultationId}`);
      } else {
        // Sinon, ouvrir le modal pour ajouter une consultation
        setSelectedAppointmentId(appointmentId);
        setIsAddConsultationModalOpen(true);
      }
    }
  };

  // Confirm appointment deletion
  const confirmAppointmentDeletion = async () => {
    if (!appointmentToDelete) return;

    setIsDeleting(true);
    try {
      // Utiliser le service pour supprimer le rendez-vous avec synchronisation
      await AppointmentService.deleteAppointment(appointmentToDelete.id);
      
      setIsDeleteAppointmentModalOpen(false);
      setAppointmentToDelete(null);
      
      // Le listener onSnapshot va automatiquement recharger les rendez-vous
    } catch (error) {
      console.error('Error deleting appointment:', error);
      setError('Erreur lors de la suppression du rendez-vous');
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

      // Utiliser le service pour mettre à jour le rendez-vous avec synchronisation
      await AppointmentService.updateAppointment(appointmentId, {
        date: newDateTime,
        endTime: newEndTime
      });

      // Le listener onSnapshot va automatiquement recharger les rendez-vous
    } catch (error) {
      console.error('Error moving appointment:', error);
      setError('Erreur lors du déplacement du rendez-vous');
    }
  };

  // Filter patients based on search term
  const filteredPatients = patients.filter(patient =>
    `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone.includes(searchTerm) ||
    patient.email.toLowerCase().includes(searchTerm)
  );

  // Handle patient selection
  const handlePatientSelect = (patient: Patient) => {
    if (selectedSlot) {
      // Fonctionnalité désactivée
    }
    setShowPatientSearch(false);
    setSelectedSlot(null);
    setSearchTerm('');
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
          <span>Chargement des rendez-vous...</span>
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
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <div className="text-sm text-gray-500">
            {formatDate(currentDateTime)} - {formatTime(currentDateTime)}
          </div>
        </div>
        <div className="text-xs text-gray-400 self-center">
          Dernière mise à jour: {formatTime(lastRefreshTime)}
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

      {/* Calendar View */}
      <CalendarView
        appointments={appointments}
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
        onAddConsultation={handleAddConsultation}
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center">
            <CalendarIcon size={20} className="text-primary-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{appointments.length}</div>
              <div className="text-sm text-gray-500">Total rendez-vous</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center">
            <Clock size={20} className="text-green-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {appointments.filter(a => a.status === 'confirmed').length}
              </div>
              <div className="text-sm text-gray-500">Confirmés</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center">
            <User size={20} className="text-blue-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {appointments.filter(a => a.status === 'pending').length}
              </div>
              <div className="text-sm text-gray-500">En attente</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center">
            <AlertCircle size={20} className="text-red-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {appointments.filter(a => a.status === 'cancelled').length}
              </div>
              <div className="text-sm text-gray-500">Annulés</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {selectedAppointmentId && (
        <>
          <EditAppointmentModal
            isOpen={isEditAppointmentModalOpen}
            onClose={() => {
              setIsEditAppointmentModalOpen(false);
              setSelectedAppointmentId(null);
            }}
            onSuccess={async () => {
              setIsEditAppointmentModalOpen(false);
              setSelectedAppointmentId(null);
              // Le listener onSnapshot va automatiquement recharger les rendez-vous
            }}
            appointmentId={selectedAppointmentId}
          />

          <AddConsultationModal
            isOpen={isAddConsultationModalOpen}
            onClose={() => {
              setIsAddConsultationModalOpen(false);
              setSelectedAppointmentId(null);
            }}
            onSuccess={() => {
              setIsAddConsultationModalOpen(false);
              setSelectedAppointmentId(null);
              // Recharger les rendez-vous après ajout de la consultation
              handleRefresh(true);
            }}
            patientId={appointments.find(a => a.id === selectedAppointmentId)?.patientId || ''}
            patientName={appointments.find(a => a.id === selectedAppointmentId)?.patientName || ''}
            appointmentId={selectedAppointmentId}
          />
        </>
      )}

      <DeleteAppointmentModal
        isOpen={isDeleteAppointmentModalOpen}
        onClose={() => {
          setIsDeleteAppointmentModalOpen(false);
          setAppointmentToDelete(null);
        }}
        onConfirm={confirmAppointmentDeletion}
        isLoading={isDeleting}
        appointmentInfo={appointmentToDelete || {
          id: '',
          patientName: '',
          date: '',
          time: ''
        }}
      />
    </div>
  );
};

export default Appointments;