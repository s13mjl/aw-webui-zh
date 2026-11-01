import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import 'moment/locale/de';

import { periodStartDate, timeperiodsForPeriod } from '~/util/timeperiod';
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
