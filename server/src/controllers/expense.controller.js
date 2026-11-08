import { Activity } from '../models/Activity.model.js';
import { Booking } from '../models/Booking.model.js';
import { Expense } from '../models/Expense.model.js';
import {
  computeTripFinancialSummary,
  resolveExpenseShares,
  simulateExpenseImpact,
} from '../services/expense.service.js';
import {
  assertTripMembers,
  getHydratedTripMembers,
  getTripMemberIdSet,
} from '../services/tripMember.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertObjectId } from '../utils/objectId.js';

export const listExpenses = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const query = req.validatedQuery || {};

  const allExpenses = await Expense.find({ tripId: trip._id })
    .populate('paidByUserId', 'displayName email')
    .populate('participantShares.userId', 'displayName email')
    .populate('linkedActivityId', 'title startAt')
    .populate('linkedBookingId', 'title provider')
    .sort({ expenseDate: -1, createdAt: -1 });

  let filtered = allExpenses;
  if (query.status) {
    filtered = filtered.filter((e) => e.status === query.status);
  }
  if (query.category) {
    filtered = filtered.filter((e) => e.category === query.category);
  }

  const members = await getHydratedTripMembers(trip);

  // Compute authoritative summary from ALL trip expenses (using raw IDs)
  const rawExpenses = allExpenses.map((e) => ({
    ...e.toJSON(),
    paidByUserId: e.paidByUserId?._id ? String(e.paidByUserId._id) : e.paidByUserId ? String(e.paidByUserId) : null,
    participantShares: (e.participantShares || []).map((s) => ({
      userId: s.userId?._id ? String(s.userId._id) : String(s.userId),
      shareMinor: s.shareMinor,
    })),
  }));

  const financialSummary = computeTripFinancialSummary({
    trip,
    members,
    expenses: rawExpenses,
  });

  return res.status(200).json({
    success: true,
    data: {
      expenses: filtered.map((e) => e.toJSON()),
      financialSummary,
    },
  });
});

export const createExpense = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const {
    title,
    description,
    amountMinor,
    currency,
    category,
    status,
    paidByUserId,
    expenseDate,
    shareMode,
    participantIds,
    customShares,
    linkedActivityId,
    linkedBookingId,
  } = req.body;

  const tripMemberIds = [...getTripMemberIdSet(trip)];

  if (status === 'paid') {
    if (!paidByUserId) {
      throw new AppError(
        'paidByUserId is required when expense status is paid.',
        400,
        'PAID_BY_REQUIRED'
      );
    }
    assertTripMembers(trip, [paidByUserId], 'Payer');
  }

  if (linkedActivityId) {
    const act = await Activity.findOne({ _id: linkedActivityId, tripId: trip._id });
    if (!act) {
      throw new AppError('Linked activity not found in this trip.', 404, 'ACTIVITY_NOT_FOUND');
    }
  }

  if (linkedBookingId) {
    const book = await Booking.findOne({ _id: linkedBookingId, tripId: trip._id });
    if (!book) {
      throw new AppError('Linked booking not found in this trip.', 404, 'BOOKING_NOT_FOUND');
    }
  }

  const participantShares = resolveExpenseShares({
    amountMinor,
    shareMode,
    participantIds,
    customShares,
    tripMemberIds,
  });

  const expense = await Expense.create({
    tripId: trip._id,
    title,
    description,
    amountMinor,
    currency: currency || trip.currency || 'INR',
    category,
    status,
    paidByUserId: status === 'paid' ? paidByUserId : null,
    expenseDate: expenseDate || new Date(),
    shareMode,
    participantShares,
    linkedActivityId: linkedActivityId || null,
    linkedBookingId: linkedBookingId || null,
    createdBy: req.user._id,
  });

  if (linkedActivityId) {
    await Activity.updateOne(
      { _id: linkedActivityId, tripId: trip._id },
      { $set: { linkedExpenseId: expense._id } }
    );
  }
  if (linkedBookingId) {
    await Booking.updateOne(
      { _id: linkedBookingId, tripId: trip._id },
      { $set: { linkedExpenseId: expense._id } }
    );
  }

  const populated = await Expense.findById(expense._id)
    .populate('paidByUserId', 'displayName email')
    .populate('participantShares.userId', 'displayName email')
    .populate('linkedActivityId', 'title startAt')
    .populate('linkedBookingId', 'title provider');

  return res.status(201).json({
    success: true,
    data: {
      expense: populated.toJSON(),
    },
  });
});

