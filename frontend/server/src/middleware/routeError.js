export function sendRouteError(res, error) {
  const isValidationError = error.name === 'ValidationError' || error.name === 'CastError';
  const isDuplicateError = error.code === 11000;
  const isStockConflict = error.code === 'INSUFFICIENT_STOCK';
  const isDatabaseUnavailable = [
    'MongoNetworkError',
    'MongoServerSelectionError',
    'MongooseServerSelectionError',
    'MongoNotConnectedError',
  ].includes(error.name);
  const status = isValidationError ? 400 : isDuplicateError || isStockConflict ? 409 : isDatabaseUnavailable ? 503 : 500;

  console.error('API operation failed', {
    name: error.name || 'Error',
    code: error.code,
    status,
  });

  const message = isStockConflict
    ? error.message
    : status === 400
      ? 'Invalid request data'
      : status === 409
        ? 'A conflicting record already exists'
        : status === 503
          ? 'Database service temporarily unavailable'
          : 'Request could not be completed';

  return res.status(status).json({ error: message });
}
