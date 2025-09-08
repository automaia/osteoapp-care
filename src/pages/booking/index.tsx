import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  User, 
  MapPin, 
  Check, 
  ArrowLeft, 
  ArrowRight,
  Download,
  Mail,
  Phone,
  Shield
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { createICSDownload } from '../../lib/ics';

interface Service {
  id: string;
  name: string;
  durationMin: number;
  priceCents?: number;
  location: 'cabinet' | 'telehealth';
  description?: string;
}

interface Practitioner {
  id: string;
  displayName: string;
  address?: string;
  color?: string;
}

interface TimeSlot {
  id: string;
  startAt: Date;
  endAt: Date;
  available: boolean;
}

interface PatientInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consentGiven: boolean;
}

const BookingPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // État du formulaire
  const [selectedPractitioner, setSelectedPractitioner] = useState<string>('');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [patientInfo, setPatientInfo] = useState<PatientInfo>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    consentGiven: false
  });
  const [holdToken, setHoldToken] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<any>(null);
  
  // Données
  const [practitioners, setPractitioners] = useState<Practitioner[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Initialisation avec les paramètres d'URL
  useEffect(() => {
    const practitionerId = searchParams.get('practitioner');
    const serviceId = searchParams.get('service');
    const date = searchParams.get('date');
    
    if (practitionerId) {
      setSelectedPractitioner(practitionerId);
      loadServices(practitionerId);
    }
    
    if (serviceId && practitionerId) {
      // Charger le service spécifique
      loadSpecificService(practitionerId, serviceId);
    }
    
    if (date) {
      try {
        setSelectedDate(new Date(date));
      } catch (e) {
        console.warn('Date invalide dans l\'URL:', date);
      }
    }
    
    // Charger les praticiens
    loadPractitioners();
  }, [searchParams]);

  const loadPractitioners = async () => {
    try {
      const response = await fetch('/api/booking/practitioners');
      const data = await response.json();
      
      if (data.success) {
        setPractitioners(data.practitioners);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des praticiens:', error);
    }
  };

  const loadServices = async (practitionerId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/booking/services?practitionerId=${practitionerId}`);
      const data = await response.json();
      
      if (data.success) {
        setServices(data.services);
      } else {
        setError('Erreur lors du chargement des services');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des services:', error);
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const loadSpecificService = async (practitionerId: string, serviceId: string) => {
    try {
      const response = await fetch(`/api/booking/services?practitionerId=${practitionerId}`);
      const data = await response.json();
      
      if (data.success) {
        const service = data.services.find((s: Service) => s.id === serviceId);
        if (service) {
          setSelectedService(service);
          setCurrentStep(2);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement du service:', error);
    }
  };

  const loadAvailableSlots = async (serviceId: string, date: Date) => {
    try {
      setLoading(true);
      const from = new Date(date);
      from.setHours(0, 0, 0, 0);
      const to = new Date(date);
      to.setHours(23, 59, 59, 999);
      
      const response = await fetch(
        `/api/booking/slots?practitionerId=${selectedPractitioner}&serviceId=${serviceId}&from=${from.toISOString()}&to=${to.toISOString()}`
      );
      const data = await response.json();
      
      if (data.success) {
        setAvailableSlots(data.slots);
      } else {
        setError('Erreur lors du chargement des créneaux');
      }
    } catch (error) {
      console.error('Erreur lors du chargement des créneaux:', error);
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
    setCurrentStep(2);
    loadAvailableSlots(service.id, selectedDate);
  };

  const handleSlotSelect = async (slot: TimeSlot) => {
    try {
      setLoading(true);
      
      // Réserver temporairement le créneau
      const response = await fetch('/api/booking/hold', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          slotId: slot.id,
          patientTempId: crypto.randomUUID()
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedSlot(slot);
        setHoldToken(data.holdToken);
        setCurrentStep(3);
      } else {
        setError(data.error || 'Impossible de réserver ce créneau');
      }
    } catch (error) {
      console.error('Erreur lors de la réservation temporaire:', error);
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/booking/book', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          slotId: selectedSlot?.id,
          patientTempId: holdToken,
          patient: patientInfo,
          serviceId: selectedService?.id,
          recaptchaToken: 'dummy-token', // À remplacer par le vrai token reCAPTCHA
          consentGiven: patientInfo.consentGiven
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAppointment(data);
        setCurrentStep(4);
      } else {
        setError(data.error || 'Erreur lors de la réservation');
      }
    } catch (error) {
      console.error('Erreur lors de la réservation:', error);
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadICS = () => {
    if (!appointment || !selectedSlot || !selectedService) return;
    
    createICSDownload({
      uid: appointment.appointmentId,
      title: `Rendez-vous - ${selectedService.name}`,
      description: `Rendez-vous avec ${practitioners.find(p => p.id === selectedPractitioner)?.displayName || 'Ostéopathe'}`,
      start: selectedSlot.startAt,
      end: selectedSlot.endAt,
      location: selectedService.location === 'cabinet' ? 'Cabinet' : 'Téléconsultation',
      organizer: {
        name: practitioners.find(p => p.id === selectedPractitioner)?.displayName || 'Ostéopathe',
        email: 'contact@osteoapp.com'
      },
      attendee: {
        name: `${patientInfo.firstName} ${patientInfo.lastName}`,
        email: patientInfo.email
      }
    });
  };

  const formatPrice = (priceCents?: number) => {
    if (!priceCents) return 'Prix sur demande';
    return `${(priceCents / 100).toFixed(0)} €`;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Générer les 7 prochains jours pour le sélecteur de date
  const getNextDays = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push(date);
    }
    
    return days;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img src="/Icon-logo-osteoapp-bleu.png" alt="OsteoApp" className="w-8 h-8 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Prendre rendez-vous</h1>
            </div>
            
            {/* Indicateur d'étapes */}
            <div className="flex items-center space-x-2">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === currentStep
                      ? 'bg-primary-500 text-white'
                      : step < currentStep
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step < currentStep ? <Check size={16} /> : step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Étape 1: Sélection du service */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Choisissez votre consultation</h2>
              <p className="text-gray-600">Sélectionnez le type de consultation qui vous convient</p>
            </div>
            
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => handleServiceSelect(service)}
                    className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-200 hover:border-primary-300"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        service.location === 'cabinet' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {service.location === 'cabinet' ? 'Cabinet' : 'Téléconsultation'}
                      </span>
                    </div>
                    
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Clock size={16} className="mr-2" />
                        <span>{service.durationMin} minutes</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-lg font-bold text-primary-600">
                          {formatPrice(service.priceCents)}
                        </span>
                      </div>
                    </div>
                    
                    {service.description && (
                      <p className="mt-3 text-sm text-gray-600">{service.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Étape 2: Sélection du créneau */}
        {currentStep === 2 && selectedService && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Choisissez votre créneau</h2>
                <p className="text-gray-600">Service sélectionné: {selectedService.name}</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                leftIcon={<ArrowLeft size={16} />}
              >
                Retour
              </Button>
            </div>
            
            {/* Sélecteur de date */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sélectionnez une date</h3>
              <div className="grid grid-cols-7 gap-2">
                {getNextDays().map((date, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSelectedDate(date);
                      loadAvailableSlots(selectedService.id, date);
                    }}
                    className={`p-3 rounded-lg text-center transition-colors ${
                      date.toDateString() === selectedDate.toDateString()
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                    }`}
                  >
                    <div className="text-xs font-medium">
                      {date.toLocaleDateString('fr-FR', { weekday: 'short' })}
                    </div>
                    <div className="text-lg font-bold">
                      {date.getDate()}
                    </div>
                    <div className="text-xs">
                      {date.toLocaleDateString('fr-FR', { month: 'short' })}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Créneaux disponibles */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Créneaux disponibles - {formatDate(selectedDate)}
              </h3>
              
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>Aucun créneau disponible pour cette date</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => handleSlotSelect(slot)}
                      disabled={!slot.available}
                      className={`p-3 rounded-lg text-center font-medium transition-colors ${
                        slot.available
                          ? 'bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {formatTime(slot.startAt)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Étape 3: Informations patient */}
        {currentStep === 3 && selectedSlot && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Vos informations</h2>
                <p className="text-gray-600">
                  Créneau sélectionné: {formatDate(selectedSlot.startAt)} à {formatTime(selectedSlot.startAt)}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentStep(2)}
                leftIcon={<ArrowLeft size={16} />}
              >
                Retour
              </Button>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <form className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Prénom *
                    </label>
                    <input
                      type="text"
                      value={patientInfo.firstName}
                      onChange={(e) => setPatientInfo(prev => ({ ...prev, firstName: e.target.value }))}
                      className="input w-full"
                      placeholder="Jean"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nom *
                    </label>
                    <input
                      type="text"
                      value={patientInfo.lastName}
                      onChange={(e) => setPatientInfo(prev => ({ ...prev, lastName: e.target.value }))}
                      className="input w-full"
                      placeholder="Dupont"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={patientInfo.email}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, email: e.target.value }))}
                    className="input w-full"
                    placeholder="jean.dupont@email.com"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Téléphone *
                  </label>
                  <input
                    type="tel"
                    value={patientInfo.phone}
                    onChange={(e) => setPatientInfo(prev => ({ ...prev, phone: e.target.value }))}
                    className="input w-full"
                    placeholder="06 12 34 56 78"
                    required
                  />
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <label className="flex items-start">
                    <input
                      type="checkbox"
                      checked={patientInfo.consentGiven}
                      onChange={(e) => setPatientInfo(prev => ({ ...prev, consentGiven: e.target.checked }))}
                      className="mt-1 mr-3 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      required
                    />
                    <span className="text-sm text-gray-700">
                      J'accepte que mes données personnelles soient traitées pour la gestion de mon rendez-vous, 
                      conformément au RGPD. Je peux exercer mes droits en contactant le praticien.
                    </span>
                  </label>
                </div>
              </form>
              
              <div className="mt-6 flex justify-end">
                <Button
                  variant="primary"
                  onClick={handleBooking}
                  isLoading={loading}
                  disabled={!patientInfo.firstName || !patientInfo.lastName || !patientInfo.email || !patientInfo.phone || !patientInfo.consentGiven}
                  rightIcon={<ArrowRight size={16} />}
                >
                  Confirmer le rendez-vous
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Étape 4: Confirmation */}
        {currentStep === 4 && appointment && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Rendez-vous confirmé !</h2>
              <p className="text-gray-600">Votre rendez-vous a été enregistré avec succès</p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Récapitulatif</h3>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <Calendar size={20} className="text-gray-400 mr-3" />
                  <div>
                    <div className="font-medium">{formatDate(selectedSlot!.startAt)}</div>
                    <div className="text-sm text-gray-600">
                      {formatTime(selectedSlot!.startAt)} - {formatTime(selectedSlot!.endAt)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <User size={20} className="text-gray-400 mr-3" />
                  <div>
                    <div className="font-medium">{selectedService!.name}</div>
                    <div className="text-sm text-gray-600">
                      avec {practitioners.find(p => p.id === selectedPractitioner)?.displayName || 'Ostéopathe'}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <MapPin size={20} className="text-gray-400 mr-3" />
                  <div>
                    <div className="font-medium">
                      {selectedService!.location === 'cabinet' ? 'Cabinet' : 'Téléconsultation'}
                    </div>
                    {practitioners.find(p => p.id === selectedPractitioner)?.address && (
                      <div className="text-sm text-gray-600">
                        {practitioners.find(p => p.id === selectedPractitioner)?.address}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="primary"
                    onClick={handleDownloadICS}
                    leftIcon={<Download size={16} />}
                    fullWidth
                  >
                    Télécharger .ics
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = '/'}
                    fullWidth
                  >
                    Retour à l'accueil
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <Shield size={20} className="text-blue-600 mt-0.5 mr-3" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Confirmation envoyée</p>
                  <p>
                    Un email de confirmation a été envoyé à {patientInfo.email}. 
                    Vous recevrez également des rappels 24h et 2h avant votre rendez-vous.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingPage;