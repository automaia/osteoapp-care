import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, Plus, Filter, Tags, Calendar, Users, ArrowDown, ArrowUp, Clock } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { Button } from '../../components/ui/Button';
import NewPatientModal from '../../components/modals/NewPatientModal';
import { Patient } from '../../types';
import { HDSCompliance } from '../../utils/hdsCompliance';
import { clearFormData } from '../../utils/sessionPersistence';

const Patients: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt'>('updatedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const location = useLocation();
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'new') {
      // Clear any existing form data before opening new patient modal
      clearFormData('new_patient_form');
      setIsModalOpen(true);
      window.history.replaceState({}, '', '/patients');
    }
  }, [location]);
  
  const loadPatients = async () => {
    if (!auth.currentUser) return;

    setLoading(true);
    setError(null);

    try {
      const patientsRef = collection(db, 'patients');
      // Query for all patients belonging to the current user
      const q = query(
        patientsRef,
        where('osteopathId', '==', auth.currentUser!.uid)
      );

      const snapshot = await getDocs(q);
      const patientsList: Patient[] = [];
      
      // Traiter chaque document
      for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Skip test data patients (but include patients without isTestData field)
        if (data.isTestData === true) {
          continue;
        }
        
        // Déchiffrer les données si nécessaire
        const decryptedData = HDSCompliance.decryptDataForDisplay(
          data,
          'patients',
          auth.currentUser.uid
        );
        
        const patient = {
          ...decryptedData,
          id: doc.id
        } as Patient;
        
        patientsList.push(patient);
      }
      
      // ✅ Sort by lastName in memory instead of using orderBy
      patientsList.sort((a, b) => a.lastName.localeCompare(b.lastName));

      // Convertir les dates en objets Date pour le tri
      patientsList.forEach(patient => {
        if (patient.createdAt && typeof patient.createdAt === 'string') {
          patient.createdAtDate = new Date(patient.createdAt);
        }
        if (patient.updatedAt && typeof patient.updatedAt === 'string') {
          patient.updatedAtDate = new Date(patient.updatedAt);
        }
      });
      
      console.log('Loaded patients:', patientsList.length);
      setPatients(patientsList);
      
    } catch (error) {
      console.error('Error fetching patients:', error);
      setError('Erreur lors de la récupération des patients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, [refreshTrigger]);

  // Fonction pour forcer le rechargement de la liste
  const refreshPatientList = () => {
    console.log('Refreshing patient list...');
    // Force immediate refresh with cache invalidation
    setRefreshTrigger(prev => prev + 1);
    // Also call loadPatients directly for immediate effect
    setTimeout(() => {
      loadPatients();
    }, 100);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSortChange = (sortField: 'createdAt' | 'updatedAt') => {
    if (sortBy === sortField) {
      // Si on clique sur le même champ, on inverse la direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Si on change de champ, on met la direction par défaut (desc)
      setSortBy(sortField);
      setSortDirection('desc');
    }
  };

  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter);
  };

  // ✅ Client-side filtering and sorting
  const filteredPatients = patients.filter(patient => {
    const fullName = `${patient.firstName} ${patient.lastName}`.toLowerCase();
    const searchMatch = fullName.includes(searchTerm.toLowerCase()) || 
                       patient.phone?.includes(searchTerm) ||
                       patient.email?.toLowerCase().includes(searchTerm.toLowerCase());

    if (selectedFilter === 'upcoming' && (!patient.nextAppointment || !isUpcomingAppointment(patient.nextAppointment))) {
      return false;
    }

    return searchMatch;
  }).sort((a, b) => {
    if (selectedFilter === 'upcoming') {
      // Conserver le tri par prochain rendez-vous pour ce filtre
      if (!a.nextAppointment) return 1;
      if (!b.nextAppointment) return -1;
      return new Date(a.nextAppointment).getTime() - new Date(b.nextAppointment).getTime();
    }
    
    // Appliquer le tri chronologique selon le champ et la direction choisis
    if (sortBy === 'createdAt') {
      const aDate = a.createdAtDate || new Date(0);
      const bDate = b.createdAtDate || new Date(0);
      return sortDirection === 'desc' 
        ? bDate.getTime() - aDate.getTime() 
        : aDate.getTime() - bDate.getTime();
    } else {
      const aDate = a.updatedAtDate || a.createdAtDate || new Date(0);
      const bDate = b.updatedAtDate || b.createdAtDate || new Date(0);
      return sortDirection === 'desc' 
        ? bDate.getTime() - aDate.getTime() 
        : aDate.getTime() - bDate.getTime();
    }
  });

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  const formatBirthDate = (date: string) => {
    try {
      return `Né(e) le ${new Date(date).toLocaleDateString('fr-FR')}`;
    } catch (error) {
      console.error('Error formatting birth date:', date);
      return 'Date invalide';
    }
  };

  const formatAppointmentDate = (date: string) => {
    try {
      const appointmentDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const diffTime = appointmentDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return "Aujourd'hui";
      } else if (diffDays === 1) {
        return "Demain";
      } else if (diffDays <= 7) {
        return `Dans ${diffDays} jours`;
      }

      return appointmentDate.toLocaleDateString('fr-FR');
    } catch (error) {
      console.error('Error formatting appointment date:', date);
      return 'Date invalide';
    }
  };

  const isUpcomingAppointment = (date: string) => {
    try {
      const appointmentDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      // Vérifier que le rendez-vous est vraiment dans le futur (pas juste aujourd'hui)
      const now = new Date();
      return appointmentDate > now;
    } catch (error) {
      console.error('Error checking upcoming appointment:', date);
      return false;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button 
            variant="primary" 
            leftIcon={<Plus size={16} />}
            onClick={() => setIsModalOpen(true)}
            size={windowWidth < 640 ? "sm" : "md"}
          >
            <span className="sm:inline">Nouveau patient</span>
          </Button>
        </div>
      </div>

      {/* Indicateur de tri */}
      <div className="flex items-center text-sm text-gray-500 mb-4">
        <Clock size={16} className="mr-1" />
        <span>Trié par : {sortBy === 'createdAt' ? 'date de création' : 'date de modification'} </span>
        <span className="ml-1">
          {sortDirection === 'desc' ? (
            <ArrowDown size={14} className="inline" />
          ) : (
            <ArrowUp size={14} className="inline" />
          )}
        </span>
      </div>

      <div className="space-y-6 md:space-y-8">
        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <div className="flex">
              <input
                type="text"
                className="w-full h-10 sm:h-12 pl-12 pr-4 rounded-l-xl border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                placeholder="Rechercher un patient..."
                value={searchTerm}
                onChange={handleSearchChange}
              />
              <div className="relative">
                <select
                  className="h-10 sm:h-12 px-3 py-2 rounded-r-xl border border-gray-200 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 bg-white"
                  value={`${sortBy}-${sortDirection}`}
                  onChange={(e) => {
                    const [field, direction] = e.target.value.split('-');
                    setSortBy(field as 'createdAt' | 'updatedAt');
                    setSortDirection(direction as 'asc' | 'desc');
                  }}
                >
                  <option value="updatedAt-desc">Modifié récemment</option>
                  <option value="updatedAt-asc">Modifié anciennement</option>
                  <option value="createdAt-desc">Créé récemment</option>
                  <option value="createdAt-asc">Créé anciennement</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 md:space-x-8 border-b border-gray-200 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => handleFilterChange('all')}
            className={`px-4 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
              selectedFilter === 'all'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Tous les patients ({patients.length})
          </button>
          <button
            onClick={() => handleFilterChange('upcoming')}
            className={`px-4 py-4 text-sm font-medium border-b-2 whitespace-nowrap ${
              selectedFilter === 'upcoming'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Consultations à venir ({patients.filter(p => p.nextAppointment && isUpcomingAppointment(p.nextAppointment)).length})
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-error/5 border border-error/20 rounded-xl text-error">
            {error}
          </div>
        )}

        {/* Patient list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredPatients.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Users size={48} className="mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">Aucun patient trouvé</h3>
                <p className="text-gray-500">
                  {patients.length === 0 
                    ? "Commencez par créer votre premier dossier patient."
                    : "Aucun patient ne correspond à vos critères de recherche."
                  }
                </p>
              </div>
            ) : (
              filteredPatients.map((patient) => (
                <Link key={patient.id} to={`/patients/${patient.id}`}>
                  <div className={`bg-white rounded-xl p-4 md:p-6 shadow-sm hover:shadow-md transition-all duration-200 border ${
                    patient.isTestData ? 'border-yellow-200 bg-yellow-50/30' : 'border-gray-100'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-primary-700 font-medium ${
                          patient.isTestData ? 'bg-yellow-100' : 'bg-primary-100'
                        }`}>
                        {getInitials(patient.firstName, patient.lastName)}
                        </div>
                        <div>
                          <div className="flex items-center flex-wrap gap-2">
                            <h3 className="text-lg font-medium text-gray-900">
                              {patient.firstName} {patient.lastName}
                            </h3>
                            {patient.isTestData && (
                              <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                                Donnée test
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 space-x-2">
                            <span>{patient.phone}</span>
                            <span className="hidden sm:inline">•</span>
                            <span className="block sm:inline">{formatBirthDate(patient.dateOfBirth)}</span>
                          </div>
                        </div>
                      </div>
                      {(patient.updatedAtDate || patient.createdAtDate) && (
                        <div className="text-xs text-gray-400 mt-1">
                          {sortBy === 'updatedAt' ? 'Modifié' : 'Créé'} le {
                            (() => {
                              const dateToDisplay = sortBy === 'updatedAt' ? patient.updatedAtDate : patient.createdAtDate;
                              if (dateToDisplay && !isNaN(dateToDisplay.getTime())) {
                                return dateToDisplay.toLocaleDateString('fr-FR');
                              }
                              return 'Date invalide';
                            })()
                          }
                        </div>
                      )}
                      <div className="text-left sm:text-right">
                        {patient.nextAppointment && isUpcomingAppointment(patient.nextAppointment) ? (
                          <div className="flex items-center space-x-2">
                            <Calendar size={16} className="text-primary-500" />
                            <div>
                              <div className="text-sm text-gray-500">Prochain RDV</div>
                              <div className={`font-medium ${
                                new Date(patient.nextAppointment).getTime() - new Date().getTime() <= 7 * 24 * 60 * 60 * 1000
                                  ? 'text-primary-600'
                                  : 'text-gray-900'
                              }`}>
                                {formatAppointmentDate(patient.nextAppointment)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">Pas de RDV prévu</span>
                        )}
                      </div>
                    </div>
                    {patient.tags && patient.tags.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
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
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      <NewPatientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          // Force refresh of patient list after successful creation
          console.log('Patient created successfully, refreshing list...');
          refreshPatientList();
          setIsModalOpen(false);
        }}
      />
    </div>
  );
};

// Add this at the top of your component to get window width
const windowWidth = window.innerWidth;

export default Patients;