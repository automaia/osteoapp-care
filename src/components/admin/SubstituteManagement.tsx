import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Edit, 
  Trash2, 
  UserCheck, 
  UserX,
  RefreshCw,
  AlertTriangle,
  Shield,
  Link as LinkIcon
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Button } from '../ui/Button';
import { Substitute } from '../../types/substitute';
import { SubstituteService } from '../../services/substituteService';
import AddSubstituteModal from './AddSubstituteModal';
import EditSubstituteModal from './EditSubstituteModal';
import DeleteSubstituteModal from './DeleteSubstituteModal';

const SubstituteManagement: React.FC = () => {
  const [substitutes, setSubstitutes] = useState<Substitute[]>([]);
  const [osteopaths, setOsteopaths] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOsteopath, setFilterOsteopath] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSubstitute, setSelectedSubstitute] = useState<Substitute | null>(null);

  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Charger les ostéopathes
      const osteopathsRef = collection(db, 'users');
      const osteopathsQuery = query(osteopathsRef, where('role', '==', 'osteopath'));
      
      const osteopathsUnsubscribe = onSnapshot(osteopathsQuery, (snapshot) => {
        const osteopathsData = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        }));
        setOsteopaths(osteopathsData);
      });

      // Charger les remplaçants
      const substitutesRef = collection(db, 'users');
      const substitutesQuery = query(substitutesRef, where('role', '==', 'substitute'));

      const substitutesUnsubscribe = onSnapshot(substitutesQuery, (snapshot) => {
        const substitutesData = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        })) as Substitute[];

        setSubstitutes(substitutesData);

        // Calculer les statistiques
        const total = substitutesData.length;
        const active = substitutesData.filter(s => s.isActive).length;
        const inactive = total - active;

        setStats({ total, active, inactive });
        setLoading(false);
        setRefreshing(false);
      });

      return () => {
        osteopathsUnsubscribe();
        substitutesUnsubscribe();
      };

    } catch (err) {
      console.error('Error loading substitute data:', err);
      setError('Erreur lors du chargement des données');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleToggleStatus = async (substitute: Substitute) => {
    try {
      await SubstituteService.updateSubstitute(substitute.uid, {
        isActive: !substitute.isActive,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error toggling substitute status:', error);
      setError('Erreur lors de la mise à jour du statut');
    }
  };

  const handleEditSubstitute = (substitute: Substitute) => {
    setSelectedSubstitute(substitute);
    setIsEditModalOpen(true);
  };

  const handleDeleteSubstitute = (substitute: Substitute) => {
    setSelectedSubstitute(substitute);
    setIsDeleteModalOpen(true);
  };

  const handleAddSuccess = () => {
    // Les listeners onSnapshot vont automatiquement mettre à jour les données
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setSelectedSubstitute(null);
  };

  const handleDeleteSuccess = () => {
    setIsDeleteModalOpen(false);
    setSelectedSubstitute(null);
  };

  // Filtrer les remplaçants
  const filteredSubstitutes = substitutes.filter(substitute => {
    const matchesSearch = 
      substitute.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      substitute.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      substitute.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesOsteopath = filterOsteopath === 'all' || substitute.linkedTo === filterOsteopath;
    
    return matchesSearch && matchesOsteopath;
  });

  // Obtenir le nom de l'ostéopathe titulaire
  const getOsteopathName = (osteopathId: string) => {
    const osteopath = osteopaths.find(o => o.uid === osteopathId);
    return osteopath ? `${osteopath.firstName} ${osteopath.lastName}` : 'Ostéopathe inconnu';
  };

  if (loading && !refreshing) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Gestion des remplaçants</h2>
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            onClick={handleRefresh}
            leftIcon={<RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />}
            disabled={refreshing}
          >
            {refreshing ? "Actualisation..." : "Actualiser"}
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<UserPlus size={16} />}
          >
            Ajouter un remplaçant
          </Button>
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

      {/* Search and filters */}
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un remplaçant..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={filterOsteopath}
          onChange={(e) => setFilterOsteopath(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">Tous les ostéopathes</option>
          {osteopaths.map(osteopath => (
            <option key={osteopath.uid} value={osteopath.uid}>
              {osteopath.firstName} {osteopath.lastName}
            </option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Users size={20} className="text-blue-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-500">Total remplaçants</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <UserCheck size={20} className="text-green-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.active}</div>
              <div className="text-sm text-gray-500">Actifs</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <UserX size={20} className="text-red-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.inactive}</div>
              <div className="text-sm text-gray-500">Inactifs</div>
            </div>
          </div>
        </div>
      </div>

      {/* Substitutes Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">Remplaçant</th>
              <th className="px-6 py-3">Ostéopathe titulaire</th>
              <th className="px-6 py-3">Statut</th>
              <th className="px-6 py-3">Dernière connexion</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredSubstitutes.map((substitute) => (
              <tr key={substitute.uid} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-secondary-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-secondary-600">
                          {substitute.firstName.charAt(0)}{substitute.lastName.charAt(0)}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {substitute.firstName} {substitute.lastName}
                      </div>
                      <div className="text-sm text-gray-500">{substitute.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <LinkIcon size={14} className="text-primary-500 mr-2" />
                    <span className="text-sm text-gray-900">
                      {getOsteopathName(substitute.linkedTo)}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs leading-5 font-medium rounded-full ${
                    substitute.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {substitute.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {substitute.lastLogin ? new Date(substitute.lastLogin).toLocaleDateString('fr-FR') : 'Jamais'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => handleToggleStatus(substitute)}
                      className={`p-2 rounded-lg transition-colors ${
                        substitute.isActive
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                      title={substitute.isActive ? 'Désactiver' : 'Activer'}
                    >
                      {substitute.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                    <button
                      onClick={() => handleEditSubstitute(substitute)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteSubstitute(substitute)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Supprimer"
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

      {filteredSubstitutes.length === 0 && (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">Aucun remplaçant trouvé</h3>
          <p className="text-gray-500">
            {substitutes.length === 0 
              ? "Aucun remplaçant n'a été créé pour le moment."
              : "Aucun remplaçant ne correspond à vos critères de recherche."
            }
          </p>
        </div>
      )}

      {/* Modals */}
      <AddSubstituteModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleAddSuccess}
        osteopaths={osteopaths}
      />

      {selectedSubstitute && (
        <>
          <EditSubstituteModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedSubstitute(null);
            }}
            onSuccess={handleEditSuccess}
            substitute={selectedSubstitute}
            osteopaths={osteopaths}
          />

          <DeleteSubstituteModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setSelectedSubstitute(null);
            }}
            onSuccess={handleDeleteSuccess}
            substitute={selectedSubstitute}
            osteopathName={getOsteopathName(selectedSubstitute.linkedTo)}
          />
        </>
      )}
    </div>
  );
};

export default SubstituteManagement;