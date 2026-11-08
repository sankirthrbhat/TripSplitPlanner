import { z } from 'zod';
import { TASK_PRIORITIES, TASK_STATUSES } from '../models/Task.model.js';
import { isValidObjectId } from '../utils/objectId.js';

const objectIdString = z
  .string()
  .trim()
  .refine(isValidObjectId, 'Invalid ObjectId format.');

const optionalDateSchema = z.preprocess((val) => {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  return new Date(val);
}, z.date({ invalid_type_error: 'Invalid due date.' }).nullable().optional());

export const createTaskSchema = z.object({
  title: z
    .string({ required_error: 'Task title is required.' })
    .trim()
    .min(2, 'Task title must be at least 2 characters.')
    .max(140),
  description: z.string().trim().max(1000).optional().default(''),
  assignedTo: objectIdString,
  dueDate: optionalDateSchema,
  priority: z.enum(TASK_PRIORITIES).optional().default('medium'),
  status: z.enum(TASK_STATUSES).optional().default('todo'),
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  description: z.string().trim().max(1000).optional(),
  assignedTo: objectIdString.optional(),
  dueDate: optionalDateSchema,
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
});

export const taskQuerySchema = z.object({
  assignedTo: objectIdString.optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueBefore: z.string().optional(),
});

