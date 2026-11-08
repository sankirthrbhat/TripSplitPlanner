/**
 * Computes transparent, rule-based Trip Pulse readiness indicators.
 * No fake AI predictions: every metric maps directly to verifiable trip data.
 *
 * Weighting (100 points total):
 * - Tasks completion: 25 pts
 * - Booking readiness: 25 pts
 * - Schedule health (zero conflicts): 25 pts
 * - Budget condition: 25 pts
 */
export function computeTripPulse({
  trip,
  tasks,
  bookings,
  activities,
  conflictReport,
  financialSummary,
}) {
  // 1. Task completion indicator
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const taskCompletionPercent =
    totalTasks === 0 ? 100 : Math.round((doneTasks / totalTasks) * 100);
  const taskScore = Math.round((taskCompletionPercent / 100) * 25);
  const taskState =
    totalTasks === 0
      ? 'neutral'
      : doneTasks === totalTasks
        ? 'healthy'
        : taskCompletionPercent >= 50
          ? 'attention'
          : 'warning';

  // 2. Booking readiness indicator (excludes cancelled bookings)
  const activeBookings = bookings.filter((b) => b.status !== 'cancelled');
  const confirmedBookings = activeBookings.filter((b) => b.status === 'confirmed').length;
  const bookingReadinessPercent =
    activeBookings.length === 0
      ? 100
      : Math.round((confirmedBookings / activeBookings.length) * 100);
  const bookingScore = Math.round((bookingReadinessPercent / 100) * 25);
  const bookingState =
    activeBookings.length === 0
      ? 'neutral'
      : confirmedBookings === activeBookings.length
        ? 'healthy'
        : confirmedBookings > 0
          ? 'attention'
          : 'warning';

  // 3. Schedule conflict indicator
  const activeActivitiesCount = activities.filter((a) => a.status !== 'cancelled').length;
  const conflictCount = conflictReport.conflictCount || 0;
  const scheduleScore =
    conflictCount === 0 ? 25 : Math.max(0, 25 - conflictCount * 10);
  const scheduleState =
    conflictCount === 0
      ? activeActivitiesCount === 0
        ? 'neutral'
        : 'healthy'
      : 'warning';

  // 4. Budget condition indicator
  const hasBudget = Boolean(trip?.budgetLimitMinor && trip.budgetLimitMinor > 0);
  const estimatedMinor = financialSummary.tripTotalEstimatedMinor || 0;
  const budgetLimitMinor = Number(trip?.budgetLimitMinor || 0);

  let budgetScore = 25;
  let budgetState = 'neutral';
  let budgetLabel = 'No budget cap set';

  if (hasBudget) {
    const ratio = estimatedMinor / budgetLimitMinor;
    if (ratio <= 0.9) {
      budgetScore = 25;
      budgetState = 'healthy';
      budgetLabel = 'Comfortably within budget';
    } else if (ratio <= 1.0) {
      budgetScore = 20;
      budgetState = 'attention';
      budgetLabel = 'Approaching budget limit';
    } else {
      const overPercent = Math.round((ratio - 1) * 100);
      budgetScore = Math.max(0, 20 - overPercent);
      budgetState = 'warning';
      budgetLabel = `Over budget by ${overPercent}%`;
    }
  }

  const overallScore = Math.min(
    100,
    Math.max(0, taskScore + bookingScore + scheduleScore + budgetScore)
  );

  const overallStatus =
    conflictCount > 0 || budgetState === 'warning'
      ? 'needs_attention'
      : overallScore >= 85
        ? 'ready'
        : 'in_progress';

  return {
    overallScore,
    overallStatus,
    indicators: {
      tasks: {
        total: totalTasks,
        completed: doneTasks,
        pending: totalTasks - doneTasks,
        percent: taskCompletionPercent,
        score: taskScore,
        maxScore: 25,
        state: taskState,
      },
      bookings: {
        totalActive: activeBookings.length,
        confirmed: confirmedBookings,
        tentative: activeBookings.length - confirmedBookings,
        percent: bookingReadinessPercent,
        score: bookingScore,
        maxScore: 25,
        state: bookingState,
      },
      schedule: {
        activeActivities: activeActivitiesCount,
        conflictCount,
        conflictingActivityCount: conflictReport.conflictingActivityCount || 0,
        score: scheduleScore,
        maxScore: 25,
        state: scheduleState,
      },
      budget: {
        hasBudget,
        budgetLimitMinor,
        estimatedTotalMinor: estimatedMinor,
        utilizationPercent: financialSummary.budgetUtilizationPercent,
        isOverBudget: financialSummary.isOverBudget,
        label: budgetLabel,
        score: budgetScore,
        maxScore: 25,
        state: budgetState,
      },
    },
  };
}

