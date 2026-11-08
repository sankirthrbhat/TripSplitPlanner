import { User } from '../models/User.model.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AUTH_COOKIE_NAME, verifyAuthToken } from '../utils/tokens.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    throw new AppError('Authentication required. Please log in.', 401, 'UNAUTHENTICATED');
  }

  let payload;
  try {
    payload = verifyAuthToken(token);
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'SESSION_EXPIRED' : 'INVALID_TOKEN';
    throw new AppError('Your session has expired or is invalid. Please log in again.', 401, code);
  }

  if (!payload?.sub) {
    throw new AppError('Invalid authentication token payload.', 401, 'INVALID_TOKEN');
  }

  const user = await User.findById(payload.sub);
  if (!user) {
    throw new AppError('Authenticated user account no longer exists.', 401, 'USER_NOT_FOUND');
  }

  req.user = user;
  next();
});

