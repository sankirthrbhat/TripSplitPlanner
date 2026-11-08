import { Booking } from '../models/Booking.model.js';
import { Expense } from '../models/Expense.model.js';
import { computeEqualShares } from '../services/expense.service.js';
import { assertTripMembers, getTripMemberIdSet } from '../services/tripMember.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertObjectId } from '../utils/objectId.js';

const BOOKING_TO_EXPENSE_CATEGORY = {
  accommodation: 'accommodation',
  transportation: 'transport',
  activities: 'activities',
  other: 'misc',
};

export const listBookings = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const query = req.validatedQuery || {};

  const filter = { tripId: trip._id };
  if (query.category) filter.category = query.category;
  if (query.status) filter.status = query.status;

  const bookings = await Booking.find(filter)
    .populate('linkedExpenseId', 'title amountMinor status currency paidByUserId')
    .sort({ startAt: 1, createdAt: -1 });

  return res.status(200).json({
    success: true,
    data: {
      bookings: bookings.map((b) => b.toJSON()),
    },
  });
});

export const createBooking = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const {
    title,
    provider,
    category,
    startAt,
    endAt,
    status,
    referenceNumber,
    url,
    notes,
    linkedExpenseId,
    costMinor,
    costStatus,
    paidByUserId,
  } = req.body;

  let resolvedExpenseId = linkedExpenseId || null;
  if (resolvedExpenseId) {
    const existingExpense = await Expense.findOne({
      _id: resolvedExpenseId,
      tripId: trip._id,
    });
    if (!existingExpense) {
      throw new AppError(
        'Linked expense not found in this trip.',
        404,
        'EXPENSE_NOT_FOUND'
      );
    }
  }

  if (!resolvedExpenseId && costMinor && costMinor > 0 && costStatus === 'paid') {
    if (!paidByUserId) {
      throw new AppError(
        'paidByUserId is required when creating a booking with a paid expense.',
        400,
        'PAID_BY_REQUIRED'
      );
    }
    assertTripMembers(trip, [paidByUserId], 'Payer');
  }

  const booking = await Booking.create({
    tripId: trip._id,
    title,
    provider,
    category,
    startAt: startAt ?? null,
    endAt: endAt ?? null,
    status,
    referenceNumber,
    url,
    notes,
    linkedExpenseId: resolvedExpenseId,
    createdBy: req.user._id,
  });

  if (!resolvedExpenseId && costMinor && costMinor > 0) {
    const memberIds = [...getTripMemberIdSet(trip)];
    const participantShares = computeEqualShares(costMinor, memberIds, memberIds);

    const expense = await Expense.create({
      tripId: trip._id,
      title: `${title} (${provider})`,
      description: `Authoritative ledger entry for booking "${title}"`,
      amountMinor: costMinor,
      currency: trip.currency || 'INR',
      category: BOOKING_TO_EXPENSE_CATEGORY[category] || 'misc',
      status: costStatus || 'planned',
      paidByUserId: costStatus === 'paid' ? paidByUserId : null,
      expenseDate: startAt || new Date(),
      shareMode: 'equal',
      participantShares,
      linkedBookingId: booking._id,
      createdBy: req.user._id,
    });

    booking.linkedExpenseId = expense._id;
    await booking.save();
  }

  const populated = await Booking.findById(booking._id).populate(
    'linkedExpenseId',
    'title amountMinor status currency paidByUserId'
  );

  return res.status(201).json({
    success: true,
    data: {
      booking: populated.toJSON(),
    },
  });
});

export const updateBooking = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const { bookingId } = req.params;
  assertObjectId(bookingId, 'Booking ID');

  const booking = await Booking.findOne({ _id: bookingId, tripId: trip._id });
  if (!booking) {
    throw new AppError('Booking not found in this trip.', 404, 'BOOKING_NOT_FOUND');
  }

  const updates = req.body;
  const nextStart =
    updates.startAt !== undefined ? updates.startAt : booking.startAt;
  const nextEnd = updates.endAt !== undefined ? updates.endAt : booking.endAt;

  if (nextStart && nextEnd && new Date(nextEnd).getTime() < new Date(nextStart).getTime()) {
    throw new AppError(
      'Booking end date/time cannot be before start date/time.',
      400,
      'INVALID_DATE_RANGE'
    );
  }

  if (updates.linkedExpenseId !== undefined && updates.linkedExpenseId !== null) {
    const existingExpense = await Expense.findOne({
      _id: updates.linkedExpenseId,
      tripId: trip._id,
    });
    if (!existingExpense) {
      throw new AppError(
        'Linked expense not found in this trip.',
        404,
        'EXPENSE_NOT_FOUND'
      );
    }
  }

  const allowedFields = [
    'title',
    'provider',
    'category',
    'startAt',
    'endAt',
    'status',
    'referenceNumber',
    'url',
    'notes',
    'linkedExpenseId',
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      booking[field] = updates[field];
    }
  }

  await booking.save();

  const populated = await Booking.findById(booking._id).populate(
    'linkedExpenseId',
    'title amountMinor status currency paidByUserId'
  );

  return res.status(200).json({
    success: true,
    data: {
      booking: populated.toJSON(),
    },
  });
});

export const deleteBooking = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const { bookingId } = req.params;
  assertObjectId(bookingId, 'Booking ID');

  const booking = await Booking.findOneAndDelete({
    _id: bookingId,
    tripId: trip._id,
  });

  if (!booking) {
    throw new AppError('Booking not found in this trip.', 404, 'BOOKING_NOT_FOUND');
  }

  await Expense.updateMany(
    { tripId: trip._id, linkedBookingId: booking._id },
    { $set: { linkedBookingId: null } }
  );

  return res.status(200).json({
    success: true,
    data: {
      deletedBookingId: String(booking._id),
    },
  });
});

