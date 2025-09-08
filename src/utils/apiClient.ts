import { auth } from '../firebase/config';

// Configuration de base
const API_BASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

// Types d'erreurs
export enum ApiErrorType {
  NETWORK = 'network',
  AUTH = 'auth',
  VALIDATION = 'validation',
  SERVER = 'server',
  UNKNOWN = 'unknown'
}

// Interface d'erreur API
export interface ApiError {
  type: ApiErrorType;
  message: string;
  status?: number;
  details?: any;
}

// Interface de réponse API
export interface ApiResponse<T = any> {
  data?: T;
  error?: ApiError;
}

// Options de requête
export interface RequestOptions {
  headers?: Record<string, string>;
  cache?: RequestCache;
  signal?: AbortSignal;
  retries?: number;
  retryDelay?: number;
}

/**
 * Client API pour les appels aux Cloud Functions
 */
export class ApiClient {
  private static instance: ApiClient;
  private baseUrl: string;
  private defaultOptions: RequestOptions = {
    retries: 2,
    retryDelay: 1000
  };

  private constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Obtient l'instance unique du client API
   */
  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient(API_BASE_URL);
    }
    return ApiClient.instance;
  }

  /**
   * Obtient le token d'authentification
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      if (!auth.currentUser) {
        return null;
      }
      return await auth.currentUser.getIdToken();
    } catch (error) {
      console.error('Erreur lors de la récupération du token:', error);
      return null;
    }
  }

  /**
   * Prépare les en-têtes de la requête
   */
  private async prepareHeaders(customHeaders?: Record<string, string>): Promise<Headers> {
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...customHeaders
    });

    const token = await this.getAuthToken();
    if (token) {
      headers.append('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  /**
   * Gère les erreurs de requête
   */
  private handleError(error: any, url: string): ApiError {
    console.error(`Erreur API pour ${url}:`, error);

    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        type: ApiErrorType.NETWORK,
        message: 'Erreur de connexion réseau. Veuillez vérifier votre connexion internet.'
      };
    }

    if (error.status === 401 || error.status === 403) {
      return {
        type: ApiErrorType.AUTH,
        message: 'Authentification requise ou accès refusé.',
        status: error.status
      };
    }

    if (error.status === 400) {
      return {
        type: ApiErrorType.VALIDATION,
        message: 'Données invalides.',
        status: error.status,
        details: error.details
      };
    }

    if (error.status >= 500) {
      return {
        type: ApiErrorType.SERVER,
        message: 'Erreur serveur. Veuillez réessayer plus tard.',
        status: error.status
      };
    }

    return {
      type: ApiErrorType.UNKNOWN,
      message: error.message || 'Une erreur inconnue est survenue',
      status: error.status,
      details: error.details
    };
  }

  /**
   * Effectue une requête avec retry automatique
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries: number,
    retryDelay: number
  ): Promise<Response> {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok && retries > 0) {
        // Attendre avant de réessayer
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Augmenter le délai pour le prochain essai (backoff exponentiel)
        const nextRetryDelay = retryDelay * 2;
        
        // Réessayer
        return this.fetchWithRetry(url, options, retries - 1, nextRetryDelay);
      }
      
      return response;
    } catch (error) {
      if (retries > 0) {
        // Attendre avant de réessayer
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        
        // Augmenter le délai pour le prochain essai (backoff exponentiel)
        const nextRetryDelay = retryDelay * 2;
        
        // Réessayer
        return this.fetchWithRetry(url, options, retries - 1, nextRetryDelay);
      }
      
      throw error;
    }
  }

  /**
   * Effectue une requête GET
   */
  public async get<T = any>(
    endpoint: string,
    params?: Record<string, string>,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const url = new URL(`${this.baseUrl}/functions/v1/${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    
    try {
      const headers = await this.prepareHeaders(mergedOptions.headers);
      
      const response = await this.fetchWithRetry(
        url.toString(),
        {
          method: 'GET',
          headers,
          cache: mergedOptions.cache,
          signal: mergedOptions.signal
        },
        mergedOptions.retries || 0,
        mergedOptions.retryDelay || 1000
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw {
          status: response.status,
          message: errorData.message || response.statusText,
          details: errorData
        };
      }
      
      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: this.handleError(error, url.toString()) };
    }
  }

  /**
   * Effectue une requête POST
   */
  public async post<T = any>(
    endpoint: string,
    body?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const url = `${this.baseUrl}/functions/v1/${endpoint}`;
    
    try {
      const headers = await this.prepareHeaders(mergedOptions.headers);
      
      const response = await this.fetchWithRetry(
        url,
        {
          method: 'POST',
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: mergedOptions.signal
        },
        mergedOptions.retries || 0,
        mergedOptions.retryDelay || 1000
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw {
          status: response.status,
          message: errorData.message || response.statusText,
          details: errorData
        };
      }
      
      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: this.handleError(error, url) };
    }
  }

  /**
   * Effectue une requête PUT
   */
  public async put<T = any>(
    endpoint: string,
    body?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const url = `${this.baseUrl}/functions/v1/${endpoint}`;
    
    try {
      const headers = await this.prepareHeaders(mergedOptions.headers);
      
      const response = await this.fetchWithRetry(
        url,
        {
          method: 'PUT',
          headers,
          body: body ? JSON.stringify(body) : undefined,
          signal: mergedOptions.signal
        },
        mergedOptions.retries || 0,
        mergedOptions.retryDelay || 1000
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw {
          status: response.status,
          message: errorData.message || response.statusText,
          details: errorData
        };
      }
      
      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: this.handleError(error, url) };
    }
  }

  /**
   * Effectue une requête DELETE
   */
  public async delete<T = any>(
    endpoint: string,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const url = `${this.baseUrl}/functions/v1/${endpoint}`;
    
    try {
      const headers = await this.prepareHeaders(mergedOptions.headers);
      
      const response = await this.fetchWithRetry(
        url,
        {
          method: 'DELETE',
          headers,
          signal: mergedOptions.signal
        },
        mergedOptions.retries || 0,
        mergedOptions.retryDelay || 1000
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw {
          status: response.status,
          message: errorData.message || response.statusText,
          details: errorData
        };
      }
      
      const data = await response.json();
      return { data };
    } catch (error) {
      return { error: this.handleError(error, url) };
    }
  }

  /**
   * Effectue une requête pour générer un PDF
   */
  public async generatePdf(
    template: string,
    data: any,
    filename?: string
  ): Promise<ApiResponse<{ pdf: string, filename: string }>> {
    return this.post('pdf-generator', {
      template,
      data,
      filename
    });
  }

  /**
   * Effectue une requête pour envoyer un email
   */
  public async sendEmail(
    to: string,
    subject: string,
    content: { text?: string, html?: string },
    from?: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    return this.post('email-sender', {
      to,
      subject,
      ...content,
      from
    });
  }

  /**
   * Effectue une requête pour obtenir les données météo
   */
  public async getWeather(city: string): Promise<ApiResponse<any>> {
    return this.get('api-proxy/weather', { city });
  }

  /**
   * Effectue une requête pour obtenir les actualités
   */
  public async getNews(category: string, country?: string): Promise<ApiResponse<any>> {
    const params: Record<string, string> = { category };
    if (country) params.country = country;
    
    return this.get('api-proxy/news', params);
  }

  /**
   * Effectue une requête pour obtenir les données de géocodage
   */
  public async getGeocoding(address: string): Promise<ApiResponse<any>> {
    return this.get('api-proxy/geocoding', { address });
  }
}

// Export de l'instance par défaut
export const apiClient = ApiClient.getInstance();

// Hook pour utiliser l'API dans les composants React
export function useApi() {
  return apiClient;
}