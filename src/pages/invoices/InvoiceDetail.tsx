import React, { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Edit,
  Trash2,
  Download,
  Mail,
  User,
  Calendar,
  CreditCard,
  FileText,
  Clock,
  AlertCircle,
  Share2,
  ChevronLeft,
  MoreVertical
} from 'lucide-react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { Button } from '../../components/ui/Button';
import EditInvoiceModal from '../../components/modals/EditInvoiceModal';
import DeleteInvoiceModal from '../../components/modals/DeleteInvoiceModal';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { InvoiceService } from '../../services/invoiceService';

interface Invoice {
  id: string;
  number: string;
  patientId: string;
  patientName: string;
  issueDate: string;
  dueDate: string;
  status: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  appointmentId?: string;
  appointmentDate?: string;
  notes?: string;
  paymentMethod?: string;
  paymentDate?: string;
  osteopathId: string;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [patientExists, setPatientExists] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [showActionMenu, setShowActionMenu] = useState(false);

  // Track window resize for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!id || !auth.currentUser) {
        setError('ID de facture manquant ou utilisateur non authentifié');
        setLoading(false);
        return;
      }

      try {
        console.log('Fetching invoice with ID:', id);
        
        const invoiceRef = doc(db, 'invoices', id);
        const invoiceDoc = await getDoc(invoiceRef);

        if (!invoiceDoc.exists()) {
          console.error('Invoice not found:', id);
          setError('Facture non trouvée');
          setLoading(false);
          return;
        }

        const invoiceData = invoiceDoc.data() as Invoice;
        console.log('Invoice data:', invoiceData);
        
        // Verify ownership
        if (invoiceData.osteopathId !== auth.currentUser.uid) {
          setError('Vous n\'avez pas accès à cette facture');
          setLoading(false);
          return;
        }

        setInvoice({
          ...invoiceData,
          id: invoiceDoc.id
        });
        
        // Vérifier si le patient existe toujours
        if (invoiceData.patientId) {
          const patientRef = doc(db, 'patients', invoiceData.patientId);
          const patientDoc = await getDoc(patientRef);
          setPatientExists(patientDoc.exists());
        }
        
      } catch (error) {
        console.error('Error fetching invoice:', error);
        setError('Erreur lors de la récupération de la facture');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id]);

  const handleDelete = async () => {
    if (!invoice) return;
    
    setIsDeleting(true);
    try {
      await InvoiceService.deleteInvoice(invoice.id);
      navigate('/invoices');
    } catch (error) {
      console.error('Error deleting invoice:', error);
      setError('Erreur lors de la suppression de la facture');
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!invoice) return;

    setIsUpdatingStatus(true);
    try {
      const updateData: any = {
        status: newStatus,
        updatedAt: new Date().toISOString()
      };

      // If marking as paid, add payment date
      if (newStatus === 'paid' && invoice.status !== 'paid') {
        updateData.paymentDate = new Date().toISOString();
        updateData.paymentMethod = 'Carte bancaire'; // Default payment method
      }

      await updateDoc(doc(db, 'invoices', invoice.id), updateData);
      
      // Update local state
      setInvoice(prev => prev ? {
        ...prev,
        status: newStatus,
        paymentDate: updateData.paymentDate || prev.paymentDate,
        paymentMethod: updateData.paymentMethod || prev.paymentMethod
      } : null);

    } catch (error) {
      console.error('Error updating invoice status:', error);
      setError('Erreur lors de la mise à jour du statut');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDownload = () => {
    // Download PDF logic here
    console.log('Download invoice:', invoice?.number);
  };

  const handleSendEmail = () => {
    // Send email logic here
    console.log('Send email for invoice:', invoice?.number);
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
        return 'bg-gray-100 text-gray-700';
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

  const toggleActionMenu = () => {
    setShowActionMenu(!showActionMenu);
  };

  const isSmallScreen = windowWidth < 768;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-6">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/invoices')}
            leftIcon={<ArrowLeft size={16} />}
          >
            Factures
          </Button>
        </div>
        
        <div className="p-6 bg-error/5 border border-error/20 rounded-xl">
          <div className="flex items-center">
            <AlertCircle className="text-error mr-3" size={24} />
            <div>
              <h3 className="font-medium text-error">Erreur</h3>
              <p className="text-error/80">{error || 'Une erreur est survenue'}</p>
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => navigate('/invoices')}
            >
              Retour aux factures
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/invoices')}
            leftIcon={<ArrowLeft size={16} />}
            className="mr-2"
          >
            {isSmallScreen ? "" : "Factures"}
          </Button>
          {isSmallScreen && <ChevronLeft size={16} className="text-gray-500 mr-1" />}
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Facture {invoice.number}
          </h1>
        </div>
        
        {/* Desktop actions */}
        <div className="hidden sm:flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            leftIcon={<Download size={16} />}
            onClick={handleDownload}
          >
            Télécharger
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            leftIcon={<Mail size={16} />}
            onClick={handleSendEmail}
          >
            Envoyer
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            leftIcon={<Edit size={16} />}
            onClick={() => setIsEditModalOpen(true)}
          >
            Modifier
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            leftIcon={<Trash2 size={16} />}
            onClick={() => setIsDeleteModalOpen(true)}
          >
            Supprimer
          </Button>
        </div>
        
        {/* Mobile actions */}
        <div className="sm:hidden relative">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleActionMenu}
            leftIcon={<MoreVertical size={16} />}
          >
            Actions
          </Button>
          
          {showActionMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
              <div className="py-1">
                <button
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  onClick={handleDownload}
                >
                  <Download size={14} className="mr-2" />
                  Télécharger
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  onClick={handleSendEmail}
                >
                  <Mail size={14} className="mr-2" />
                  Envoyer
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  onClick={() => setIsEditModalOpen(true)}
                >
                  <Edit size={14} className="mr-2" />
                  Modifier
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-error hover:bg-gray-100 flex items-center"
                  onClick={() => setIsDeleteModalOpen(true)}
                >
                  <Trash2 size={14} className="mr-2" />
                  Supprimer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Patient warning */}
      {!patientExists && (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex items-start">
          <AlertCircle size={20} className="text-warning shrink-0 mt-0.5 mr-3" />
          <div>
            <h3 className="font-medium text-warning">Patient introuvable</h3>
            <p className="text-sm text-warning/80 mt-1">
              Le patient associé à cette facture n'existe plus dans la base de données.
              Les informations affichées sont celles enregistrées au moment de la création de la facture.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main invoice content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice details card */}
          <div className="bg-white rounded-xl shadow p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{invoice.number}</h2>
                <p className="text-gray-500 mt-1">
                  Émise le {format(new Date(invoice.issueDate), 'd MMMM yyyy', { locale: fr })}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${getStatusColor(invoice.status)}`}>
                  {getStatusText(invoice.status)}
                </span>
                {/* Status change dropdown */}
                <select
                  value={invoice.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={isUpdatingStatus}
                  className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="draft">Brouillon</option>
                  <option value="sent">Envoyée</option>
                  <option value="paid">Payée</option>
                </select>
              </div>
            </div>

            {/* Items table - Desktop */}
            <div className="hidden sm:block mt-6">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500">
                    <th className="pb-3">Description</th>
                    <th className="pb-3 text-right">Quantité</th>
                    <th className="pb-3 text-right">Prix unitaire</th>
                    <th className="pb-3 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="border-t border-gray-200">
                  {invoice.items.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-4">{item.description}</td>
                      <td className="py-4 text-right">{item.quantity}</td>
                      <td className="py-4 text-right">{item.unitPrice} €</td>
                      <td className="py-4 text-right">{item.amount} €</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-4 text-right font-medium">Sous-total</td>
                    <td className="pt-4 text-right font-medium">{invoice.subtotal} €</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="pt-2 text-right font-medium">TVA</td>
                    <td className="pt-2 text-right font-medium">{invoice.tax} €</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="pt-4 text-right text-lg font-bold">Total</td>
                    <td className="pt-4 text-right text-lg font-bold">{invoice.total} €</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Items list - Mobile */}
            <div className="sm:hidden mt-6">
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Prestations</h3>
                {invoice.items.map((item, index) => (
                  <div key={index} className="mb-4 pb-4 border-b border-gray-100">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium">{item.description}</span>
                      <span className="text-sm font-medium">{item.amount} €</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{item.quantity} x {item.unitPrice} €</span>
                    </div>
                  </div>
                ))}
                
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Sous-total:</span>
                    <span className="text-sm font-medium">{invoice.subtotal} €</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">TVA:</span>
                    <span className="text-sm font-medium">{invoice.tax} €</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="text-base font-bold">Total:</span>
                    <span className="text-base font-bold">{invoice.total} €</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Notes</h3>
                <p className="text-gray-600 text-sm">{invoice.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Patient info */}
          <div className="bg-white rounded-xl shadow p-4 sm:p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Patient</h3>
            {patientExists ? (
              <Link 
                to={`/patients/${invoice.patientId}`}
                className="flex items-center hover:bg-gray-50 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 rounded-lg"
              >
                <div className="w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-medium text-lg mr-3">
                  {invoice.patientName.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{invoice.patientName}</div>
                  <div className="text-sm text-gray-500">Voir la fiche patient</div>
                </div>
              </Link>
            ) : (
              <div className="flex items-center -mx-4 sm:-mx-6 px-4 sm:px-6 py-3">
                <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center font-medium text-lg mr-3">
                  {invoice.patientName.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{invoice.patientName}</div>
                  <div className="text-sm text-gray-500">Patient supprimé</div>
                </div>
              </div>
            )}
          </div>

          {/* Appointment info */}
          {invoice.appointmentId && invoice.appointmentDate && (
            <div className="bg-white rounded-xl shadow p-4 sm:p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Rendez-vous lié</h3>
              <Link 
                to={`/appointments/${invoice.appointmentId}`}
                className="flex items-center space-x-3 text-gray-600 hover:text-gray-900"
              >
                <Calendar size={16} />
                <span>{format(new Date(invoice.appointmentDate), 'dd/MM/yyyy HH:mm')}</span>
              </Link>
            </div>
          )}

          {/* Payment info */}
          {invoice.status === 'paid' && invoice.paymentDate && (
            <div className="bg-white rounded-xl shadow p-4 sm:p-6">
              <h3 className="text-sm font-medium text-gray-900 mb-4">Paiement</h3>
              <div className="space-y-3">
                {invoice.paymentMethod && (
                  <div className="flex items-center text-sm text-gray-600">
                    <CreditCard size={16} className="mr-2" />
                    <span>{invoice.paymentMethod}</span>
                  </div>
                )}
                <div className="flex items-center text-sm text-gray-600">
                  <Clock size={16} className="mr-2" />
                  <span>Payé le {format(new Date(invoice.paymentDate), 'd MMMM yyyy', { locale: fr })}</span>
                </div>
              </div>
            </div>
          )}

          {/* Mobile share button */}
          {isSmallScreen && (
            <div className="bg-white rounded-xl shadow p-4">
              <Button
                variant="outline"
                fullWidth
                leftIcon={<Share2 size={16} />}
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({
                      title: `Facture ${invoice.number}`,
                      text: `Facture ${invoice.number} pour ${invoice.patientName}`,
                      url: window.location.href
                    }).catch(err => console.error('Error sharing:', err));
                  }
                }}
              >
                Partager la facture
              </Button>
            </div>
          )}

          {/* Debug info (only in development) */}
          {import.meta.env.DEV && (
            <div className="bg-gray-50 rounded-xl p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Debug Info</h3>
              <div className="text-xs text-gray-600 space-y-1">
                <div>ID: {invoice.id}</div>
                <div>Number: {invoice.number}</div>
                <div>Patient ID: {invoice.patientId}</div>
                <div>Osteopath ID: {invoice.osteopathId}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <EditInvoiceModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
        }}
        onSuccess={() => {
          setIsEditModalOpen(false);
          // Refresh the page to show updated data
          window.location.reload();
        }}
        invoiceId={invoice.id}
      />

      <DeleteInvoiceModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        invoiceNumber={invoice.number}
      />
    </div>
  );
};

export default InvoiceDetail;