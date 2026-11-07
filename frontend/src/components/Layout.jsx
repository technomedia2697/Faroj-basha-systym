import React, { useEffect, useRef, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Boxes,
  Utensils,
  BarChart3,
  LogOut,
  Layers,
  Menu,
  X,
  Settings,
  Globe,
  Users2,
} from 'lucide-react';
import { LanguageContext } from '../contexts/LanguageContext';
import { AuthContext } from '../contexts/AuthContext';
import BrandLogo from './BrandLogo';

export default function Layout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const drawerRef = useRef(null);
  const { language, setLanguage } = useContext(LanguageContext);
  const { user, logout } = useContext(AuthContext);

  const labels = {
    ar: {
      dashboard: 'لوحة التحكم',
      orders: 'الطلبات',
      ingredients: 'المكونات',
      products: 'المنتجات',
      categories: 'الفئات',
      production: 'الإنتاج',
      stockMovements: 'حركات المخزون',
      reports: 'التقارير',
      settings: 'الإعدادات',
      customers: 'العملاء',
      logout: 'تسجيل الخروج',
      menu: 'القائمة الجانبية',
    },
    en: {
      dashboard: 'Dashboard',
      orders: 'Orders',
      ingredients: 'Ingredients',
      products: 'Products',
      categories: 'Categories',
      production: 'Production',
      stockMovements: 'Stock Movements',
      reports: 'Reports',
      settings: 'Settings',
      customers: 'Customers',
      logout: 'Logout',
      menu: 'Menu',
    }
  };

  const currentLabels = labels[language];

  // Close drawer when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (drawerRef.current && !drawerRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    }

    // Close drawer on route change
    const unlisten = () => {
      setMobileMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      unlisten();
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { path: '/dashboard', icon: LayoutDashboard, labelKey: 'dashboard', roles: ['admin'] },
    { path: '/orders', icon: Utensils, labelKey: 'orders', roles: ['admin', 'staff'] },
    { path: '/customers', icon: Users2, labelKey: 'customers', roles: ['admin', 'staff'] },
    { path: '/ingredients', icon: Package, labelKey: 'ingredients', roles: ['admin'] },
    { path: '/products', icon: Utensils, labelKey: 'products', roles: ['admin'] },
    { path: '/categories', icon: Layers, labelKey: 'categories', roles: ['admin'] },
    { path: '/stock-movements', icon: BarChart3, labelKey: 'stockMovements', roles: ['admin'] },
    { path: '/reports', icon: BarChart3, labelKey: 'reports', roles: ['admin'] },
    { path: '/settings', icon: Settings, labelKey: 'settings', roles: ['admin'] },
  ];

  // Filter menu items based on user role
  const availableMenuItems = menuItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  return (
    <div 
      className="flex h-screen bg-dark text-white rtl font-sans relative"
      style={{
        backgroundImage: 'radial-gradient(ellipse at 15% 10%, rgba(181, 18, 36, 0.3), transparent 38%), linear-gradient(145deg, #241616, var(--brand-charcoal) 58%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Background Overlay */}
      <div className="absolute inset-0 bg-black/10 pointer-events-none"></div>
      
      {/* Sidebar */}
      <aside 
        ref={drawerRef}
        className={`${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'
        } fixed right-0 top-0 h-full w-[min(18rem,88vw)] bg-brand-charcoal border-l border-brand-red/50 flex flex-col z-40 shadow-2xl transition-transform duration-300 ease-in-out`}>
        {/* Logo */}
        <div className="p-6 border-b border-brand-red/40 hover:bg-brand-deep-purple/20 transition-colors duration-300">
          <BrandLogo language={language} className="w-28 h-20 sm:w-36 sm:h-24 animate-fade-in" />
          <p className="text-sm text-gray-400 mt-1 animate-fade-in-delay">
            {language === 'ar' ? 'مطعم' : 'Restaurant'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Inventory Management System</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {availableMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 rounded-xl transition text-base sm:text-lg font-medium ${
                  isActive
                    ? 'bg-accent text-white shadow-lg'
                    : 'text-brand-cream/80 hover:bg-brand-deep-purple/40 hover:text-white'
                }`}
              >
                <Icon className="w-6 h-6 sm:w-7 sm:h-7" />
                {currentLabels[item.labelKey]}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-brand-red/40">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 sm:px-6 py-3 sm:py-4 rounded-xl text-brand-cream/80 hover:bg-brand-red hover:text-white transition text-base sm:text-lg font-medium"
          >
            <LogOut className="w-6 h-6 sm:w-7 sm:h-7" />
            {currentLabels.logout}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 xl:mr-72 flex flex-col overflow-hidden transition-all duration-300 relative z-10">
        {/* Top Bar */}
        <header className="bg-brand-charcoal/95 border-b border-brand-red/50 px-3 sm:px-6 lg:px-8 py-3 sm:py-4 flex flex-wrap justify-between items-center gap-2 shadow-lg">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 sm:p-3 hover:bg-brand-deep-purple/40 rounded-lg text-2xl transition-colors"
              aria-label={currentLabels.menu}
            >
              {mobileMenuOpen ? <X className="w-6 h-6 sm:w-8 sm:h-8" /> : <Menu className="w-6 h-6 sm:w-8 sm:h-8" />}
            </button>
            <h2 className="truncate text-lg sm:text-2xl font-bold whitespace-nowrap">
              {menuItems.find(item => item.path === location.pathname) 
                ? currentLabels[menuItems.find(item => item.path === location.pathname)?.labelKey]
                : currentLabels.dashboard}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-4">
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="p-2 sm:p-3 hover:bg-brand-orange rounded-lg transition-colors text-brand-orange hover:text-brand-charcoal flex items-center gap-1 sm:gap-2"
              title={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
            >
              <Globe className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-sm font-semibold uppercase">{language}</span>
            </button>
            <div className="hidden text-sm text-gray-400 sm:block sm:text-base">
              {new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                calendar: language === 'ar' ? 'gregory' : undefined
              })}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-70 z-30 transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        } xl:hidden`}
        onClick={() => setMobileMenuOpen(false)}
      />
    </div>
  );
}
