import { Button } from './Button';
import { Patient } from '../../types';
import { PatientService } from '../../services/patientService';
import { apiClient } from '../../utils/apiClient';

interface PatientFileGeneratorProps {
  patient: Patient;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

export const PatientFileGenerator: React.FC<PatientFileGeneratorProps> = ({
  patient,
  onSuccess,
  onError,
  className = ''
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const generatePatientFile = async (format: 'pdf' | 'csv' | 'json') => {
    if (!patient?.id) {
      onError?.('Données patient manquantes');
      return;
    }

    setIsGenerating(true);
    setProgress(10);

    try {
      // Récupérer les données complètes du patient
      // S'assurer que firstName et lastName sont toujours présents
      const patientData = await PatientService.exportPatientData(patient.id, format);
      
      // Vérification explicite des champs nom/prénom
      if (!patientData.firstName || !patientData.lastName) {
        console.warn('Données nom/prénom manquantes, utilisation des valeurs de secours');
        patientData.firstName = patient.firstName || '';
        patientData.lastName = patient.lastName || '';
      }
      
      setProgress(30);
      
      // Générer le fichier selon le format
      if (format === 'pdf') {
        const response = await apiClient.generatePdf(
          'medicalCertificate',
          {
            practitionerName: 'Dr. ' + (auth.currentUser?.displayName || 'Ostéopathe'),
            firstName: patientData.firstName,
            lastName: patientData.lastName,
            patientDateOfBirth: new Date(patient.dateOfBirth).toLocaleDateString('fr-FR'),
            certificateContent: 'Ce patient a été examiné ce jour et...',
            location: 'Paris',
            issueDate: new Date().toLocaleDateString('fr-FR')
          },
          `dossier_${patient.lastName.toLowerCase()}_${patient.firstName.toLowerCase()}.pdf`
        );
      }
    } catch (error) {
      onError?.(error.message);
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };
};