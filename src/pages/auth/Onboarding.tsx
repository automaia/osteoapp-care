import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { db, storage, auth } from '../../firebase/config';
import { HDSCompliance } from '../../utils/hdsCompliance';
import { useAuth } from '../../context/AuthContext';
import { Building2, Upload, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Practice, UserProfile, Schedule, Rate } from '../../types';

// Specialties options
const SPECIALTIES = [
  'Ostéopathie structurelle',
  'Ostéopathie crânienne',
  'Ostéopathie viscérale',
  'Ostéopathie pédiatrique',
  'Ostéopathie sportive',
  'Ostéopathie aquatique',
  'Fasciathérapie',
  'Posturologie',
];

// Days of the week
const DAYS = [
  { id: 'monday', label: 'Lundi' },
  { id: 'tuesday', label: 'Mardi' },
  { id: 'wednesday', label: 'Mercredi' },
  { id: 'thursday', label: 'Jeudi' },
  { id: 'friday', label: 'Vendredi' },
  { id: 'saturday', label: 'Samedi' },
  { id: 'sunday', label: 'Dimanche' },
];

// Default rate types
const DEFAULT_RATES = [
  { type: 'Consultation standard', amount: 60, currency: 'EUR', duration: 60 },
  { type: 'Consultation première fois', amount: 70, currency: 'EUR', duration: 75 },
  { type: 'Consultation enfant', amount: 50, currency: 'EUR', duration: 45 },
  { type: 'Consultation urgence', amount: 80, currency: 'EUR', duration: 60 },
];

