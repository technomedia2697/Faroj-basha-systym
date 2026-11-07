import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Globe, Eye, EyeOff } from 'lucide-react';
import { LanguageContext } from '../contexts/LanguageContext';
import { AuthContext } from '../contexts/AuthContext';
import { authAPI } from '../api';
import BrandLogo from '../components/BrandLogo';

export default function Login() {
  const { language, setLanguage } = useContext(LanguageContext);
  const { setUser } = useContext(AuthContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const isArabic = language === 'ar';
  const labels = {
    ar: {
      subtitle: 'مطعم',
      systemName: 'نظام إدارة المخزون',
      login: 'تسجيل الدخول',
      email: 'البريد الإلكتروني',
      password: 'كلمة المرور',
      emailPlaceholder: 'أدخل بريدك الإلكتروني',
      passwordPlaceholder: 'أدخل كلمة المرور',
      loginButton: '🔓 دخول',
      loggingIn: 'جاري تسجيل الدخول...',
      loginFailed: 'فشل تسجيل الدخول',
      connectionFailed: 'فشل الاتصال بالخادم',
      language: 'English'
    },
    en: {
      subtitle: 'Restaurant',
      systemName: 'Inventory Management System',
      login: 'Login',
      email: 'Email Address',
      password: 'Password',
      emailPlaceholder: 'Enter your email',
      passwordPlaceholder: 'Enter your password',
      loginButton: '🔓 Login',
      loggingIn: 'Signing in...',
      loginFailed: 'Login failed',
      connectionFailed: 'Connection to server failed',
      language: 'العربية'
    }
  };

  const currentLabels = labels[language];
  const demoMode = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== 'false';

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authAPI.login(email, password);
      const data = response.data;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || err.message || currentLabels.connectionFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="relative min-h-screen flex items-center justify-center p-6"
      style={{
        backgroundImage: 'radial-gradient(ellipse at 15% 15%, rgba(181, 18, 36, 0.36), transparent 46%), radial-gradient(ellipse at 85% 82%, rgba(123, 25, 181, 0.24), transparent 44%), linear-gradient(135deg, var(--brand-charcoal), #241518 55%, var(--brand-charcoal))',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Language Toggle Button */}
      <button
        onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
        className={`absolute top-6 ${isArabic ? 'left-6' : 'right-6'} flex items-center gap-2 bg-accent text-white px-4 py-2 rounded-lg font-semibold hover:bg-brand-deep-purple transition-colors shadow-lg`}
      >
        <Globe className="w-5 h-5" />
        {currentLabels.language}
      </button>

      <div className="w-full max-w-lg relative z-10">
        {/* Logo */}
        <div className="text-center mb-12">
          <BrandLogo language={language} className="w-48 h-40 md:w-56 md:h-48 mx-auto mb-3" />
          <p className="text-2xl text-gray-100 drop-shadow-md">
            {currentLabels.subtitle}
          </p>
          <p className="text-base text-gray-300 mt-3 drop-shadow-md">
            {currentLabels.systemName}
          </p>
        </div>

        {/* Card */}
        <div className="card backdrop-blur-sm">
          <h2 className="text-4xl font-bold mb-8">{currentLabels.login}</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-900/80 border-2 border-red-700 rounded-lg flex items-center gap-3 backdrop-blur-sm">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <span className="text-base">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-base font-semibold mb-3">
                {currentLabels.email}
              </label>
              <input
                type="email"
                className="input text-lg py-4"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={currentLabels.emailPlaceholder}
                required
              />
            </div>

            <div>
              <label className="block text-base font-semibold mb-3">
                {currentLabels.password}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input text-lg py-4 pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={currentLabels.passwordPlaceholder}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200 transition"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary w-full text-xl py-4 shadow-lg" 
              disabled={loading}
            >
              {loading ? currentLabels.loggingIn : currentLabels.loginButton}
            </button>
          </form>
        </div>

        {/* Footer Info */}
        <div className="text-center mt-8">
          {demoMode && (
            <p className="text-amber-200 text-sm mt-2">
              {isArabic
                ? 'وضع العرض المحلي: الكاشير cashier@farojbasha.com / CashierDemo123!'
                : 'Local demo: cashier@farojbasha.com / CashierDemo123!'}
            </p>
          )}
          <p className="text-gray-300 drop-shadow-md">
            {isArabic ? 'نظام إدارة المخزون والمبيعات' : 'Inventory & Sales Management System'}
          </p>
          <p className="text-gray-400 text-sm mt-2 drop-shadow-md">
            {isArabic ? '© 2026 فروج باشا. جميع الحقوق محفوظة' : '© 2026 Faroj Basha. All Rights Reserved'}
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Developed by Hexa Plus · Software Engineering &amp; Technical Lead: Eng. Angelo Rezq
          </p>
        </div>
      </div>
    </div>
  );
}
