export interface User {
  uid: string;
  email: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  role: 'user' | 'admin' | 'substitute';
  permissions: string[];
  linkedTo?: string; // Pour les remplaçants : ID de l'ostéopathe titulaire
  lastLogin?: string;
  isActive: boolean;
  phoneNumber?: string; // Phone number for authentication
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
  phoneNumber?: string; // Optional phone number for authentication
}

export interface JWTPayload {
  uid: string;
  email: string;
  role: 'user' | 'admin';
  permissions: string[];
  iat: number;
  exp: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface ActivityLog {
  id: string;
  userId: string;
  action: string;
  resource: string;
  timestamp: string;
  ipAddress: string;
  userAgent: string;
  details?: Record<string, any>;
}