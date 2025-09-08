import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, deleteDoc, getCountFromServer, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { 
  Users, 
  Mail, 
  Calendar, 
  Download, 
  Eye, 
  UserCheck, 
  Trash2,
  Filter,
  Search,
  TrendingUp,
  Clock,
  Star,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface BetaWaitlistEntry {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  profession: string;
  practiceType: string;
  city: string;
  teamSize: string;
  motivation: string;
  position: number;
  status: 'waiting' | 'invited' | 'registered' | 'declined';
  submittedAt: any;
  emailSent: boolean;
  emailOpenedAt?: any;
  invitedAt?: any;
  registeredAt?: any;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

const BetaWaitlistDashboard: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [entries, setEntries] = useState<BetaWaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    waiting: 0,
    invited: 0,
    registered: 0,
    declined: 0
  });

  useEffect(() => {
    if (user && isAdmin()) {
      loadWaitlistData();
    }
  }, [user, isAdmin]);

  const loadWaitlistData = async () => {
    if (!user || !isAdmin()) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Récupérer les statistiques
      await loadStats();
      
      // Configurer le listener pour les entrées
      const waitlistRef = collection(db, 'beta_waitlist');
      const q = query(
        waitlistRef,
        orderBy('submittedAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const waitlistData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as BetaWaitlistEntry[];
        
        setEntries(waitlistData);
        setLoading(false);
        setRefreshing(false);
      }, (error) => {
        console.error('Erreur dans le listener de la liste d\'attente:', error);
        setError('Erreur lors de la récupération des données');
        setLoading(false);
        setRefreshing(false);
      });
      
      return unsubscribe;
    } catch (err) {
      console.error('Erreur lors du chargement de la liste d\'attente:', err);
      setError('Erreur lors du chargement des données');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadStats = async () => {
    if (!user || !isAdmin()) return;
    
    try {
      const waitlistRef = collection(db, 'beta_waitlist');
      
      // Total
      const totalSnapshot = await getCountFromServer(query(waitlistRef));
      const total = totalSnapshot.data().count;
      
      // En attente
      const waitingSnapshot = await getCountFromServer(query(waitlistRef, where('status', '==', 'waiting')));
      const waiting = waitingSnapshot.data().count;
      
      // Invités
      const invitedSnapshot = await getCountFromServer(query(waitlistRef, where('status', '==', 'invited')));
      const invited = invitedSnapshot.data().count;
      
      // Inscrits
      const registeredSnapshot = await getCountFromServer(query(waitlistRef, where('status', '==', 'registered')));
      const registered = registeredSnapshot.data().count;
      
      // Refusés
      const declinedSnapshot = await getCountFromServer(query(waitlistRef, where('status', '==', 'declined')));
      const declined = declinedSnapshot.data().count;
      
      setStats({
        total,
        waiting,
        invited,
        registered,
        declined
      });
    } catch (err) {
      console.error('Erreur lors du chargement des statistiques:', err);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadWaitlistData();
  };

  const handleStatusChange = async (entryId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      
      if (newStatus === 'invited' && !entries.find(e => e.id === entryId)?.invitedAt) {
        updateData.invitedAt = new Date();
      }
      
      if (newStatus === 'registered' && !entries.find(e => e.id === entryId)?.registeredAt) {
        updateData.registeredAt = new Date();
      }

      await updateDoc(doc(db, 'beta_waitlist', entryId), updateData);
      
      // Mettre à jour les statistiques
      loadStats();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const handleBulkInvite = async () => {
    const promises = selectedEntries.map(entryId => 
      handleStatusChange(entryId, 'invited')
    );
    
    await Promise.all(promises);
    setSelectedEntries([]);
  };

  const handleDelete = async (entryId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette entrée ?')) {
      try {
        await deleteDoc(doc(db, 'beta_waitlist', entryId));
        
        // Mettre à jour les statistiques
        loadStats();
      } catch (error) {
        console.error('Error deleting entry:', error);
      }
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Position', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Profession', 
      'Type de cabinet', 'Ville', 'Taille équipe', 'Statut', 'Date inscription',
      'Source', 'Motivation'
    ];
    
    const csvData = filteredEntries.map(entry => [
      entry.position,
      entry.firstName,
      entry.lastName,
      entry.email,
      entry.phone,
      entry.profession,
      entry.practiceType,
      entry.city,
      entry.teamSize,
      entry.status,
      entry.submittedAt?.toDate?.()?.toLocaleDateString('fr-FR') || '',
      entry.utm_source || '',
      entry.motivation?.replace(/,/g, ';') || '' // Escape commas
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `beta_waitlist_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'bg-yellow-100 text-yellow-800';
      case 'invited':
        return 'bg-blue-100 text-blue-800';
      case 'registered':
        return 'bg-green-100 text-green-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'waiting':
        return 'En attente';
      case 'invited':
        return 'Invité';
      case 'registered':
        return 'Inscrit';
      case 'declined':
        return 'Refusé';
      default:
        return status;
    }
  };

  // Filter entries based on search term and status filter
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = 
      entry.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.city?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading && !refreshing) {
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
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center">
            <Star size={14} className="mr-1" />
            BETA
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Liste d'attente Beta</h1>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            leftIcon={<RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />}
            disabled={refreshing}
          >
            {refreshing ? "Actualisation..." : "Actualiser"}
          </Button>
          {selectedEntries.length > 0 && (
            <Button
              variant="primary"
              onClick={handleBulkInvite}
              leftIcon={<UserCheck size={16} />}
            >
              Inviter ({selectedEntries.length})
            </Button>
          )}
          <Button
            variant="outline"
            onClick={exportToCSV}
            leftIcon={<Download size={16} />}
          >
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center">
            <Users size={20} className="text-primary-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center">
            <Clock size={20} className="text-yellow-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.waiting}</div>
              <div className="text-sm text-gray-500">En attente</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center">
            <Mail size={20} className="text-blue-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.invited}</div>
              <div className="text-sm text-gray-500">Invités</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center">
            <UserCheck size={20} className="text-green-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.registered}</div>
              <div className="text-sm text-gray-500">Inscrits</div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow p-4">
          <div className="flex items-center">
            <TrendingUp size={20} className="text-purple-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.total > 0 ? ((stats.registered / stats.total) * 100).toFixed(1) : "0.0"}%
              </div>
              <div className="text-sm text-gray-500">Conversion</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            className="input pl-10"
            placeholder="Rechercher par nom, email ou ville..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex space-x-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="all">Tous les statuts</option>
            <option value="waiting">En attente</option>
            <option value="invited">Invités</option>
            <option value="registered">Inscrits</option>
            <option value="declined">Refusés</option>
          </select>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-error/5 border border-error/20 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle size={20} className="text-error mr-3" />
            <div>
              <h3 className="font-medium text-error">Erreur</h3>
              <p className="text-error/80">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white shadow rounded-xl overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedEntries(filteredEntries.map(entry => entry.id));
                    } else {
                      setSelectedEntries([]);
                    }
                  }}
                  checked={selectedEntries.length === filteredEntries.length && filteredEntries.length > 0}
                />
              </th>
              <th className="px-6 py-3">Position</th>
              <th className="px-6 py-3">Candidat</th>
              <th className="px-6 py-3">Profession</th>
              <th className="px-6 py-3">Localisation</th>
              <th className="px-6 py-3">Statut</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredEntries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedEntries.includes(entry.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedEntries([...selectedEntries, entry.id]);
                      } else {
                        setSelectedEntries(selectedEntries.filter(id => id !== entry.id));
                      }
                    }}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">#{entry.position}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {entry.firstName} {entry.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{entry.email}</div>
                    <div className="text-sm text-gray-500">{entry.phone}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{entry.profession}</div>
                  <div className="text-sm text-gray-500">{entry.practiceType}</div>
                  <div className="text-sm text-gray-500">Équipe: {entry.teamSize}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{entry.city}</div>
                  {entry.utm_source && (
                    <div className="text-sm text-gray-500">Source: {entry.utm_source}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={entry.status}
                    onChange={(e) => handleStatusChange(entry.id, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-full border-0 ${getStatusColor(entry.status)}`}
                  >
                    <option value="waiting">En attente</option>
                    <option value="invited">Invité</option>
                    <option value="registered">Inscrit</option>
                    <option value="declined">Refusé</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {entry.submittedAt?.toDate?.() ? 
                      format(entry.submittedAt.toDate(), 'dd/MM/yyyy', { locale: fr }) : 
                      'Date inconnue'
                    }
                  </div>
                  {entry.emailSent && (
                    <div className="text-xs text-green-600">✓ Email envoyé</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        // Ouvrir modal avec détails complets
                        alert(`Motivation: ${entry.motivation}`);
                      }}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredEntries.length === 0 && (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">Aucune entrée trouvée</h3>
          <p className="text-gray-500">
            {entries.length === 0 
              ? "Aucune inscription à la liste d'attente pour le moment."
              : "Aucune entrée ne correspond à vos critères de recherche."
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default BetaWaitlistDashboard;