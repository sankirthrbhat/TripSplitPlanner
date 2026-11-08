import { Activity } from '../models/Activity.model.js';
import { Booking } from '../models/Booking.model.js';
import { Expense } from '../models/Expense.model.js';
import { Invitation } from '../models/Invitation.model.js';
import { Task } from '../models/Task.model.js';
import { Trip } from '../models/Trip.model.js';
import { detectScheduleConflicts } from '../services/conflict.service.js';
import { getHydratedTripMembers } from '../services/tripMember.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertObjectId } from '../utils/objectId.js';

export const listTrips = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const trips = await Trip.find({
    $or: [{ ownerId: userId }, { 'members.userId': userId }],
  }).sort({ startDate: 1, createdAt: -1 });

  const enriched = await Promise.all(
    trips.map(async (trip) => {
      const [members, expenses, activities, tasks] = await Promise.all([
        getHydratedTripMembers(trip),
        Expense.find({ tripId: trip._id }).select('amountMinor status'),
        Activity.find({ tripId: trip._id, status: { $ne: 'cancelled' } }).select(
          'title startAt endAt status'
        ),
        Task.find({ tripId: trip._id }).select('status'),
      ]);

      const plannedMinor = expenses
        .filter((e) => e.status === 'planned')
        .reduce((s, e) => s + e.amountMinor, 0);
      const paidMinor = expenses
        .filter((e) => e.status === 'paid')
        .reduce((s, e) => s + e.amountMinor, 0);
      const conflictReport = detectScheduleConflicts(activities, trip.timezone);

      const completedTasks = tasks.filter((t) => t.status === 'done').length;

      return {
        ...trip.toJSON(),
        viewerRole: String(trip.ownerId) === String(userId) ? 'owner' : 'member',
        members,
        quickStats: {
          memberCount: members.length,
          estimatedTotalMinor: plannedMinor + paidMinor,
          paidTotalMinor: paidMinor,
          plannedTotalMinor: plannedMinor,
          activityCount: activities.length,
          conflictCount: conflictReport.conflictCount,
          taskCount: tasks.length,
          completedTaskCount: completedTasks,
        },
      };
    })
  );

  return res.status(200).json({
    success: true,
    data: {
      trips: enriched,
    },
  });
});

export const createTrip = asyncHandler(async (req, res) => {
  const {
    title,
    destination,
    description,
    startDate,
    endDate,
    timezone,
    currency,
    budgetLimitMinor,
  } = req.body;

  const trip = await Trip.create({
    title,
    destination,
    description,
    startDate,
    endDate,
    timezone,
    currency,
    budgetLimitMinor,
    ownerId: req.user._id,
    members: [
      {
        userId: req.user._id,
        role: 'owner',
        joinedAt: new Date(),
      },
    ],
  });

  const members = await getHydratedTripMembers(trip);

  return res.status(201).json({
    success: true,
    data: {
      trip: {
        ...trip.toJSON(),
        viewerRole: 'owner',
        members,
      },
    },
  });
});

export const getTrip = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const members = await getHydratedTripMembers(trip);

  return res.status(200).json({
    success: true,
    data: {
      trip: {
        ...trip.toJSON(),
        viewerRole: req.tripRole,
        members,
      },
    },
  });
});

export const updateTrip = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const updates = req.body;

  const nextStart = updates.startDate ? new Date(updates.startDate) : trip.startDate;
  const nextEnd = updates.endDate ? new Date(updates.endDate) : trip.endDate;

  if (nextEnd.getTime() < nextStart.getTime()) {
    throw new AppError(
      'Trip end date cannot be before start date.',
      400,
      'INVALID_DATE_RANGE'
    );
  }

  const allowedFields = [
    'title',
    'destination',
    'description',
    'startDate',
    'endDate',
    'timezone',
    'currency',
    'budgetLimitMinor',
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      trip[field] = updates[field];
    }
  }

  await trip.save();
  const members = await getHydratedTripMembers(trip);

  return res.status(200).json({
    success: true,
    data: {
      trip: {
        ...trip.toJSON(),
        viewerRole: req.tripRole,
        members,
      },
    },
  });
});

export const deleteTrip = asyncHandler(async (req, res) => {
  const tripId = req.trip._id;

  // Cascade delete all dependent records for this trip
  await Promise.all([
    Invitation.deleteMany({ tripId }),
    Activity.deleteMany({ tripId }),
    Booking.deleteMany({ tripId }),
    Task.deleteMany({ tripId }),
    Expense.deleteMany({ tripId }),
    Trip.findByIdAndDelete(tripId),
  ]);

  return res.status(200).json({
    success: true,
    data: {
      deletedTripId: String(tripId),
      message: 'Trip and all associated records deleted permanently.',
    },
  });
});

export const listTripMembers = asyncHandler(async (req, res) => {
  const members = await getHydratedTripMembers(req.trip);
  return res.status(200).json({
    success: true,
    data: {
      members,
    },
  });
});

export const removeTripMember = asyncHandler(async (req, res) => {
  const { memberUserId } = req.params;
  assertObjectId(memberUserId, 'Member User ID');

  const trip = req.trip;
  if (String(trip.ownerId) === String(memberUserId)) {
    throw new AppError(
      'The trip owner cannot be removed from the trip.',
      400,
      'CANNOT_REMOVE_OWNER'
    );
  }

  const isMember = trip.members.some((m) => String(m.userId) === String(memberUserId));
  if (!isMember) {
    throw new AppError('User is not a member of this trip.', 404, 'MEMBER_NOT_FOUND');
  }

  // Prevent silent corruption of historical financial records
  const linkedExpenseCount = await Expense.countDocuments({
    tripId: trip._id,
    $or: [
      { paidByUserId: memberUserId },
      { 'participantShares.userId': memberUserId },
    ],
  });

  if (linkedExpenseCount > 0) {
    throw new AppError(
      'Cannot remove a member who is part of existing trip expenses. Update or remove their expense shares first to preserve ledger integrity.',
      409,
      'MEMBER_HAS_FINANCIAL_RECORDS'
    );
  }

  // Remove member from trip and unassign from activities/tasks
  trip.members = trip.members.filter(
    (m) => String(m.userId) !== String(memberUserId)
  );
  await Promise.all([
    trip.save(),
    Activity.updateMany(
      { tripId: trip._id },
      { $pull: { assignedParticipantIds: memberUserId } }
    ),
    Task.deleteMany({ tripId: trip._id, assignedTo: memberUserId }),
  ]);

  const members = await getHydratedTripMembers(trip);

  return res.status(200).json({
    success: true,
    data: {
      members,
    },
  });
});

