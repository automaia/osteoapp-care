import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Users, 
  BarChart3, 
  Settings, 
  Database, 
  LogOut, 
  ArrowLeft,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  UserPlus,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import BetaWaitlistDashboard from '../../components/admin/BetaWaitlistDashboard';
import UserManagement from '../../components/admin/UserManagement';
import SystemLogs from '../../components/admin/SystemLogs';
import SystemConfig from '../../components/admin/SystemConfig';
import AddUserModal from '../../components/admin/AddUserModal';
import DataMigrationDashboard from '../../components/admin/DataMigrationDashboard';
import SubstituteManagement from '../../components/admin/SubstituteManagement';
import { trackEvent } from '../../lib/clarityClient';
import { trackEvent as trackMatomoEvent } from '../../lib/matomoTagManager';
import { trackEvent as trackGAEvent } from '../../lib/googleAnalytics';
import { collection, query, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../../firebase/config';
import EncryptionDiagnostic from '../../components/ui/EncryptionDiagnostic';
import DataRepairTool from '../../components/ui/DataRepairTool';

const AdminDashboard: React.FC = () => {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    betaSignups: 0,
    systemHealth: 'good'
  });
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEncryptionDiagnostic, setShowEncryptionDiagnostic] = useState(false);
  const [showDataRepairTool, setShowDataRepairTool] = useState(false);

  useEffect(() => {
    // Charger les statistiques
    loadStats();
    
    // Track page view
    trackEvent("admin_dashboard_view");
    trackMatomoEvent('Admin', 'Dashboard View');
    trackGAEvent('view_admin_dashboard');
    
    // Mise à jour de l'heure actuelle toutes les secondes
    const clockInterval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    
    return () => clearInterval(clockInterval);
  }, []);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Récupérer le nombre total d'utilisateurs
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getCountFromServer(query(usersRef));
      const totalUsers = usersSnapshot.data().count;
      
      // Récupérer le nombre d'utilisateurs actifs
      const activeUsersQuery = query(usersRef);
      const activeUsersSnapshot = await getDocs(activeUsersQuery);
      const activeUsers = activeUsersSnapshot.docs.filter(doc => doc.data().isActive !== false).length;
      
      // Récupérer le nombre d'inscriptions Beta
      const betaRef = collection(db, 'beta_waitlist');
      const betaSnapshot = await getCountFromServer(query(betaRef));
      const betaSignups = betaSnapshot.data().count;
      
      setStats({
        totalUsers,
        activeUsers,
        betaSignups,
        systemHealth: 'good'
      });
      
      console.log('📊 Statistiques administrateur chargées:', {
        totalUsers,
        activeUsers,
        betaSignups
      });
      
    } catch (error) {
      console.error('Erreur lors du chargement des statistiques:', error);
      setError('Erreur lors du chargement des statistiques');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  const handleLogout = async () => {
    // Track logout
    trackEvent("admin_logout");
    trackMatomoEvent('Admin', 'Logout');
    trackGAEvent('admin_logout');
    
    const result = await logout();
    if (result.success) {
      navigate('/admin/login');
    }
  };

  const handleBackToApp = () => {
    // Track navigation
    trackEvent("admin_back_to_app");
    trackMatomoEvent('Admin', 'Navigate', 'Back to App');
    trackGAEvent('admin_back_to_app');
    
    navigate('/');
  };

  const handleAddUserSuccess = () => {
    // Rafraîchir les statistiques
    loadStats();
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    
    // Track tab change
    trackEvent("admin_tab_change", { tab });
    trackMatomoEvent('Admin', 'Tab Change', tab);
    trackGAEvent('admin_tab_change', { tab });
  };

  const tabs = [
    { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3, permission: 'analytics:read' },
    { id: 'users', label: 'Utilisateurs', icon: Users, permission: 'users:read' },
    { id: 'substitutes', label: 'Remplaçants', icon: UserPlus, permission: 'users:read' },
    { id: 'beta', label: 'Liste d\'attente Beta', icon: Clock, permission: 'users:read' },
    { id: 'encryption', label: 'Diagnostic Chiffrement', icon: Shield, permission: 'system:config' },
    { id: 'logs', label: 'Logs d\'activité', icon: Activity, permission: 'logs:read' },
    { id: 'migration', label: 'Migration des données', icon: Database, permission: 'system:config' },
    { id: 'config', label: 'Configuration', icon: Settings, permission: 'system:config' }
  ];

  const visibleTabs = tabs.filter(tab => hasPermission(tab.permission));

  // Formatage de la date et de l'heure
  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading && !refreshing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <img src="/Icon-logo-osteoapp-bleu.png" alt="OsteoApp Logo" width={32} height={32} className="mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Administration OsteoApp
                </h1>
                <p className="text-sm text-gray-500">
                  Bienvenue, {user?.displayName || user?.email}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDateTime(currentDateTime)}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium flex items-center">
                <Shield size={14} className="mr-1" />
                Administrateur
              </div>
              <Button
                variant="primary"
                onClick={() => {
                  setIsAddUserModalOpen(true);
                  trackEvent("admin_add_user_click");
                  trackMatomoEvent('Admin', 'Click', 'Add User');
                  trackGAEvent('admin_add_user_click');
                }}
                leftIcon={<UserPlus size={16} />}
              >
                Nouvel utilisateur
              </Button>
              <Button
                variant="outline"
                onClick={handleBackToApp}
                leftIcon={<ArrowLeft size={16} />}
              >
                Retour à l'app
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                leftIcon={<LogOut size={16} />}
              >
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex border-b border-gray-200 mb-8 overflow-x-auto hide-scrollbar">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon size={16} className="mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="space-y-6">
          {error && (
            <div className="bg-error/5 border border-error/20 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertTriangle size={20} className="text-error mr-3" />
                <div>
                  <h3 className="font-medium text-error">Erreur</h3>
                  <p className="text-error/80">{error}</p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Statistiques</h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  leftIcon={<RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />}
                  disabled={refreshing}
                >
                  {refreshing ? "Actualisation..." : "Actualiser"}
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="flex items-center">
                    <Users size={24} className="text-blue-600 mr-3" />
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{stats.totalUsers}</div>
                      <div className="text-sm text-gray-500">Utilisateurs total</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow p-6">
                  <div className="flex items-center">
                    <CheckCircle size={24} className="text-green-600 mr-3" />
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{stats.activeUsers}</div>
                      <div className="text-sm text-gray-500">Utilisateurs actifs</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow p-6">
                  <div className="flex items-center">
                    <Clock size={24} className="text-orange-600 mr-3" />
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{stats.betaSignups}</div>
                      <div className="text-sm text-gray-500">Inscriptions Beta</div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow p-6">
                  <div className="flex items-center">
                    <TrendingUp size={24} className="text-purple-600 mr-3" />
                    <div>
                      <div className="text-2xl font-bold text-gray-900">98.5%</div>
                      <div className="text-sm text-gray-500">Disponibilité</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* System Health */}
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">État du système</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Base de données</span>
                    <div className="flex items-center">
                      <CheckCircle size={16} className="text-green-500 mr-2" />
                      <span className="text-sm text-green-600">Opérationnel</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Authentification</span>
                    <div className="flex items-center">
                      <CheckCircle size={16} className="text-green-500 mr-2" />
                      <span className="text-sm text-green-600">Opérationnel</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Stockage</span>
                    <div className="flex items-center">
                      <AlertTriangle size={16} className="text-yellow-500 mr-2" />
                      <span className="text-sm text-yellow-600">Attention (85% utilisé)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'encryption' && hasPermission('system:config') && (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <AlertTriangle size={20} className="text-red-600 mr-3" />
                  <div>
                    <h3 className="font-medium text-red-800">Problème de Chiffrement Détecté</h3>
                    <p className="text-sm text-red-700 mt-1">
                      Les consultations affichent "[Données protégées]". Utilisez les outils ci-dessous pour diagnostiquer et réparer.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Shield size={20} className="mr-2 text-primary-600" />
                    Diagnostic du Chiffrement
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Vérifiez la configuration du système de chiffrement et testez son fonctionnement.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => setShowEncryptionDiagnostic(true)}
                    leftIcon={<Shield size={16} />}
                    fullWidth
                  >
                    Lancer le diagnostic
                  </Button>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                    <Database size={20} className="mr-2 text-primary-600" />
                    Réparation des Données
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Réparez automatiquement les consultations qui affichent "[Données protégées]".
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setShowDataRepairTool(true)}
                    leftIcon={<Database size={16} />}
                    fullWidth
                  >
                    Réparer les données
                  </Button>
                </div>
              </div>

              {/* Instructions détaillées */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Instructions de Résolution</h3>
                <div className="space-y-4">
                  <div className="flex items-start">
                    <div className="bg-primary-100 text-primary-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">1</div>
                    <div>
                      <h4 className="font-medium text-gray-900">Diagnostic du Chiffrement</h4>
                      <p className="text-sm text-gray-600">
                        Lancez d'abord le diagnostic pour identifier la cause du problème (clé de chiffrement incorrecte, corruption des données, etc.).
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-primary-100 text-primary-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">2</div>
                    <div>
                      <h4 className="font-medium text-gray-900">Vérification de la Clé</h4>
                      <p className="text-sm text-gray-600">
                        Si le diagnostic révèle un problème de clé, vérifiez que VITE_ENCRYPTION_KEY est correctement configurée dans votre fichier .env et sur votre plateforme de déploiement.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start">
                    <div className="bg-primary-100 text-primary-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3 mt-0.5">3</div>
                    <div>
                      <h4 className="font-medium text-gray-900">Réparation des Données</h4>
                      <p className="text-sm text-gray-600">
                        Si le problème persiste, utilisez l'outil de réparation pour restaurer les consultations corrompues avec des valeurs par défaut lisibles.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'users' && hasPermission('users:read') && (
            <UserManagement />
          )}

          {activeTab === 'substitutes' && hasPermission('users:read') && (
            <SubstituteManagement />
          )}

          {activeTab === 'beta' && hasPermission('users:read') && (
            <BetaWaitlistDashboard />
          )}

          {activeTab === 'logs' && hasPermission('logs:read') && (
            <SystemLogs />
          )}

          {activeTab === 'migration' && hasPermission('system:config') && (
            <DataMigrationDashboard />
          )}

          {activeTab === 'config' && hasPermission('system:config') && (
            <SystemConfig />
          )}
        </div>
      </div>

      {/* Modal d'ajout d'utilisateur */}
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onSuccess={handleAddUserSuccess}
      />

      {/* Modal de diagnostic du chiffrement */}
      {showEncryptionDiagnostic && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <EncryptionDiagnostic onClose={() => setShowEncryptionDiagnostic(false)} />
        </div>
      )}

      {/* Modal de réparation des données */}
      {showDataRepairTool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <DataRepairTool 
            onClose={() => setShowDataRepairTool(false)}
            onSuccess={() => {
              setShowDataRepairTool(false);
              setSuccess('Données réparées avec succès. Actualisez vos pages de consultation pour voir les changements.');
            }}
          />
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;