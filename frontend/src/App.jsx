import React, { Suspense, lazy, useContext, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import Layout from './components/Layout';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageContext } from './contexts/LanguageContext';
import './index.css';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Ingredients = lazy(() => import('./pages/Ingredients'));
const Products = lazy(() => import('./pages/Products'));
const Categories = lazy(() => import('./pages/Categories'));
const OrdersAndProduction = lazy(() => import('./pages/OrdersAndProduction'));
const StockMovements = lazy(() => import('./pages/StockMovements'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Customers = lazy(() => import('./pages/Customers'));

const queryClient = new QueryClient();

function RouteLoadingFallback() {
  const { language } = useContext(LanguageContext);

  return (
    <BrandLoadingScreen language={language} />
  );
}

function BrandLoadingScreen({ language }) {
  return (
    <div className="brand-loading-screen" role="status" aria-live="polite">
      <div
        className="brand-loading-logo"
        role="img"
        aria-label={language === 'ar' ? 'فروج باشا' : 'Faroj Basha'}
      >
        <img className="brand-logo-word" src="/5994297452451795077.jpg" alt="" />
        <img className="brand-logo-moustache" src="/5994297452451795077.jpg" alt="" />
        <img className="brand-logo-fez" src="/5994297452451795077.jpg" alt="" />
      </div>
      <p className="brand-loading-caption">
        {language === 'ar' ? 'نظام إدارة المخزون' : 'Inventory Management System'}
      </p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" replace />;
}

function RoleRoute({ roles, children }) {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  return user?.role && roles.includes(user.role) ? children : <Navigate to="/orders" replace />;
}

export default function App() {
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'ar');
  const [showStartup, setShowStartup] = useState(true);

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const startupTimer = window.setTimeout(() => setShowStartup(false), 3200);
    return () => window.clearTimeout(startupTimer);
  }, []);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/login" replace />} />

                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <Layout>
                        <Routes>
                          <Route path="/dashboard" element={<RoleRoute roles={['admin']}><Dashboard /></RoleRoute>} />
                          <Route path="/orders" element={<OrdersAndProduction />} />
                          <Route path="/ingredients" element={<RoleRoute roles={['admin']}><Ingredients /></RoleRoute>} />
                          <Route path="/products" element={<RoleRoute roles={['admin']}><Products /></RoleRoute>} />
                          <Route path="/categories" element={<RoleRoute roles={['admin']}><Categories /></RoleRoute>} />
                          <Route path="/stock-movements" element={<RoleRoute roles={['admin']}><StockMovements /></RoleRoute>} />
                          <Route path="/reports" element={<RoleRoute roles={['admin']}><Reports /></RoleRoute>} />
                          <Route path="/settings" element={<RoleRoute roles={['admin']}><Settings /></RoleRoute>} />
                          <Route path="/customers" element={<Customers />} />
                          <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                      </Layout>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </Router>
        </QueryClientProvider>
      </AuthProvider>
      {showStartup && (
        <div className="brand-loading-overlay">
          <BrandLoadingScreen language={language} />
        </div>
      )}
    </LanguageContext.Provider>
  );
}
