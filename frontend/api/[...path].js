import app from '../server/src/app.js';
import { connectDatabase } from '../server/src/db.js';

export default async function handler(req, res) {
  const requestPath = req.url?.split('?')[0] || '';

  // Keep the liveness probe independent from MongoDB so Vercel can report
  // function availability while the database is unavailable.
  if (requestPath === '/api/health' || requestPath === '/health') {
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
