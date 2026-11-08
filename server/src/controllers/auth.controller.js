import { User } from '../models/User.model.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  AUTH_COOKIE_NAME,
  getAuthCookieOptions,
  signAuthToken,
} from '../utils/tokens.js';

export const register = asyncHandler(async (req, res) => {
  const { displayName, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError(
      'An account with this email address already exists.',
      409,
      'EMAIL_ALREADY_EXISTS'
    );
  }

  const passwordHash = await User.hashPassword(password);
  const user = await User.create({
    displayName,
    email,
    passwordHash,
  });

  const token = signAuthToken(user);
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

  return res.status(201).json({
    success: true,
    data: {
      user: user.toJSON(),
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  const isPasswordValid = await user.verifyPassword(password);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password.', 401, 'INVALID_CREDENTIALS');
  }

  const token = signAuthToken(user);
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());

  return res.status(200).json({
    success: true,
    data: {
      user: user.toJSON(),
    },
  });
});

export const logout = asyncHandler(async (_req, res) => {
  const cookieOpts = getAuthCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: cookieOpts.httpOnly,
    secure: cookieOpts.secure,
    sameSite: cookieOpts.sameSite,
    path: cookieOpts.path,
  });

  return res.status(200).json({
    success: true,
    data: {
      message: 'Logged out successfully.',
    },
  });
});

export const getMe = asyncHandler(async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      user: req.user.toJSON(),
    },
  });
});

