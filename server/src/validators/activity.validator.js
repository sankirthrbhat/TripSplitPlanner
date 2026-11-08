import { z } from 'zod';
import { ACTIVITY_CATEGORIES, ACTIVITY_STATUSES } from '../models/Activity.model.js';
import { isValidObjectId } from '../utils/objectId.js';

const objectIdString = z
  .string()
  .trim()
  .refine(isValidObjectId, 'Invalid ObjectId format.');

const isoDateTimeSchema = z.preprocess(
  (val) => (typeof val === 'string' || val instanceof Date ? new Date(val) : val),
  z.date({ invalid_type_error: 'Invalid timestamp.' })
);

export const createActivitySchema = z
  .object({
    title: z
      .string({ required_error: 'Activity title is required.' })
      .trim()
      .min(2, 'Activity title must be at least 2 characters.')
      .max(140, 'Activity title cannot exceed 140 characters.'),
    description: z.string().trim().max(1000).optional().default(''),
    location: z.string().trim().max(200).optional().default(''),
    category: z.enum(ACTIVITY_CATEGORIES).optional().default('sightseeing'),
    startAt: isoDateTimeSchema,
    endAt: isoDateTimeSchema,
    status: z.enum(ACTIVITY_STATUSES).optional().default('planned'),
    assignedParticipantIds: z.array(objectIdString).optional().default([]),
    linkedExpenseId: objectIdString.nullable().optional().default(null),
    plannedCostMinor: z
      .number()
      .int('Planned cost must be an integer in paise.')
      .positive('Planned cost must be greater than zero.')
      .optional()
      .nullable(),
  })
  .refine((data) => data.endAt.getTime() > data.startAt.getTime(), {
    message: 'Activity end time must be strictly after start time.',
    path: ['endAt'],
  });

export const updateActivitySchema = z
  .object({
    title: z.string().trim().min(2).max(140).optional(),
    description: z.string().trim().max(1000).optional(),
    location: z.string().trim().max(200).optional(),
    category: z.enum(ACTIVITY_CATEGORIES).optional(),
    startAt: isoDateTimeSchema.optional(),
    endAt: isoDateTimeSchema.optional(),
    status: z.enum(ACTIVITY_STATUSES).optional(),
    assignedParticipantIds: z.array(objectIdString).optional(),
    linkedExpenseId: objectIdString.nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return data.endAt.getTime() > data.startAt.getTime();
      }
      return true;
    },
    {
      message: 'Activity end time must be strictly after start time.',
      path: ['endAt'],
    }
  );

export const activityQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date filter must be YYYY-MM-DD.')
    .optional(),
  status: z.enum(ACTIVITY_STATUSES).optional(),
  category: z.enum(ACTIVITY_CATEGORIES).optional(),
});

