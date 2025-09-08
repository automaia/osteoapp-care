import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  FileText, 
  Search, 
  Plus, 
  Download, 
  Mail,
  Filter,
  Eye,
  AlertCircle,
  Edit,
  Trash2,
  Menu,
  MoreVertical,
  RefreshCw
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { Button } from '../../components/ui/Button';
import NewInvoiceModal from '../../components/modals/NewInvoiceModal';
import EditInvoiceModal from '../../components/modals/EditInvoiceModal';
import DeleteInvoiceModal from '../../components/modals/DeleteInvoiceModal';
import { InvoiceService } from '../../services/invoiceService';

interface Invoice {
  id: string;
  number: string;
  patientId: string;
  patientName: string;
  issueDate: string;
  dueDate: string;
  total: number;
  status: string;
}

const Invoices: React.FC = () => {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNewInvoiceModalOpen, setIsNewInvoiceModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedInvoiceNumber, setSelectedInvoiceNumber] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [lastRefreshTime, setLastRefreshTime] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);

  // Track window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
      setLastRefreshTime(new Date());
    }, 3000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Check for action parameter to open new invoice modal
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'new') {
      setIsNewInvoiceModalOpen(true);
      // Clean up URL without causing a page reload
      window.history.replaceState({}, '', '/invoices');
    }
  }, [location]);
  
  useEffect(() => {
    if (!auth.currentUser) return;

    setLoading(true);
    setError(null);

    try {
      const invoicesRef = collection(db, 'invoices');
      // ✅ Use only single field query to avoid index requirements
      const q = query(
        invoicesRef,
        where('osteopathId', '==', auth.currentUser.uid)
      );

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          try {
            const invoicesData: Invoice[] = [];
            
            snapshot.docs.forEach(doc => {
              const data = doc.data();
              
              // Validation des données
              if (data.number && data.patientName && data.issueDate && data.total !== undefined) {
                invoicesData.push({
                  id: doc.id,
                  number: data.number,
                  patientId: data.patientId || '',
                  patientName: data.patientName,
                  issueDate: data.issueDate,
                  dueDate: data.dueDate || '',
                  total: data.total,
                  status: data.status || 'draft'
                });
              } else {
                console.warn('Invalid invoice data:', doc.id, data);
              }
            });
            
            // ✅ Tri côté client au lieu de orderBy dans la requête
            const sortedInvoices = invoicesData.sort((a, b) => 
              new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
            );
            
            console.log('Loaded invoices:', sortedInvoices);
            setInvoices(sortedInvoices);
            setLoading(false);
            setRefreshing(false);
          } catch (error) {
            console.error('Error processing invoices:', error);
            setError('Erreur lors du traitement des factures');
            setLoading(false);
            setRefreshing(false);
          }
        },
        (error) => {
          console.error('Error in invoices listener:', error);
          setError('Erreur lors de la récupération des factures');
          setLoading(false);
          setRefreshing(false);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up invoices listener:', error);
      setError('Erreur lors de la configuration du listener');
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleFilterChange = (filter: string) => {
    setSelectedFilter(filter);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    // The listener will automatically refresh the data
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleEditInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
    setIsEditModalOpen(true);
    setShowActionMenu(null);
  };

  const handleDeleteInvoice = (invoiceId: string, invoiceNumber: string) => {
    setSelectedInvoiceId(invoiceId);
    setSelectedInvoiceNumber(invoiceNumber);
    setIsDeleteModalOpen(true);
    setShowActionMenu(null);
  };

  const confirmDeleteInvoice = async () => {
    if (!selectedInvoiceId) return;

    setIsDeleting(true);
    try {
      await InvoiceService.deleteInvoice(selectedInvoiceId);
      setIsDeleteModalOpen(false);
      setSelectedInvoiceId(null);
      setSelectedInvoiceNumber('');
      
      // The listener will automatically update the invoices list
    } catch (error) {
      console.error('Error deleting invoice:', error);
      setError('Erreur lors de la suppression de la facture');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle patient link click
  const handlePatientClick = async (e: React.MouseEvent, patientId: string) => {
    if (!patientId) {
      e.preventDefault();
      return;
    }
    
    try {
      const patientDoc = await getDoc(doc(db, 'patients', patientId));
      
      if (!patientDoc.exists()) {
        e.preventDefault();
        setError('Le patient associé à cette facture n\'existe plus');
      }
    } catch (error) {
      console.error('Error checking patient:', error);
      e.preventDefault();
      setError('Erreur lors de la vérification du patient');
    }
  };

  // ✅ Filtrage côté client modifié
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesFilter = selectedFilter === 'all' || invoice.status === selectedFilter;
    
    return matchesSearch && matchesFilter;
  });

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('fr-FR');
    } catch (error) {
      console.error('Error formatting date:', dateString);
      return dateString;
    }
  };

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-red-200 text-red-800'; // Rouge clair (#FFB3B3)
      case 'sent':
        return 'bg-green-200 text-green-800'; // Vert clair (#90EE90)
      case 'paid':
        return 'bg-blue-200 text-blue-800'; // Bleu clair (#ADD8E6)
      case 'overdue':
        return 'bg-error/10 text-error';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft':
        return 'Brouillon';
      case 'sent':
        return 'Envoyée';
      case 'paid':
        return 'Payée';
      case 'overdue':
        return 'En retard';
      default:
        return status;
    }
  };

  // Vérifier l'existence du patient avant de créer une facture
  const handleNewInvoice = async () => {
    setIsNewInvoiceModalOpen(true);
  };

  const toggleActionMenu = (invoiceId: string) => {
    if (showActionMenu === invoiceId) {
      setShowActionMenu(null);
    } else {
      setShowActionMenu(invoiceId);
    }
  };

  const isSmallScreen = windowWidth < 768;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Factures</h1>
          <div className="text-sm text-gray-500">
            {formatDateTime(currentDateTime)}
          </div>
          <div className="text-xs text-gray-400">
            Dernière mise à jour: {lastRefreshTime.toLocaleTimeString('fr-FR')}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleRefresh}
            leftIcon={<RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />}
            disabled={refreshing}
          >
            {isSmallScreen ? "" : "Actualiser"}
          </Button>
          <Button 
            variant="primary" 
            leftIcon={<Plus size={16} />}
            onClick={handleNewInvoice}
          >
            {isSmallScreen ? "Nouvelle" : "Nouvelle facture"}
          </Button>
        </div>
      </div>

      {/* Error message */}
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

      {/* Search and filters */}
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            className="input pl-10 w-full"
            placeholder="Rechercher une facture..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
        <div className="flex space-x-2">
          <div className="relative">
            <button
              className="btn btn-outline flex items-center"
              onClick={() => {/* Toggle filter dropdown */}}
            >
              <Filter size={16} className="mr-2" />
              Filtres
            </button>
          </div>
        </div>
      </div>

      {/* Filter tabs - Scrollable on mobile */}
      <div className="overflow-x-auto hide-scrollbar">
        <div className="flex border-b border-gray-200 min-w-max">
          <button
            className={`pb-2 px-4 text-sm font-medium border-b-2 ${
              selectedFilter === 'all'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => handleFilterChange('all')}
          >
            Toutes ({invoices.length})
          </button>
          <button
            className={`pb-2 px-4 text-sm font-medium border-b-2 ${
              selectedFilter === 'draft'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => handleFilterChange('draft')}
          >
            Brouillons ({invoices.filter(i => i.status === 'draft').length})
          </button>
          <button
            className={`pb-2 px-4 text-sm font-medium border-b-2 ${
              selectedFilter === 'sent'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => handleFilterChange('sent')}
          >
            Envoyées ({invoices.filter(i => i.status === 'sent').length})
          </button>
          <button
            className={`pb-2 px-4 text-sm font-medium border-b-2 ${
              selectedFilter === 'paid'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => handleFilterChange('paid')}
          >
            Payées ({invoices.filter(i => i.status === 'paid').length})
          </button>
        </div>
      </div>

      {/* Invoices list */}
      <div className="space-y-4">
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">Aucune facture trouvée</h3>
            <p className="text-gray-500">
              {invoices.length === 0 
                ? "Commencez par créer votre première facture."
                : "Aucune facture ne correspond à vos critères de recherche."
              }
            </p>
          </div>
        ) : (
          <>
            {/* Desktop view - Table */}
            <div className="hidden md:block bg-white shadow rounded-xl overflow-hidden">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Facture</th>
                    <th className="px-6 py-3">Patient</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Montant</th>
                    <th className="px-6 py-3">Statut</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{invoice.number}</div>
                        {import.meta.env.DEV && (
                          <div className="text-xs text-gray-400">ID: {invoice.id}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link 
                          to={`/patients/${invoice.patientId}`} 
                          className="text-sm text-primary-600 hover:text-primary-700"
                          onClick={(e) => handlePatientClick(e, invoice.patientId)}
                        >
                          {invoice.patientName}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{formatDate(invoice.issueDate)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{invoice.total} €</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                          {getStatusText(invoice.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-3">
                          <Link 
                            to={`/invoices/${invoice.id}`} 
                            className="text-primary-600 hover:text-primary-700 flex items-center"
                          >
                            <Eye size={16} className="mr-1" />
                            Voir
                          </Link>
                          <button 
                            className="text-gray-600 hover:text-gray-900 flex items-center"
                            onClick={() => handleEditInvoice(invoice.id)}
                          >
                            <Edit size={16} className="mr-1" />
                            Modifier
                          </button>
                          <button 
                            className="text-error hover:text-error/80 flex items-center"
                            onClick={() => handleDeleteInvoice(invoice.id, invoice.number)}
                          >
                            <Trash2 size={16} className="mr-1" />
                            Supprimer
                          </button>
                          <button 
                            className="text-gray-600 hover:text-gray-900"
                            onClick={() => console.log('Download invoice:', invoice.id)}
                          >
                            <Download size={16} />
                          </button>
                          <button 
                            className="text-gray-600 hover:text-gray-900"
                            onClick={() => console.log('Send email for invoice:', invoice.id)}
                          >
                            <Mail size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile view - Card list */}
            <div className="md:hidden space-y-4">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="bg-white rounded-xl shadow p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-base font-medium text-gray-900">{invoice.number}</div>
                      <Link 
                        to={`/patients/${invoice.patientId}`} 
                        className="text-sm text-primary-600 hover:text-primary-700 block mt-1"
                        onClick={(e) => handlePatientClick(e, invoice.patientId)}
                      >
                        {invoice.patientName}
                      </Link>
                    </div>
                    <div className="flex items-center">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                        {getStatusText(invoice.status)}
                      </span>
                      <button 
                        className="ml-2 p-1 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
                        onClick={() => toggleActionMenu(invoice.id)}
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-sm text-gray-500">
                      <div>Date: {formatDate(invoice.issueDate)}</div>
                    </div>
                    <div className="text-base font-medium text-gray-900">{invoice.total} €</div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <Link 
                      to={`/invoices/${invoice.id}`} 
                      className="text-primary-600 hover:text-primary-700 text-sm flex items-center"
                    >
                      <Eye size={14} className="mr-1" />
                      Voir
                    </Link>
                    
                    <div className="flex space-x-2">
                      <button 
                        className="p-1.5 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200"
                        onClick={() => console.log('Download invoice:', invoice.id)}
                      >
                        <Download size={14} />
                      </button>
                      <button 
                        className="p-1.5 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200"
                        onClick={() => console.log('Send email for invoice:', invoice.id)}
                      >
                        <Mail size={14} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Mobile action menu */}
                  {showActionMenu === invoice.id && (
                    <div className="absolute right-4 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                      <div className="py-1">
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          onClick={() => handleEditInvoice(invoice.id)}
                        >
                          <Edit size={14} className="mr-2" />
                          Modifier
                        </button>
                        <button
                          className="w-full text-left px-4 py-2 text-sm text-error hover:bg-gray-100 flex items-center"
                          onClick={() => handleDeleteInvoice(invoice.id, invoice.number)}
                        >
                          <Trash2 size={14} className="mr-2" />
                          Supprimer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <NewInvoiceModal
        isOpen={isNewInvoiceModalOpen}
        onClose={() => setIsNewInvoiceModalOpen(false)}
        onSuccess={() => {
          setIsNewInvoiceModalOpen(false);
        }}
      />

      {selectedInvoiceId && (
        <EditInvoiceModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedInvoiceId(null);
          }}
          onSuccess={() => {
            setIsEditModalOpen(false);
            setSelectedInvoiceId(null);
          }}
          invoiceId={selectedInvoiceId}
        />
      )}

      <DeleteInvoiceModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedInvoiceId(null);
          setSelectedInvoiceNumber('');
        }}
        onConfirm={confirmDeleteInvoice}
        isLoading={isDeleting}
        invoiceNumber={selectedInvoiceNumber}
      />
    </div>
  );
};

export default Invoices;