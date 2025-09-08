import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Star, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { LoginCredentials } from '../../types/auth';
import AdminLoginButton from '../../components/auth/AdminLoginButton';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading } = useAuth();
  
  const [formData, setFormData] = useState<LoginCredentials>({
    email: '',
    password: '',
    rememberMe: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = location.state?.from?.pathname || '/';

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

    const result = await login(formData);
    
    if (result.success && result.data) {
      console.log("✅ Connexion réussie");
      
      // Redirection basée sur le rôle
      if (result.data.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate(from, { replace: true });
      }
    } else {
      setError(result.message || 'Erreur de connexion');
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

      {/* Beta Notice */}
      <div className="mb-6 p-4 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg border border-primary-200">
        <div className="flex items-center justify-center mb-2">
          <div className="bg-gradient-to-r from-primary-500 to-secondary-500 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center">
            <Star size={12} className="mr-1" />
            BETA
          </div>
        </div>
        <p className="text-sm text-center text-gray-700">
          Réservé aux ostéopathes et futur(e)s ostéopathes bêta-testeur·se·s<br />
          👉 Note moyenne des testeur·se·s : 4,9/5<br />
          ⏱️ Temps gagné : 2 à 3 heures par semaine<br />
          ✅ 100 % de satisfaction
        </p>
        <div className="mt-3 text-center">
          <Link 
            to="/beta-waitlist" 
            className="inline-block text-primary-600 hover:text-primary-700 font-medium transition-all duration-300 relative group"
          >
            Devenez BETA testeur·se·s
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-primary-500 group-hover:w-full transition-all duration-300"></span>
          </Link>
        </div>
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
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

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

export default Login;