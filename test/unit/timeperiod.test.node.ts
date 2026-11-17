import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import 'moment/locale/de';

import {
  periodStartDate,
  timeperiodsForPeriod,
  parseDateRange,
  formatDateRange,
  dateRangeDays,
  shiftDateRange,
  dateRangeToTimeperiod,
  splitTimeperiodStrs,
  timeperiodsForBarchart,
  usesMonthlyBuckets,
  timeperiodsCalendarMonthsOfPeriod,
  MAX_DAILY_BUCKETS,
} from '~/util/timeperiod';
import { useSettingsStore } from '~/stores/settings';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('periodStartDate', () => {
  // 2026-10-02 is a Friday.
  it.each([
    ['Monday', 'week', '2026-09-28'],
    ['Sunday', 'week', '2026-09-27'],
    ['Saturday', 'week', '2026-09-26'],
    ['Monday', 'month', '2026-10-01'],
    ['Monday', 'year', '2026-01-01'],
    ['Monday', 'day', '2026-10-02'],
  ])('with weeks starting %s, snaps to the start of the %s', (startOfWeek, period, expected) => {
    useSettingsStore().startOfWeek = startOfWeek;
    expect(periodStartDate('2026-10-02', period)).toBe(expected);
  });

  it.each([
    ['Monday', '2026-09-28'],
    ['Sunday', '2026-09-27'],
    ['Saturday', '2026-09-26'],
  ])('keeps a date that is already the start of a %s week', (startOfWeek, date) => {
    useSettingsStore().startOfWeek = startOfWeek;
    expect(periodStartDate(date, 'week')).toBe(date);
  });

  it('does not depend on the moment locale', () => {
    useSettingsStore().startOfWeek = 'Sunday';
    const previousLocale = moment.locale();
    moment.locale('de'); // weeks start on Monday in the German locale
    try {
      expect(moment.locale()).toBe('de');
      expect(periodStartDate('2026-10-02', 'week')).toBe('2026-09-27');
    } finally {
      moment.locale(previousLocale);
    }
  });
});

// Use local timestamps (no offset) so the assertions are timezone-agnostic.
const at = (date: string) => moment(date).format();

describe('timeperiodsForPeriod', () => {
  test('splits a single day into hours', () => {
    const periods = timeperiodsForPeriod({ start: at('2024-01-01T04:00:00'), length: [1, 'day'] });

    expect(periods).toHaveLength(24);
    expect(periods[0].length).toEqual([1, 'hour']);
    expect(periods[23].start).toBe(at('2024-01-02T03:00:00'));
  });

  test('splits a week into days', () => {
    const periods = timeperiodsForPeriod({ start: at('2024-01-01T04:00:00'), length: [7, 'days'] });

    expect(periods).toHaveLength(7);
    expect(periods[0].length).toEqual([1, 'day']);
  });

  test('splits a year into months', () => {
    const periods = timeperiodsForPeriod({ start: at('2024-01-01T04:00:00'), length: [1, 'year'] });

    expect(periods).toHaveLength(12);
    expect(moment(periods[0].start).month()).toBe(0);
    expect(moment(periods[1].start).month()).toBe(1);

    const last = periods[periods.length - 1];
    const lastEnd = moment(last.start).add(last.length[0], 'day');
    expect(lastEnd.isSame(moment(at('2025-01-01T04:00:00')))).toBe(true);
  });

  test('splits a multi-year range into years', () => {
    const periods = timeperiodsForPeriod({
      start: at('2015-01-01T04:00:00'),
      length: [10, 'year'],
    });

    expect(periods).toHaveLength(10);
    expect(periods[0].length[0]).toBe(365);
  });

  test('keeps custom ranges within their bounds', () => {
    const start = moment('2024-01-15T04:00:00');
    const periods = timeperiodsForPeriod({ start: start.format(), length: [90, 'day'] });

    expect(periods.length).toBeGreaterThan(1);

    const last = periods[periods.length - 1];
    const lastEnd = moment(last.start).add(last.length[0], 'day');
    expect(lastEnd.isSame(start.clone().add(90, 'day'))).toBe(true);
  });
});