export const updateExpense = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const { expenseId } = req.params;
  assertObjectId(expenseId, 'Expense ID');

  const expense = await Expense.findOne({ _id: expenseId, tripId: trip._id });
  if (!expense) {
    throw new AppError('Expense not found in this trip.', 404, 'EXPENSE_NOT_FOUND');
  }

  const updates = req.body;
  const tripMemberIds = [...getTripMemberIdSet(trip)];

  const nextStatus = updates.status !== undefined ? updates.status : expense.status;
  const nextPaidBy =
    nextStatus === 'planned'
      ? null
      : updates.paidByUserId !== undefined
        ? updates.paidByUserId
        : expense.paidByUserId;

  if (nextStatus === 'paid') {
    if (!nextPaidBy) {
      throw new AppError(
        'paidByUserId is required when expense status is paid.',
        400,
        'PAID_BY_REQUIRED'
      );
    }
    assertTripMembers(trip, [nextPaidBy], 'Payer');
  }

  const nextAmountMinor =
    updates.amountMinor !== undefined ? updates.amountMinor : expense.amountMinor;
  const nextShareMode =
    updates.shareMode !== undefined ? updates.shareMode : expense.shareMode;

  const amountOrSplitChanged =
    updates.amountMinor !== undefined ||
    updates.shareMode !== undefined ||
    updates.participantIds !== undefined ||
    updates.customShares !== undefined;

  if (amountOrSplitChanged) {
    if (nextShareMode === 'equal') {
      const targetParticipants =
        updates.participantIds ||
        expense.participantShares.map((s) => String(s.userId));
      expense.participantShares = resolveExpenseShares({
        amountMinor: nextAmountMinor,
        shareMode: 'equal',
        participantIds: targetParticipants,
        tripMemberIds,
      });
    } else {
      const targetCustomShares =
        updates.customShares ||
        expense.participantShares.map((s) => ({
          userId: String(s.userId),
          shareMinor: s.shareMinor,
        }));
      expense.participantShares = resolveExpenseShares({
        amountMinor: nextAmountMinor,
        shareMode: 'custom',
        customShares: targetCustomShares,
        tripMemberIds,
      });
    }
  }

  if (updates.title !== undefined) expense.title = updates.title;
  if (updates.description !== undefined) expense.description = updates.description;
  if (updates.currency !== undefined) expense.currency = updates.currency;
  if (updates.category !== undefined) expense.category = updates.category;
  if (updates.expenseDate !== undefined) expense.expenseDate = updates.expenseDate;
  expense.amountMinor = nextAmountMinor;
  expense.shareMode = nextShareMode;
  expense.status = nextStatus;
  expense.paidByUserId = nextPaidBy;

  if (updates.linkedActivityId !== undefined) {
    if (updates.linkedActivityId) {
      const act = await Activity.findOne({
        _id: updates.linkedActivityId,
        tripId: trip._id,
      });
      if (!act) {
        throw new AppError('Linked activity not found in this trip.', 404, 'ACTIVITY_NOT_FOUND');
      }
    }
    expense.linkedActivityId = updates.linkedActivityId;
  }

  if (updates.linkedBookingId !== undefined) {
    if (updates.linkedBookingId) {
      const book = await Booking.findOne({
        _id: updates.linkedBookingId,
        tripId: trip._id,
      });
      if (!book) {
        throw new AppError('Linked booking not found in this trip.', 404, 'BOOKING_NOT_FOUND');
      }
    }
    expense.linkedBookingId = updates.linkedBookingId;
  }

  await expense.save();

  const populated = await Expense.findById(expense._id)
    .populate('paidByUserId', 'displayName email')
    .populate('participantShares.userId', 'displayName email')
    .populate('linkedActivityId', 'title startAt')
    .populate('linkedBookingId', 'title provider');

  return res.status(200).json({
    success: true,
    data: {
      expense: populated.toJSON(),
    },
  });
});

export const deleteExpense = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const { expenseId } = req.params;
  assertObjectId(expenseId, 'Expense ID');

  const expense = await Expense.findOneAndDelete({
    _id: expenseId,
    tripId: trip._id,
  });

  if (!expense) {
    throw new AppError('Expense not found in this trip.', 404, 'EXPENSE_NOT_FOUND');
  }

  // Safely clear linkedExpenseId on any referencing Activity or Booking
  await Promise.all([
    Activity.updateMany(
      { tripId: trip._id, linkedExpenseId: expense._id },
      { $set: { linkedExpenseId: null } }
    ),
    Booking.updateMany(
      { tripId: trip._id, linkedExpenseId: expense._id },
      { $set: { linkedExpenseId: null } }
    ),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      deletedExpenseId: String(expense._id),
    },
  });
});

export const simulateExpense = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const [members, existingExpenses] = await Promise.all([
    getHydratedTripMembers(trip),
    Expense.find({ tripId: trip._id }),
  ]);

  const simulation = simulateExpenseImpact({
    trip,
    members,
    existingExpenses,
    simulationInput: req.body,
  });

  return res.status(200).json({
    success: true,
    data: {
      simulation,
    },
  });
});

