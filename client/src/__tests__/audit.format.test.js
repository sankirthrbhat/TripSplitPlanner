import { describe, expect, it } from 'vitest';
import {
  formatINR,
  rupeesToPaise,
  utcIsoToZonedInput,
  zonedDateTimeToUtcIso,
} from '../utils/format';

/**
 * Audit: client-side money and timezone conversions run before anything reaches the API.
 */
describe('AUDIT: rupeesToPaise (no floating point drift)', () => {
  it.each([
    ['0', 0],
    ['1', 100],
    ['0.1', 10],
    ['0.10', 10],
    ['0.01', 1],
    ['1250.75', 125075],
    ['100.00', 10000],
    ['19.99', 1999],
    ['0.29', 29], // 0.29 * 100 === 28.999999999999996 in IEEE-754
    ['1.15', 115], // 1.15 * 100 === 114.99999999999999
    ['4.35', 435], // 4.35 * 100 === 434.99999999999994
    ['99999999.99', 9999999999],
    [' 42 ', 4200],
  ])('%s -> %d paise', (input, expected) => {
    expect(rupeesToPaise(input)).toBe(expected);
  });

  it.each(['', ' ', 'abc', '-5', '1.005', '1.', '.5', '1e3', '1,000', '₹100', '12.345', null, undefined, '--1', '0x10'])(
    'rejects %j',
    (input) => {
      expect(rupeesToPaise(input)).toBeNull();
    }
  );

  it('always produces a safe integer for any 2-decimal string', () => {
    for (let paise = 0; paise <= 20000; paise += 1) {
      const rupees = (paise / 100).toFixed(2);
      expect(rupeesToPaise(rupees)).toBe(paise);
    }
  });
});

describe('AUDIT: formatINR', () => {
  it('formats paise with Indian grouping and exactly 2 decimals', () => {
    expect(formatINR(125075)).toBe('₹1,250.75');
    expect(formatINR(10000000)).toBe('₹1,00,000.00');
    expect(formatINR(0)).toBe('₹0.00');
    expect(formatINR(3334)).toBe('₹33.34');
  });
});

describe('AUDIT: wall-clock <-> UTC conversion is independent of the browser timezone', () => {
  const cases = [
    ['Asia/Kolkata', '2026-12-19T09:00', '2026-12-19T03:30:00.000Z'],
    ['UTC', '2026-12-19T09:00', '2026-12-19T09:00:00.000Z'],
    ['America/New_York', '2026-12-19T09:00', '2026-12-19T14:00:00.000Z'], // EST (UTC-5)
    ['America/New_York', '2026-07-19T09:00', '2026-07-19T13:00:00.000Z'], // EDT (UTC-4)
    ['Europe/London', '2026-07-19T09:00', '2026-07-19T08:00:00.000Z'], // BST (UTC+1)
    ['Australia/Sydney', '2026-12-19T09:00', '2026-12-18T22:00:00.000Z'], // AEDT (UTC+11)
    ['Asia/Tokyo', '2026-12-19T00:00', '2026-12-18T15:00:00.000Z'],
    ['Asia/Kolkata', '2026-12-19T23:59', '2026-12-19T18:29:00.000Z'],
  ];

  it.each(cases)('%s %s -> %s', (tz, local, utc) => {
    expect(zonedDateTimeToUtcIso(local, tz)).toBe(utc);
    expect(utcIsoToZonedInput(utc, tz)).toBe(local);
  });

  it('overnight pair stays ordered across midnight in the trip timezone', () => {
    const start = zonedDateTimeToUtcIso('2026-12-19T22:00', 'Asia/Kolkata');
    const end = zonedDateTimeToUtcIso('2026-12-20T02:00', 'Asia/Kolkata');
    expect(new Date(end) - new Date(start)).toBe(4 * 3600 * 1000);
  });

  it('round-trips every 15 minutes across a DST-change week without drifting', () => {
    for (const tz of ['America/New_York', 'Europe/London', 'Australia/Sydney']) {
      for (let h = 0; h < 24 * 8; h += 1) {
        for (const m of [0, 15, 30, 45]) {
          const base = new Date(Date.UTC(2026, 10, 1, 0, 0) + h * 3600 * 1000 + m * 60 * 1000);
          const local = utcIsoToZonedInput(base, tz);
          const back = zonedDateTimeToUtcIso(local, tz);
          const backLocal = utcIsoToZonedInput(back, tz);
          // converting the rendered wall-clock back must render the same wall-clock
          expect(backLocal, `${tz} ${base.toISOString()}`).toBe(local);
        }
      }
    }
  });

  it('a non-existent spring-forward time resolves to a real instant (no NaN / throw)', () => {
    // 2026-03-08 02:30 does not exist in New York
    const iso = zonedDateTimeToUtcIso('2026-03-08T02:30', 'America/New_York');
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(zonedDateTimeToUtcIso('', 'UTC')).toBeNull();
    expect(zonedDateTimeToUtcIso('2026-12-19 09:00', 'UTC')).toBeNull();
    expect(zonedDateTimeToUtcIso('2026-12-19', 'UTC')).toBeNull();
    expect(utcIsoToZonedInput('garbage', 'UTC')).toBe('');
  });
});
