import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const AUTH_COOKIE_NAME = 'tripsplit_token';

export function signAuthToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      email: user.email,
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
    }
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

export function getAuthCookieOptions() {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  };
}

export function generateInviteTokenPair() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashInviteToken(rawToken);
  return { rawToken, tokenHash };
}

export function hashInviteToken(rawToken) {
  return crypto.createHash('sha256').update(String(rawToken)).digest('hex');
}

