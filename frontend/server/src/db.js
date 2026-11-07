import mongoose from 'mongoose';

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
    .then(() => {
      return mongoose.connection;
    })
    .catch((error) => {
      connectionCache.promise = null;
      throw error;
    });

  return connectionCache.promise;
}