describe('parseDateRange', () => {
  test('parses a normal inclusive range', () => {
    expect(parseDateRange('2026-01-01..2026-01-07')).toEqual({
      start: '2026-01-01',
      end: '2026-01-07',
    });
  });

  test('parses a same-day range', () => {
    const range = parseDateRange('2026-03-15..2026-03-15');
    expect(range).toEqual({ start: '2026-03-15', end: '2026-03-15' });
    expect(dateRangeDays(range!)).toBe(1);
  });

  test('rejects an inverted range', () => {
    expect(parseDateRange('2026-03-15..2026-01-01')).toBeNull();
  });

  test('rejects invalid calendar dates (e.g. Feb 30)', () => {
    expect(parseDateRange('2026-02-30..2026-03-01')).toBeNull();
    expect(parseDateRange('2026-13-01..2026-13-02')).toBeNull();
  });

  test('rejects missing input and wrong shape', () => {
    expect(parseDateRange(undefined)).toBeNull();
    expect(parseDateRange(null)).toBeNull();
    expect(parseDateRange('')).toBeNull();
    expect(parseDateRange('2026-01-01')).toBeNull();
    expect(parseDateRange('2026-01-01/2026-01-07')).toBeNull();
    expect(parseDateRange('garbage..garbage')).toBeNull();
  });

  test('round-trips through formatDateRange', () => {
    const range = parseDateRange('2025-12-31..2026-01-05')!;
    expect(parseDateRange(formatDateRange(range))).toEqual(range);
  });
});

describe('dateRangeDays / shiftDateRange', () => {
  test('counts both ends, including leap-year and cross-year ranges', () => {
    expect(dateRangeDays({ start: '2026-01-01', end: '2026-01-07' })).toBe(7);
    expect(dateRangeDays({ start: '2024-02-28', end: '2024-03-01' })).toBe(3); // leap year
    expect(dateRangeDays({ start: '2025-12-30', end: '2026-01-02' })).toBe(4); // cross year
  });

  test('shifts a range by its own length in both directions', () => {
    const range = { start: '2026-01-01', end: '2026-01-07' };
    expect(shiftDateRange(range, 1)).toEqual({ start: '2026-01-08', end: '2026-01-14' });
    expect(shiftDateRange(range, -1)).toEqual({ start: '2025-12-25', end: '2025-12-31' });
  });
});

describe('dateRangeToTimeperiod', () => {
  test('starts at the day-start offset and covers the inclusive range', () => {
    const range = { start: '2026-03-01', end: '2026-03-03' };
    const tp = dateRangeToTimeperiod(range, '04:00');
    expect(moment(tp.start).format('YYYY-MM-DD HH:mm')).toBe('2026-03-01 04:00');
    expect(tp.length).toEqual([3, 'days']);
  });

  test('keeps the configured start-of-day across a DST boundary', () => {
    // US DST starts 2026-03-08; the day-start clock time must be preserved.
    const range = { start: '2026-03-07', end: '2026-03-09' };
    const tp = dateRangeToTimeperiod(range, '04:00');
    expect(tp.length).toEqual([3, 'days']);
    expect(moment(tp.start).hours()).toBe(4);
  });
});

