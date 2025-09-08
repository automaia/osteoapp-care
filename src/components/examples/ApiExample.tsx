import React, { useState } from 'react';
import { useApi } from '../../utils/apiClient';
import { Button } from '../ui/Button';
import { Search, Cloud, Newspaper, MapPin, Send, FileText } from 'lucide-react';

const ApiExample: React.FC = () => {
  const api = useApi();
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Exemple de requête météo
  const handleWeatherRequest = async () => {
    setLoading('weather');
    setError(null);
    setResult(null);
    
    const city = 'Paris';
    const response = await api.getWeather(city);
    
    setLoading(null);
    
    if (response.error) {
      setError(`Erreur: ${response.error.message}`);
    } else {
      setResult({
        type: 'Météo',
        data: response.data
      });
    }
  };
  
  // Exemple de requête actualités
  const handleNewsRequest = async () => {
    setLoading('news');
    setError(null);
    setResult(null);
    
    const response = await api.getNews('health');
    
    setLoading(null);
    
    if (response.error) {
      setError(`Erreur: ${response.error.message}`);
    } else {
      setResult({
        type: 'Actualités',
        data: response.data
      });
    }
  };
  
  // Exemple de requête géocodage
  const handleGeocodingRequest = async () => {
    setLoading('geocoding');
    setError(null);
    setResult(null);
    
    const address = '1 rue de la Paix, Paris, France';
    const response = await api.getGeocoding(address);
    
    setLoading(null);
    
    if (response.error) {
      setError(`Erreur: ${response.error.message}`);
    } else {
      setResult({
        type: 'Géocodage',
        data: response.data
      });
    }
  };
  
  // Exemple d'envoi d'email
  const handleEmailRequest = async () => {
    setLoading('email');
    setError(null);
    setResult(null);
    
    const response = await api.sendEmail(
      'destinataire@exemple.com',
      'Test depuis OsteoApp',
      {
        html: `
          <h1>Bonjour depuis OsteoApp</h1>
          <p>Ceci est un email de test envoyé via notre Cloud Function sécurisée.</p>
        `
      }
    );
    
    setLoading(null);
    
    if (response.error) {
      setError(`Erreur: ${response.error.message}`);
    } else {
      setResult({
        type: 'Email',
        data: response.data
      });
    }
  };
  
  // Exemple de génération de PDF
  const handlePdfRequest = async () => {
    setLoading('pdf');
    setError(null);
    setResult(null);
    
    const response = await api.generatePdf(
      'invoice',
      {
        invoiceNumber: 'F-20230001',
        practitionerName: 'Dr. Jean Dupont',
        patientName: 'Marie Martin',
        patientAddress: '123 rue des Lilas, 75001 Paris',
        issueDate: '01/06/2023',
        dueDate: '15/06/2023',
        items: [
          { description: 'Consultation standard', quantity: 1, unitPrice: 60, amount: 60 }
        ],
        subtotal: 60,
        tax: 0,
        total: 60,
        notes: 'Paiement par carte bancaire ou chèque à l\'ordre du Dr. Jean Dupont.'
      },
      'facture-20230001.pdf'
    );
    
    setLoading(null);
    
    if (response.error) {
      setError(`Erreur: ${response.error.message}`);
    } else {
      setResult({
        type: 'PDF',
        data: {
          filename: response.data?.filename,
          size: response.data?.pdf ? `${Math.round(response.data.pdf.length / 1024)} Ko` : 'N/A'
        }
      });
      
      // Téléchargement du PDF (si disponible)
      if (response.data?.pdf) {
        const blob = base64ToBlob(response.data.pdf, 'application/pdf');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.data.filename || 'document.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
  };
  
  // Utilitaire pour convertir Base64 en Blob
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    
    return new Blob(byteArrays, { type: mimeType });
  };
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Exemples d'utilisation des Cloud Functions</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Button
          variant="outline"
          onClick={handleWeatherRequest}
          isLoading={loading === 'weather'}
          loadingText="Chargement..."
          leftIcon={<Cloud size={16} />}
          fullWidth
        >
          Météo
        </Button>
        
        <Button
          variant="outline"
          onClick={handleNewsRequest}
          isLoading={loading === 'news'}
          loadingText="Chargement..."
          leftIcon={<Newspaper size={16} />}
          fullWidth
        >
          Actualités
        </Button>
        
        <Button
          variant="outline"
          onClick={handleGeocodingRequest}
          isLoading={loading === 'geocoding'}
          loadingText="Chargement..."
          leftIcon={<MapPin size={16} />}
          fullWidth
        >
          Géocodage
        </Button>
        
        <Button
          variant="outline"
          onClick={handleEmailRequest}
          isLoading={loading === 'email'}
          loadingText="Chargement..."
          leftIcon={<Send size={16} />}
          fullWidth
        >
          Envoyer un email
        </Button>
        
        <Button
          variant="outline"
          onClick={handlePdfRequest}
          isLoading={loading === 'pdf'}
          loadingText="Chargement..."
          leftIcon={<FileText size={16} />}
          fullWidth
        >
          Générer un PDF
        </Button>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-700">
          {error}
        </div>
      )}
      
      {result && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-medium mb-2">Résultat - {result.type}</h3>
          <pre className="bg-white p-3 rounded border border-gray-200 overflow-auto max-h-60 text-sm">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default ApiExample;