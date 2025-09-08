/**
 * Exemple de composant React utilisant le SDK OsteoApp
 */

import React, { useState, useEffect } from 'react';
import { OsteoAppSDK, DateHelpers, OsteoAppSDKError } from '../index';

interface BookingComponentProps {
  apiUrl: string;
  apiKey?: string;
  osteopathId?: string; // Si pré-sélectionné
  onSuccess?: (appointment: any) => void;
  onError?: (error: string) => void;
}

export const BookingComponent: React.FC<BookingComponentProps> = ({
  apiUrl,
  apiKey,
  osteopathId: preselectedOsteopathId,
  onSuccess,
  onError
}) => {
  const [sdk] = useState(() => new OsteoAppSDK({ apiUrl, apiKey }));
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // État du formulaire
  const [osteopaths, setOsteopaths] = useState<any[]>([]);
  const [selectedOsteopathId, setSelectedOsteopathId] = useState(preselectedOsteopathId || '');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [patientData, setPatientData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: ''
  });

  // Charger les ostéopathes au montage
  useEffect(() => {
    loadOsteopaths();
  }, []);

  const loadOsteopaths = async () => {
    try {
      setLoading(true);
      const data = await sdk.getOsteopaths();
      setOsteopaths(data);
      
      if (preselectedOsteopathId) {
        setStep(2); // Passer directement à la sélection de date
      }
    } catch (err) {
      const errorMessage = err instanceof OsteoAppSDKError ? err.message : 'Erreur de chargement';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableSlots = async (date: Date) => {
    if (!selectedOsteopathId) return;

    try {
      setLoading(true);
      const availability = await sdk.appointments.getAvailableSlots(
        selectedOsteopathId,
        date,
        60
      );
      
      setAvailableSlots(availability.slots.filter(slot => slot.available));
      setStep(3);
    } catch (err) {
      const errorMessage = err instanceof OsteoAppSDKError ? err.message : 'Erreur de chargement des créneaux';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!selectedOsteopathId || !selectedDate || !selectedTime) return;

    try {
      setLoading(true);
      
      const appointment = await sdk.bookAppointment({
        osteopathId: selectedOsteopathId,
        patient: {
          firstName: patientData.firstName,
          lastName: patientData.lastName,
          email: patientData.email,
          phone: patientData.phone || undefined
        },
        date: selectedDate,
        time: selectedTime,
        notes: patientData.notes || undefined
      });

      setStep(5); // Étape de confirmation
      onSuccess?.(appointment);

    } catch (err) {
      const errorMessage = err instanceof OsteoAppSDKError ? err.message : 'Erreur lors de la création';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Générer les 14 prochains jours
  const getAvailableDates = () => {
    const dates = [];
    for (let i = 1; i <= 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  if (loading && step === 1) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-primary-600 mb-6 text-center">
        Prendre rendez-vous
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Étape 1: Sélection ostéopathe */}
      {step === 1 && !preselectedOsteopathId && (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Choisissez votre ostéopathe :
          </label>
          <select
            value={selectedOsteopathId}
            onChange={(e) => {
              setSelectedOsteopathId(e.target.value);
              if (e.target.value) setStep(2);
            }}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Sélectionner un praticien</option>
            {osteopaths.map(osteopath => (
              <option key={osteopath.id} value={osteopath.id}>
                {osteopath.firstName} {osteopath.lastName}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Étape 2: Sélection de date */}
      {step === 2 && (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Choisissez une date :
          </label>
          <div className="grid grid-cols-4 gap-2">
            {getAvailableDates().map(date => (
              <button
                key={date.toISOString()}
                onClick={() => {
                  setSelectedDate(date);
                  loadAvailableSlots(date);
                }}
                className="p-3 border border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors text-center"
              >
                <div className="text-xs text-gray-500 uppercase">
                  {DateHelpers.formatDate(date, 'EEE')}
                </div>
                <div className="text-lg font-bold">
                  {DateHelpers.formatDate(date, 'd')}
                </div>
                <div className="text-xs text-gray-500">
                  {DateHelpers.formatDate(date, 'MMM')}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Étape 3: Sélection d'horaire */}
      {step === 3 && (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Choisissez un horaire :
          </label>
          {loading ? (
            <div className="text-center py-4">Chargement des créneaux...</div>
          ) : availableSlots.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              Aucun créneau disponible ce jour-là
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {availableSlots.map(slot => (
                <button
                  key={slot.start}
                  onClick={() => {
                    setSelectedTime(slot.start);
                    setStep(4);
                  }}
                  className="p-3 border border-gray-300 rounded-lg hover:border-primary-500 hover:bg-primary-50 transition-colors font-semibold"
                >
                  {slot.start}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Étape 4: Informations patient */}
      {step === 4 && (
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            Vos informations :
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Prénom *"
              value={patientData.firstName}
              onChange={(e) => setPatientData(prev => ({ ...prev, firstName: e.target.value }))}
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
            <input
              type="text"
              placeholder="Nom *"
              value={patientData.lastName}
              onChange={(e) => setPatientData(prev => ({ ...prev, lastName: e.target.value }))}
              className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>
          <input
            type="email"
            placeholder="Email *"
            value={patientData.email}
            onChange={(e) => setPatientData(prev => ({ ...prev, email: e.target.value }))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
          />
          <input
            type="tel"
            placeholder="Téléphone"
            value={patientData.phone}
            onChange={(e) => setPatientData(prev => ({ ...prev, phone: e.target.value }))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <textarea
            placeholder="Motif de consultation (optionnel)"
            value={patientData.notes}
            onChange={(e) => setPatientData(prev => ({ ...prev, notes: e.target.value }))}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            rows={3}
          />
          <button
            onClick={handleBooking}
            disabled={loading || !patientData.firstName || !patientData.lastName || !patientData.email}
            className="w-full bg-primary-500 text-white py-3 px-6 rounded-lg font-semibold hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Création en cours...' : 'Confirmer le rendez-vous'}
          </button>
        </div>
      )}

      {/* Étape 5: Confirmation */}
      {step === 5 && (
        <div className="text-center space-y-4">
          <div className="text-6xl">✅</div>
          <h3 className="text-xl font-bold text-green-600">
            Rendez-vous confirmé !
          </h3>
          <div className="bg-green-50 p-4 rounded-lg text-left">
            <p><strong>Date :</strong> {selectedDate && DateHelpers.formatDate(selectedDate)}</p>
            <p><strong>Heure :</strong> {selectedTime}</p>
            <p><strong>Patient :</strong> {patientData.firstName} {patientData.lastName}</p>
          </div>
          <p className="text-sm text-gray-600">
            Un email de confirmation vous a été envoyé.
          </p>
          <button
            onClick={() => {
              setStep(1);
              setSelectedDate(null);
              setSelectedTime('');
              setPatientData({ firstName: '', lastName: '', email: '', phone: '', notes: '' });
            }}
            className="bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Prendre un autre rendez-vous
          </button>
        </div>
      )}
    </div>
  );
};