const Onboarding: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Practice information
  const [practice, setPractice] = useState<Practice>({
    id: '',
    name: '',
    logo: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'France',
    },
    ownerId: user?.uid || '',
  });
  
  // User profile
  const [profile, setProfile] = useState<UserProfile>({
    uid: user?.uid || '',
    firstName: '',
    lastName: '',
    email: user?.email || '',
    specialties: [],
    schedule: {},
    rates: DEFAULT_RATES,
  });
  
  // Schedule state
  const [schedule, setSchedule] = useState<Schedule>({
    monday: { isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
    tuesday: { isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
    wednesday: { isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
    thursday: { isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
    friday: { isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
    saturday: { isOpen: false, slots: [{ start: '09:00', end: '13:00' }] },
    sunday: { isOpen: false, slots: [] },
  });
  
  // Rates state
  const [rates, setRates] = useState<Rate[]>(DEFAULT_RATES);
  
  // Logo file state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  
  // Error state
  const [error, setError] = useState<string | null>(null);

  // Handle practice info change
  const handlePracticeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name.startsWith('address.')) {
      const addressField = name.split('.')[1];
      setPractice({
        ...practice,
        address: {
          ...practice.address,
          [addressField]: value,
        },
      });
    } else {
      setPractice({
        ...practice,
        [name]: value,
      });
    }
  };
  
  // Handle profile info change
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile({
      ...profile,
      [name]: value,
    });
  };
  
  // Handle specialties selection
  const handleSpecialtyToggle = (specialty: string) => {
    setProfile(prev => {
      const specialties = [...prev.specialties];
      
      if (specialties.includes(specialty)) {
        return {
          ...prev,
          specialties: specialties.filter(item => item !== specialty),
        };
      } else {
        return {
          ...prev,
          specialties: [...specialties, specialty],
        };
      }
    });
  };
  
  // Handle schedule changes
  const handleScheduleToggle = (day: string) => {
    setSchedule(prev => {
      const updatedSchedule = { ...prev };
      if (updatedSchedule[day as keyof Schedule]) {
        updatedSchedule[day as keyof Schedule] = {
          ...updatedSchedule[day as keyof Schedule]!,
          isOpen: !updatedSchedule[day as keyof Schedule]!.isOpen,
        };
      }
      return updatedSchedule;
    });
  };
  
  const handleTimeChange = (day: string, slotIndex: number, field: 'start' | 'end', value: string) => {
    setSchedule(prev => {
      const updatedSchedule = { ...prev };
      if (updatedSchedule[day as keyof Schedule]?.slots?.[slotIndex]) {
        updatedSchedule[day as keyof Schedule]!.slots[slotIndex][field] = value;
      }
      return updatedSchedule;
    });
  };
  
  // Handle rates changes
  const handleRateChange = (index: number, field: keyof Rate, value: any) => {
    setRates(prev => {
      const updatedRates = [...prev];
      updatedRates[index] = {
        ...updatedRates[index],
        [field]: field === 'amount' || field === 'duration' ? Number(value) : value,
      };
      return updatedRates;
    });
  };
  
  // Handle logo file selection
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setLogoPreview(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Upload logo if selected
      let logoUrl = '';
      if (logoFile) {
        const storageRef = ref(storage, `practices/${user.uid}/logo`);
        await uploadBytes(storageRef, logoFile);
        logoUrl = await getDownloadURL(storageRef);
      }
      
      // Create practice document
      const practiceData: Practice = {
        ...practice,
        id: user.uid, // Use user ID as practice ID for now
        logo: logoUrl,
        ownerId: user.uid,
      };
      
      await setDoc(doc(db, 'practices', user.uid), practiceData);
      
      // Create user profile
      // Use HDSCompliance.updateCompliantData to preserve existing fields like 'role'
      const profileData: UserProfile = {
        ...profile,
        uid: user.uid,
        schedule,
        rates,
      };
      
      await HDSCompliance.updateCompliantData('users', user.uid, profileData);
      
      // Update user profile display name if needed
      if (user && (!user.displayName || user.displayName.trim() === '')) {
        await updateProfile(auth.currentUser!, {
          displayName: `${profile.firstName} ${profile.lastName}`,
        });
      }
      
      // Navigate to dashboard
      navigate('/');
    } catch (err) {
      console.error('Onboarding error:', err);
      setError('Une erreur est survenue lors de la configuration de votre compte');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle next step
  const handleNextStep = () => {
    if (step === 1 && !practice.name) {
      setError('Veuillez saisir le nom de votre cabinet');
      return;
    }
    
    if (step === 2 && (!profile.firstName || !profile.lastName)) {
      setError('Veuillez saisir votre nom et prénom');
      return;
    }
    
    setError(null);
    setStep(prev => prev + 1);
  };
  
  // Handle previous step
  const handlePreviousStep = () => {
    setStep(prev => prev - 1);
  };
  
  // Render practice setup step
  const renderPracticeSetup = () => {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Configuration du cabinet</h2>
          <p className="mt-2 text-gray-600">Configurez les informations de votre cabinet</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="label">
              Nom du cabinet
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={practice.name}
              onChange={handlePracticeChange}
              className="input"
              placeholder="Cabinet d'ostéopathie"
              required
            />
          </div>
          
          <div>
            <label className="label">Logo du cabinet</label>
            <div className="flex items-center space-x-4">
              <div
                className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden"
              >
                {logoPreview ? (
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 size={24} className="text-gray-400" />
                )}
              </div>
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-outline"
              >
                <Upload size={16} className="mr-2" />
                {logoPreview ? 'Changer le logo' : 'Télécharger un logo'}
              </button>
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleLogoSelect}
                accept="image/*"
                className="hidden"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Formats recommandés: PNG, JPG. Taille maximale: 2MB
            </p>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-md font-medium text-gray-900">Adresse du cabinet</h3>
            
            <div>
              <label htmlFor="address.street" className="label">
                Adresse
              </label>
              <input
                type="text"
                id="address.street"
                name="address.street"
                value={practice.address.street}
                onChange={handlePracticeChange}
                className="input"
                placeholder="123 rue de la Santé"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="address.city" className="label">
                  Ville
                </label>
                <input
                  type="text"
                  id="address.city"
                  name="address.city"
                  value={practice.address.city}
                  onChange={handlePracticeChange}
                  className="input"
                  placeholder="Paris"
                />
              </div>
              
              <div>
                <label htmlFor="address.zipCode" className="label">
                  Code postal
                </label>
                <input
                  type="text"
                  id="address.zipCode"
                  name="address.zipCode"
                  value={practice.address.zipCode}
                  onChange={handlePracticeChange}
                  className="input"
                  placeholder="75001"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="address.state" className="label">
                  Région
                </label>
                <input
                  type="text"
                  id="address.state"
                  name="address.state"
                  value={practice.address.state}
                  onChange={handlePracticeChange}
                  className="input"
                  placeholder="Île-de-France"
                />
              </div>
              
              <div>
                <label htmlFor="address.country" className="label">
                  Pays
                </label>
                <input
                  type="text"
                  id="address.country"
                  name="address.country"
                  value={practice.address.country}
                  onChange={handlePracticeChange}
                  className="input"
                  placeholder="France"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render profile setup step
  const renderProfileSetup = () => {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Votre profil professionnel</h2>
          <p className="mt-2 text-gray-600">Configurez vos informations personnelles</p>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="label">
                Prénom
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={profile.firstName}
                onChange={handleProfileChange}
                className="input"
                placeholder="Jean"
                required
              />
            </div>
            
            <div>
              <label htmlFor="lastName" className="label">
                Nom
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={profile.lastName}
                onChange={handleProfileChange}
                className="input"
                placeholder="Dupont"
                required
              />
            </div>
          </div>
          
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={profile.email}
              onChange={handleProfileChange}
              className="input"
              placeholder="votre@email.com"
              disabled
            />
            <p className="mt-1 text-xs text-gray-500">
              L'email est celui utilisé pour la connexion et ne peut pas être modifié ici.
            </p>
          </div>
          
          <div>
            <label className="label">Spécialités</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {SPECIALTIES.map((specialty) => (
                <button
                  key={specialty}
                  type="button"
                  onClick={() => handleSpecialtyToggle(specialty)}
                  className={`flex items-center px-3 py-2 rounded-lg text-sm border transition-colors ${
                    profile.specialties.includes(specialty)
                      ? 'bg-primary-50 border-primary-200 text-primary-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {profile.specialties.includes(specialty) && (
                    <Check size={16} className="mr-2 text-primary-500" />
                  )}
                  {specialty}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render schedule setup step
  const renderScheduleSetup = () => {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Horaires du cabinet</h2>
          <p className="mt-2 text-gray-600">Configurez vos plages horaires d'ouverture</p>
        </div>
        
        <div className="space-y-4">
          {DAYS.map(({ id, label }) => (
            <div key={id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">{label}</h3>
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={schedule[id as keyof Schedule]?.isOpen}
                    onChange={() => handleScheduleToggle(id)}
                    className="sr-only"
                  />
                  <div
                    className={`relative w-11 h-6 flex items-center rounded-full transition-colors ${
                      schedule[id as keyof Schedule]?.isOpen ? 'bg-primary-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        schedule[id as keyof Schedule]?.isOpen ? 'translate-x-5' : ''
                      }`}
                    />
                  </div>
                  <span className="ml-2 text-sm">
                    {schedule[id as keyof Schedule]?.isOpen ? 'Ouvert' : 'Fermé'}
                  </span>
                </label>
              </div>
              
              {schedule[id as keyof Schedule]?.isOpen && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Heure d'ouverture</label>
                    <input
                      type="time"
                      value={schedule[id as keyof Schedule]?.slots[0]?.start || '09:00'}
                      onChange={(e) => handleTimeChange(id, 0, 'start', e.target.value)}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Heure de fermeture</label>
                    <input
                      type="time"
                      value={schedule[id as keyof Schedule]?.slots[0]?.end || '18:00'}
                      onChange={(e) => handleTimeChange(id, 0, 'end', e.target.value)}
                      className="input"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Render rates setup step
  const renderRatesSetup = () => {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Tarifs des consultations</h2>
          <p className="mt-2 text-gray-600">Définissez vos tarifs par type de consultation</p>
        </div>
        
        <div className="space-y-4">
          {rates.map((rate, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Type de consultation</label>
                  <input
                    type="text"
                    value={rate.type}
                    onChange={(e) => handleRateChange(index, 'type', e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Tarif (€)</label>
                  <input
                    type="number"
                    value={rate.amount}
                    onChange={(e) => handleRateChange(index, 'amount', e.target.value)}
                    className="input"
                    min="0"
                    step="5"
                  />
                </div>
                <div>
                  <label className="label">Durée (minutes)</label>
                  <input
                    type="number"
                    value={rate.duration}
                    onChange={(e) => handleRateChange(index, 'duration', e.target.value)}
                    className="input"
                    min="15"
                    step="5"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <div className="w-full">
      {/* Progress indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((stepNumber) => (
            <div key={stepNumber} className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  step >= stepNumber
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 text-gray-600'
                } ${step === stepNumber ? 'ring-2 ring-primary-200 ring-offset-2' : ''}`}
              >
                {stepNumber}
              </div>
              <span className="mt-2 text-xs text-gray-600 hidden md:block">
                {stepNumber === 1 && 'Cabinet'}
                {stepNumber === 2 && 'Profil'}
                {stepNumber === 3 && 'Horaires'}
                {stepNumber === 4 && 'Tarifs'}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between">
          <div className={`h-1 flex-1 ${step >= 1 ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
          <div className={`h-1 flex-1 ${step >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
          <div className={`h-1 flex-1 ${step >= 3 ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
          <div className={`h-1 flex-1 ${step >= 4 ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-error bg-opacity-10 border border-error border-opacity-20 rounded-lg text-error text-sm">
          {error}
        </div>
      )}
      
      {/* Step content */}
      <div className="mb-8">
        {step === 1 && renderPracticeSetup()}
        {step === 2 && renderProfileSetup()}
        {step === 3 && renderScheduleSetup()}
        {step === 4 && renderRatesSetup()}
      </div>
      
      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handlePreviousStep}
          disabled={step === 1 || loading}
          leftIcon={<ArrowLeft size={16} />}
        >
          Précédent
        </Button>
        
        {step < 4 ? (
          <Button
            variant="primary"
            onClick={handleNextStep}
            disabled={loading}
            rightIcon={<ArrowRight size={16} />}
          >
            Suivant
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={loading}
            loadingText="Configuration en cours..."
          >
            Terminer la configuration
          </Button>
        )}
      </div>
    </div>
  );
};

export default Onboarding;