import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { KeyRound, ArrowLeft } from 'lucide-react';
import AdminLoginButton from '../../components/auth/AdminLoginButton';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Aucun compte trouvé avec cet email');
      } else {
        setError('Une erreur est survenue lors de l\'envoi de l\'email');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Admin Login Button */}
      <div className="absolute top-4 right-4">
        <AdminLoginButton />
      </div>
      
      <Link to="/login" className="flex items-center text-sm text-primary-600 mb-8">
        <ArrowLeft size={16} className="mr-1" />
        Retour à la connexion
      </Link>

      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Mot de passe oublié</h2>
        <p className="mt-2 text-gray-600">
          Entrez votre adresse email pour recevoir un lien de réinitialisation
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-error bg-opacity-10 border border-error border-opacity-20 rounded-lg text-error text-sm">
          {error}
        </div>
      )}

      {success ? (
        <div className="p-4 bg-secondary-50 border border-secondary-200 rounded-lg">
          <h3 className="text-lg font-medium text-secondary-700">Email envoyé!</h3>
          <p className="mt-2 text-secondary-600">
            Un lien de réinitialisation de mot de passe a été envoyé à {email}.
            Vérifiez votre boîte de réception et suivez les instructions.
          </p>
          <div className="mt-4">
            <Link
              to="/login"
              className="btn btn-primary w-full"
            >
              Retour à la connexion
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={handleChange}
              className="input"
              placeholder="votre@email.com"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-full"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Envoi en cours...
              </span>
            ) : (
              <span className="flex items-center justify-center">
                <KeyRound size={18} className="mr-2" />
                Réinitialiser le mot de passe
              </span>
            )}
          </button>
        </form>
      )}
    </div>
  );
};

export default ForgotPassword;