import { describe, expect, it } from 'vitest';
import {
  annotateActivitiesWithConflicts,
  detectScheduleConflicts,
  doActivitiesOverlap,
  filterActivitiesByLocalDate,
} from '../src/services/conflict.service.js';

describe('Schedule Conflict Detection Engine', () => {
  it('1. returns no conflict for non-overlapping activities', () => {
    const activities = [
      {
        id: 'act-1',
        title: 'Morning Trek',
        startAt: '2026-12-12T03:00:00.000Z',
        endAt: '2026-12-12T05:00:00.000Z',
        status: 'planned',
      },
      {
        id: 'act-2',
        title: 'Afternoon Lunch',
        startAt: '2026-12-12T07:00:00.000Z',
        endAt: '2026-12-12T08:30:00.000Z',
        status: 'confirmed',
      },
    ];

    const report = detectScheduleConflicts(activities, 'Asia/Kolkata');
    expect(report.conflictCount).toBe(0);
    expect(report.conflicts).toHaveLength(0);
    expect(report.conflictingActivityIds).toEqual([]);
  });

  it('2. detects partial overlap between two activities', () => {
    const activities = [
      {
        id: 'act-1',
        title: 'Jeep Safari',
        startAt: '2026-12-12T10:00:00.000Z',
        endAt: '2026-12-12T12:00:00.000Z',
        status: 'planned',
      },
      {
        id: 'act-2',
        title: 'Sunset Point Walk',
        startAt: '2026-12-12T11:00:00.000Z',
        endAt: '2026-12-12T12:30:00.000Z',
        status: 'planned',
      },
    ];

    const report = detectScheduleConflicts(activities, 'Asia/Kolkata');
    expect(report.conflictCount).toBe(1);
    expect(report.conflictingActivityIds).toEqual(['act-1', 'act-2']);
    expect(report.conflicts[0].overlapMinutes).toBe(60);
  });

  it('3. detects fully contained overlap (one activity inside another)', () => {
    const activities = [
      {
        id: 'act-outer',
        title: 'Full Day Plantation Tour',
        startAt: '2026-12-12T04:00:00.000Z',
        endAt: '2026-12-12T12:00:00.000Z',
        status: 'confirmed',
      },
      {
        id: 'act-inner',
        title: 'Coffee Roasting Workshop',
        startAt: '2026-12-12T06:00:00.000Z',
        endAt: '2026-12-12T07:30:00.000Z',
        status: 'planned',
      },
    ];

    const report = detectScheduleConflicts(activities, 'Asia/Kolkata');
    expect(report.conflictCount).toBe(1);
    expect(report.conflicts[0].overlapMinutes).toBe(90);
    expect(report.conflictMap['act-outer'][0].conflictingActivityId).toBe('act-inner');
    expect(report.conflictMap['act-inner'][0].conflictingActivityId).toBe('act-outer');
  });

  it('4. detects identical time range conflict', () => {
    const activities = [
      {
        id: 'act-a',
        title: 'Kayaking Session',
        startAt: '2026-12-12T09:00:00.000Z',
        endAt: '2026-12-12T10:30:00.000Z',
        status: 'planned',
      },
      {
        id: 'act-b',
        title: 'Waterfall Hike',
        startAt: '2026-12-12T09:00:00.000Z',
        endAt: '2026-12-12T10:30:00.000Z',
        status: 'confirmed',
      },
    ];

    const report = detectScheduleConflicts(activities, 'Asia/Kolkata');
    expect(report.conflictCount).toBe(1);
    expect(report.conflicts[0].overlapMinutes).toBe(90);
  });

  it('5. treats touching endpoints (endAt === next startAt) as non-conflicting', () => {
    const activities = [
      {
        id: 'act-1',
        title: 'Drive to Madikeri',
        startAt: '2026-12-12T06:00:00.000Z',
        endAt: '2026-12-12T09:00:00.000Z',
        status: 'confirmed',
      },
      {
        id: 'act-2',
        title: 'Hotel Check-in',
        startAt: '2026-12-12T09:00:00.000Z',
        endAt: '2026-12-12T10:00:00.000Z',
        status: 'confirmed',
      },
    ];

    expect(doActivitiesOverlap(activities[0], activities[1])).toBe(false);
    const report = detectScheduleConflicts(activities, 'Asia/Kolkata');
    expect(report.conflictCount).toBe(0);
  });

  it('6. excludes cancelled activities from conflict detection', () => {
    const activities = [
      {
        id: 'act-active',
        title: 'River Rafting',
        startAt: '2026-12-12T05:00:00.000Z',
        endAt: '2026-12-12T08:00:00.000Z',
        status: 'confirmed',
      },
      {
        id: 'act-cancelled',
        title: 'Cancelled Zipline Tour',
        startAt: '2026-12-12T05:30:00.000Z',
        endAt: '2026-12-12T07:00:00.000Z',
        status: 'cancelled',
      },
    ];

    const report = detectScheduleConflicts(activities, 'Asia/Kolkata');
    expect(report.conflictCount).toBe(0);
  });

  it('7. handles overnight activities spanning midnight in trip timezone', () => {
    // 2026-12-12 22:30 IST (17:00 UTC) to 2026-12-13 01:30 IST (20:00 UTC)
    const overnight = {
      id: 'act-overnight',
      title: 'Stargazing & Campfire',
      startAt: '2026-12-12T17:00:00.000Z',
      endAt: '2026-12-12T20:00:00.000Z',
      status: 'planned',
    };
    // 2026-12-13 00:30 IST (19:00 UTC) to 2026-12-13 02:00 IST (20:30 UTC)
    const lateNight = {
      id: 'act-late',
      title: 'Midnight Forest Walk',
      startAt: '2026-12-12T19:00:00.000Z',
      endAt: '2026-12-12T20:30:00.000Z',
      status: 'planned',
    };

    const { activities: annotated, conflictReport } = annotateActivitiesWithConflicts(
      [overnight, lateNight],
      'Asia/Kolkata'
    );

    expect(conflictReport.conflictCount).toBe(1);
    expect(conflictReport.conflicts[0].overlapMinutes).toBe(60);

    // Overnight activity should appear on BOTH 2026-12-12 and 2026-12-13 in Asia/Kolkata
    const dec12 = filterActivitiesByLocalDate(annotated, '2026-12-12', 'Asia/Kolkata');
    const dec13 = filterActivitiesByLocalDate(annotated, '2026-12-13', 'Asia/Kolkata');
    expect(dec12.map((a) => a.id)).toContain('act-overnight');
    expect(dec13.map((a) => a.id)).toContain('act-overnight');
    expect(dec13.map((a) => a.id)).toContain('act-late');
  });

  it('8. excludes the same activity ID when checking updates', () => {
    const existing = {
      id: 'same-id-123',
      title: 'Original Slot',
      startAt: '2026-12-12T10:00:00.000Z',
      endAt: '2026-12-12T12:00:00.000Z',
      status: 'planned',
    };
    const updatedVersion = {
      id: 'same-id-123',
      title: 'Updated Slot',
      startAt: '2026-12-12T10:30:00.000Z',
      endAt: '2026-12-12T12:30:00.000Z',
      status: 'planned',
    };

    expect(doActivitiesOverlap(existing, updatedVersion)).toBe(false);
  });
});

