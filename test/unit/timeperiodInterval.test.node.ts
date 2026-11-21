import moment from 'moment';

import {
  EXACT_HOURLY_MAX_MS,
  MAX_INTERVAL_MS,
  exactBucketLabels,
  exactIntervalReadable,
  exactIntervalToTimeperiod,
  formatExactInterval,
  formatInstant,
  hourlyLabels,
  instantToWall,
  isExactTimeperiod,
  parseExactInterval,
  shiftExactInterval,
  timeperiodsExactDaysOfPeriod,
  timeperiodsForBarchart,
  timeperiodsHoursOfPeriod,
  wallTimeInstants,
} from '~/util/timeperiod';

const UTC = '2026-10-20T13:00:00Z';
const UTC_END = '2026-10-20T14:00:00Z';

describe('parseExactInterval', () => {
  test('parses a valid UTC interval', () => {
    expect(parseExactInterval(`${UTC}..${UTC_END}`)).toEqual({ start: UTC, end: UTC_END });
  });

  test('parses a valid interval in the local timezone', () => {
    const instants = wallTimeInstants('2026-10-20T13:00:00');
    expect(instants.length).toBeGreaterThanOrEqual(1);
    const endInstants = wallTimeInstants('2026-10-20T14:00:00');
    expect(endInstants.length).toBeGreaterThanOrEqual(1);
    const interval = parseExactInterval(`${instants[0]}..${endInstants[0]}`);
    expect(interval).not.toBeNull();
    expect(exactIntervalToTimeperiod(interval as NonNullable<typeof interval>).length).toEqual([
      3600000,
      'milliseconds',
    ]);
  });

  test('rejects an inverted interval', () => {
    expect(parseExactInterval(`${UTC_END}..${UTC}`)).toBeNull();
  });

  test('rejects a zero-length interval', () => {
    expect(parseExactInterval(`${UTC}..${UTC}`)).toBeNull();
  });

  test('rejects missing or malformed segments', () => {
    expect(parseExactInterval(undefined)).toBeNull();
    expect(parseExactInterval(null)).toBeNull();
    expect(parseExactInterval('')).toBeNull();
    expect(parseExactInterval(`${UTC}`)).toBeNull();
    expect(parseExactInterval(`${UTC}/${UTC_END}`)).toBeNull();
    expect(parseExactInterval('garbage..garbage')).toBeNull();
  });

  test('rejects a bare date without a time', () => {
    expect(parseExactInterval('2026-10-20..2026-10-21')).toBeNull();
  });

  test('rejects an interval without a timezone offset', () => {
    expect(parseExactInterval('2026-10-20T13:00:00..2026-10-20T14:00:00')).toBeNull();
  });

  test('rejects an impossible date or time', () => {
    expect(parseExactInterval('2026-02-30T13:00:00Z..2026-03-01T13:00:00Z')).toBeNull();
    expect(parseExactInterval('2026-13-01T13:00:00Z..2026-13-02T13:00:00Z')).toBeNull();
    expect(parseExactInterval('2026-10-20T24:00:00Z..2026-10-20T25:00:00Z')).toBeNull();
  });

  test('rejects an interval longer than MAX_INTERVAL_MS', () => {
    const tooLong = moment(UTC)
      .add(MAX_INTERVAL_MS + 1, 'milliseconds')
      .toISOString();
    expect(parseExactInterval(`${UTC}..${tooLong}`)).toBeNull();
  });

  test('round-trips through formatExactInterval', () => {
    const interval = parseExactInterval(`${UTC}..${UTC_END}`);
    expect(interval).not.toBeNull();
    expect(
      parseExactInterval(formatExactInterval(interval as NonNullable<typeof interval>))
    ).toEqual(interval);
  });
});

describe('exactIntervalToTimeperiod / isExactTimeperiod', () => {
  test('keeps exact instants and elapsed milliseconds', () => {
    const tp = exactIntervalToTimeperiod({ start: UTC, end: UTC_END });
    expect(moment(tp.start).valueOf()).toBe(moment(UTC).valueOf());
    expect(tp.length).toEqual([3600000, 'milliseconds']);
    expect(isExactTimeperiod(tp)).toBe(true);
    expect(isExactTimeperiod({ start: UTC, length: [1, 'day'] })).toBe(false);
  });
});

describe('shiftExactInterval', () => {
  test('shifts both bounds by the elapsed duration in both directions', () => {
    const interval = { start: UTC, end: UTC_END };
    expect(shiftExactInterval(interval, 1)).toEqual({
      start: UTC_END,
      end: '2026-10-20T15:00:00Z',
    });
    expect(shiftExactInterval(interval, -1)).toEqual({
      start: '2026-10-20T12:00:00Z',
      end: UTC,
    });
  });
});

describe('wallTimeInstants / instantToWall', () => {
  test('returns one instant for a normal wall time', () => {
    const instants = wallTimeInstants('2026-10-20T13:00:00');
    expect(instants).toHaveLength(1);
    expect(instantToWall(instants[0])).toBe('2026-10-20T13:00:00');
  });

  test('rejects an impossible wall time', () => {
    expect(wallTimeInstants('2026-02-30T13:00:00')).toEqual([]);
    expect(wallTimeInstants('garbage')).toEqual([]);
  });

  test('returns two instants for the repeated fall-back hour where the zone observes it', () => {
    // America/New_York repeats 01:30 on 2026-11-01; in a fixed-zone CI it is one instant.
    const instants = wallTimeInstants('2026-11-01T01:30:00');
    expect(instants.length).toBeGreaterThanOrEqual(1);
    if (instants.length === 2) {
      expect(instantToWall(instants[0])).toBe('2026-11-01T01:30:00');
      expect(instantToWall(instants[1])).toBe('2026-11-01T01:30:00');
      expect(moment(instants[1]).valueOf()).toBeGreaterThan(moment(instants[0]).valueOf());
    }
  });
});