describe('splitTimeperiodStrs', () => {
  test('splits a long period into contiguous chunks of at most maxDays', () => {
    const periods = splitTimeperiodStrs(
      { start: moment('2026-01-01T00:00:00').format(), length: [30, 'day'] },
      10
    );
    expect(periods).toHaveLength(3);
    const [p0Start, p0End] = periods[0].split('/').map(d => moment(d));
    expect(p0Start.isSame('2026-01-01T00:00:00')).toBe(true);
    expect(p0End.isSame('2026-01-11T00:00:00')).toBe(true);
    // Chunks are contiguous: one chunk's end is the next chunk's start
    for (let i = 1; i < periods.length; i++) {
      expect(periods[i].split('/')[0]).toBe(periods[i - 1].split('/')[1]);
    }
    // Last chunk ends exactly at the period end
    expect(moment(periods[periods.length - 1].split('/')[1]).isSame('2026-01-31T00:00:00')).toBe(
      true
    );
  });

  test('returns a single chunk when the period fits', () => {
    const periods = splitTimeperiodStrs(
      { start: moment('2026-01-01T00:00:00').format(), length: [366, 'day'] },
      366
    );
    expect(periods).toHaveLength(1);
  });

  test('covers a long all-time range without gaps or overlap', () => {
    const periods = splitTimeperiodStrs(
      { start: moment('2015-01-01T00:00:00').format(), length: [4000, 'day'] },
      366
    );
    expect(periods.length).toBeGreaterThan(5);
    for (let i = 1; i < periods.length; i++) {
      expect(periods[i].split('/')[0]).toBe(periods[i - 1].split('/')[1]);
    }
    expect(moment(periods[0].split('/')[0]).isSame('2015-01-01T00:00:00')).toBe(true);
  });
});

describe('timeperiodsForBarchart / usesMonthlyBuckets', () => {
  test('uses hours for a single day', () => {
    const periods = timeperiodsForBarchart({
      start: moment('2026-01-01T04:00:00').format(),
      length: [1, 'day'],
    });
    expect(periods).toHaveLength(24);
    expect(periods[0].length).toEqual([1, 'hour']);
    expect(usesMonthlyBuckets({ start: periods[0].start, length: [1, 'day'] })).toBe(false);
  });

  test('uses days up to MAX_DAILY_BUCKETS', () => {
    const periods = timeperiodsForBarchart({
      start: moment('2026-01-01T04:00:00').format(),
      length: [MAX_DAILY_BUCKETS, 'day'],
    });
    expect(periods).toHaveLength(MAX_DAILY_BUCKETS);
    expect(periods[0].length).toEqual([1, 'day']);
    expect(
      usesMonthlyBuckets({ start: periods[0].start, length: [MAX_DAILY_BUCKETS, 'day'] })
    ).toBe(false);
  });

  test('switches to calendar months beyond MAX_DAILY_BUCKETS', () => {
    const tp = {
      start: moment('2026-01-01T04:00:00').format(),
      length: [MAX_DAILY_BUCKETS + 1, 'day'],
    };
    expect(usesMonthlyBuckets(tp)).toBe(true);
    const periods = timeperiodsForBarchart(tp);
    expect(periods[0].length[1]).toBe('days');
    expect(periods.length).toBeLessThan(MAX_DAILY_BUCKETS);
  });

  test('uses months for a year', () => {
    const periods = timeperiodsForBarchart({
      start: moment('2026-01-01T04:00:00').format(),
      length: [1, 'year'],
    });
    expect(periods).toHaveLength(12);
    expect(periods[0].length).toEqual([1, 'month']);
  });
});

describe('timeperiodsCalendarMonthsOfPeriod', () => {
  test('clips the first and last month to the period bounds', () => {
    const periods = timeperiodsCalendarMonthsOfPeriod({
      start: moment('2026-01-15T04:00:00').format(),
      length: [55, 'day'],
    });
    expect(periods.length).toBe(3); // Jan partial, Feb full, Mar partial
    expect(periods[0].length[0]).toBeLessThan(31);
    expect(periods[1].length[0]).toBe(28);
    expect(periods[2].length[0]).toBeLessThan(31);
    // Contiguous: one chunk's end is the next chunk's start, with the day-start offset kept
    for (let i = 1; i < periods.length; i++) {
      const prevEnd = moment(periods[i - 1].start).add(periods[i - 1].length[0], 'day');
      expect(moment(periods[i].start).isSame(prevEnd)).toBe(true);
    }
  });
});
