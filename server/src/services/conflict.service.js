import { AppError } from '../utils/AppError.js';

/**
 * Formats a Date in the specified IANA timezone as YYYY-MM-DD.
 */
export function getLocalDateString(dateInput, timeZone = 'Asia/Kolkata') {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Formats a Date range in the specified IANA timezone for human-readable conflict explanations.
 */
export function formatTimeRangeInTimezone(startAt, endAt, timeZone = 'Asia/Kolkata') {
  const start = startAt instanceof Date ? startAt : new Date(startAt);
  const end = endAt instanceof Date ? endAt : new Date(endAt);

  const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return `${dateTimeFormatter.format(start)} – ${dateTimeFormatter.format(end)} (${timeZone})`;
}

/**
 * Core overlap predicate:
 * Two non-cancelled activities overlap if and only if:
 *   activityA.id !== activityB.id
 *   AND activityA.startAt < activityB.endAt
 *   AND activityB.startAt < activityA.endAt
 *
 * Touching endpoints (activityA.endAt === activityB.startAt) are NOT overlaps.
 */
export function doActivitiesOverlap(activityA, activityB) {
  if (!activityA || !activityB) return false;

  const idA = String(activityA._id || activityA.id || '');
  const idB = String(activityB._id || activityB.id || '');
  if (idA && idB && idA === idB) {
    return false;
  }

  if (activityA.status === 'cancelled' || activityB.status === 'cancelled') {
    return false;
  }

  const startA = new Date(activityA.startAt).getTime();
  const endA = new Date(activityA.endAt).getTime();
  const startB = new Date(activityB.startAt).getTime();
  const endB = new Date(activityB.endAt).getTime();

  if (
    Number.isNaN(startA) ||
    Number.isNaN(endA) ||
    Number.isNaN(startB) ||
    Number.isNaN(endB)
  ) {
    return false;
  }

  if (startA >= endA || startB >= endB) {
    throw new AppError(
      'Activity startAt must be strictly before endAt.',
      400,
      'INVALID_ACTIVITY_TIME_RANGE'
    );
  }

  return startA < endB && startB < endA;
}

/**
 * Computes all schedule conflicts among a list of activities.
 */
export function detectScheduleConflicts(activities, timeZone = 'Asia/Kolkata') {
  const activeActivities = (activities || [])
    .filter((act) => act && act.status !== 'cancelled')
    .map((act) =>
      typeof act.toJSON === 'function'
        ? act.toJSON()
        : { ...act, id: String(act._id || act.id) }
    )
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const conflicts = [];
  const conflictMap = {};

  for (let i = 0; i < activeActivities.length; i += 1) {
    const actA = activeActivities[i];
    const idA = String(actA.id || actA._id);

    for (let j = i + 1; j < activeActivities.length; j += 1) {
      const actB = activeActivities[j];
      const idB = String(actB.id || actB._id);

      if (new Date(actB.startAt).getTime() >= new Date(actA.endAt).getTime()) {
        break;
      }

      if (doActivitiesOverlap(actA, actB)) {
        const startA = new Date(actA.startAt).getTime();
        const endA = new Date(actA.endAt).getTime();
        const startB = new Date(actB.startAt).getTime();
        const endB = new Date(actB.endAt).getTime();

        const overlapStartMs = Math.max(startA, startB);
        const overlapEndMs = Math.min(endA, endB);
        const overlapMinutes = Math.max(
          1,
          Math.round((overlapEndMs - overlapStartMs) / 60000)
        );

        const overlapStartAt = new Date(overlapStartMs).toISOString();
        const overlapEndAt = new Date(overlapEndMs).toISOString();

        const participantsA = new Set(
          (actA.assignedParticipantIds || []).map(String)
        );
        const sharedParticipantIds = (actB.assignedParticipantIds || [])
          .map(String)
          .filter((pid) => participantsA.has(pid));

        const explanation = `"${actA.title}" overlaps with "${actB.title}" for ${overlapMinutes} min (${formatTimeRangeInTimezone(
          overlapStartAt,
          overlapEndAt,
          timeZone
        )}).`;

        const conflictRecord = {
          id: `${idA}_${idB}`,
          activityA: {
            id: idA,
            title: actA.title,
            startAt: new Date(actA.startAt).toISOString(),
            endAt: new Date(actA.endAt).toISOString(),
            location: actA.location || '',
            category: actA.category,
          },
          activityB: {
            id: idB,
            title: actB.title,
            startAt: new Date(actB.startAt).toISOString(),
            endAt: new Date(actB.endAt).toISOString(),
            location: actB.location || '',
            category: actB.category,
          },
          overlapStartAt,
          overlapEndAt,
          overlapMinutes,
          sharedParticipantIds,
          explanation,
        };

        conflicts.push(conflictRecord);

        if (!conflictMap[idA]) conflictMap[idA] = [];
        if (!conflictMap[idB]) conflictMap[idB] = [];

        conflictMap[idA].push({
          conflictingActivityId: idB,
          title: actB.title,
          startAt: new Date(actB.startAt).toISOString(),
          endAt: new Date(actB.endAt).toISOString(),
          overlapMinutes,
          explanation,
        });

        conflictMap[idB].push({
          conflictingActivityId: idA,
          title: actA.title,
          startAt: new Date(actA.startAt).toISOString(),
          endAt: new Date(actA.endAt).toISOString(),
          overlapMinutes,
          explanation,
        });
      }
    }
  }

  const conflictingActivityIds = Object.keys(conflictMap);

  return {
    conflictCount: conflicts.length,
    conflictingActivityCount: conflictingActivityIds.length,
    conflictingActivityIds,
    conflicts,
    conflictMap,
  };
}

export function annotateActivitiesWithConflicts(
  activities,
  timeZone = 'Asia/Kolkata'
) {
  const report = detectScheduleConflicts(activities, timeZone);

  const annotated = (activities || []).map((act) => {
    const plain =
      typeof act.toJSON === 'function'
        ? act.toJSON()
        : { ...act, id: String(act._id || act.id) };
    const id = String(plain.id || plain._id);
    const activityConflicts = report.conflictMap[id] || [];

    return {
      ...plain,
      id,
      localStartDate: getLocalDateString(plain.startAt, timeZone),
      localEndDate: getLocalDateString(plain.endAt, timeZone),
      hasConflict: activityConflicts.length > 0,
      conflictingActivityIds: activityConflicts.map((c) => c.conflictingActivityId),
      conflicts: activityConflicts,
    };
  });

  return {
    activities: annotated,
    conflictReport: report,
  };
}

export function filterActivitiesByLocalDate(
  annotatedActivities,
  targetDateStr,
  timeZone = 'Asia/Kolkata'
) {
  if (!targetDateStr) return annotatedActivities;

  return annotatedActivities.filter((act) => {
    const startLocal =
      act.localStartDate || getLocalDateString(act.startAt, timeZone);
    const endLocal = act.localEndDate || getLocalDateString(act.endAt, timeZone);
    return startLocal <= targetDateStr && endLocal >= targetDateStr;
  });
}

