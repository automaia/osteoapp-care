import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  MoreVertical, 
  Shield, 
  UserX, 
  UserCheck,
  Edit,
  Trash2,
  UserPlus,
  RefreshCw
} from 'lucide-react';
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc, getCountFromServer } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Button } from '../ui/Button';
import { User } from '../../types/auth';
import AddUserModal from './AddUserModal';
import EditUserModal from './EditUserModal';
import { AuditLogger, AuditEventType, SensitivityLevel } from '../../utils/auditLogger';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    admin: 0
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Configurer le listener pour les utilisateurs
      const usersRef = collection(db, 'users');
      const q = query(usersRef);

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({
          ...doc.data(),
          uid: doc.id
        })) as User[];
        
        setUsers(usersData);
        
        // Calculer les statistiques
        const totalUsers = usersData.length;
        const activeUsers = usersData.filter(u => u.isActive).length;
        const adminUsers = usersData.filter(u => u.role === 'admin').length;
        
        setStats({
          total: totalUsers,
          active: activeUsers,
          admin: adminUsers
        });
        
        setLoading(false);
        setRefreshing(false);
      }, (error) => {
        console.error('Erreur dans le listener des utilisateurs:', error);
        setError('Erreur lors de la récupération des utilisateurs');
        setLoading(false);
        setRefreshing(false);
      });
      
      return unsubscribe;
    } catch (err) {
      console.error('Erreur lors du chargement des utilisateurs:', err);
      setError('Erreur lors du chargement des utilisateurs');
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        isActive: !user.isActive,
        updatedAt: new Date().toISOString()
      });
      
      // Journaliser l'action
      await AuditLogger.log(
        AuditEventType.ADMIN_ACTION,
        'users',
        user.isActive ? 'deactivate' : 'activate',
        SensitivityLevel.SENSITIVE,
        'success',
        { userId: user.uid, email: user.email }
      );
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.ADMIN_ACTION,
        'users',
        user.isActive ? 'deactivate' : 'activate',
        SensitivityLevel.SENSITIVE,
        'failure',
        { userId: user.uid, error: (error as Error).message }
      );
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${user.email} ?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', user.uid));
      
      // Journaliser l'action
      await AuditLogger.log(
        AuditEventType.ADMIN_ACTION,
        'users',
        'delete',
        SensitivityLevel.SENSITIVE,
        'success',
        { userId: user.uid, email: user.email }
      );
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      
      // Journalisation de l'erreur
      await AuditLogger.log(
        AuditEventType.ADMIN_ACTION,
        'users',
        'delete',
        SensitivityLevel.SENSITIVE,
        'failure',
        { userId: user.uid, error: (error as Error).message }
      );
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800';
      case 'user':
      case 'osteopath':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrateur';
      case 'user':
        return 'Utilisateur';
      case 'osteopath':
        return 'Ostéopathe';
      default:
        return role;
    }
  };

  const handleAddUserSuccess = () => {
    // Rafraîchir la liste des utilisateurs
    // (déjà géré par le listener onSnapshot)
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditUserModalOpen(true);
  };

  const handleEditUserSuccess = () => {
    setIsEditUserModalOpen(false);
    setSelectedUser(null);
    // Les données seront automatiquement mises à jour par le listener onSnapshot
  };

  // Filter users based on search term and role filter
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.displayName || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    
    return matchesSearch && matchesRole;
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Gestion des utilisateurs</h2>
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
            onClick={() => setIsAddUserModalOpen(true)}
            leftIcon={<UserPlus size={16} />}
          >
            Ajouter un utilisateur
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
            placeholder="Rechercher un utilisateur..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">Tous les rôles</option>
          <option value="admin">Administrateurs</option>
          <option value="osteopath">Ostéopathes</option>
          <option value="user">Utilisateurs</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Users size={20} className="text-blue-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
              <div className="text-sm text-gray-500">Total utilisateurs</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <UserCheck size={20} className="text-green-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.active}
              </div>
              <div className="text-sm text-gray-500">Utilisateurs actifs</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Shield size={20} className="text-red-500 mr-2" />
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.admin}
              </div>
              <div className="text-sm text-gray-500">Administrateurs</div>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-6 py-3">Utilisateur</th>
              <th className="px-6 py-3">Rôle</th>
              <th className="px-6 py-3">Statut</th>
              <th className="px-6 py-3">Dernière connexion</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.map((user) => (
              <tr key={user.uid} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10">
                      <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary-600">
                          {user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {user.displayName || 'Sans nom'}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs leading-5 font-medium rounded-full ${getRoleColor(user.role)}`}>
                    {getRoleText(user.role)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs leading-5 font-medium rounded-full ${
                    user.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('fr-FR') : 'Jamais'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Modifier"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(user)}
                      className={`p-2 rounded-lg transition-colors ${
                        user.isActive
                          ? 'text-red-600 hover:bg-red-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                      title={user.isActive ? 'Désactiver' : 'Activer'}
                    >
                      {user.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user)}
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

      {filteredUsers.length === 0 && (
        <div className="text-center py-12">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">Aucun utilisateur trouvé</h3>
          <p className="text-gray-500">
            Aucun utilisateur ne correspond à vos critères de recherche.
          </p>
        </div>
      )}

      {/* Modal d'ajout d'utilisateur */}
      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
        onSuccess={handleAddUserSuccess}
      />

      {/* Modal d'édition d'utilisateur */}
      {selectedUser && (
        <EditUserModal
          isOpen={isEditUserModalOpen}
          onClose={() => {
            setIsEditUserModalOpen(false);
            setSelectedUser(null);
          }}
          onSuccess={handleEditUserSuccess}
          user={selectedUser}
        />
      )}
    </div>
  );
};

export default UserManagement;