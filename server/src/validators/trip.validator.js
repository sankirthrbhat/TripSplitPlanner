import { z } from 'zod';
import { isValidIanaTimezone } from '../models/Trip.model.js';

const dateStringSchema = z.preprocess(
  (val) => (typeof val === 'string' || val instanceof Date ? new Date(val) : val),
  z.date({ invalid_type_error: 'Invalid date value.' })
);

export const createTripSchema = z
  .object({
    title: z
      .string({ required_error: 'Trip title is required.' })
      .trim()
      .min(2, 'Trip title must be at least 2 characters.')
      .max(120, 'Trip title cannot exceed 120 characters.'),
    destination: z
      .string({ required_error: 'Destination is required.' })
      .trim()
      .min(2, 'Destination must be at least 2 characters.')
      .max(120, 'Destination cannot exceed 120 characters.'),
    description: z.string().trim().max(1000).optional().default(''),
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    timezone: z
      .string()
      .trim()
      .default('Asia/Kolkata')
      .refine(isValidIanaTimezone, 'Invalid IANA timezone (e.g. Asia/Kolkata).'),
    currency: z.enum(['INR']).default('INR'),
    budgetLimitMinor: z
      .number({ invalid_type_error: 'Budget must be a numeric amount in paise.' })
      .int('Budget must be an integer in paise.')
      .min(0, 'Budget cannot be negative.')
      .max(100000000000, 'Budget exceeds maximum supported limit.')
      .default(0),
  })
  .refine((data) => data.endDate.getTime() >= data.startDate.getTime(), {
    message: 'Trip end date cannot be before start date.',
    path: ['endDate'],
  });

export const updateTripSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    destination: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(1000).optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    timezone: z
      .string()
      .trim()
      .refine(isValidIanaTimezone, 'Invalid IANA timezone.')
      .optional(),
    currency: z.enum(['INR']).optional(),
    budgetLimitMinor: z
      .number()
      .int('Budget must be an integer in paise.')
      .min(0, 'Budget cannot be negative.')
      .max(100000000000)
      .optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate.getTime() >= data.startDate.getTime();
      }
      return true;
    },
    {
      message: 'Trip end date cannot be before start date.',
      path: ['endDate'],
    }
  );

export const createInvitationSchema = z.object({
  invitedEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Invalid email format.')
    .optional()
    .or(z.literal(''))
    .default(''),
  label: z.string().trim().max(100).optional().default(''),
});

