import app from '../server/src/app.js';
import { connectDatabase } from '../server/src/db.js';

export default async function handler(req, res) {
  const requestUrl = new URL(req.url || '/', 'http://vercel.local');
  const route = requestUrl.searchParams.get('route');

  if (!route || route.startsWith('/') || route.split('/').includes('..')) {
    return res.status(400).json({ error: 'Invalid API route' });
  }

  requestUrl.searchParams.delete('route');
  const query = requestUrl.searchParams.toString();
  req.url = `/api/${route}${query ? `?${query}` : ''}`;

  if (req.url.split('?')[0] === '/api/health') {
    return app(req, res);
  }

  try {
    await connectDatabase();
    return app(req, res);
  } catch (error) {
    console.error('Serverless API initialization failed', {
      name: error.name || 'Error',
      code: error.code,
    });
    return res.status(503).json({
      error: 'Service temporarily unavailable',
    });
  }
}
