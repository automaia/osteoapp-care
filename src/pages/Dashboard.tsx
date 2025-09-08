import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  FileText, 
  UserPlus, 
  CalendarPlus, 
  FileUp,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { DashboardService } from '../services/dashboardService';
import { auth } from '../firebase/config';
import HDSComplianceBadge from '../components/ui/HDSComplianceBadge';
import SubstitutesList from '../components/dashboard/SubstitutesList';
import { trackEvent } from '../lib/clarityClient';
import { trackEvent as trackMatomoEvent } from '../lib/matomoTagManager';
import { trackEvent as trackGAEvent } from '../lib/googleAnalytics';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  
  // Stats du tableau de bord
  const [stats, setStats] = useState({
    patientCount: 0,
    todayAppointments: 0,
    pendingInvoices: 0,
    newPatientsThisMonth: 0,
    occupancyRate: 0,
    invoicesThisMonth: 0,
    recentNotifications: []
  });

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
      loadDashboardStats(false);
    }, 3000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Chargement initial des statistiques
  useEffect(() => {
    loadDashboardStats(true);
    
    // Track dashboard view in Clarity
    trackEvent("dashboard_view");
    
    // Track dashboard view in Matomo
    trackMatomoEvent('Dashboard', 'Page View', 'Dashboard Home');
    
    // Track dashboard view in Google Analytics
    trackGAEvent('view_dashboard', {
      page_title: 'Dashboard Home'
    });
  }, []);

  const loadDashboardStats = async (isInitialLoad = false) => {
    try {
      if (isInitialLoad) {
        setLoading(true);
      }
      setError(null);
      
      const dashboardStats = await DashboardService.getDashboardStats();
      setStats(dashboardStats);
      setLastRefreshTime(new Date());
      
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      
      // Message d'erreur plus informatif
      let errorMessage = 'Erreur lors du chargement des statistiques';
      if ((error as Error).message?.includes('index')) {
        errorMessage = 'Les index Firestore sont en cours de construction. Veuillez patienter quelques minutes et actualiser la page.';
      }
      
      setError(errorMessage);
      
      // Track error in Clarity
      trackEvent("dashboard_error", { 
        error_message: errorMessage,
        error_type: (error as Error).name
      });
      
      // Track error in Matomo
      trackMatomoEvent('Error', 'Dashboard Load', errorMessage);
      
      // Track error in Google Analytics
      trackGAEvent('dashboard_error', {
        error_message: errorMessage,
        error_type: (error as Error).name || 'Unknown'
      });
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  const handleNewAppointment = () => {
    trackEvent("create_appointment_click", { source: "dashboard" });
    trackMatomoEvent('Dashboard', 'Action', 'Create Appointment');
    trackGAEvent('create_appointment', { source: "dashboard" });
    navigate('/consultations?action=new');
  };

  const handleNewInvoice = () => {
    trackEvent("create_invoice_click", { source: "dashboard" });
    trackMatomoEvent('Dashboard', 'Action', 'Create Invoice');
    trackGAEvent('create_invoice', { source: "dashboard" });
    navigate('/invoices?action=new');
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
      <div className="flex items-center justify-center h-full py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <div className="flex items-center mt-1">
            <HDSComplianceBadge size="sm" />
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-sm text-gray-500">
            {formatDate(currentDateTime)} - {formatTime(currentDateTime)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Dernière mise à jour: {formatTime(lastRefreshTime)}
          </div>
        </div>
      </div>

      {/* Message d'erreur */}
      {error && (
        <div className="p-4 bg-error/5 border border-error/20 rounded-lg flex items-start">
          <AlertCircle size={20} className="text-error shrink-0 mt-0.5 mr-3" />
          <div>
            <h3 className="font-medium text-error">Erreur</h3>
            <p className="text-sm text-error/80">{error}</p>
            {error.includes('index') && (
              <div className="mt-2 text-sm text-gray-600">
                <p>Pour résoudre ce problème :</p>
                <ol className="list-decimal list-inside mt-1 space-y-1">
                  <li>Consultez le fichier FIRESTORE_INDEX_SETUP.md</li>
                  <li>Créez les index manquants dans la console Firebase</li>
                  <li>Attendez que les index soient construits (quelques minutes)</li>
                  <li>Actualisez cette page</li>
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Patients</p>
              <h3 className="text-3xl font-bold mt-1">{stats.patientCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
              <Users size={20} className="text-primary-600" />
            </div>
          </div>
          <div className="mt-4">
            <Link 
              to="/patients" 
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              onClick={() => trackGAEvent('navigate_to_patients', { source: 'dashboard' })}
            >
              Voir tous les patients →
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Consultations aujourd'hui</p>
              <h3 className="text-3xl font-bold mt-1">{stats.todayAppointments}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center">
              <Calendar size={20} className="text-secondary-600" />
            </div>
          </div>
          <div className="mt-4">
            <Link 
              to="/consultations" 
              className="text-sm text-primary-600 hover:text-primary-700 font-medium group flex items-center"
              onClick={() => {
                trackEvent("view_appointments_click");
                trackMatomoEvent('Dashboard', 'Navigation', 'View Appointments');
                trackGAEvent('navigate_to_consultations', { source: 'dashboard' });
              }}
            >
              Voir l'agenda et les consultations 
              <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Factures en attente</p>
              <h3 className="text-3xl font-bold mt-1">{stats.pendingInvoices}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center">
              <FileText size={20} className="text-accent-600" />
            </div>
          </div>
          <div className="mt-4">
            <Link 
              to="/invoices" 
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              onClick={() => {
                trackEvent("view_invoices_click");
                trackMatomoEvent('Dashboard', 'Navigation', 'View Invoices');
                trackGAEvent('navigate_to_invoices', { source: 'dashboard' });
              }}
            >
              Voir toutes les factures →
            </Link>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            to="/patients?action=new"
            className="card flex items-center hover:shadow-lg"
            onClick={() => {
              trackEvent("create_patient_click", { source: "dashboard" });
              trackMatomoEvent('Dashboard', 'Action', 'Create Patient');
              trackGAEvent('create_patient', { source: 'dashboard' });
            }}
          >
            <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center mr-4">
              <UserPlus size={20} className="text-primary-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Nouveau patient</h3>
              <p className="text-sm text-gray-600">Ajouter un dossier patient</p>
            </div>
          </Link>

          <button 
            onClick={handleNewAppointment}
            className="card flex items-center hover:shadow-lg text-left w-full"
          >
            <div className="w-10 h-10 rounded-lg bg-secondary-100 flex items-center justify-center mr-4">
              <CalendarPlus size={20} className="text-secondary-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Nouvelle consultation</h3>
              <p className="text-sm text-gray-600">Créer une nouvelle consultation</p>
            </div>
          </button>

          <button 
            onClick={handleNewInvoice}
            className="card flex items-center hover:shadow-lg text-left w-full"
          >
            <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center mr-4">
              <FileUp size={20} className="text-accent-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Nouvelle facture</h3>
              <p className="text-sm text-gray-600">Créer une facture</p>
            </div>
          </button>
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Notifications */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Notifications récentes</h2>
            <Link 
              to="/notifications" 
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              onClick={() => {
                trackEvent("view_notifications_click");
                trackMatomoEvent('Dashboard', 'Navigation', 'View Notifications');
                trackGAEvent('navigate_to_notifications', { source: 'dashboard' });
              }}
            >
              Voir tout
            </Link>
          </div>
          
          <div className="space-y-3">
            {stats.recentNotifications.length > 0 ? (
              stats.recentNotifications.map((notification: any) => (
                <div key={notification.id} className="flex items-start p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                  <div className="mr-3 mt-0.5">
                    {notification.type === 'appointment' && <Clock size={16} className="text-primary-500" />}
                    {notification.type === 'invoice' && <FileText size={16} className="text-accent-500" />}
                    {notification.type === 'document' && <FileText size={16} className="text-secondary-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{notification.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{notification.timeFormatted}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-500">
                <p>Aucune notification récente</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent activity / Statistics preview */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Aperçu statistique</h2>
            <Link 
              to="/statistics" 
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              onClick={() => {
                trackEvent("view_statistics_click");
                trackMatomoEvent('Dashboard', 'Navigation', 'View Statistics');
                trackGAEvent('navigate_to_statistics', { source: 'dashboard' });
              }}
            >
              Détails
            </Link>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                  <TrendingUp size={16} className="text-green-600" />
                </div>
                <span className="text-sm font-medium">Nouveaux patients ce mois</span>
              </div>
              <span className="text-lg font-bold">{stats.newPatientsThisMonth}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                  <Calendar size={16} className="text-blue-600" />
                </div>
                <span className="text-sm font-medium">Taux de remplissage</span>
              </div>
              <span className="text-lg font-bold">{stats.occupancyRate}%</span>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100">
              <div className="flex items-center">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-3">
                  <FileText size={16} className="text-purple-600" />
                </div>
                <span className="text-sm font-medium">Factures ce mois</span>
              </div>
              <span className="text-lg font-bold">{stats.invoicesThisMonth}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Substitutes section for osteopaths */}
      <SubstitutesList />
      
    </div>
  );
};

export default Dashboard;