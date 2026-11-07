import axios, { AxiosError } from 'axios';

// ============================================
// Axios Instance Configuration
// ============================================
const API_URL = import.meta.env.VITE_API_URL || '/api';
const DEMO_MODE = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== 'false';
export const isDemoMode = DEMO_MODE;

const demoNormalizePhone = (phone) => String(phone || '')
  .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
  .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/\D/g, '');

function readDemoList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

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
  if (path === '/customers' && method === 'get') {
    return { status: 200, data: readDemoList('demoCustomers') };
  }
  if (path === '/customers/import' && method === 'post') {
    const customers = readDemoList('demoCustomers');
    const knownPhones = new Set(customers.map((customer) => demoNormalizePhone(customer.phone)));
    (body.customers || []).forEach((customer) => {
      const normalizedPhone = demoNormalizePhone(customer.phone);
      if (!normalizedPhone || knownPhones.has(normalizedPhone)) return;
      const id = customer.id || window.crypto.randomUUID();
      customers.push({ ...customer, id, _id: id, normalizedPhone });
      knownPhones.add(normalizedPhone);
    });
    localStorage.setItem('demoCustomers', JSON.stringify(customers));
    return { status: 200, data: { imported: customers.length } };
  }
  if (path === '/customers' && method === 'post') {
    const customers = readDemoList('demoCustomers');
    const normalizedPhone = demoNormalizePhone(body.phone);
    if (customers.some((customer) => demoNormalizePhone(customer.phone) === normalizedPhone)) {
      return { status: 409, data: { error: 'رقم الهاتف مسجل بالفعل لدى عميل آخر' } };
    }
    const id = window.crypto.randomUUID();
    const customer = {
      ...body,
      id,
      _id: id,
      normalizedPhone,
      loyaltyPoints: 0,
      orderCount: 0,
      totalSpent: 0,
      createdAt: new Date().toISOString(),
    };
    customers.unshift(customer);
    localStorage.setItem('demoCustomers', JSON.stringify(customers));
    return { status: 201, data: customer };
  }
  const customerOrdersPath = path.match(/^\/customers\/([^/]+)\/orders$/);
  if (customerOrdersPath && method === 'get') {
    const customer = readDemoList('demoCustomers').find((item) => item._id === customerOrdersPath[1] || item.id === customerOrdersPath[1]);
    const customerOrders = readDemoList('demoOrders')
      .filter((order) => demoNormalizePhone(order.customer_phone) === demoNormalizePhone(customer?.phone))
      .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt));
    const params = new URLSearchParams(config.params || '');
    const page = Math.max(1, Number(params.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, Number(params.get('limit')) || 10));
    const start = (page - 1) * limit;
    return {
      status: 200,
      data: {
        orders: customerOrders.slice(start, start + limit),
        page,
        limit,
        total: customerOrders.length,
        totalSpent: customerOrders.reduce((total, order) => total + Number(order.total || 0), 0),
        hasMore: page * limit < customerOrders.length,
      },
    };
  }
  const customerPath = path.match(/^\/customers\/([^/]+)$/);
  if (customerPath && method === 'put') {
    const customers = readDemoList('demoCustomers');
    const index = customers.findIndex((customer) => customer._id === customerPath[1] || customer.id === customerPath[1]);
    if (index < 0) return { status: 404, data: { error: 'العميل غير موجود' } };
    const duplicate = customers.some((customer, position) => position !== index && demoNormalizePhone(customer.phone) === demoNormalizePhone(body.phone));
    if (duplicate) return { status: 409, data: { error: 'رقم الهاتف مسجل بالفعل لدى عميل آخر' } };
    customers[index] = { ...customers[index], ...body, normalizedPhone: demoNormalizePhone(body.phone), updatedAt: new Date().toISOString() };
    localStorage.setItem('demoCustomers', JSON.stringify(customers));
    return { status: 200, data: customers[index] };
  }
  if (customerPath && method === 'delete') {
    const customers = readDemoList('demoCustomers');
    const updated = customers.filter((customer) => customer._id !== customerPath[1] && customer.id !== customerPath[1]);
    if (updated.length === customers.length) return { status: 404, data: { error: 'العميل غير موجود' } };
    localStorage.setItem('demoCustomers', JSON.stringify(updated));
    return { status: 200, data: { message: 'تم حذف العميل' } };
  }
  if (path === '/orders' && method === 'get') {
    return { status: 200, data: readDemoList('demoOrders') };
  }
  if (path === '/orders' && method === 'post') {
    const orders = readDemoList('demoOrders');
    const idempotencyKey = config.headers?.get?.('Idempotency-Key')
      || config.headers?.['Idempotency-Key']
      || config.headers?.['idempotency-key'];
    const existing = orders.find((order) => order.idempotency_key === idempotencyKey);
    if (existing) return { status: 200, data: existing };
    const order = {
      ...body,
      _id: window.crypto.randomUUID(),
      order_number: `DEMO-${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    };
    orders.unshift(order);
    localStorage.setItem('demoOrders', JSON.stringify(orders));
    return { status: 201, data: order };
  }
  const orderStatusPath = path.match(/^\/orders\/([^/]+)\/status$/);
  if (orderStatusPath && method === 'put') {
    const orders = readDemoList('demoOrders');
    const index = orders.findIndex((order) => order._id === orderStatusPath[1]);
    if (index < 0) return { status: 404, data: { error: 'Order not found' } };
    orders[index] = { ...orders[index], status: body.status };
    localStorage.setItem('demoOrders', JSON.stringify(orders));
    return { status: 200, data: orders[index] };
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
    const response = { ...result, config, headers: {}, statusText: 'OK' };
    if (result.status < 200 || result.status >= 300) {
      throw new AxiosError(result.data?.error || 'Demo API request failed', AxiosError.ERR_BAD_REQUEST, config, null, response);
    }
    return response;
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

export const customersAPI = {
  getAll: () => api.get('/customers'),
  create: (data) => api.post('/customers', data),
  importLocal: (customers) => api.post('/customers/import', { customers }),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  getOrders: (id, params) => api.get(`/customers/${id}/orders`, { params }),
};

export default api;
