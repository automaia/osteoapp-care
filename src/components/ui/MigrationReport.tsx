import React from 'react';
import { Users, Calendar, FileText, ClipboardList, Download } from 'lucide-react';
import { Button } from './Button';

interface MigrationReportProps {
  report: {
    patients: {
      total: number;
      test: number;
      real: number;
    };
    appointments: {
      total: number;
      test: number;
      real: number;
      upcoming: number;
      past: number;
    };
    consultations: {
      total: number;
      test: number;
      real: number;
    };
    invoices: {
      total: number;
      test: number;
      real: number;
      draft: number;
      sent: number;
      paid: number;
    };
  };
  onExport?: () => void;
}

const MigrationReport: React.FC<MigrationReportProps> = ({ report, onExport }) => {
  // Calculate percentages
  const calculatePercentage = (value: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };
  
  const patientRealPercentage = calculatePercentage(report.patients.real, report.patients.total);
  const appointmentRealPercentage = calculatePercentage(report.appointments.real, report.appointments.total);
  const consultationRealPercentage = calculatePercentage(report.consultations.real, report.consultations.total);
  const invoiceRealPercentage = calculatePercentage(report.invoices.real, report.invoices.total);
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-medium text-gray-900">Rapport de migration</h3>
        {onExport && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            leftIcon={<Download size={16} />}
          >
            Exporter
          </Button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Patients */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-800 flex items-center">
            <Users size={16} className="mr-2 text-primary-500" />
            Patients
          </h4>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Total</span>
              <span className="font-medium">{report.patients.total}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Données test</span>
              <span className="font-medium text-amber-600">{report.patients.test}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Données réelles</span>
              <span className="font-medium text-green-600">{report.patients.real}</span>
            </div>
            
            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span>Données réelles</span>
                <span>{patientRealPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-500 h-2.5 rounded-full"
                  style={{ width: `${patientRealPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Appointments */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-800 flex items-center">
            <Calendar size={16} className="mr-2 text-primary-500" />
            Rendez-vous
          </h4>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Total</span>
              <span className="font-medium">{report.appointments.total}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Données test</span>
              <span className="font-medium text-amber-600">{report.appointments.test}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Données réelles</span>
              <span className="font-medium text-green-600">{report.appointments.real}</span>
            </div>
            
            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span>Données réelles</span>
                <span>{appointmentRealPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-500 h-2.5 rounded-full"
                  style={{ width: `${appointmentRealPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Consultations */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-800 flex items-center">
            <ClipboardList size={16} className="mr-2 text-primary-500" />
            Consultations
          </h4>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Total</span>
              <span className="font-medium">{report.consultations.total}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Données test</span>
              <span className="font-medium text-amber-600">{report.consultations.test}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Données réelles</span>
              <span className="font-medium text-green-600">{report.consultations.real}</span>
            </div>
            
            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span>Données réelles</span>
                <span>{consultationRealPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-500 h-2.5 rounded-full"
                  style={{ width: `${consultationRealPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Invoices */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-800 flex items-center">
            <FileText size={16} className="mr-2 text-primary-500" />
            Factures
          </h4>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Total</span>
              <span className="font-medium">{report.invoices.total}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Données test</span>
              <span className="font-medium text-amber-600">{report.invoices.test}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-600">Données réelles</span>
              <span className="font-medium text-green-600">{report.invoices.real}</span>
            </div>
            
            {/* Progress bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs mb-1">
                <span>Données réelles</span>
                <span>{invoiceRealPercentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-green-500 h-2.5 rounded-full"
                  style={{ width: `${invoiceRealPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Summary */}
      <div className="mt-6 p-4 bg-primary-50 border border-primary-100 rounded-lg">
        <h4 className="font-medium text-primary-800 mb-2">Résumé de la migration</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">
              {calculatePercentage(
                report.patients.real + report.appointments.real + 
                report.consultations.real + report.invoices.real,
                report.patients.total + report.appointments.total + 
                report.consultations.total + report.invoices.total
              )}%
            </div>
            <div className="text-sm text-primary-700">Progression globale</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-primary-600">
              {report.patients.real + report.appointments.real + 
               report.consultations.real + report.invoices.real}
            </div>
            <div className="text-sm text-primary-700">Données réelles</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-amber-600">
              {report.patients.test + report.appointments.test + 
               report.consultations.test + report.invoices.test}
            </div>
            <div className="text-sm text-amber-700">Données test</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">
              {report.patients.total + report.appointments.total + 
               report.consultations.total + report.invoices.total}
            </div>
            <div className="text-sm text-gray-700">Total</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MigrationReport;