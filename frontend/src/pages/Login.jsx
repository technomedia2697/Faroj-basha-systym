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

  const getLoginErrorMessage = (err) => {
    const apiError = err.response?.data?.error;
    if (typeof apiError === 'string') return apiError;
    if (apiError && typeof apiError.message === 'string') return apiError.message;
    if (typeof err.message === 'string') return err.message;
    return currentLabels.connectionFailed;
  };

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
      setError(getLoginErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="relative flex min-h-screen min-h-[100svh] flex-col items-center px-4 py-3 sm:justify-center sm:p-6"
      style={{
        backgroundImage: 'radial-gradient(ellipse at 15% 15%, rgba(181, 18, 36, 0.36), transparent 46%), radial-gradient(ellipse at 85% 82%, rgba(123, 25, 181, 0.24), transparent 44%), linear-gradient(135deg, var(--brand-charcoal), #241518 55%, var(--brand-charcoal))',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <button
        type="button"
        onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
        className="z-20 mb-2 flex min-h-11 shrink-0 items-center gap-2 self-end rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-brand-deep-purple sm:absolute sm:top-6 sm:mb-0 sm:px-4 sm:text-base"
        aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}
      >
        <Globe className="h-5 w-5 shrink-0" />
        {currentLabels.language}
      </button>

      <div className="relative z-10 my-auto w-full max-w-lg">
        <div className="mb-6 text-center sm:mb-8 md:mb-10">
          <BrandLogo language={language} className="mx-auto mb-3 h-28 w-32 sm:h-36 sm:w-40 md:h-40 md:w-48" />
          <p className="text-xl text-gray-100 drop-shadow-md sm:text-2xl">
            {currentLabels.subtitle}
          </p>
          <p className="mt-2 text-sm text-gray-300 drop-shadow-md sm:mt-3 sm:text-base">
            {currentLabels.systemName}
          </p>
        </div>

        <div className="card p-4 backdrop-blur-sm sm:p-6 md:p-8">
          <h2 className="mb-5 text-2xl font-bold sm:mb-7 sm:text-3xl md:mb-8 md:text-4xl">{currentLabels.login}</h2>

          {error && (
            <div className="mb-5 flex items-start gap-3 rounded-lg border-2 border-red-700 bg-red-900/80 p-3 backdrop-blur-sm sm:mb-6 sm:p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 sm:h-6 sm:w-6" />
              <span className="break-words text-sm sm:text-base">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold sm:mb-3 sm:text-base">
                {currentLabels.email}
              </label>
              <input
                type="email"
                className="input min-h-11 py-3 text-base sm:py-3.5 sm:text-lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={currentLabels.emailPlaceholder}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold sm:mb-3 sm:text-base">
                {currentLabels.password}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input min-h-11 py-3 pr-12 text-base sm:py-3.5 sm:text-lg"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={currentLabels.passwordPlaceholder}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 transition hover:text-gray-200"
                  aria-label={showPassword ? (isArabic ? 'إخفاء كلمة المرور' : 'Hide password') : (isArabic ? 'إظهار كلمة المرور' : 'Show password')}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary min-h-12 w-full py-3 text-base shadow-lg sm:py-4 sm:text-lg md:text-xl" 
              disabled={loading}
            >
              {loading ? currentLabels.loggingIn : currentLabels.loginButton}
            </button>
          </form>
        </div>

        {/* Footer Info */}
        <div className="mt-5 space-y-1 text-center sm:mt-7">
          {demoMode && (
            <p className="mt-2 break-words text-xs text-amber-200 sm:text-sm">
              {isArabic
                ? 'وضع العرض المحلي: الكاشير cashier@farojbasha.com / CashierDemo123!'
                : 'Local demo: cashier@farojbasha.com / CashierDemo123!'}
            </p>
          )}
          <p className="text-sm text-gray-300 drop-shadow-md sm:text-base">
            {isArabic ? 'نظام إدارة المخزون والمبيعات' : 'Inventory & Sales Management System'}
          </p>
          <p className="mt-1 text-xs text-gray-400 drop-shadow-md sm:mt-2 sm:text-sm">
            {isArabic ? '© 2026 فروج باشا. جميع الحقوق محفوظة' : '© 2026 Faroj Basha. All Rights Reserved'}
          </p>
          <p className="mt-1 break-words text-[10px] text-gray-500 sm:mt-2 sm:text-xs">
            Developed by Hexa Plus · Software Engineering &amp; Technical Lead: Eng. Angelo Rezq
          </p>
        </div>
      </div>
    </div>
  );
}
