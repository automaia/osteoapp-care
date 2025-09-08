import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../firebase/config';
import { Users, Calendar, FileText, TrendingUp } from 'lucide-react';
import { HDSCompliance } from '../../utils/hdsCompliance';

interface RealTimeStatsProps {
  className?: string;
}

const RealTimeStats: React.FC<RealTimeStatsProps> = ({ className = '' }) => {
  const [stats, setStats] = useState({
    patients: 0,
    appointments: 0,
    invoices: 0,
    consultations: 0
  });
  
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!auth.currentUser) return;
    
    const userId = auth.currentUser.uid;
    
    // Patients listener
    const patientsRef = collection(db, 'patients');
    const patientsQuery = query(
      patientsRef,
      where('osteopathId', '==', userId),
      where('isTestData', '!=', true)
    );
    
    const patientsUnsubscribe = onSnapshot(patientsQuery, (snapshot) => {
      setStats(prev => ({ ...prev, patients: snapshot.size }));
      setLoading(false);
    });
    
    // Appointments listener
    const appointmentsRef = collection(db, 'appointments');
    const appointmentsQuery = query(
      appointmentsRef,
      where('osteopathId', '==', userId),
      where('isTestData', '!=', true)
    );
    
    const appointmentsUnsubscribe = onSnapshot(appointmentsQuery, (snapshot) => {
      setStats(prev => ({ ...prev, appointments: snapshot.size }));
    });
    
    // Invoices listener
    const invoicesRef = collection(db, 'invoices');
    const invoicesQuery = query(
      invoicesRef,
      where('osteopathId', '==', userId),
      where('isTestData', '!=', true)
    );
    
    const invoicesUnsubscribe = onSnapshot(invoicesQuery, (snapshot) => {
      setStats(prev => ({ ...prev, invoices: snapshot.size }));
    });
    
    // Consultations listener
    const consultationsRef = collection(db, 'consultations');
    const consultationsQuery = query(
      consultationsRef,
      where('osteopathId', '==', userId),
      where('isTestData', '!=', true)
    );
    
    const consultationsUnsubscribe = onSnapshot(consultationsQuery, (snapshot) => {
      setStats(prev => ({ ...prev, consultations: snapshot.size }));
    });
    
    // Cleanup
    return () => {
      patientsUnsubscribe();
      appointmentsUnsubscribe();
      invoicesUnsubscribe();
      consultationsUnsubscribe();
    };
  }, []);
  
  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${className}`}>
      <h3 className="text-sm font-medium text-gray-900 mb-3">Données réelles en temps réel</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="flex flex-col items-center p-3 bg-primary-50 rounded-lg">
          <Users size={20} className="text-primary-600 mb-2" />
          <div className="text-xl font-bold text-primary-700">{stats.patients}</div>
          <div className="text-xs text-primary-600">Patients</div>
        </div>
        
        <div className="flex flex-col items-center p-3 bg-secondary-50 rounded-lg">
          <Calendar size={20} className="text-secondary-600 mb-2" />
          <div className="text-xl font-bold text-secondary-700">{stats.appointments}</div>
          <div className="text-xs text-secondary-600">Rendez-vous</div>
        </div>
        
        <div className="flex flex-col items-center p-3 bg-accent-50 rounded-lg">
          <FileText size={20} className="text-accent-600 mb-2" />
          <div className="text-xl font-bold text-accent-700">{stats.invoices}</div>
          <div className="text-xs text-accent-600">Factures</div>
        </div>
        
        <div className="flex flex-col items-center p-3 bg-purple-50 rounded-lg">
          <TrendingUp size={20} className="text-purple-600 mb-2" />
          <div className="text-xl font-bold text-purple-700">{stats.consultations}</div>
          <div className="text-xs text-purple-600">Consultations</div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeStats;