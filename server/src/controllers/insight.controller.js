import { Activity } from '../models/Activity.model.js';
import { Booking } from '../models/Booking.model.js';
import { Expense } from '../models/Expense.model.js';
import { Task } from '../models/Task.model.js';
import { detectScheduleConflicts } from '../services/conflict.service.js';
import { computeTripFinancialSummary } from '../services/expense.service.js';
import { computeTripPulse } from '../services/pulse.service.js';
import { getHydratedTripMembers } from '../services/tripMember.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const getTripSummary = asyncHandler(async (req, res) => {
  const trip = req.trip;

  const [members, activities, bookings, tasks, expenses] = await Promise.all([
    getHydratedTripMembers(trip),
    Activity.find({ tripId: trip._id }).sort({ startAt: 1 }),
    Booking.find({ tripId: trip._id }).sort({ startAt: 1 }),
    Task.find({ tripId: trip._id })
      .populate('assignedTo', 'displayName email')
      .sort({ dueDate: 1 }),
    Expense.find({ tripId: trip._id }).sort({ expenseDate: -1 }),
  ]);

  const conflictReport = detectScheduleConflicts(activities, trip.timezone);
  const financialSummary = computeTripFinancialSummary({
    trip,
    members,
    expenses,
  });

  const pulse = computeTripPulse({
    trip,
    tasks,
    bookings,
    activities,
    conflictReport,
    financialSummary,
  });

  const now = Date.now();
  const nonCancelledActivities = activities
    .filter((a) => a.status !== 'cancelled')
    .map((a) => a.toJSON());

  const upcomingActivities = nonCancelledActivities
    .filter((a) => new Date(a.endAt).getTime() >= now)
    .slice(0, 5);

  const previewActivities =
    upcomingActivities.length > 0
      ? upcomingActivities
      : nonCancelledActivities.slice(0, 5);

  const outstandingTasks = tasks
    .filter((t) => t.status !== 'done')
    .slice(0, 5)
    .map((t) => t.toJSON());

  const bookingStats = {
    total: bookings.length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    tentative: bookings.filter((b) => b.status === 'tentative').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
  };

  return res.status(200).json({
    success: true,
    data: {
      trip: {
        ...trip.toJSON(),
        viewerRole: req.tripRole,
        members,
      },
      pulse,
      financialSummary,
      conflictReport,
      upcomingActivities: previewActivities,
      outstandingTasks,
      bookingStats,
      recentBookings: bookings.slice(0, 4).map((b) => b.toJSON()),
    },
  });
});

export const getTripConflicts = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const activities = await Activity.find({ tripId: trip._id }).sort({ startAt: 1 });
  const conflictReport = detectScheduleConflicts(activities, trip.timezone);

  return res.status(200).json({
    success: true,
    data: {
      timezone: trip.timezone,
      ...conflictReport,
    },
  });
});

export const getTripSettlements = asyncHandler(async (req, res) => {
  const trip = req.trip;
  const [members, expenses] = await Promise.all([
    getHydratedTripMembers(trip),
    Expense.find({ tripId: trip._id }),
  ]);

  const financialSummary = computeTripFinancialSummary({
    trip,
    members,
    expenses,
  });

  return res.status(200).json({
    success: true,
    data: {
      currency: financialSummary.currency,
      tripTotalPaidMinor: financialSummary.tripTotalPaidMinor,
      tripTotalPlannedMinor: financialSummary.tripTotalPlannedMinor,
      note: 'Settlements are computed strictly from PAID expenses. Planned expenses are excluded.',
      participantBalances: financialSummary.participantSummaries.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        email: p.email,
        totalPaidOutMinor: p.totalPaidOutMinor,
        paidShareMinor: p.paidShareMinor,
        netBalanceMinor: p.netBalanceMinor,
      })),
      settlements: financialSummary.settlements,
    },
  });
});

