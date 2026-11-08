import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function verifyRequestOrigin(req, _res, next) {
  if (!MUTATING_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  const originHeader = req.get('origin');
  const refererHeader = req.get('referer');
  const hostHeader = req.get('host');

  // If neither Origin nor Referer is present:
  // Allow in automated test/server-to-server CLI calls, or if no auth cookie is attached on login/register
  if (!originHeader && !refererHeader) {
    return next();
  }

  let sourceOrigin = originHeader;
  if (!sourceOrigin && refererHeader) {
    try {
      sourceOrigin = new URL(refererHeader).origin;
    } catch (_err) {
      throw new AppError('Malformed Referer header.', 403, 'INVALID_ORIGIN');
    }
  }

  // Same-host check (when Express serves the SPA in production)
  if (hostHeader) {
    try {
      const parsedOrigin = new URL(sourceOrigin);
      if (parsedOrigin.host === hostHeader) {
        return next();
      }
    } catch (_err) {
      throw new AppError('Malformed Origin header.', 403, 'INVALID_ORIGIN');
    }
  }

  if (env.allowedOrigins.includes(sourceOrigin)) {
    return next();
  }

  throw new AppError(
    'Cross-origin mutation request blocked by origin policy.',
    403,
    'FORBIDDEN_ORIGIN'
  );
}

