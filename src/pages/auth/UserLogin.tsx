import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Star, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { LoginCredentials } from '../../types/auth';
import { trackEvent } from '../../lib/clarityClient';
import { trackEvent as trackMatomoEvent } from '../../lib/matomoTagManager';
import { trackEvent as trackGAEvent } from '../../lib/googleAnalytics';
import AdminLoginButton from '../../components/auth/AdminLoginButton';

const UserLogin: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading } = useAuth();
  
  const [formData, setFormData] = useState<LoginCredentials>({
    email: '',
    password: '',
    rememberMe: false,
    phoneNumber: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPhoneField, setShowPhoneField] = useState(false);

  const from = location.state?.from?.pathname || '/';

  // Track page view
  useEffect(() => {
    trackMatomoEvent('Authentication', 'Page View', 'Login Page');
    trackGAEvent('page_view', {
      page_title: 'Login Page',
      page_location: window.location.href,
      page_path: location.pathname
    });
  }, [location.pathname]);

  // Check if email is julie.boddaert@hotmail.fr to show phone field
  useEffect(() => {
    setShowPhoneField(formData.email.toLowerCase() === 'julie.boddaert@hotmail.fr');
  }, [formData.email]);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate phone number for julie.boddaert@hotmail.fr
    if (showPhoneField && formData.phoneNumber !== '06 16 53 13 76') {
      setError('Numéro de téléphone incorrect pour ce compte');
      return;
    }
    // Track login attempt
    trackEvent("login_attempt", { 
      email_domain: formData.email.split('@')[1] || 'unknown'
    });
    
    // Track login attempt in Matomo
    trackMatomoEvent('Authentication', 'Login Attempt', formData.email.split('@')[1] || 'unknown');
    
    // Track login attempt in Google Analytics
    trackGAEvent('login_attempt', {
      method: 'email',
      email_domain: formData.email.split('@')[1] || 'unknown'
    });

    const result = await login(formData);
    
    if (result.success && result.data) {
      console.log("✅ Connexion réussie");
      navigate(from, { replace: true });
    } else {
      setError(result.message || 'Erreur de connexion');
      
      // Track login error
      trackEvent("login_error", { 
        error_message: result.message || 'Erreur de connexion'
      });
      
      // Track login error in Matomo
      trackMatomoEvent('Authentication', 'Login Error', result.message || 'Unknown error');
      
      // Track login error in Google Analytics
      trackGAEvent('login_error', {
        error_message: result.message || 'Unknown error'
      });
    }
  };

  return (
    <div className="w-full">
      {/* Admin Login Button */}
      <div className="absolute top-4 right-4">
        <AdminLoginButton />
      </div>
      
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Connexion</h2>
        <p className="mt-2 text-gray-600">Accédez à votre compte</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-error/5 border border-error/20 rounded-lg flex items-center">
          <AlertCircle size={16} className="text-error mr-2" />
          <span className="text-error text-sm">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="input"
            placeholder="votre@email.com"
            required
            disabled={loading}
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="label">
              Mot de passe
            </label>
            <Link 
              to="/forgot-password" 
              className="text-sm text-primary-600 hover:text-primary-700"
              onClick={() => {
                trackEvent("forgot_password_click");
                trackMatomoEvent('Authentication', 'Click', 'Forgot Password');
                trackGAEvent('click_forgot_password');
              }}
            >
              Mot de passe oublié?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="input pr-10"
              placeholder="••••••••"
              required
              disabled={loading}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500"
              onClick={() => {
                setShowPassword(!showPassword);
                trackMatomoEvent('Authentication', 'Toggle', showPassword ? 'Hide Password' : 'Show Password');
                trackGAEvent('toggle_password_visibility', { 
                  state: showPassword ? 'hidden' : 'visible' 
                });
              }}
              disabled={loading}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {showPhoneField && (
          <div>
            <label htmlFor="phoneNumber" className="label">
              Numéro de téléphone
            </label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              className="input"
              placeholder="06 16 53 13 76"
              required={showPhoneField}
              disabled={loading}
            />
            <p className="mt-1 text-xs text-gray-500">
              Saisissez votre numéro de téléphone pour ce compte sécurisé
            </p>
          </div>
        )}

        <div className="flex items-center">
          <input
            type="checkbox"
            id="rememberMe"
            name="rememberMe"
            checked={formData.rememberMe}
            onChange={handleChange}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            disabled={loading}
          />
          <label htmlFor="rememberMe" className="ml-2 block text-sm text-gray-900">
            Se souvenir de moi
          </label>
        </div>

        <Button
          type="submit"
          variant="primary"
          fullWidth
          isLoading={loading}
          loadingText="Connexion en cours..."
          disabled={loading}
          leftIcon={<LogIn size={18} />}
        >
          Se connecter
        </Button>
      </form>
    </div>
  );
};

export default UserLogin;