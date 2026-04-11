import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';
import { USE_DUMMY_DATA } from '../config/useDummyData';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (USE_DUMMY_DATA) {
        // Auto-login with dummy credentials
        await new Promise(resolve => setTimeout(resolve, 500));
        login(
          'admin@example.com',
          'dummy-token',
          ['Manager'],
          'John',
          'Doe',
          true,
          '/uploads/company1'
        );
        navigate('/dashboard');
      } else {
        // Real API call would go here
        // const response = await api.post('/auth/login', { email, password });
        // login(response.data.email, response.data.token, ...);
      }
    } catch (err) {
      setError('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#065F46] to-[#10B981] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#065F46] rounded-full mb-4">
            <LogIn className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('app_name')}</h1>
          <p className="text-gray-600">{t('sign_in')}</p>
        </div>

        {USE_DUMMY_DATA && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 text-center">
              🎯 Demo Mode: Click "Sign In" to continue
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-transparent"
              placeholder="admin@example.com"
              disabled={USE_DUMMY_DATA}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#065F46] focus:border-transparent"
              placeholder="••••••••"
              disabled={USE_DUMMY_DATA}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#065F46] text-white py-3 rounded-lg font-medium hover:bg-[#064E3B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : t('sign_in')}
          </button>
        </form>
      </div>
    </div>
  );
}
