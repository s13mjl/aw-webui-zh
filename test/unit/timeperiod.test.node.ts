import moment from 'moment';
import { timeperiodsForPeriod } from '~/util/timeperiod';

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
