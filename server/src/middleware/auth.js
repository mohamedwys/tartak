import { verifyAuthToken } from '../utils/jwt.js';
import { HttpError } from '../utils/async.js';

export function requireAuth(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new HttpError(401, 'Missing bearer token'));
  }
  try {
    const payload = verifyAuthToken(token);
    req.user = {
      id: payload.id,
      email: payload.email,
      currentOrgId: payload.currentOrgId ?? null,
    };
    next();
  } catch {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = verifyAuthToken(token);
      req.user = {
        id: payload.id,
        email: payload.email,
        currentOrgId: payload.currentOrgId ?? null,
      };
    } catch {
      /* ignore — treat as anonymous */
    }
  }
  next();
}
