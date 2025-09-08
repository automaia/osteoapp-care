import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, UserPlus, Star, Clock, Users, CheckCircle, User, Building, MessageCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { WaitlistFormData, WaitlistService, SubmissionState } from '../../services/waitlistService';
import { trackEvent } from '../../lib/clarityClient';
import { trackEvent as trackMatomoEvent } from '../../lib/matomoTagManager';
import { trackEvent as trackGAEvent } from '../../lib/googleAnalytics';

const BetaWaitlist: React.FC = () => {
  const [submissionState, setSubmissionState] = useState<SubmissionState>({
    isSubmitting: false,
    currentAttempt: 0,
    maxAttempts: 3,
    lastError: null,
    method: null
  });
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Track page view
  useEffect(() => {
    trackEvent("beta_waitlist_view");
    trackMatomoEvent('Waitlist', 'Page View', 'Beta Waitlist Form');
    trackGAEvent('view_beta_waitlist', {
      page_title: 'Beta Waitlist Form'
    });
  }, []);

  // Track window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { register, handleSubmit, formState: { errors, isValid }, reset, watch } = useForm<WaitlistFormData>({
    mode: 'onChange',
    defaultValues: {
      newsletter: true,
      profileType: 'installed',
      hasCurrentSoftware: 'no'
    }
  });

  const watchedProfileType = watch('profileType');
  const watchedHasCurrentSoftware = watch('hasCurrentSoftware');

  const onSubmit = async (data: WaitlistFormData) => {
    // Prévention des soumissions multiples
    if (submissionState.isSubmitting) return;
    
    console.log('📝 Form submission started with data:', data);
    setError(null);
    setSubmissionState({
      isSubmitting: true,
      currentAttempt: 0,
      maxAttempts: 3,
      lastError: null,
      method: null
    });

    // Track form submission
    trackEvent("beta_waitlist_submit", {
      profile_type: data.profileType,
      has_software: data.hasCurrentSoftware,
      city: data.city,
      team_size: data.teamSize
    });
    
    // Track form submission in Matomo
    trackMatomoEvent('Waitlist', 'Form Submit', 'Beta Registration', data.experienceYears === '5+' ? 5 : 1);
    
    // Track form submission in Google Analytics
    trackGAEvent('submit_beta_waitlist', {
      profile_type: data.profileType,
      has_software: data.hasCurrentSoftware,
      city: data.city,
      team_size: data.teamSize,
      experience_years: data.experienceYears
    });

    try {
      // Utiliser le service avec progress tracking
      const result = await WaitlistService.submitEntry(data, (state) => {
        console.log('🔄 Submission progress update:', state);
        setSubmissionState(state);
      });

      console.log('✅ Submission successful:', result);
      
      // Mise à jour de l'UI
      setWaitlistPosition(result.position);
      setIsSuccess(true);
      reset();

      // Track successful submission
      trackEvent("beta_waitlist_success", {
        position: result.position
      });
      
      // Track conversion in Matomo
      trackMatomoEvent('Waitlist', 'Registration Success', 'Position', result.position);
      
      // Track conversion in Google Analytics
      trackGAEvent('beta_waitlist_success', {
        position: result.position,
        waitlist_id: result.entryId
      });

    } catch (error: any) {
      console.error('❌ Submission failed:', error);
      setError(error.message || 'Une erreur est survenue. Veuillez réessayer.');
      
      setSubmissionState(prev => ({
        ...prev,
        isSubmitting: false,
        lastError: error.message
      }));
      
      // Track submission error
      trackEvent("beta_waitlist_error", {
        error_message: error.message || 'Unknown error'
      });
      
      // Track error in Matomo
      trackMatomoEvent('Waitlist', 'Registration Error', error.message || 'Unknown error');
      
      // Track error in Google Analytics
      trackGAEvent('beta_waitlist_error', {
        error_message: error.message || 'Unknown error'
      });
    }
  };

  // Fonction pour réessayer après une erreur
  const handleRetry = () => {
    setError(null);
    handleSubmit(onSubmit)();
    
    // Track retry attempt
    trackEvent("beta_waitlist_retry");
    trackMatomoEvent('Waitlist', 'Retry Submission');
    trackGAEvent('retry_beta_waitlist');
  };

  const isSmallScreen = windowWidth < 768;

  if (isSuccess) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Inscription confirmée !</h2>
          <p className="mt-2 text-gray-600">Bienvenue dans la communauté Beta d'OsteoApp</p>
        </div>

        <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-xl p-6 mb-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-primary-600 mb-2">
              #{waitlistPosition}
            </div>
            <p className="text-gray-700 font-medium">Votre position dans la liste d'attente</p>
            <p className="text-sm text-gray-600 mt-2">
              Vous recevrez un email de confirmation avec tous les détails
            </p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center mt-0.5">
              <span className="text-xs font-bold text-primary-600">1</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Email de confirmation</h3>
              <p className="text-sm text-gray-600">Vous allez recevoir un email avec votre position et les prochaines étapes</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center mt-0.5">
              <span className="text-xs font-bold text-primary-600">2</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Accès prioritaire</h3>
              <p className="text-sm text-gray-600">Nous vous contacterons dès qu'une place se libère</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center mt-0.5">
              <span className="text-xs font-bold text-primary-600">3</span>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Accès complet</h3>
              <p className="text-sm text-gray-600">Profitez de toutes les fonctionnalités d'OsteoApp</p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link 
            to="/login" 
            className="text-primary-600 hover:text-primary-700 font-medium"
            onClick={() => {
              trackEvent("back_to_login_click", { from: "waitlist_success" });
              trackMatomoEvent('Navigation', 'Click', 'Back to Login from Success');
              trackGAEvent('click_back_to_login', { from: "waitlist_success" });
            }}
          >
            ← Retour à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Link 
        to="/login" 
        className="flex items-center text-sm text-primary-600 mb-6"
        onClick={() => {
          trackEvent("back_to_login_click", { from: "waitlist_form" });
          trackMatomoEvent('Navigation', 'Click', 'Back to Login from Form');
          trackGAEvent('click_back_to_login', { from: "waitlist_form" });
        }}
      >
        <ArrowLeft size={16} className="mr-1" />
        Retour à la connexion
      </Link>

      {/* Header avec badge BETA */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center">
            <Star size={16} className="mr-2" />
            BETA PRIVÉE OUVERTE
          </div>
        </div>
        
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">Rejoignez la Beta d'OsteoApp</h1>
        
        <p className="text-base md:text-lg text-gray-600 mb-2">
          Un logiciel de gestion simple, moderne et pensé pour les osteopathes.
        </p>
        <p className="text-gray-600 mb-6">
          Conçu pour ceux qui n'ont pas encore trouvé l'outil idéal – ou qui débutent.
        </p>
        
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-green-800 font-medium flex items-center justify-center">
            <CheckCircle size={18} className="mr-2" />
            Aucun engagement – Vous serez contacté uniquement lorsqu'une place se libère.
          </p>
        </div>
      </div>

      {/* Statistiques Beta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="text-center p-4 bg-primary-50 rounded-lg">
          <Users size={24} className="mx-auto text-primary-600 mb-2" />
          <div className="text-2xl font-bold text-primary-600">45</div>
          <div className="text-xs text-gray-600">Osteopathes inscrits</div>
        </div>
        <div className="text-center p-4 bg-secondary-50 rounded-lg">
          <Clock size={24} className="mx-auto text-secondary-600 mb-2" />
          <div className="text-2xl font-bold text-secondary-600">2-3</div>
          <div className="text-xs text-gray-600">semaines d'attente</div>
        </div>
        <div className="text-center p-4 bg-accent-50 rounded-lg">
          <Star size={24} className="mx-auto text-accent-600 mb-2" />
          <div className="text-2xl font-bold text-accent-600">4.9/5</div>
          <div className="text-xs text-gray-600">de satisfaction</div>
        </div>
      </div>

      {/* Affichage des erreurs avec possibilité de retry */}
      {error && (
        <div className="mb-6 p-4 bg-error/5 border border-error/20 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle size={20} className="text-error shrink-0 mt-0.5 mr-3" />
            <div className="flex-1">
              <p className="text-error font-medium">{error}</p>
              {submissionState.lastError && submissionState.lastError !== error && (
                <p className="text-sm text-error/80 mt-1">{submissionState.lastError}</p>
              )}
              <div className="mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  leftIcon={<RefreshCw size={14} />}
                >
                  Réessayer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Affichage de l'état de la tentative en cours */}
      {submissionState.isSubmitting && (
        <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-lg">
          <div className="flex items-center">
            <RefreshCw size={20} className={`text-primary-600 ${submissionState.currentAttempt > 0 ? 'animate-spin' : ''} mr-3`} />
            <div>
              {submissionState.method === 'functions' && (
                <>
                  <p className="text-primary-800 font-medium">
                    {submissionState.currentAttempt > 0 
                      ? `Tentative ${submissionState.currentAttempt}/${submissionState.maxAttempts}...` 
                      : "Inscription en cours..."}
                  </p>
                  {submissionState.currentAttempt > 1 && (
                    <p className="text-sm text-primary-700">
                      Nous rencontrons des difficultés de connexion. Veuillez patienter...
                    </p>
                  )}
                </>
              )}
              
              {submissionState.method === 'firestore' && (
                <>
                  <p className="text-primary-800 font-medium">
                    Utilisation de la méthode alternative...
                  </p>
                  <p className="text-sm text-primary-700">
                    Nous traitons votre inscription via une autre méthode. Veuillez patienter...
                  </p>
                </>
              )}
            </div>
          </div>
          
          {/* Barre de progression */}
          {submissionState.isSubmitting && (
            <div className="mt-3 w-full bg-primary-100 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-primary-500 h-2 transition-all duration-300"
                style={{ 
                  width: `${submissionState.currentAttempt > 0 
                    ? (submissionState.currentAttempt / submissionState.maxAttempts) * 100 
                    : 33}%` 
                }}
              ></div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 bg-white rounded-xl shadow-md p-4 md:p-6">
        {/* Étape 1 : Profil professionnel */}
        <div className="space-y-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <User size={16} className="text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Profil professionnel</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="label">
                Prénom *
              </label>
              <input
                type="text"
                id="firstName"
                className={`input ${errors.firstName ? 'border-error' : ''}`}
                {...register('firstName', { 
                  required: 'Ce champ est requis',
                  minLength: { value: 2, message: 'Prénom trop court' }
                })}
                placeholder="Jean"
                onChange={(e) => {
                  register('firstName').onChange(e);
                  if (e.target.value.length > 1) {
                    trackEvent("waitlist_field_completed", { field: "firstName" });
                    trackMatomoEvent('Form', 'Field Completed', 'First Name');
                    trackGAEvent('waitlist_field_completed', { field: "firstName" });
                  }
                }}
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-error">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="lastName" className="label">
                Nom *
              </label>
              <input
                type="text"
                id="lastName"
                className={`input ${errors.lastName ? 'border-error' : ''}`}
                {...register('lastName', { 
                  required: 'Ce champ est requis',
                  minLength: { value: 2, message: 'Nom trop court' }
                })}
                placeholder="Dupont"
                onChange={(e) => {
                  register('lastName').onChange(e);
                  if (e.target.value.length > 1) {
                    trackEvent("waitlist_field_completed", { field: "lastName" });
                    trackMatomoEvent('Form', 'Field Completed', 'Last Name');
                    trackGAEvent('waitlist_field_completed', { field: "lastName" });
                  }
                }}
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-error">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="email" className="label">
              Email professionnel *
            </label>
            <input
              type="email"
              id="email"
              className={`input ${errors.email ? 'border-error' : ''}`}
              {...register('email', { 
                required: 'Ce champ est requis',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Email invalide'
                }
              })}
              placeholder="votre@email.com"
              onChange={(e) => {
                register('email').onChange(e);
                if (e.target.value.includes('@') && e.target.value.includes('.')) {
                  trackEvent("waitlist_field_completed", { 
                    field: "email",
                    domain: e.target.value.split('@')[1]
                  });
                  trackMatomoEvent('Form', 'Field Completed', 'Email');
                  trackGAEvent('waitlist_field_completed', { 
                    field: "email",
                    domain: e.target.value.split('@')[1]
                  });
                }
              }}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-error">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="phone" className="label">
              Téléphone *
            </label>
            <input
              type="tel"
              id="phone"
              className={`input ${errors.phone ? 'border-error' : ''}`}
              {...register('phone', { 
                required: 'Ce champ est requis',
                pattern: {
                  value: /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/,
                  message: 'Format de téléphone invalide'
                }
              })}
              placeholder="06 12 34 56 78"
              onChange={(e) => {
                register('phone').onChange(e);
                if (e.target.value.length > 9) {
                  trackEvent("waitlist_field_completed", { field: "phone" });
                  trackMatomoEvent('Form', 'Field Completed', 'Phone');
                  trackGAEvent('waitlist_field_completed', { field: "phone" });
                }
              }}
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-error">{errors.phone.message}</p>
            )}
          </div>

          <div>
            <label className="label">Vous êtes : *</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="installed"
                  className="mr-3"
                  {...register('profileType', { required: 'Ce champ est requis' })}
                  onChange={(e) => {
                    register('profileType').onChange(e);
                    trackEvent("waitlist_profile_selected", { type: "installed" });
                    trackMatomoEvent('Form', 'Profile Selected', 'Installed');
                    trackGAEvent('waitlist_profile_selected', { type: "installed" });
                  }}
                />
                <span>Osteopathe installé</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="graduate"
                  className="mr-3"
                  {...register('profileType', { required: 'Ce champ est requis' })}
                  onChange={(e) => {
                    register('profileType').onChange(e);
                    trackEvent("waitlist_profile_selected", { type: "graduate" });
                    trackMatomoEvent('Form', 'Profile Selected', 'Graduate');
                    trackGAEvent('waitlist_profile_selected', { type: "graduate" });
                  }}
                />
                <span>Jeune diplômé</span>
              </label>
            </div>
            {errors.profileType && (
              <p className="mt-1 text-sm text-error">{errors.profileType.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="experienceYears" className="label">
              Depuis combien d'années exercez-vous ? *
            </label>
            <select
              id="experienceYears"
              className={`input ${errors.experienceYears ? 'border-error' : ''}`}
              {...register('experienceYears', { required: 'Ce champ est requis' })}
              onChange={(e) => {
                register('experienceYears').onChange(e);
                trackEvent("waitlist_experience_selected", { years: e.target.value });
                trackMatomoEvent('Form', 'Experience Selected', e.target.value);
                trackGAEvent('waitlist_experience_selected', { years: e.target.value });
              }}
            >
              <option value="">Sélectionner</option>
              <option value="0">0 (étudiant ou tout nouveau diplômé)</option>
              <option value="1-3">1 à 3 ans</option>
              <option value="3-5">3 à 5 ans</option>
              <option value="5+">5 ans ou plus</option>
            </select>
            {errors.experienceYears && (
              <p className="mt-1 text-sm text-error">{errors.experienceYears.message}</p>
            )}
          </div>
        </div>

        {/* Séparateur visuel */}
        <hr className="border-gray-200" />

        {/* Étape 2 : Activité */}
        <div className="space-y-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 bg-secondary-100 rounded-full flex items-center justify-center">
              <Building size={16} className="text-secondary-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Votre activité</h3>
          </div>

          <div>
            <label htmlFor="city" className="label">
              Ville d'exercice *
            </label>
            <input
              type="text"
              id="city"
              className={`input ${errors.city ? 'border-error' : ''}`}
              {...register('city', { required: 'Ce champ est requis' })}
              placeholder="Paris"
              onChange={(e) => {
                register('city').onChange(e);
                if (e.target.value.length > 2) {
                  trackEvent("waitlist_field_completed", { 
                    field: "city",
                    city: e.target.value
                  });
                  trackMatomoEvent('Form', 'Field Completed', 'City');
                  trackGAEvent('waitlist_field_completed', { 
                    field: "city",
                    city: e.target.value
                  });
                }
              }}
            />
            {errors.city && (
              <p className="mt-1 text-sm text-error">{errors.city.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="teamSize" className="label">
                Taille de l'équipe *
              </label>
              <select
                id="teamSize"
                className={`input ${errors.teamSize ? 'border-error' : ''}`}
                {...register('teamSize', { required: 'Ce champ est requis' })}
                onChange={(e) => {
                  register('teamSize').onChange(e);
                  trackEvent("waitlist_team_size_selected", { size: e.target.value });
                  trackMatomoEvent('Form', 'Team Size Selected', e.target.value);
                  trackGAEvent('waitlist_team_size_selected', { size: e.target.value });
                }}
              >
                <option value="">Sélectionner</option>
                <option value="alone">Seul(e)</option>
                <option value="2-3">2-3 personnes</option>
                <option value="4+">4 personnes ou plus</option>
              </select>
              {errors.teamSize && (
                <p className="mt-1 text-sm text-error">{errors.teamSize.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="practiceType" className="label">
                Type de cabinet *
              </label>
              <select
                id="practiceType"
                className={`input ${errors.practiceType ? 'border-error' : ''}`}
                {...register('practiceType', { required: 'Ce champ est requis' })}
                onChange={(e) => {
                  register('practiceType').onChange(e);
                  trackEvent("waitlist_practice_type_selected", { type: e.target.value });
                  trackMatomoEvent('Form', 'Practice Type Selected', e.target.value);
                  trackGAEvent('waitlist_practice_type_selected', { type: e.target.value });
                }}
              >
                <option value="">Sélectionner</option>
                <option value="liberal">Libéral</option>
                <option value="scm">SCM</option>
                <option value="clinic">Clinique</option>
                <option value="other">Autre</option>
              </select>
              {errors.practiceType && (
                <p className="mt-1 text-sm text-error">{errors.practiceType.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="label">Avez-vous un logiciel de gestion ? *</label>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="yes"
                  className="mr-3"
                  {...register('hasCurrentSoftware', { required: 'Ce champ est requis' })}
                  onChange={(e) => {
                    register('hasCurrentSoftware').onChange(e);
                    trackEvent("waitlist_has_software", { value: "yes" });
                    trackMatomoEvent('Form', 'Has Software', 'Yes');
                    trackGAEvent('waitlist_has_software', { value: "yes" });
                  }}
                />
                <span>Oui</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="no"
                  className="mr-3"
                  {...register('hasCurrentSoftware', { required: 'Ce champ est requis' })}
                  onChange={(e) => {
                    register('hasCurrentSoftware').onChange(e);
                    trackEvent("waitlist_has_software", { value: "no" });
                    trackMatomoEvent('Form', 'Has Software', 'No');
                    trackGAEvent('waitlist_has_software', { value: "no" });
                  }}
                />
                <span>Non</span>
              </label>
            </div>
            {errors.hasCurrentSoftware && (
              <p className="mt-1 text-sm text-error">{errors.hasCurrentSoftware.message}</p>
            )}
          </div>

          {watchedHasCurrentSoftware === 'yes' && (
            <>
              <div>
                <label htmlFor="currentSoftware" className="label">
                  Si oui, lequel ?
                </label>
                <input
                  type="text"
                  id="currentSoftware"
                  className="input"
                  {...register('currentSoftware')}
                  placeholder="Nom du logiciel actuel"
                  onChange={(e) => {
                    register('currentSoftware').onChange(e);
                    if (e.target.value.length > 2) {
                      trackEvent("waitlist_current_software", { software: e.target.value });
                      trackMatomoEvent('Form', 'Current Software', e.target.value);
                      trackGAEvent('waitlist_current_software', { software: e.target.value });
                    }
                  }}
                />
              </div>

              <div>
                <label htmlFor="currentSoftwareIssues" className="label">
                  Qu'est-ce qui vous manque avec votre solution actuelle ?
                </label>
                <textarea
                  id="currentSoftwareIssues"
                  rows={3}
                  className="input resize-none"
                  {...register('currentSoftwareIssues')}
                  placeholder="Décrivez les limitations ou problèmes rencontrés..."
                  onChange={(e) => {
                    register('currentSoftwareIssues').onChange(e);
                    if (e.target.value.length > 10) {
                      trackEvent("waitlist_software_issues_provided");
                      trackMatomoEvent('Form', 'Software Issues Provided');
                      trackGAEvent('waitlist_software_issues_provided', {
                        length: e.target.value.length
                      });
                    }
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* Séparateur visuel */}
        <hr className="border-gray-200" />

        {/* Étape 3 : Vos attentes */}
        <div className="space-y-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-8 h-8 bg-accent-100 rounded-full flex items-center justify-center">
              <MessageCircle size={16} className="text-accent-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Vos attentes</h3>
          </div>

          <div>
            <label htmlFor="expectations" className="label">
              Qu'attendez-vous d'un logiciel comme OsteoApp ? *
            </label>
            <textarea
              id="expectations"
              rows={4}
              className={`input resize-none ${errors.expectations ? 'border-error' : ''}`}
              {...register('expectations', { 
                required: 'Ce champ est requis',
                minLength: { value: 10, message: 'Veuillez détailler davantage vos attentes' }
              })}
              placeholder="Décrivez vos besoins et attentes..."
              onChange={(e) => {
                register('expectations').onChange(e);
                if (e.target.value.length > 20) {
                  trackEvent("waitlist_expectations_provided", {
                    length: e.target.value.length
                  });
                  trackMatomoEvent('Form', 'Expectations Provided', '', e.target.value.length);
                  trackGAEvent('waitlist_expectations_provided', {
                    length: e.target.value.length
                  });
                }
              }}
            />
            {errors.expectations && (
              <p className="mt-1 text-sm text-error">{errors.expectations.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="referralSource" className="label">
              Comment avez-vous entendu parler de nous ?
            </label>
            <select
              id="referralSource"
              className="input"
              {...register('referralSource')}
              onChange={(e) => {
                register('referralSource').onChange(e);
                trackEvent("waitlist_referral_source", { source: e.target.value });
                trackMatomoEvent('Form', 'Referral Source', e.target.value);
                trackGAEvent('waitlist_referral_source', { source: e.target.value });
              }}
            >
              <option value="">Sélectionner</option>
              <option value="google">Recherche Google</option>
              <option value="social">Réseaux sociaux</option>
              <option value="colleague">Collègue osteopathe</option>
              <option value="conference">Conférence/Formation</option>
              <option value="school">École d'osteopathie</option>
              <option value="press">Article de presse</option>
              <option value="other">Autre</option>
            </select>
          </div>
        </div>

        {/* Opt-in */}
        <div className="space-y-3">
          <label className="flex items-start">
            <input
              type="checkbox"
              className="mt-1 mr-3"
              {...register('newsletter')}
              onChange={(e) => {
                register('newsletter').onChange(e);
                trackEvent("waitlist_newsletter_opt_in", { 
                  opted_in: e.target.checked 
                });
                trackMatomoEvent('Form', 'Newsletter Opt-in', e.target.checked ? 'Yes' : 'No');
                trackGAEvent('waitlist_newsletter_opt_in', { 
                  opted_in: e.target.checked 
                });
              }}
            />
            <span className="text-sm text-gray-700">
              Je souhaite recevoir les nouveautés, astuces et témoignages d'autres osteopathes par email
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="btn btn-primary w-full"
          disabled={!isValid || submissionState.isSubmitting}
          onClick={() => {
            if (isValid && !submissionState.isSubmitting) {
              trackEvent("waitlist_submit_button_click");
              trackMatomoEvent('Form', 'Submit Button Click');
              trackGAEvent('waitlist_submit_button_click');
            }
          }}
        >
          {submissionState.isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {submissionState.method === 'functions' && submissionState.currentAttempt > 0 
                ? `Tentative ${submissionState.currentAttempt}/${submissionState.maxAttempts}...` 
                : submissionState.method === 'firestore'
                ? "Méthode alternative en cours..."
                : "Inscription en cours..."}
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <UserPlus size={18} className="mr-2" />
              Rejoindre la liste d'attente
            </span>
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Déjà inscrit ?{' '}
        <Link 
          to="/login" 
          className="font-medium text-primary-600 hover:text-primary-700"
          onClick={() => {
            trackEvent("login_link_click", { from: "waitlist_form" });
            trackMatomoEvent('Navigation', 'Click', 'Login from Waitlist');
            trackGAEvent('click_login', { from: "waitlist_form" });
          }}
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
};

export default BetaWaitlist;