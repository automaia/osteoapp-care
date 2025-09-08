import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { 
  SDKConfig, 
  ApiResponse, 
  Appointment, 
  Patient, 
  Osteopath, 
  DaySchedule,
  CreateAppointmentRequest,
  CreateAppointmentResponse,
  AvailabilityRequest,
  OsteoAppSDKError 
} from '../types';

export class OsteoAppClient {
  private httpClient: AxiosInstance;
  private config: SDKConfig;

  constructor(config: SDKConfig) {
    this.config = {
      timeout: 10000,
      retries: 3,
      ...config
    };

    this.httpClient = axios.create({
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
      }
    });

    // Intercepteur pour la gestion des erreurs
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        throw new OsteoAppSDKError(
          error.response?.data?.message || error.message,
          error.response?.data?.code || 'NETWORK_ERROR',
          error.response?.data
        );
      }
    );
  }

  /**
   * Récupère la liste des ostéopathes disponibles
   */
  async getOsteopaths(): Promise<Osteopath[]> {
    try {
      const response = await this.httpClient.get<ApiResponse<Osteopath[]>>('/osteopaths');
      
      if (!response.data.success) {
        throw new OsteoAppSDKError(
          response.data.error?.message || 'Erreur lors de la récupération des ostéopathes',
          response.data.error?.code || 'API_ERROR'
        );
      }

      return response.data.data || [];
    } catch (error) {
      if (error instanceof OsteoAppSDKError) throw error;
      throw new OsteoAppSDKError(
        'Erreur de connexion lors de la récupération des ostéopathes',
        'CONNECTION_ERROR',
        error
      );
    }
  }

  /**
   * Récupère les créneaux disponibles pour un ostéopathe à une date donnée
   */
  async getAvailableSlots(request: AvailabilityRequest): Promise<DaySchedule> {
    try {
      const response = await this.httpClient.post<ApiResponse<DaySchedule>>(
        '/availability',
        request
      );
      
      if (!response.data.success) {
        throw new OsteoAppSDKError(
          response.data.error?.message || 'Erreur lors de la vérification de disponibilité',
          response.data.error?.code || 'API_ERROR'
        );
      }

      return response.data.data!;
    } catch (error) {
      if (error instanceof OsteoAppSDKError) throw error;
      throw new OsteoAppSDKError(
        'Erreur de connexion lors de la vérification de disponibilité',
        'CONNECTION_ERROR',
        error
      );
    }
  }

  /**
   * Crée un nouveau rendez-vous
   */
  async createAppointment(request: CreateAppointmentRequest): Promise<CreateAppointmentResponse> {
    try {
      const response = await this.httpClient.post<ApiResponse<CreateAppointmentResponse>>(
        '/appointments',
        request
      );
      
      if (!response.data.success) {
        throw new OsteoAppSDKError(
          response.data.error?.message || 'Erreur lors de la création du rendez-vous',
          response.data.error?.code || 'API_ERROR'
        );
      }

      return response.data.data!;
    } catch (error) {
      if (error instanceof OsteoAppSDKError) throw error;
      throw new OsteoAppSDKError(
        'Erreur de connexion lors de la création du rendez-vous',
        'CONNECTION_ERROR',
        error
      );
    }
  }

  /**
   * Annule un rendez-vous existant
   */
  async cancelAppointment(appointmentId: string, reason?: string): Promise<boolean> {
    try {
      const response = await this.httpClient.delete<ApiResponse<boolean>>(
        `/appointments/${appointmentId}`,
        {
          data: { reason }
        }
      );
      
      if (!response.data.success) {
        throw new OsteoAppSDKError(
          response.data.error?.message || 'Erreur lors de l\'annulation du rendez-vous',
          response.data.error?.code || 'API_ERROR'
        );
      }

      return response.data.data || false;
    } catch (error) {
      if (error instanceof OsteoAppSDKError) throw error;
      throw new OsteoAppSDKError(
        'Erreur de connexion lors de l\'annulation du rendez-vous',
        'CONNECTION_ERROR',
        error
      );
    }
  }

  /**
   * Récupère les détails d'un rendez-vous
   */
  async getAppointment(appointmentId: string): Promise<Appointment> {
    try {
      const response = await this.httpClient.get<ApiResponse<Appointment>>(
        `/appointments/${appointmentId}`
      );
      
      if (!response.data.success) {
        throw new OsteoAppSDKError(
          response.data.error?.message || 'Rendez-vous non trouvé',
          response.data.error?.code || 'NOT_FOUND'
        );
      }

      return response.data.data!;
    } catch (error) {
      if (error instanceof OsteoAppSDKError) throw error;
      throw new OsteoAppSDKError(
        'Erreur de connexion lors de la récupération du rendez-vous',
        'CONNECTION_ERROR',
        error
      );
    }
  }

  /**
   * Recherche un patient par email
   */
  async findPatientByEmail(email: string): Promise<Patient | null> {
    try {
      const response = await this.httpClient.get<ApiResponse<Patient>>(
        `/patients/search?email=${encodeURIComponent(email)}`
      );
      
      if (!response.data.success) {
        if (response.data.error?.code === 'NOT_FOUND') {
          return null;
        }
        throw new OsteoAppSDKError(
          response.data.error?.message || 'Erreur lors de la recherche du patient',
          response.data.error?.code || 'API_ERROR'
        );
      }

      return response.data.data || null;
    } catch (error) {
      if (error instanceof OsteoAppSDKError) throw error;
      throw new OsteoAppSDKError(
        'Erreur de connexion lors de la recherche du patient',
        'CONNECTION_ERROR',
        error
      );
    }
  }

  /**
   * Vérifie la santé de l'API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get<ApiResponse<{ status: string }>>('/health');
      return response.data.success && response.data.data?.status === 'ok';
    } catch (error) {
      return false;
    }
  }

  /**
   * Configure les en-têtes d'authentification
   */
  setAuthToken(token: string): void {
    this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  /**
   * Supprime l'authentification
   */
  clearAuth(): void {
    delete this.httpClient.defaults.headers.common['Authorization'];
  }
}