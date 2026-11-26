import mongoose from 'mongoose';
import Order from './models/Order.js';

const connectionCache = globalThis.__ramadaMongoConnection || {
  promise: null,
};

globalThis.__ramadaMongoConnection = connectionCache;

mongoose.connection.on('disconnected', () => {
  connectionCache.promise = null;
});

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (mongoose.connection.readyState === 2 && connectionCache.promise) {
    return connectionCache.promise;
  }

  connectionCache.promise = null;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI must be configured');
  }

  connectionCache.promise = mongoose.connect(uri, {
    maxPoolSize: 5,
    minPoolSize: 0,
    maxIdleTimeMS: 30_000,
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 10_000,
  })
    .then(async () => {
      await migrateOrderIndexes();
      return mongoose.connection;
    })
    .catch((error) => {
      connectionCache.promise = null;
      throw error;
    });

  return connectionCache.promise;
}

// Order numbers now restart every day, so the old unique index on order_number alone must go and the
// (order_day, order_number) index must exist. Only an index is touched, never any order data. Safe to repeat.
export async function migrateOrderIndexes() {
  try {
    const indexes = await Order.collection.indexes().catch(() => []);
    const legacy = indexes.find((index) => index.name === 'order_number_1' && index.unique);
    if (legacy) {
      await Order.collection.dropIndex('order_number_1');
      console.log('Dropped legacy unique index order_number_1');
    }
    await Order.createIndexes();
  } catch (error) {
    // Never block the API on index housekeeping; a failed order insert would surface a clear error.
    console.error('Order index migration failed', { name: error.name, code: error.code });
  }
}
