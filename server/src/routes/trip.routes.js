import { Router } from 'express';
import {
  createActivity,
  deleteActivity,
  listActivities,
  updateActivity,
} from '../controllers/activity.controller.js';
import {
  createBooking,
  deleteBooking,
  listBookings,
  updateBooking,
} from '../controllers/booking.controller.js';
import {
  createExpense,
  deleteExpense,
  listExpenses,
  simulateExpense,
  updateExpense,
} from '../controllers/expense.controller.js';
import {
  getTripConflicts,
  getTripSettlements,
  getTripSummary,
} from '../controllers/insight.controller.js';
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
} from '../controllers/invitation.controller.js';
import {
  createTask,
  deleteTask,
  listTasks,
  updateTask,
} from '../controllers/task.controller.js';
import {
  createTrip,
  deleteTrip,
  getTrip,
  listTripMembers,
  listTrips,
  removeTripMember,
  updateTrip,
} from '../controllers/trip.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  requireTripMember,
  requireTripOwner,
} from '../middleware/tripAccess.middleware.js';
import { validateBody, validateQuery } from '../middleware/validate.middleware.js';
import {
  activityQuerySchema,
  createActivitySchema,
  updateActivitySchema,
} from '../validators/activity.validator.js';
import {
  bookingQuerySchema,
  createBookingSchema,
  updateBookingSchema,
} from '../validators/booking.validator.js';
import {
  createExpenseSchema,
  expenseQuerySchema,
  simulateExpenseSchema,
  updateExpenseSchema,
} from '../validators/expense.validator.js';
import {
  createTaskSchema,
  taskQuerySchema,
  updateTaskSchema,
} from '../validators/task.validator.js';
import {
  createInvitationSchema,
  createTripSchema,
  updateTripSchema,
} from '../validators/trip.validator.js';

const router = Router();

// All trip routes require an authenticated user
router.use(requireAuth);

// Top-level trips
router.get('/', listTrips);
router.post('/', validateBody(createTripSchema), createTrip);

// Single trip operations (authorized members / owner)
router.get('/:tripId', requireTripMember, getTrip);
router.patch(
  '/:tripId',
  requireTripMember,
  requireTripOwner,
  validateBody(updateTripSchema),
  updateTrip
);
router.delete('/:tripId', requireTripMember, requireTripOwner, deleteTrip);

// Members
router.get('/:tripId/members', requireTripMember, listTripMembers);
router.delete(
  '/:tripId/members/:memberUserId',
  requireTripMember,
  requireTripOwner,
  removeTripMember
);

// Invitations (nested under trip)
router.get('/:tripId/invitations', requireTripMember, listInvitations);
router.post(
  '/:tripId/invitations',
  requireTripMember,
  requireTripOwner,
  validateBody(createInvitationSchema),
  createInvitation
);
router.delete(
  '/:tripId/invitations/:invitationId',
  requireTripMember,
  requireTripOwner,
  revokeInvitation
);

// Activities & schedule
router.get(
  '/:tripId/activities',
  requireTripMember,
  validateQuery(activityQuerySchema),
  listActivities
);
router.post(
  '/:tripId/activities',
  requireTripMember,
  validateBody(createActivitySchema),
  createActivity
);
router.patch(
  '/:tripId/activities/:activityId',
  requireTripMember,
  validateBody(updateActivitySchema),
  updateActivity
);
router.delete('/:tripId/activities/:activityId', requireTripMember, deleteActivity);

// Bookings
router.get(
  '/:tripId/bookings',
  requireTripMember,
  validateQuery(bookingQuerySchema),
  listBookings
);
router.post(
  '/:tripId/bookings',
  requireTripMember,
  validateBody(createBookingSchema),
  createBooking
);
router.patch(
  '/:tripId/bookings/:bookingId',
  requireTripMember,
  validateBody(updateBookingSchema),
  updateBooking
);
router.delete('/:tripId/bookings/:bookingId', requireTripMember, deleteBooking);

// Tasks & responsibilities
router.get(
  '/:tripId/tasks',
  requireTripMember,
  validateQuery(taskQuerySchema),
  listTasks
);
router.post(
  '/:tripId/tasks',
  requireTripMember,
  validateBody(createTaskSchema),
  createTask
);
router.patch(
  '/:tripId/tasks/:taskId',
  requireTripMember,
  validateBody(updateTaskSchema),
  updateTask
);
router.delete('/:tripId/tasks/:taskId', requireTripMember, deleteTask);

// Expenses & Budget Simulator
router.get(
  '/:tripId/expenses',
  requireTripMember,
  validateQuery(expenseQuerySchema),
  listExpenses
);
router.post(
  '/:tripId/expenses',
  requireTripMember,
  validateBody(createExpenseSchema),
  createExpense
);
router.post(
  '/:tripId/expenses/simulate',
  requireTripMember,
  validateBody(simulateExpenseSchema),
  simulateExpense
);
router.patch(
  '/:tripId/expenses/:expenseId',
  requireTripMember,
  validateBody(updateExpenseSchema),
  updateExpense
);
router.delete('/:tripId/expenses/:expenseId', requireTripMember, deleteExpense);

// Insights (summary, conflicts, settlements)
router.get('/:tripId/summary', requireTripMember, getTripSummary);
router.get('/:tripId/conflicts', requireTripMember, getTripConflicts);
router.get('/:tripId/settlements', requireTripMember, getTripSettlements);

export default router;

