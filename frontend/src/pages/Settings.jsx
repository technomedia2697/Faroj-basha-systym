import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Settings as SettingsIcon, 
  Save, 
  Lock, 
  Mail, 
  Percent, 
  User, 
  ArrowLeft,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Phone,
  Building2,
  UserPlus,
  Pencil
} from 'lucide-react';
import Toast from '../components/Toast';
import LoadingSkeleton from '../components/LoadingSkeleton';
import { authAPI } from '../api';
import { LanguageContext } from '../contexts/LanguageContext';
import { AuthContext } from '../contexts/AuthContext';

export default function Settings() {
  const { language } = useContext(LanguageContext);
  const { user, setUser } = useContext(AuthContext);
  const labels = {
    ar: {
      back: 'رجوع',
      title: 'الإعدادات',
    },
    en: {
      back: 'Back',
      title: 'Settings',
    }
  };
  const currentLabels = labels[language];
  
  const [activeTab, setActiveTab] = useState('general');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // General Settings State
  const [settings, setSettings] = useState({
    taxRate: 14,
    companyName: 'Faroj Basha Restaurant',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
    deliveryFeeDefault: 0,
  });

  // ...

  const handleSettingChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: (name === 'taxRate' || name === 'deliveryFeeDefault') ? parseFloat(value) || 0 : value
    }));
  };

  // User Profile State
  const [userProfile, setUserProfile] = useState({
    name: '',
    email: '',
  });
  const [cashiers, setCashiers] = useState([]);
  const [cashierForm, setCashierForm] = useState({ id: '', name: '', email: '', password: '' });
  const [cashierLoading, setCashierLoading] = useState(false);

  // Password Change State
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    loadUserProfile();
    loadCashiers();
    
    // Listen for storage updates from other tabs
    const handleStorageChange = () => {
      loadSettings();
    };
    window.addEventListener('storageUpdated', handleStorageChange);
    return () => window.removeEventListener('storageUpdated', handleStorageChange);
  }, []);

  const loadCashiers = async () => {
    try {
      const response = await authAPI.getUsers();
      setCashiers(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load cashier accounts:', error);
      showError(error.response?.data?.error || 'فشل تحميل حسابات الكاشير');
    }
  };

  const loadSettings = async () => {
    try {
      const savedSettings = localStorage.getItem('appSettings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      showError('فشل تحميل الإعدادات');
    }
  };

  const loadUserProfile = async () => {
    try {
      const response = await authAPI.getProfile();
      setUserProfile({
        name: response.data.name || '',
        email: response.data.email || '',
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
      // Use default values if API fails
    }
  };

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const showError = (message) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(''), 4000);
  };

  // Handle user profile changes
  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setUserProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle password field changes
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Save general settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validation
      if (!settings.companyName || !settings.companyName.trim()) {
        showError('اسم المتجر مطلوب');
        setIsLoading(false);
        return;
      }

      if (settings.taxRate < 0 || settings.taxRate > 100) {
        showError('معدل الضريبة يجب أن يكون بين 0 و 100');
        setIsLoading(false);
        return;
      }

      // Save to localStorage
      localStorage.setItem('appSettings', JSON.stringify(settings));
      
      // Dispatch event to update other tabs/windows
      window.dispatchEvent(new Event('storageUpdated'));
      
      showSuccess('✓ تم حفظ الإعدادات بنجاح! سيتم تطبيق معدل الضريبة على جميع الفواتير الجديدة');
    } catch (error) {
      console.error('Error saving settings:', error);
      showError('فشل حفظ الإعدادات');
    } finally {
      setIsLoading(false);
    }
  };

  // Save user profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await authAPI.updateProfile(userProfile);
      const updatedUser = response.data;
      setUser((previous) => ({ ...previous, ...updatedUser }));
      localStorage.setItem('user', JSON.stringify({ ...user, ...updatedUser }));
      showSuccess('تم تحديث بيانات الملف الشخصي بنجاح ✓');
    } catch (error) {
      console.error('Error saving profile:', error);
      showError(error.response?.data?.error || 'فشل تحديث الملف الشخصي');
    } finally {
      setIsLoading(false);
    }
  };

  // Change password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword) {
      showError('الرجاء ملء جميع حقول كلمة المرور');
      return;
    }

    if (passwordData.newPassword.length < 12) {
      showError('كلمة المرور الجديدة يجب أن تكون 12 حرفًا على الأقل');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError('كلمات المرور غير متطابقة');
      return;
    }

    setIsLoading(true);
    try {
      await authAPI.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      
      showSuccess('تم تغيير كلمة المرور بنجاح ✓');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      console.error('Error changing password:', error);
      showError(error.response?.data?.error || 'فشل تغيير كلمة المرور');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCashierSubmit = async (e) => {
    e.preventDefault();
    if (!cashierForm.name.trim() || !cashierForm.email.trim() || (!cashierForm.id && !cashierForm.password)) {
      showError('الاسم والبريد وكلمة المرور مطلوبة للحساب الجديد');
      return;
    }
    if (cashierForm.password && cashierForm.password.length < 12) {
      showError('كلمة المرور يجب أن تكون 12 حرفًا على الأقل');
      return;
    }
    setCashierLoading(true);
    try {
      const payload = {
        name: cashierForm.name,
        email: cashierForm.email,
        ...(cashierForm.password ? { password: cashierForm.password } : {}),
      };
      if (cashierForm.id) {
        await authAPI.updateUser(cashierForm.id, payload);
        showSuccess('تم تحديث حساب الكاشير بنجاح');
      } else {
        await authAPI.createUser(payload);
        showSuccess('تم إنشاء حساب الكاشير بنجاح');
      }
      setCashierForm({ id: '', name: '', email: '', password: '' });
      await loadCashiers();
    } catch (error) {
      console.error('Cashier account save failed:', error);
      showError(error.response?.data?.error || 'فشل حفظ حساب الكاشير');
    } finally {
      setCashierLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen p-4 sm:p-6 lg:p-8"
      style={{
        backgroundImage: 'linear-gradient(145deg, rgba(var(--brand-red-rgb), 0.18), var(--brand-charcoal) 55%, var(--brand-charcoal))',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>
      
      {/* Toast */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      
      <div className="relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8 animate-fadeIn">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-400 hover:text-white transition text-sm sm:text-base"
          >
            <ArrowLeft className="w-5 h-5 ml-2" />
            {currentLabels.back}
          </button>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold flex items-center drop-shadow-lg">
            <SettingsIcon className="w-8 h-8 ml-3 text-accent" />
            {currentLabels.title}
          </h1>
        </div>

        {/* Alert Messages */}
        {successMessage && (
          <div className="mb-6 bg-green-900 bg-opacity-20 border border-green-700 rounded-lg p-3 sm:p-4 flex items-start gap-3 animate-slideIn">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <p className="text-green-300 text-sm sm:text-base">{successMessage}</p>
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-3 sm:p-4 flex items-start gap-3 animate-slideIn">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-red-300 text-sm sm:text-base">{errorMessage}</p>
          </div>
        )}

        {/* Main Settings Container */}
        <div className="card overflow-hidden animate-fadeIn">
          {/* Tabs */}
          <div className="border-b border-gray-700 bg-gray-800">
            <nav className="flex overflow-x-auto">
              {[
                { id: 'general', label: 'الإعدادات العامة', icon: Building2 },
                { id: 'cashiers', label: 'حسابات الكاشير', icon: UserPlus },
                { id: 'profile', label: 'الملف الشخصي', icon: User },
                { id: 'password', label: 'تغيير كلمة المرور', icon: Lock },
              ].map(tab => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`shrink-0 py-3 sm:py-4 px-3 sm:px-6 flex items-center gap-2 border-b-2 font-medium text-xs sm:text-sm transition ${
                      isActive
                        ? 'border-accent text-accent bg-gray-700 bg-opacity-50'
                        : 'border-transparent text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    <TabIcon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 lg:p-8">
          {/* === Cashier Accounts Tab === */}
          {activeTab === 'cashiers' && (
            <div className="space-y-8">
              <section>
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-accent" />
                  إدارة حسابات الكاشير
                </h3>
                <p className="text-sm text-gray-400 mb-6">
                  يمكنك إنشاء حسابات الكاشير أو تعديل الاسم والبريد وكلمة المرور. لا يتم عرض كلمات المرور الحالية.
                </p>
                <form onSubmit={handleCashierSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-700 bg-opacity-30 p-6 rounded-lg">
                  <input
                    className="input"
                    placeholder="اسم الكاشير"
                    value={cashierForm.name}
                    onChange={(e) => setCashierForm({ ...cashierForm, name: e.target.value })}
                    required
                  />
                  <input
                    type="email"
                    className="input"
                    placeholder="البريد الإلكتروني"
                    value={cashierForm.email}
                    onChange={(e) => setCashierForm({ ...cashierForm, email: e.target.value })}
                    required
                  />
                  <input
                    type="password"
                    className="input"
                    placeholder={cashierForm.id ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور (12 حرفًا على الأقل)'}
                    value={cashierForm.password}
                    onChange={(e) => setCashierForm({ ...cashierForm, password: e.target.value })}
                    required={!cashierForm.id}
                    minLength={12}
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary flex items-center gap-2" disabled={cashierLoading}>
                      {cashierForm.id ? <Pencil className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                      {cashierLoading ? 'جاري الحفظ...' : cashierForm.id ? 'حفظ التعديل' : 'إضافة كاشير'}
                    </button>
                    {cashierForm.id && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setCashierForm({ id: '', name: '', email: '', password: '' })}
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </form>
              </section>

              <section className="space-y-3">
                <h4 className="font-bold text-gray-200">الحسابات الحالية</h4>
                {cashiers.length === 0 ? (
                  <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-gray-400">لا توجد حسابات كاشير.</p>
                ) : (
                  cashiers.map((cashier) => (
                    <div key={cashier._id} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-white/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">{cashier.name}</p>
                        <p className="text-sm text-gray-400">{cashier.email}</p>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary flex items-center gap-2 text-sm"
                        onClick={() => setCashierForm({ id: cashier._id, name: cashier.name, email: cashier.email, password: '' })}
                      >
                        <Pencil className="w-4 h-4" />
                        تعديل
                      </button>
                    </div>
                  ))
                )}
              </section>
            </div>
          )}

          {/* === General Settings Tab === */}
          {activeTab === 'general' && (
            <form onSubmit={handleSaveSettings} className="space-y-8">
              {/* Store Information */}
              <section>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-accent" />
                  معلومات المتجر
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-700 bg-opacity-30 p-6 rounded-lg">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      اسم المطعم
                    </label>
                    <input
                      type="text"
                      name="companyName"
                      value={settings.companyName}
                      onChange={handleSettingChange}
                      className="input w-full"
                      placeholder="مثال: فروج باشا"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-accent" />
                        البريد الإلكتروني
                      </div>
                    </label>
                    <input
                      type="email"
                      name="companyEmail"
                      value={settings.companyEmail}
                      onChange={handleSettingChange}
                      className="input w-full"
                      placeholder="info@ramada.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-accent" />
                        رقم الهاتف
                      </div>
                    </label>
                    <input
                      type="tel"
                      name="companyPhone"
                      value={settings.companyPhone}
                      onChange={handleSettingChange}
                      className="input w-full"
                      placeholder="+201000000000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      <div className="flex items-center gap-2">
                        <Percent className="w-4 h-4 text-accent" />
                        معدل الضريبة (%)
                      </div>
                    </label>
                    <input
                      type="number"
                      name="taxRate"
                      value={settings.taxRate}
                      onChange={handleSettingChange}
                      className="input w-full"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="14"
                    />
                    <div className="text-xs text-gray-400 mt-2 space-y-1">
                      <p>⚡ سيتم تطبيق هذه الضريبة على جميع الفواتير الجديدة</p>
                      <p>📌 مثال: إذا أضفت منتج ب 100 ج.م والضريبة {settings.taxRate}%</p>
                      <p className="text-accent">الضريبة = {(100 * (settings.taxRate / 100)).toFixed(2)} ج.م</p>
                      <p className="text-accent">الإجمالي = {(100 + (100 * (settings.taxRate / 100))).toFixed(2)} ج.م</p>
                    </div>

                    {/* Delivery fee default */}
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-gray-300 mb-2">قيمة رسوم التوصيل الافتراضية</label>
                      <input
                        type="number"
                        name="deliveryFeeDefault"
                        value={settings.deliveryFeeDefault}
                        onChange={handleSettingChange}
                        className="input w-full"
                        step="0.1"
                        min="0"
                        placeholder="مثال: 10"
                      />
                      <p className="text-xs text-gray-400 mt-2">سيتم إضافة هذه القيمة تلقائياً عندما لا يدخل الكاشير رسوم توصيل يدوياً</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Address */}
              <section>
                <h3 className="text-lg font-bold mb-4 text-gray-300">العنوان</h3>
                <textarea
                  name="companyAddress"
                  value={settings.companyAddress}
                  onChange={handleSettingChange}
                  className="input w-full"
                  rows="3"
                  placeholder="شارع النيل، القاهرة، مصر"
                />
              </section>

              {/* Save Button */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => loadSettings()}
                  className="btn-secondary px-6"
                  disabled={isLoading}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-primary px-6 flex items-center gap-2"
                  disabled={isLoading}
                >
                  <Save className="w-4 h-4" />
                  {isLoading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </button>
              </div>
            </form>
          )}

          {/* === Profile Tab === */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-8">
              <section>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <User className="w-5 h-5 text-accent" />
                  بيانات الملف الشخصي
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-700 bg-opacity-30 p-6 rounded-lg">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      الاسم الكامل
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={userProfile.name}
                      onChange={handleProfileChange}
                      className="input w-full"
                      placeholder="أحمد محمد"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      البريد الإلكتروني
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={userProfile.email}
                      onChange={handleProfileChange}
                      className="input w-full"
                      placeholder="user@example.com"
                      required
                    />
                  </div>
                </div>
              </section>

              {/* Save Button */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => loadUserProfile()}
                  className="btn-secondary px-6"
                  disabled={isLoading}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-primary px-6 flex items-center gap-2"
                  disabled={isLoading}
                >
                  <Save className="w-4 h-4" />
                  {isLoading ? 'جاري الحفظ...' : 'حفظ البيانات'}
                </button>
              </div>
            </form>
          )}

          {/* === Password Tab === */}
          {activeTab === 'password' && (
            <form onSubmit={handleChangePassword} className="space-y-8">
              <section>
                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-accent" />
                  تغيير كلمة المرور
                </h3>
                <div className="space-y-6 bg-gray-700 bg-opacity-30 p-6 rounded-lg">
                  {/* Current Password */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      كلمة المرور الحالية *
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        className="input w-full pr-10"
                        placeholder="أدخل كلمة المرور الحالية"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(prev => ({
                          ...prev,
                          current: !prev.current
                        }))}
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                      >
                        {showPasswords.current ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      كلمة المرور الجديدة *
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.new ? 'text' : 'password'}
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        className="input w-full pr-10"
                        placeholder="أدخل كلمة المرور الجديدة"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(prev => ({
                          ...prev,
                          new: !prev.new
                        }))}
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                      >
                        {showPasswords.new ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      يجب أن تكون كلمة المرور 12 حرفًا على الأقل
                    </p>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      تأكيد كلمة المرور الجديدة *
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.confirm ? 'text' : 'password'}
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        className="input w-full pr-10"
                        placeholder="أعد إدخال كلمة المرور الجديدة"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(prev => ({
                          ...prev,
                          confirm: !prev.confirm
                        }))}
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300"
                      >
                        {showPasswords.confirm ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Password Strength Indicator */}
                  {passwordData.newPassword && (
                    <div className="bg-gray-800 p-4 rounded-lg">
                      <p className="text-sm text-gray-300 mb-2">قوة كلمة المرور:</p>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            passwordData.newPassword.length < 12
                              ? 'w-1/3 bg-red-500'
                              : passwordData.newPassword.length < 16
                              ? 'w-2/3 bg-yellow-500'
                              : 'w-full bg-green-500'
                          }`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Save Button */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-700">
                <button
                  type="button"
                  onClick={() => setPasswordData({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                  })}
                  className="btn-secondary px-6"
                  disabled={isLoading}
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="btn-primary px-6 flex items-center gap-2"
                  disabled={isLoading}
                >
                  <Lock className="w-4 h-4" />
                  {isLoading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                </button>
              </div>
            </form>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
