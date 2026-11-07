import axios from 'axios';

// ============================================
// Axios Instance Configuration
// ============================================
const API_URL = import.meta.env.VITE_API_URL || '/api';
const DEMO_MODE = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== 'false';

const demoUsers = {
  'admin@farojbasha.com': { password: 'SecurePassword123!', name: 'Administrator', role: 'admin' },
  'cashier@farojbasha.com': { password: 'CashierDemo123!', name: 'Demo Cashier', role: 'staff' },
};

function demoResponse(config) {
  const path = config.url || '';
  const method = (config.method || 'get').toLowerCase();
  const body = typeof config.data === 'string' ? JSON.parse(config.data || '{}') : (config.data || {});

  if (path.endsWith('/auth/login') && method === 'post') {
    const email = String(body.email || '').trim().toLowerCase();
    const account = demoUsers[email];
    if (!account || account.password !== body.password) {
      return { status: 401, data: { error: 'بيانات الدخول غير صحيحة' } };
    }
    return {
      status: 200,
      data: {
        token: `demo-token-${account.role}`,
        user: { id: `demo-${account.role}`, email, name: account.name, role: account.role },
      },
    };
  }

  if (path.endsWith('/auth/profile')) {
    return { status: 200, data: JSON.parse(localStorage.getItem('user') || '{}') };
  }
  if (path.includes('/dashboard/summary')) {
    return { status: 200, data: { total_ingredients: 0, total_products: 0, low_stock_alerts: [], most_consumed_ingredients: [] } };
  }
  if (path.includes('/dashboard/consumption-chart')) {
    return { status: 200, data: [] };
  }
  if (method === 'get') {
    return { status: 200, data: [] };
  }
  return { status: 200, data: { message: 'تم الحفظ في وضع العرض المحلي', ...body } };
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 30 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  },
  adapter: DEMO_MODE
    ? async (config) => {
        const result = demoResponse(config);
        return { ...result, config, headers: {}, statusText: 'OK' };
      }
    : undefined,
});

// ============================================
// Request Interceptor (Add token to all requests)
// ============================================
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`📤 ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    }

    return config;
  },
  (error) => {
    console.error('❌ Request error:', error.message);
    return Promise.reject(error);
  }
);

// ============================================
// Response Interceptor (Handle responses and errors)
// ============================================
api.interceptors.response.use(
  (response) => {
    // Log successful response in development
    if (import.meta.env.DEV) {
      console.log(`✅ ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error) => {
    const isNetworkError = !error.response;
    
    if (isNetworkError) {
      console.error('❌ Network Error:', {
        message: error.message,
        code: error.code,
        url: error.config?.url,
      });
    } else {
      console.error('❌ API Error:', {
        status: error.response?.status,
        message: error.response?.data?.error || error.message,
        url: error.config?.url,
      });
    }

    // Handle specific status codes
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    if (error.response?.status === 403) {
      // Forbidden
      console.error('❌ Access Forbidden (403)');
    }

    if (error.response?.status >= 500) {
      // Server error
      console.error('❌ Server Error (5xx)');
    }

    return Promise.reject(error);
  }
);

// ============================================
// Auth API
// ============================================
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password) => api.post('/auth/register', { email, password }),
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  getUsers: () => api.get('/auth/users'),
  createUser: (data) => api.post('/auth/users', data),
  updateUser: (id, data) => api.put(`/auth/users/${id}`, data),
};

// ============================================
// Ingredients API
// ============================================
export const ingredientsAPI = {
  getAll: () => api.get('/ingredients'),
  getById: (id) => api.get(`/ingredients/${id}`),
  create: (data) => api.post('/ingredients', data),
  update: (id, data) => api.put(`/ingredients/${id}`, data),
  delete: (id) => api.delete(`/ingredients/${id}`),
};

// ============================================
// Categories API
// ============================================
export const categoriesAPI = {
  getAll: () => api.get('/categories'),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  delete: (id) => api.delete(`/categories/${id}`),
};

// ============================================
// Products API
// ============================================
export const productsAPI = {
  getAll: () => api.get('/products'),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  toggleStatus: (id) => api.patch(`/products/${id}/toggle-status`),
};

// ============================================
// Recipes API
// ============================================
export const recipesAPI = {
  getByProductId: (productId) => api.get(`/recipes/product/${productId}`),
  create: (data) => api.post('/recipes', data),
  update: (id, data) => api.put(`/recipes/${id}`, data),
  delete: (id) => api.delete(`/recipes/${id}`),
};

// ============================================
// Production API
// ============================================
export const productionAPI = {
  getAll: () => api.get('/production'),
  produce: (data) => api.post('/production/produce', data),
};

// ============================================
// Stock Movements API
// ============================================
export const stockAPI = {
  getAll: () => api.get('/stock-movements'),
  add: (data) => api.post('/stock-movements/add', data),
  adjust: (data) => api.post('/stock-movements/adjust', data),
};

// ============================================
// Dashboard API
// ============================================
export const dashboardAPI = {
  getSummary: () => api.get('/dashboard/summary'),
  getConsumptionChart: () => api.get('/dashboard/consumption-chart'),
};

// ============================================
// Reports API
// ============================================
export const reportsAPI = {
  getConsumption: (params) => api.get('/reports/consumption', { params }),
  getProductUsage: (params) => api.get('/reports/product-usage', { params }),
  getStockStatus: () => api.get('/reports/stock-status'),
};

// ============================================
// Orders API
// ============================================
export const ordersAPI = {
  getAll: () => api.get('/orders'),
  getById: (id) => api.get(`/orders/${id}`),
  create: (data) => {
    const { idempotency_key: idempotencyKey, ...orderData } = data;
    return api.post('/orders', orderData, {
      headers: { 'Idempotency-Key': idempotencyKey || window.crypto.randomUUID() },
    });
  },
  updateStatus: (id, status) => api.put(`/orders/${id}/status`, { status }),
  delete: (id) => api.delete(`/orders/${id}`),

  // Checks (split bills)
  createCheck: (orderId, data) => api.post(`/orders/${orderId}/checks`, data),
  addItemToCheck: (orderId, checkId, data) => api.post(`/orders/${orderId}/checks/${checkId}/add-item`, data),
  closeCheck: (orderId, checkId) => api.post(`/orders/${orderId}/checks/${checkId}/close`),
};

export default api;
