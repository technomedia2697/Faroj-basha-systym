import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const [{ default: app }, { connectDatabase }] = await Promise.all([
  import('./app.js'),
  import('./db.js'),
]);

const PORT = process.env.PORT || 5000;

async function startServer() {
  if (!process.env.JWT_SECRET || Buffer.byteLength(process.env.JWT_SECRET, 'utf8') < 32) {
    throw new Error('JWT_SECRET must be configured with at least 32 bytes');
  }
  await connectDatabase();

  app.listen(PORT, () => {
    console.log(`Faroj Basha Restaurant API running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start API server:', error);
  process.exitCode = 1;
});
