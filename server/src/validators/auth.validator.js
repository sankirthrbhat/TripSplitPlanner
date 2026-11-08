import { z } from 'zod';

export const registerSchema = z.object({
  displayName: z
    .string({ required_error: 'Display name is required.' })
    .trim()
    .min(2, 'Display name must be at least 2 characters.')
    .max(80, 'Display name cannot exceed 80 characters.'),
  email: z
    .string({ required_error: 'Email is required.' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address.')
    .max(160),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(8, 'Password must be at least 8 characters long.')
    .max(128, 'Password cannot exceed 128 characters.')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.'),
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password is required.')
    .max(128),
});

