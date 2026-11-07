import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  const secret = process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    return res.status(503).json({ error: 'Authentication is temporarily unavailable' });
  }

  const authorization = req.headers.authorization || '';
  const [scheme, token, ...extra] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token || extra.length > 0) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  jwt.verify(token, secret, { algorithms: ['HS256'] }, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      typeof decoded.id !== 'string' ||
      !['admin', 'manager', 'staff'].includes(decoded.role)
    ) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = { id: decoded.id, email: decoded.email, role: decoded.role };
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  });
};
