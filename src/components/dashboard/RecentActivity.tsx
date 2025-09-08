import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { User, Calendar, FileText, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { HDSCompliance } from '../../utils/hdsCompliance';

interface RecentActivityProps {
  className?: string;
  maxItems?: number;
}

const RecentActivity: React.FC<RecentActivityProps> = ({ 
  className = '',
  maxItems = 5
}) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const userId = auth.currentUser.uid;
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);
    
    try {
      // Récupérer les dernières activités
      const fetchActivities = async () => {
        const allActivities: any[] = [];
        
        // 1. Derniers patients ajoutés
        const patientsRef = collection(db, 'patients');
        const patientsQuery = query(
          patientsRef,
          where('osteopathId', '==', userId),
          where('isTestData', '!=', true),
          orderBy('createdAt', 'desc'),
          limit(3)
        );
        
        const patientsUnsubscribe = onSnapshot(patientsQuery, (snapshot) => {
          const patientActivities = snapshot.docs.map(doc => {
            const data = doc.data();
            const decryptedData = HDSCompliance.decryptDataForDisplay(data, 'patients', userId);
            
            return {
              id: `patient_${doc.id}`,
              type: 'patient',
              title: `Nouveau patient: ${decryptedData.firstName} ${decryptedData.lastName}`,
              timestamp: new Date(decryptedData.createdAt),
              icon: <User size={16} className="text-primary-600" />,
              link: `/patients/${doc.id}`
            };
          });
          
          updateActivities([...patientActivities]);
        });
        
        // 2. Derniers rendez-vous
        const appointmentsRef = collection(db, 'appointments');
        const appointmentsQuery = query(
          appointmentsRef,
          where('osteopathId', '==', userId),
          where('isTestData', '!=', true),
          orderBy('date', 'desc'),
          limit(3)
        );
        
        const appointmentsUnsubscribe = onSnapshot(appointmentsQuery, (snapshot) => {
          const appointmentActivities = snapshot.docs.map(doc => {
            const data = doc.data();
            const decryptedData = HDSCompliance.decryptDataForDisplay(data, 'appointments', userId);
            const date = data.date.toDate();
            
            return {
              id: `appointment_${doc.id}`,
              type: 'appointment',
              title: `Rendez-vous avec ${decryptedData.patientName}`,
              timestamp: date,
              icon: <Calendar size={16} className="text-secondary-600" />,
              link: `/appointments/${doc.id}`
            };
          });
          
          updateActivities([...appointmentActivities]);
        });
        
        // 3. Dernières factures
        const invoicesRef = collection(db, 'invoices');
        const invoicesQuery = query(
          invoicesRef,
          where('osteopathId', '==', userId),
          where('isTestData', '!=', true),
          orderBy('issueDate', 'desc'),
          limit(3)
        );
        
        const invoicesUnsubscribe = onSnapshot(invoicesQuery, (snapshot) => {
          const invoiceActivities = snapshot.docs.map(doc => {
            const data = doc.data();
            const decryptedData = HDSCompliance.decryptDataForDisplay(data, 'invoices', userId);
            
            return {
              id: `invoice_${doc.id}`,
              type: 'invoice',
              title: `Facture ${decryptedData.number} créée`,
              timestamp: new Date(decryptedData.issueDate),
              icon: <FileText size={16} className="text-accent-600" />,
              link: `/invoices/${doc.id}`
            };
          });
          
          updateActivities([...invoiceActivities]);
        });
        
        // Nettoyage
        return () => {
          patientsUnsubscribe();
          appointmentsUnsubscribe();
          invoicesUnsubscribe();
        };
      };
      
      fetchActivities();
      
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      setError('Erreur lors du chargement des activités récentes');
      setLoading(false);
    }
  }, []);
  
  // Mettre à jour les activités et les trier par date
  const updateActivities = (newActivities: any[]) => {
    setActivities(prev => {
      // Fusionner les nouvelles activités avec les existantes
      const merged = [...prev, ...newActivities];
      
      // Supprimer les doublons (par ID)
      const unique = merged.filter((activity, index, self) => 
        index === self.findIndex(a => a.id === activity.id)
      );
      
      // Trier par date (plus récent en premier)
      const sorted = unique.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      // Limiter au nombre maximum
      const limited = sorted.slice(0, maxItems);
      
      setLoading(false);
      return limited;
    });
  };
  
  // Formater la date relative
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays < 7) return `Il y a ${diffDays} j`;
    
    return format(date, 'dd/MM/yyyy', { locale: fr });
  };
  
  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <h3 className="text-sm font-medium text-gray-900 mb-3">Activité récente</h3>
        <div className="animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3">
              <div className="rounded-full bg-gray-200 h-8 w-8"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <h3 className="text-sm font-medium text-gray-900 mb-3">Activité récente</h3>
        <div className="p-3 bg-error/5 border border-error/20 rounded-lg flex items-center">
          <AlertCircle size={16} className="text-error mr-2" />
          <span className="text-error text-sm">{error}</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <h3 className="text-sm font-medium text-gray-900 mb-3">Activité récente</h3>
      
      {activities.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <Clock size={24} className="mx-auto text-gray-300 mb-2" />
          <p>Aucune activité récente</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.map((activity) => (
            <a 
              key={activity.id} 
              href={activity.link}
              className="flex items-start p-3 rounded-lg border border-gray-100 hover:bg-gray-50"
            >
              <div className="mr-3 mt-0.5">
                {activity.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-900">{activity.title}</p>
                <p className="text-xs text-gray-500 mt-1">{formatRelativeTime(activity.timestamp)}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecentActivity;