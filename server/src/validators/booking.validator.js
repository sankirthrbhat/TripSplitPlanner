import { z } from 'zod';
import { BOOKING_CATEGORIES, BOOKING_STATUSES } from '../models/Booking.model.js';
import { isValidObjectId } from '../utils/objectId.js';

const objectIdString = z
  .string()
  .trim()
  .refine(isValidObjectId, 'Invalid ObjectId format.');

const optionalDateSchema = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  return new Date(val);
}, z.date({ invalid_type_error: 'Invalid date.' }).nullable().optional());

const safeHttpUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine(
    (val) => {
      if (!val) return true;
      try {
        const parsed = new URL(val);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch (_err) {
        return false;
      }
    },
    { message: 'URL must be a valid http:// or https:// web address.' }
  );

export const createBookingSchema = z
  .object({
    title: z
      .string({ required_error: 'Booking title is required.' })
      .trim()
      .min(2, 'Booking title must be at least 2 characters.')
      .max(140),
    provider: z
      .string({ required_error: 'Provider or vendor name is required.' })
      .trim()
      .min(1, 'Provider or vendor is required.')
      .max(140),
    category: z.enum(BOOKING_CATEGORIES).default('accommodation'),
    startAt: optionalDateSchema,
    endAt: optionalDateSchema,
    status: z.enum(BOOKING_STATUSES).default('tentative'),
    referenceNumber: z.string().trim().max(100).optional().default(''),
    url: safeHttpUrlSchema.optional().default(''),
    notes: z.string().trim().max(1000).optional().default(''),
    linkedExpenseId: objectIdString.nullable().optional().default(null),
    costMinor: z
      .number()
      .int('Cost must be an integer in paise.')
      .positive('Cost must be positive.')
      .optional()
      .nullable(),
    costStatus: z.enum(['planned', 'paid']).optional().default('planned'),
    paidByUserId: objectIdString.nullable().optional().default(null),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return data.endAt.getTime() >= data.startAt.getTime();
      }
      return true;
    },
    {
      message: 'Booking end date/time cannot be before start date/time.',
      path: ['endAt'],
    }
  );

export const updateBookingSchema = z
  .object({
    title: z.string().trim().min(2).max(140).optional(),
    provider: z.string().trim().min(1).max(140).optional(),
    category: z.enum(BOOKING_CATEGORIES).optional(),
    startAt: optionalDateSchema,
    endAt: optionalDateSchema,
    status: z.enum(BOOKING_STATUSES).optional(),
    referenceNumber: z.string().trim().max(100).optional(),
    url: safeHttpUrlSchema.optional(),
    notes: z.string().trim().max(1000).optional(),
    linkedExpenseId: objectIdString.nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return data.endAt.getTime() >= data.startAt.getTime();
      }
      return true;
    },
    {
      message: 'Booking end date/time cannot be before start date/time.',
      path: ['endAt'],
    }
  );

export const bookingQuerySchema = z.object({
  category: z.enum(BOOKING_CATEGORIES).optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
});