describe('exactIntervalReadable', () => {
  test('shows date and time on both ends when the interval crosses a day', () => {
    const start = '2026-10-20T23:30:00Z';
    const end = '2026-10-21T01:00:00Z';
    const tp = exactIntervalToTimeperiod({ start, end });
    const label = exactIntervalReadable(tp);
    expect(label).toContain(moment(start).format('YYYY-MM-DD'));
    expect(label).toContain(moment(end).format('YYYY-MM-DD'));
  });

  test('keeps the date on the start when the interval stays on one day', () => {
    const tp = exactIntervalToTimeperiod({ start: UTC, end: UTC_END });
    const label = exactIntervalReadable(tp);
    expect(label).toContain(moment(UTC).format('YYYY-MM-DD'));
  });
});

describe('timeperiodsHoursOfPeriod for exact intervals', () => {
  test('one hour is one bucket', () => {
    const periods = timeperiodsHoursOfPeriod({ start: UTC, length: [3600000, 'milliseconds'] });
    expect(periods).toHaveLength(1);
    expect(periods[0].length).toEqual([1, 'hour']);
  });

  test('clips the final hourly bucket and never rounds up', () => {
    const periods = timeperiodsHoursOfPeriod({
      start: '2026-10-20T13:15:00Z',
      length: [6300000, 'milliseconds'],
    });
    expect(periods).toHaveLength(2);
    expect(periods[0].length).toEqual([1, 'hour']);
    expect(periods[1].length[0]).toBeCloseTo(0.75);
  });

  test('exactly 24 elapsed hours is hourly; 24 buckets', () => {
    const periods = timeperiodsHoursOfPeriod({
      start: UTC,
      length: [24 * 3600000, 'milliseconds'],
    });
    expect(periods).toHaveLength(24);
  });

  test('an hour that repeats on fall-back gets an offset in its labels', () => {
    // America/New_York: fall back from 02:00 EDT to 01:00 EST on 2026-11-01.
    const tp = { start: '2026-11-01T00:30:00-04:00', length: [23, 'hour'] };
    const labels = hourlyLabels(tp);
    const repeated = labels.filter(l => l.startsWith('1 ('));
    expect(labels).toHaveLength(timeperiodsHoursOfPeriod(tp).length);
    if (repeated.length === 2) {
      expect(repeated[0]).not.toBe(repeated[1]);
      expect(labels).not.toContain('1');
    }
  });
});

describe('timeperiodsExactDaysOfPeriod', () => {
  test('splits a long exact interval into clipped day chunks', () => {
    const periods = timeperiodsExactDaysOfPeriod({
      start: '2026-10-20T13:00:00Z',
      length: [66 * 3600000, 'milliseconds'],
    });
    expect(periods).toHaveLength(3);
    expect(periods[0].length).toEqual([1, 'day']);
    expect(periods[1].length).toEqual([1, 'day']);
    expect(periods[2].length[1]).toBe('milliseconds');
    expect(periods[2].length[0]).toBeCloseTo(18 * 3600000);
  });

  test('keeps chunks contiguous without overlap', () => {
    const periods = timeperiodsExactDaysOfPeriod({
      start: '2026-10-20T13:00:00Z',
      length: [66 * 3600000, 'milliseconds'],
    });
    for (let i = 1; i < periods.length; i++) {
      expect(moment(periods[i].start).isSame(moment(periods[i - 1].start).add(1, 'day'))).toBe(
        true
      );
    }
    const lastEnd = moment(periods[2].start).add(periods[2].length[0], 'milliseconds');
    expect(lastEnd.valueOf()).toBe(moment('2026-10-23T07:00:00Z').valueOf());
  });
});

describe('timeperiodsForBarchart exact branches', () => {
  test('uses hourly buckets for an interval up to one elapsed day', () => {
    const periods = timeperiodsForBarchart({ start: UTC, length: [3600000, 'milliseconds'] });
    expect(periods).toHaveLength(1);
    expect(periods[0].length[1]).toBe('hour');
  });

  test('uses day chunks for a longer interval', () => {
    const periods = timeperiodsForBarchart({
      start: UTC,
      length: [EXACT_HOURLY_MAX_MS + 3600000, 'milliseconds'],
    });
    expect(periods.length).toBeGreaterThan(1);
    expect(periods[0].length[1]).toBe('day');
  });
});

describe('exactBucketLabels', () => {
  test('matches the bucket count for a short interval', () => {
    const tp = { start: UTC, length: [3600000, 'milliseconds'] };
    expect(exactBucketLabels(tp)).toHaveLength(timeperiodsForBarchart(tp).length);
  });

  test('uses chunk dates for a long interval', () => {
    const tp = { start: '2026-10-20T13:00:00Z', length: [66 * 3600000, 'milliseconds'] };
    const labels = exactBucketLabels(tp);
    expect(labels).toHaveLength(3);
    expect(labels[0]).toBe(moment('2026-10-20T13:00:00Z').format('YYYY-MM-DD HH:mm'));
  });
});

describe('formatInstant', () => {
  test('normalizes any offset to UTC', () => {
    expect(formatInstant('2026-10-20T13:00:00+02:00')).toBe('2026-10-20T11:00:00Z');
  });
});
