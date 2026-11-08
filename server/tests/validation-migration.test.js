import { describe, expect, it } from 'vitest';
import { registerSchema } from '../src/validators/auth.validator.js';
import { createTripSchema } from '../src/validators/trip.validator.js';
import { createExpenseSchema, updateExpenseSchema } from '../src/validators/expense.validator.js';
import { updateTaskSchema } from '../src/validators/task.validator.js';
import { validateBody } from '../src/middleware/validate.middleware.js';

describe('Validation contracts after the Zod 4 security upgrade', () => {
  const memberId = '507f1f77bcf86cd799439011';
  const expense = { title: 'Travel', amountMinor: 10000, participantIds: [memberId] };

  it('keeps actionable missing-field messages in the API error envelope', () => {
    let error;
    validateBody(registerSchema)({ body: {} }, {}, (err) => { error = err; });
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Display name is required.');
    expect(error.details.fields.email).toContain('Email is required.');
    expect(error.details.fields.password).toContain('Password is required.');
  });

  it('preserves money validation messages for missing and string amounts', () => {
    const missing = { ...expense };
    delete missing.amountMinor;
    expect(createExpenseSchema.safeParse(missing).error.issues[0].message)
      .toBe('Expense amount is required.');
    expect(createExpenseSchema.safeParse({ ...expense, amountMinor: '10000' }).error.issues[0].message)
      .toBe('Expense amount must be a number in paise.');
  });

  it('rejects fractional paise while applying valid creation defaults', () => {
    expect(createExpenseSchema.safeParse({ ...expense, amountMinor: 100.5 }).success).toBe(false);
    const valid = createExpenseSchema.parse(expense);
    expect(valid.status).toBe('planned');
    expect(valid.shareMode).toBe('equal');
    expect(valid.paidByUserId).toBeNull();
  });

  it('does not overwrite dates on partial task or expense updates', () => {
    expect(updateTaskSchema.parse({ status: 'done' })).not.toHaveProperty('dueDate');
    expect(updateExpenseSchema.parse({ title: 'Updated travel' })).not.toHaveProperty('expenseDate');
    expect(updateTaskSchema.parse({ dueDate: null }).dueDate).toBeNull();
  });

  it('coerces trip dates and still rejects a reversed range', () => {
    const trip = { title: 'Coorg', destination: 'Coorg', startDate: '2026-12-02', endDate: '2026-12-03' };
    expect(createTripSchema.parse(trip).startDate).toBeInstanceOf(Date);
    expect(createTripSchema.safeParse({ ...trip, endDate: '2026-12-01' }).success).toBe(false);
    expect(createTripSchema.safeParse({ ...trip, startDate: 'not-a-date' }).success).toBe(false);
  });

  it('keeps dependent paid-expense and participant checks active', () => {
    const paid = createExpenseSchema.safeParse({ ...expense, status: 'paid' });
    expect(paid.success).toBe(false);
    expect(paid.error.issues.some((issue) => issue.path[0] === 'paidByUserId')).toBe(true);
    expect(createExpenseSchema.safeParse({ ...expense, participantIds: [] }).success).toBe(false);
  });
});
