import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import ingredientsRoutes from './routes/ingredients.js';
import categoriesRoutes from './routes/categories.js';
import productsRoutes from './routes/products.js';
import recipesRoutes from './routes/recipes.js';
import productionRoutes from './routes/production.js';
import stockMovementsRoutes from './routes/stockMovements.js';
import dashboardRoutes from './routes/dashboard.js';
import reportsRoutes from './routes/reports.js';
import ordersRoutes from './routes/orders.js';
import customersRoutes from './routes/customers.js';
import { verifyToken } from './middleware/auth.js';
import { requireRole } from './middleware/permissions.js';

const app = express();
const NODE_ENV = process.env.NODE_ENV || 'development';

const allowedOrigins = new Set(
  [
    NODE_ENV === 'production' ? null : 'http://localhost:3000',
    NODE_ENV === 'production' ? null : 'http://localhost:5173',
    NODE_ENV === 'production' ? null : 'http://127.0.0.1:3000',
    NODE_ENV === 'production' ? null : 'http://127.0.0.1:5173',
    process.env.FRONTEND_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ].filter(Boolean).map((origin) => origin.replace(/\/$/, ''))
);

const corsOptions = {
  origin: (origin, callback) => {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key'],
  maxAge: 86400, // 24 hours
};

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  hsts: NODE_ENV === 'production' ? undefined : false,
}));

// Apply CORS middleware BEFORE all routes
app.use(cors(corsOptions));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: false }));

app.use((req, res, next) => {
  if (NODE_ENV !== 'production') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

app.get(['/health', '/api/health'], (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/ready', (req, res) => {
  res.json({ status: 'ready' });
});

app.use('/api/auth', authRoutes);
app.use('/api/ingredients', verifyToken, requireRole('admin'), ingredientsRoutes);
// Authenticated staff can read categories for order entry; mutations remain admin-only in the router.
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/recipes', verifyToken, requireRole('admin'), recipesRoutes);
app.use('/api/production', verifyToken, requireRole('admin'), productionRoutes);
app.use('/api/stock-movements', verifyToken, requireRole('admin'), stockMovementsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/dashboard', verifyToken, requireRole('admin'), dashboardRoutes);
app.use('/api/reports', verifyToken, requireRole('admin'), reportsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  console.error('API request failed', {
    name: err.name || 'Error',
    code: err.code,
    status,
    method: req.method,
    path: req.path,
  });

  res.status(status >= 400 && status < 500 ? status : 500).json({
    error: status === 413 ? 'Request body is too large' : status >= 400 && status < 500 ? 'Invalid request' : 'Internal server error',
  });
});

export default app;
