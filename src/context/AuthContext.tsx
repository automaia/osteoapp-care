import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config';
import { User, AuthState, LoginCredentials, ApiResponse } from '../types/auth';
import { authService } from '../services/authService';
import { tokenStorage } from '../utils/jwt';
import { trackEvent, setUserTag } from '../lib/clarityClient';
import { setUserId } from '../lib/matomoTagManager';
import { setUserId as setGAUserId, setUserProperties } from '../lib/googleAnalytics';
import { saveSessionState, hasValidSession } from '../utils/sessionPersistence';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<ApiResponse<{ user: User; token: string }>>;
  logout: () => Promise<ApiResponse>;
  resetPassword: (email: string) => Promise<ApiResponse>;
  refreshAuth: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
  isSubstitute: () => boolean;
  getEffectiveOsteopathId: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    loading: true
  });

  // Vérifier les permissions
  const hasPermission = useCallback((permission: string): boolean => {
    return authState.user?.permissions.includes(permission) || false;
  }, [authState.user]);

  // Vérifier si l'utilisateur est admin
  const isAdmin = useCallback((): boolean => {
    return authState.user?.role === 'admin';
  }, [authState.user]);

  // Vérifier si l'utilisateur est un remplaçant
  const isSubstitute = useCallback((): boolean => {
    return authState.user?.role === 'substitute';
  }, [authState.user]);

  // Obtenir l'ID de l'ostéopathe effectif
  const getEffectiveOsteopathId = useCallback(async (): Promise<string | null> => {
    if (!authState.user) return null;
    
    if (authState.user.role === 'osteopath') {
      return authState.user.uid;
    } else if (authState.user.role === 'substitute') {
      return authState.user.linkedTo || null;
    }
    
    return null;
  }, [authState.user]);

  // Connexion
  const login = useCallback(async (credentials: LoginCredentials) => {
    setAuthState(prev => ({ ...prev, loading: true }));
    
    // Track login attempt in Matomo
    trackEvent('Authentication', 'Login Attempt', credentials.email.split('@')[1]);
    
    // Track login attempt in Google Analytics
    trackEvent('login_attempt', {
      method: 'email',
      email_domain: credentials.email.split('@')[1]
    });
    
    const result = await authService.login(credentials);
    
    if (result.success && result.data) {
      setAuthState({
        user: result.data.user,
        token: result.data.token,
        refreshToken: result.data.token,
        isAuthenticated: true,
        loading: false
      });
      
      // Save session state
      saveSessionState();
      
      // Track login event in Clarity
      trackEvent("user_login", { 
        role: result.data.user.role,
        method: "email"
      });
      
      // Set user properties in Clarity
      setUserTag("role", result.data.user.role);
      
      // Set user ID in Matomo
      setUserId(result.data.user.uid);
      
      // Set user ID and properties in Google Analytics
      setGAUserId(result.data.user.uid);
      setUserProperties({
        role: result.data.user.role,
        user_type: result.data.user.role === 'admin' ? 'admin' : 'standard'
      });
      
      // Track successful login in Matomo
      trackEvent('Authentication', 'Login Success', result.data.user.role);
      
      // Track successful login in Google Analytics
      trackEvent('login_success', {
        method: 'email',
        role: result.data.user.role
      });
    } else {
      setAuthState(prev => ({ ...prev, loading: false }));
      
      // Track login failure in Clarity
      trackEvent("login_failed");
      
      // Track login failure in Matomo
      trackEvent('Authentication', 'Login Failed', result.message);
      
      // Track login failure in Google Analytics
      trackEvent('login_failed', {
        error_message: result.message || 'Unknown error',
        method: 'email'
      });
    }
    
    return result;
  }, []);

  // Déconnexion
  const logout = useCallback(async () => {
    setAuthState(prev => ({ ...prev, loading: true }));
    
    // Track logout event in Clarity
    if (authState.user) {
      trackEvent("user_logout", { role: authState.user.role });
    }
    
    // Track logout in Matomo
    trackEvent('Authentication', 'Logout', authState.user?.role);
    
    // Track logout in Google Analytics
    trackEvent('logout', {
      role: authState.user?.role || 'unknown'
    });
    
    const result = await authService.logout();
    
    setAuthState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      loading: false
    });
    
    return result;
  }, [authState.user]);

  // Réinitialisation du mot de passe
  const resetPassword = useCallback(async (email: string) => {
    // Track password reset request in Clarity
    trackEvent("password_reset_request", { email_domain: email.split('@')[1] });
    
    // Track password reset in Matomo
    trackEvent('Authentication', 'Password Reset Request', email.split('@')[1]);
    
    // Track password reset in Google Analytics
    trackEvent('password_reset_request', {
      email_domain: email.split('@')[1]
    });
    
    return authService.resetPassword(email);
  }, []);

  // Rafraîchir l'authentification
  const refreshAuth = useCallback(async () => {
    setAuthState(prev => ({ ...prev, loading: true }));
    
    const user = await authService.verifyToken();
    const token = tokenStorage.getAccessToken();
    
    setAuthState({
      user,
      token,
      refreshToken: token,
      isAuthenticated: !!user,
      loading: false
    });
    
    // Update Clarity with user info if available
    if (user) {
      setUserTag("role", user.role);
      
      // Set user ID in Google Analytics
      setGAUserId(user.uid);
      setUserProperties({
        role: user.role,
        user_type: user.role === 'admin' ? 'admin' : 'standard'
      });
      
      // Save session state
      saveSessionState();
    }
  }, []);

  // Écouter les changements d'authentification Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Utilisateur connecté - vérifier le profil
        const user = await authService.verifyToken();
        const token = tokenStorage.getAccessToken();
        
        setAuthState({
          user,
          token,
          refreshToken: token,
          isAuthenticated: !!user,
          loading: false
        });
        
        // Update Clarity with user info
        if (user) {
          setUserTag("role", user.role);
          
          // Set user ID in Matomo
          setUserId(user.uid);
          
          // Set user ID in Google Analytics
          setGAUserId(user.uid);
          setUserProperties({
            role: user.role,
            user_type: user.role === 'admin' ? 'admin' : 'standard'
          });
          
          // Save session state
          saveSessionState();
        }
      } else {
        // Check if we have a valid session in localStorage
        if (hasValidSession()) {
          // Try to refresh auth
          try {
            await refreshAuth();
          } catch (error) {
            console.error('Failed to refresh auth from saved session:', error);
            tokenStorage.clearTokens();
            setAuthState({
              user: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
              loading: false
            });
          }
        } else {
          // Utilisateur déconnecté
          tokenStorage.clearTokens();
          setAuthState({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            loading: false
          });
        }
      }
    });

    return () => unsubscribe();
  }, [refreshAuth]);

  // Vérification automatique du token au chargement
  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const value: AuthContextType = {
    ...authState,
    login,
    logout,
    resetPassword,
    refreshAuth,
    hasPermission,
    isAdmin,
    isSubstitute,
    getEffectiveOsteopathId
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}