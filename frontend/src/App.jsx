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
    <div
      className="flex min-h-screen items-center justify-center bg-brand-charcoal text-brand-cream"
      role="status"
      aria-live="polite"
    >
      {language === 'ar' ? 'جارٍ تحميل الصفحة...' : 'Loading page...'}
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

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

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
    </LanguageContext.Provider>
  );
}
