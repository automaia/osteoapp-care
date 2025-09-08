import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  FileText, 
  TrendingUp, 
  TrendingDown,
  Filter,
  Download,
  Eye,
  Clock,
  Euro,
  UserCheck,
  CalendarCheck,
  AlertCircle,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { Button } from '../components/ui/Button';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addWeeks,
  addMonths, subWeeks, subMonths, subDays, isWithinInterval, isFuture, startOfDay, endOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PatientStats {
  total: number;
  active: number;
  newThisMonth: number;
  seenLast30Days: number;
  byGender: { male: number; female: number; other: number };
  byAgeGroup: { [key: string]: number };
}

interface AppointmentStats {
  today: number;
  thisWeek: number;
  occupancyRate: number;
  cancellationRate: number;
  totalSlots: number;
  bookedSlots: number;
}

interface InvoiceStats {
  currentMonthRevenue: number;
  unpaidAmount: number;
  collectionRate: number;
  previousMonthRevenue: number;
  totalInvoices: number;
  paidInvoices: number;
}

const Statistics: React.FC = () => {
  const [patientStats, setPatientStats] = useState<PatientStats>({
    total: 0,
    active: 0,
    newThisMonth: 0,
    seenLast30Days: 0,
    byGender: { male: 0, female: 0, other: 0 },
    byAgeGroup: {}
  });

  const [appointmentStats, setAppointmentStats] = useState<AppointmentStats>({
    today: 0,
    thisWeek: 0,
    occupancyRate: 0,
    cancellationRate: 0,
    totalSlots: 0,
    bookedSlots: 0
  });

  const [invoiceStats, setInvoiceStats] = useState<InvoiceStats>({
    currentMonthRevenue: 0,
    unpaidAmount: 0,
    collectionRate: 0,
    previousMonthRevenue: 0,
    totalInvoices: 0,
    paidInvoices: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // Mise à jour de l'heure actuelle toutes les secondes
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    
    return () => clearInterval(clockInterval);
  }, []);

  // Rafraîchissement automatique toutes les 3 secondes
  useEffect(() => {
    const refreshInterval = setInterval(() => {
      loadAllStats();
    }, 3000);
    
    return () => clearInterval(refreshInterval);
  }, [selectedPeriod]);

  // Initial load
  useEffect(() => {
    loadAllStats();
  }, [selectedPeriod]);

  const loadAllStats = async () => {
    if (!auth.currentUser) return;

    try {
      setError(null);
      await Promise.all([
        loadPatientStats(),
        loadAppointmentStats(),
        loadInvoiceStats()
      ]);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading statistics:', error);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
    }
  };

  const loadPatientStats = async () => {
    const patientsRef = collection(db, 'patients');
    const q = query(patientsRef, where('osteopathId', '==', auth.currentUser!.uid));
    const snapshot = await getDocs(q);

    const patients = snapshot.docs.map(doc => doc.data());
    const now = new Date();
    const monthStart = startOfMonth(now);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Calculate age groups
    const ageGroups: { [key: string]: number } = {
      '0-18': 0,
      '19-35': 0,
      '36-50': 0,
      '51-65': 0,
      '65+': 0
    };

    const genderCount = { male: 0, female: 0, other: 0 };
    let newThisMonth = 0;

    patients.forEach(patient => {
      // Gender distribution
      genderCount[patient.gender as keyof typeof genderCount]++;

      // Age groups
      if (patient.dateOfBirth) {
        const age = new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear();
        if (age <= 18) ageGroups['0-18']++;
        else if (age <= 35) ageGroups['19-35']++;
        else if (age <= 50) ageGroups['36-50']++;
        else if (age <= 65) ageGroups['51-65']++;
        else ageGroups['65+']++;
      }

      // New patients this month
      if (patient.createdAt && new Date(patient.createdAt) >= monthStart) {
        newThisMonth++;
      }
    });

    // Get consultations for "seen last 30 days"
    const consultationsRef = collection(db, 'consultations');
    const consultationsQuery = query(
      consultationsRef,
      where('osteopathId', '==', auth.currentUser!.uid)
    );
    const consultationsSnapshot = await getDocs(consultationsQuery);
    
    const uniquePatients = new Set();
    consultationsSnapshot.docs.forEach(doc => {
      const consultation = doc.data();
      const consultationDate = consultation.date?.toDate?.() || new Date(consultation.date);
      if (consultationDate >= thirtyDaysAgo) {
        uniquePatients.add(consultation.patientId);
      }
    });

    setPatientStats({
      total: patients.length,
      active: patients.length, // Assuming all patients are active
      newThisMonth,
      seenLast30Days: uniquePatients.size,
      byGender: genderCount,
      byAgeGroup: ageGroups
    });
  };

  const loadAppointmentStats = async () => {
    const appointmentsRef = collection(db, 'appointments');
    const q = query(appointmentsRef, where('osteopathId', '==', auth.currentUser!.uid));
    const snapshot = await getDocs(q);

    const appointments = snapshot.docs.map(doc => doc.data());
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    let todayCount = 0;
    let thisWeekCount = 0;
    let cancelledCount = 0;
    let totalAppointments = appointments.length;

    appointments.forEach(appointment => {
      const appointmentDate = appointment.date?.toDate?.() || new Date(appointment.date);
      
      // Today's appointments
      if (appointmentDate.toDateString() === today.toDateString()) {
        todayCount++;
      }

      // This week's appointments
      if (isWithinInterval(appointmentDate, { start: weekStart, end: weekEnd })) {
        thisWeekCount++;
      }

      // Cancelled appointments
      if (appointment.status === 'cancelled') {
        cancelledCount++;
      }
    });

    // Calculate occupancy rate (simplified - assuming 8 hours * 5 days = 40 slots per week)
    const totalWeeklySlots = 40;
    const occupancyRate = totalWeeklySlots > 0 ? (thisWeekCount / totalWeeklySlots) * 100 : 0;
    const cancellationRate = totalAppointments > 0 ? (cancelledCount / totalAppointments) * 100 : 0;

    setAppointmentStats({
      today: todayCount,
      thisWeek: thisWeekCount,
      occupancyRate: Math.min(occupancyRate, 100),
      cancellationRate,
      totalSlots: totalWeeklySlots,
      bookedSlots: thisWeekCount
    });
  };

  const loadInvoiceStats = async () => {
    const invoicesRef = collection(db, 'invoices');
    const q = query(invoicesRef, where('osteopathId', '==', auth.currentUser!.uid));
    const snapshot = await getDocs(q);

    const invoices = snapshot.docs.map(doc => doc.data());
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const previousMonthStart = startOfMonth(subMonths(now, 1));
    const previousMonthEnd = endOfMonth(subMonths(now, 1));

    let currentMonthRevenue = 0;
    let previousMonthRevenue = 0;
    let unpaidAmount = 0;
    let paidInvoices = 0;

    invoices.forEach(invoice => {
      const issueDate = new Date(invoice.issueDate);
      
      // Current month revenue
      if (isWithinInterval(issueDate, { start: currentMonthStart, end: currentMonthEnd })) {
        if (invoice.status === 'paid') {
          currentMonthRevenue += invoice.total || 0;
        }
      }

      // Previous month revenue
      if (isWithinInterval(issueDate, { start: previousMonthStart, end: previousMonthEnd })) {
        if (invoice.status === 'paid') {
          previousMonthRevenue += invoice.total || 0;
        }
      }

      // Unpaid invoices
      if (invoice.status !== 'paid') {
        unpaidAmount += invoice.total || 0;
      } else {
        paidInvoices++;
      }
    });

    const collectionRate = invoices.length > 0 ? (paidInvoices / invoices.length) * 100 : 0;

    setInvoiceStats({
      currentMonthRevenue,
      previousMonthRevenue,
      unpaidAmount,
      collectionRate,
      totalInvoices: invoices.length,
      paidInvoices
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getRevenueChange = () => {
    if (invoiceStats.previousMonthRevenue === 0) return 0;
    return ((invoiceStats.currentMonthRevenue - invoiceStats.previousMonthRevenue) / invoiceStats.previousMonthRevenue) * 100;
  };

  const exportStats = () => {
    const data = {
      patients: patientStats,
      appointments: appointmentStats,
      invoices: invoiceStats,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statistics_${format(new Date(), 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statistiques</h1>
          <div className="text-sm text-gray-500">
            {formatDate(currentDateTime)} - {formatTime(currentDateTime)}
          </div>
          <div className="text-xs text-gray-400">
            Dernière mise à jour: {formatTime(lastUpdate)}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="input text-sm"
          >
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
            <option value="quarter">Ce trimestre</option>
            <option value="year">Cette année</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={exportStats}
            leftIcon={<Download size={16} />}
          >
            Exporter
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-error/5 border border-error/20 rounded-xl">
          <div className="flex items-center">
            <AlertCircle className="text-error mr-3" size={24} />
            <div>
              <h3 className="font-medium text-error">Erreur</h3>
              <p className="text-error/80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Patient Statistics */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <Users className="mr-2" size={24} />
          Statistiques Patients
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Patients actifs</p>
                <p className="text-2xl font-bold text-gray-900">{patientStats.active}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <UserCheck className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Nouveaux ce mois</p>
                <p className="text-2xl font-bold text-gray-900">{patientStats.newThisMonth}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <TrendingUp className="text-green-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Vus (30 derniers jours)</p>
                <p className="text-2xl font-bold text-gray-900">{patientStats.seenLast30Days}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Activity className="text-purple-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total patients</p>
                <p className="text-2xl font-bold text-gray-900">{patientStats.total}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
                <Users className="text-indigo-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Gender and Age Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Répartition par sexe</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Hommes</span>
                <span className="font-medium">{patientStats.byGender.male}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Femmes</span>
                <span className="font-medium">{patientStats.byGender.female}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Autre</span>
                <span className="font-medium">{patientStats.byGender.other}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Répartition par âge</h3>
            <div className="space-y-3">
              {Object.entries(patientStats.byAgeGroup).map(([ageGroup, count]) => (
                <div key={ageGroup} className="flex items-center justify-between">
                  <span className="text-gray-600">{ageGroup} ans</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Statistics */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <Calendar className="mr-2" size={24} />
          Statistiques Agenda
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">RDV aujourd'hui</p>
                <p className="text-2xl font-bold text-gray-900">{appointmentStats.today}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <Clock className="text-orange-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">RDV cette semaine</p>
                <p className="text-2xl font-bold text-gray-900">{appointmentStats.thisWeek}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <CalendarCheck className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Taux d'occupation</p>
                <p className="text-2xl font-bold text-gray-900">{appointmentStats.occupancyRate.toFixed(1)}%</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <BarChart3 className="text-green-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Taux d'annulation</p>
                <p className="text-2xl font-bold text-gray-900">{appointmentStats.cancellationRate.toFixed(1)}%</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="text-red-600" size={24} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Statistics */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 flex items-center">
          <FileText className="mr-2" size={24} />
          Statistiques Factures
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">CA ce mois</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(invoiceStats.currentMonthRevenue)}
                </p>
                <div className="flex items-center mt-1">
                  {getRevenueChange() >= 0 ? (
                    <TrendingUp className="text-green-500 mr-1" size={16} />
                  ) : (
                    <TrendingDown className="text-red-500 mr-1" size={16} />
                  )}
                  <span className={`text-sm ${getRevenueChange() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(getRevenueChange()).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Euro className="text-green-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Factures impayées</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(invoiceStats.unpaidAmount)}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="text-red-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Taux de recouvrement</p>
                <p className="text-2xl font-bold text-gray-900">{invoiceStats.collectionRate.toFixed(1)}%</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <PieChart className="text-blue-600" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">CA mois précédent</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(invoiceStats.previousMonthRevenue)}
                </p>
              </div>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <BarChart3 className="text-gray-600" size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Comparison */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Comparaison mensuelle</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Mois actuel</p>
              <p className="text-xl font-bold text-primary-600">
                {formatCurrency(invoiceStats.currentMonthRevenue)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Mois précédent</p>
              <p className="text-xl font-bold text-gray-600">
                {formatCurrency(invoiceStats.previousMonthRevenue)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Évolution</p>
              <div className="flex items-center justify-center">
                {getRevenueChange() >= 0 ? (
                  <TrendingUp className="text-green-500 mr-2" size={20} />
                ) : (
                  <TrendingDown className="text-red-500 mr-2" size={20} />
                )}
                <p className={`text-xl font-bold ${getRevenueChange() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {getRevenueChange() >= 0 ? '+' : ''}{getRevenueChange().toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;