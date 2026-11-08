import { z } from 'zod';

export const registerSchema = z.object({
  displayName: z
    .string({ error: (issue) => issue.input === undefined ? 'Display name is required.' : undefined })
    .trim()
    .min(2, 'Display name must be at least 2 characters.')
    .max(80, 'Display name cannot exceed 80 characters.'),
  email: z
    .string({ error: (issue) => issue.input === undefined ? 'Email is required.' : undefined })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address.')
    .max(160),
  password: z
    .string({ error: (issue) => issue.input === undefined ? 'Password is required.' : undefined })
    .min(8, 'Password must be at least 8 characters long.')
    .max(128, 'Password cannot exceed 128 characters.')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.'),
});

export const loginSchema = z.object({
  email: z
    .string({ error: (issue) => issue.input === undefined ? 'Email is required.' : undefined })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address.'),
  password: z
    .string({ error: (issue) => issue.input === undefined ? 'Password is required.' : undefined })
    .min(1, 'Password is required.')
    .max(128),
});

