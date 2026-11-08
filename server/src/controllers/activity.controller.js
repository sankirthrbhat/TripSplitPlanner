import { Activity } from '../models/Activity.model.js';
import { Expense } from '../models/Expense.model.js';
import {
  annotateActivitiesWithConflicts,
  filterActivitiesByLocalDate,
} from '../services/conflict.service.js';
import { computeEqualShares } from '../services/expense.service.js';
import { assertTripMembers, getTripMemberIdSet } from '../services/tripMember.service.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { assertObjectId } from '../utils/objectId.js';

export const listActivities = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const query = req.validatedQuery || {};

  const allActivities = await Activity.find({ tripId: trip._id })
    .populate('linkedExpenseId', 'title amountMinor status currency')
    .sort({ startAt: 1, endAt: 1 });

  // Always detect conflicts across ALL trip activities before applying UI filters
  const { activities: annotated, conflictReport } = annotateActivitiesWithConflicts(
    allActivities,
    trip.timezone
  );

  let filtered = annotated;
  if (query.date) {
    filtered = filterActivitiesByLocalDate(filtered, query.date, trip.timezone);
  }
  if (query.status) {
    filtered = filtered.filter((a) => a.status === query.status);
  }
  if (query.category) {
    filtered = filtered.filter((a) => a.category === query.category);
  }

  return res.status(200).json({
    success: true,
    data: {
      activities: filtered,
      conflictReport,
    },
  });
});

export const createActivity = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const {
    title,
    description,
    location,
    category,
    startAt,
    endAt,
    status,
    assignedParticipantIds,
    linkedExpenseId,
    plannedCostMinor,
  } = req.body;

  if (assignedParticipantIds?.length) {
    assertTripMembers(trip, assignedParticipantIds, 'Assigned participant');
  }

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

  const activity = await Activity.create({
    tripId: trip._id,
    title,
    description,
    location,
    category,
    startAt,
    endAt,
    status,
    assignedParticipantIds: assignedParticipantIds || [],
    linkedExpenseId: resolvedExpenseId,
    createdBy: req.user._id,
  });

  // Optional single-ledger convenience: create one planned expense linked to this activity
  if (!resolvedExpenseId && plannedCostMinor && plannedCostMinor > 0) {
    const memberIds = [...getTripMemberIdSet(trip)];
    const splitTargetIds =
      assignedParticipantIds && assignedParticipantIds.length > 0
        ? assignedParticipantIds
        : memberIds;
    const participantShares = computeEqualShares(
      plannedCostMinor,
      splitTargetIds,
      memberIds
    );

    const createdExpense = await Expense.create({
      tripId: trip._id,
      title: `${title} (Activity)`,
      description: `Planned cost linked to itinerary activity "${title}"`,
      amountMinor: plannedCostMinor,
      currency: trip.currency || 'INR',
      category: 'activities',
      status: 'planned',
      paidByUserId: null,
      expenseDate: startAt,
      shareMode: 'equal',
      participantShares,
      linkedActivityId: activity._id,
      createdBy: req.user._id,
    });

    activity.linkedExpenseId = createdExpense._id;
    await activity.save();
  }

  const allActivities = await Activity.find({ tripId: trip._id })
    .populate('linkedExpenseId', 'title amountMinor status currency')
    .sort({ startAt: 1, endAt: 1 });

  const { activities: annotated, conflictReport } = annotateActivitiesWithConflicts(
    allActivities,
    trip.timezone
  );

  const createdAnnotated = annotated.find(
    (a) => String(a.id) === String(activity._id)
  );

  return res.status(201).json({
    success: true,
    data: {
      activity: createdAnnotated,
      conflictReport,
    },
  });
});

export const updateActivity = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const { activityId } = req.params;
  assertObjectId(activityId, 'Activity ID');

  const activity = await Activity.findOne({ _id: activityId, tripId: trip._id });
  if (!activity) {
    throw new AppError('Activity not found in this trip.', 404, 'ACTIVITY_NOT_FOUND');
  }

  const updates = req.body;
  const nextStart = updates.startAt ? new Date(updates.startAt) : activity.startAt;
  const nextEnd = updates.endAt ? new Date(updates.endAt) : activity.endAt;

  if (nextEnd.getTime() <= nextStart.getTime()) {
    throw new AppError(
      'Activity end time must be strictly after start time.',
      400,
      'INVALID_ACTIVITY_TIME_RANGE'
    );
  }

  if (updates.assignedParticipantIds !== undefined) {
    assertTripMembers(trip, updates.assignedParticipantIds, 'Assigned participant');
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
    'description',
    'location',
    'category',
    'startAt',
    'endAt',
    'status',
    'assignedParticipantIds',
    'linkedExpenseId',
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      activity[field] = updates[field];
    }
  }

  await activity.save();

  const allActivities = await Activity.find({ tripId: trip._id })
    .populate('linkedExpenseId', 'title amountMinor status currency')
    .sort({ startAt: 1, endAt: 1 });

  const { activities: annotated, conflictReport } = annotateActivitiesWithConflicts(
    allActivities,
    trip.timezone
  );

  const updatedAnnotated = annotated.find(
    (a) => String(a.id) === String(activity._id)
  );

  return res.status(200).json({
    success: true,
    data: {
      activity: updatedAnnotated,
      conflictReport,
    },
  });
});

export const deleteActivity = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const { activityId } = req.params;
  assertObjectId(activityId, 'Activity ID');

  const activity = await Activity.findOneAndDelete({
    _id: activityId,
    tripId: trip._id,
  });

  if (!activity) {
    throw new AppError('Activity not found in this trip.', 404, 'ACTIVITY_NOT_FOUND');
  }

  await Expense.updateMany(
    { tripId: trip._id, linkedActivityId: activity._id },
    { $set: { linkedActivityId: null } }
  );

  const remaining = await Activity.find({ tripId: trip._id }).sort({
    startAt: 1,
    endAt: 1,
  });
  const { conflictReport } = annotateActivitiesWithConflicts(
    remaining,
    trip.timezone
  );

  return res.status(200).json({
    success: true,
    data: {
      deletedActivityId: String(activity._id),
      conflictReport,
    },
  });
});

