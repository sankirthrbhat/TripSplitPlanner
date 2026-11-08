import { z } from 'zod';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_SHARE_MODES,
  EXPENSE_STATUSES,
} from '../models/Expense.model.js';
import { isValidObjectId } from '../utils/objectId.js';

const objectIdString = z
  .string()
  .trim()
  .refine(isValidObjectId, 'Invalid ObjectId format.');

const optionalDateSchema = z.preprocess((val) => {
  if (val === undefined || val === null || val === '') return new Date();
  return new Date(val);
}, z.date({ error: 'Invalid expense date.' }));

const customShareEntrySchema = z.object({
  userId: objectIdString,
  shareMinor: z
    .number({ error: 'Share amount must be a number in paise.' })
    .int('Share amount must be an integer in paise.')
    .min(0, 'Share amount cannot be negative.'),
});

export const createExpenseSchema = z
  .object({
    title: z
      .string({ error: (issue) => issue.input === undefined ? 'Expense title is required.' : undefined })
      .trim()
      .min(2, 'Expense title must be at least 2 characters.')
      .max(140),
    description: z.string().trim().max(1000).optional().default(''),
    amountMinor: z
      .number({
        error: (issue) => issue.input === undefined
          ? 'Expense amount is required.'
          : 'Expense amount must be a number in paise.',
      })
      .int('Expense amount must be an integer in paise (no fractional paise).')
      .positive('Expense amount must be greater than zero.')
      .max(10000000000, 'Expense amount exceeds maximum supported value.'),
    currency: z.enum(['INR']).default('INR'),
    category: z.enum(EXPENSE_CATEGORIES).default('misc'),
    status: z.enum(EXPENSE_STATUSES).default('planned'),
    paidByUserId: objectIdString.nullable().optional().default(null),
    expenseDate: optionalDateSchema.optional(),
    shareMode: z.enum(EXPENSE_SHARE_MODES).default('equal'),
    participantIds: z.array(objectIdString).optional(),
    customShares: z.array(customShareEntrySchema).optional(),
    linkedActivityId: objectIdString.nullable().optional().default(null),
    linkedBookingId: objectIdString.nullable().optional().default(null),
  })
  .superRefine((data, ctx) => {
    if (data.status === 'paid' && !data.paidByUserId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paidByUserId'],
        message: 'paidByUserId is required when expense status is paid.',
      });
    }
    if (data.shareMode === 'equal') {
      if (!Array.isArray(data.participantIds) || data.participantIds.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['participantIds'],
          message: 'Select at least one participant for equal splitting.',
        });
      }
    } else if (data.shareMode === 'custom') {
      if (!Array.isArray(data.customShares) || data.customShares.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['customShares'],
          message: 'Provide custom participant shares for custom splitting.',
        });
      }
    }
  });

export const updateExpenseSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().max(1000).optional(),
  amountMinor: z
    .number({ error: 'Expense amount must be a number in paise.' })
    .int('Expense amount must be an integer in paise.')
    .positive('Expense amount must be greater than zero.')
    .max(10000000000)
    .optional(),
  currency: z.enum(['INR']).optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  status: z.enum(EXPENSE_STATUSES).optional(),
  paidByUserId: objectIdString.nullable().optional(),
  expenseDate: optionalDateSchema.optional(),
  shareMode: z.enum(EXPENSE_SHARE_MODES).optional(),
  participantIds: z.array(objectIdString).optional(),
  customShares: z.array(customShareEntrySchema).optional(),
  linkedActivityId: objectIdString.nullable().optional(),
  linkedBookingId: objectIdString.nullable().optional(),
});

export const simulateExpenseSchema = z.object({
  expenseId: objectIdString.nullable().optional().default(null),
  title: z.string().trim().max(140).optional().default('Simulated Expense'),
  amountMinor: z
    .number()
    .int('Simulated amount must be an integer in paise.')
    .positive('Simulated amount must be greater than zero.'),
  shareMode: z.enum(EXPENSE_SHARE_MODES).default('equal'),
  participantIds: z.array(objectIdString).optional(),
  customShares: z.array(customShareEntrySchema).optional(),
});

export const expenseQuerySchema = z.object({
  status: z.enum(EXPENSE_STATUSES).optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
});

