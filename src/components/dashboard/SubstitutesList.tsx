import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Edit, 
  Trash2, 
  UserCheck, 
  UserX,
  Mail,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Substitute } from '../../types/substitute';
import { SubstituteService } from '../../services/substituteService';
import { auth } from '../../firebase/config';
import AddSubstituteModal from '../admin/AddSubstituteModal';
import EditSubstituteModal from '../admin/EditSubstituteModal';
import DeleteSubstituteModal from '../admin/DeleteSubstituteModal';

interface SubstitutesListProps {
  className?: string;
}

const SubstitutesList: React.FC<SubstitutesListProps> = ({ className = '' }) => {
  const [substitutes, setSubstitutes] = useState<Substitute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSubstitute, setSelectedSubstitute] = useState<Substitute | null>(null);

  useEffect(() => {
    loadSubstitutes();
  }, []);

  const loadSubstitutes = async () => {
    if (!auth.currentUser) return;

    try {
      setLoading(true);
      setError(null);

      // Charger les remplaçants liés à l'ostéopathe actuel
      const substitutesData = await SubstituteService.getSubstitutesByOsteopath(auth.currentUser.uid);
      setSubstitutes(substitutesData);

    } catch (err) {
      console.error('Error loading substitutes:', err);
      setError('Erreur lors du chargement des remplaçants');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (substitute: Substitute) => {
    try {
      await SubstituteService.updateSubstitute(substitute.uid, {
        isActive: !substitute.isActive
      });
      
      // Recharger la liste
      loadSubstitutes();
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
    loadSubstitutes();
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setSelectedSubstitute(null);
    loadSubstitutes();
  };

  const handleDeleteSuccess = () => {
    setIsDeleteModalOpen(false);
    setSelectedSubstitute(null);
    loadSubstitutes();
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900 flex items-center">
          <Users size={20} className="mr-2 text-primary-600" />
          Mes remplaçants ({substitutes.length})
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddModalOpen(true)}
          leftIcon={<UserPlus size={16} />}
        >
          Ajouter un remplaçant
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-error/5 border border-error/20 rounded-lg flex items-center">
          <AlertCircle size={16} className="text-error mr-2" />
          <span className="text-error text-sm">{error}</span>
        </div>
      )}

      {substitutes.length === 0 ? (
        <div className="text-center py-8">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Aucun remplaçant</h4>
          <p className="text-gray-500 mb-4">
            Vous n'avez pas encore de remplaçant configuré.
          </p>
          <Button
            variant="primary"
            onClick={() => setIsAddModalOpen(true)}
            leftIcon={<UserPlus size={16} />}
          >
            Ajouter votre premier remplaçant
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {substitutes.map((substitute) => (
            <div key={substitute.uid} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 rounded-full bg-secondary-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-secondary-600">
                      {substitute.firstName.charAt(0)}{substitute.lastName.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-medium text-gray-900">
                        {substitute.firstName} {substitute.lastName}
                      </h4>
                      <span className={`inline-flex px-2 py-1 text-xs leading-5 font-medium rounded-full ${
                        substitute.isActive 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {substitute.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 space-x-4">
                      <div className="flex items-center">
                        <Mail size={12} className="mr-1" />
                        <span>{substitute.email}</span>
                      </div>
                      {substitute.lastLogin && (
                        <div className="flex items-center">
                          <Calendar size={12} className="mr-1" />
                          <span>Dernière connexion : {new Date(substitute.lastLogin).toLocaleDateString('fr-FR')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <AddSubstituteModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleAddSuccess}
        osteopaths={[]} // Sera rempli avec l'ostéopathe actuel
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
            osteopaths={[]} // Sera rempli avec l'ostéopathe actuel
          />

          <DeleteSubstituteModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setSelectedSubstitute(null);
            }}
            onSuccess={handleDeleteSuccess}
            substitute={selectedSubstitute}
            osteopathName="Vous" // Puisque c'est l'ostéopathe actuel
          />
        </>
      )}
    </div>
  );
};

export default SubstitutesList;