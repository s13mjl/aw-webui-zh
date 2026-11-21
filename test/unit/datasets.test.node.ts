import { groupDaysIntoWeeks } from '~/util/datasets';
import { IEvent } from '~/util/interfaces';

const event = (category: string[], duration: number): IEvent => ({
  timestamp: '',
  duration,
  data: { $category: category },
});

const hoursIn = (entry: { cat_events: IEvent[] }): number => {
  const seconds = entry.cat_events.reduce((a, e) => a + (e.duration || 0), 0);
  return Math.round((seconds / 3600) * 1000) / 1000;
};

describe('groupDaysIntoWeeks', () => {
  // 2026-10-15 is a Thursday. Ten days: Thu 15 .. Sat 24, starting at 04:00.
  const byDay: Record<string, { cat_events: IEvent[] }> = {};
  for (let d = 15; d <= 24; d++) {
    byDay[`2026-10-${d}T04:00:00+02:00/2026-10-${d + 1}T04:00:00+02:00`] = {
      cat_events: [event(['Work'], 3600 * (d - 14))],
    };
  }

  test('buckets days into Monday-start weeks, keeping partial edge weeks', () => {
    const { firstWeekStart, byWeek } = groupDaysIntoWeeks(byDay, 'Monday');
    expect(firstWeekStart).toBe('2026-10-12');
    expect(Object.keys(byWeek)).toEqual(['2026-10-12', '2026-10-19']);
    // Thu-Sun (days 1-4) then Mon-Sat (days 5-10)
    expect(byWeek['2026-10-12'].cat_events).toHaveLength(4);
    expect(byWeek['2026-10-19'].cat_events).toHaveLength(6);
    const hours = Object.values(byWeek).map(hoursIn);
    expect(hours).toEqual([1 + 2 + 3 + 4, 5 + 6 + 7 + 8 + 9 + 10]);
  });

  test('honours a Sunday or Saturday start of week', () => {
    expect(Object.keys(groupDaysIntoWeeks(byDay, 'Sunday').byWeek)).toEqual([
      '2026-10-11',
      '2026-10-18',
    ]);
    expect(Object.keys(groupDaysIntoWeeks(byDay, 'Saturday').byWeek)).toEqual([
      '2026-10-10',
      '2026-10-17',
      '2026-10-24',
    ]);
  });

  test('keys by the written date, not the UTC date', () => {
    // Monday 00:30 in UTC+2 is Sunday 22:30 UTC; it must stay in Monday's week.
    const { byWeek } = groupDaysIntoWeeks(
      { '2026-10-19T00:30:00+02:00/2026-10-20T00:30:00+02:00': { cat_events: [] } },
      'Monday'
    );
    expect(Object.keys(byWeek)).toEqual(['2026-10-19']);
  });

  test('spans the new-year boundary without missing or duplicating a day', () => {
    // Tue 2026-12-29 .. Mon 2027-01-04, Monday start.
    const aroundYear: Record<string, { cat_events: IEvent[] }> = {};
    const days = [
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
      '2027-01-04',
    ];
    for (const day of days) {
      aroundYear[`${day}T04:00:00+02:00/${day}T04:00:00+02:00`] = {
        cat_events: [event(['Work'], 3600)],
      };
    }
    const { firstWeekStart, byWeek } = groupDaysIntoWeeks(aroundYear, 'Monday');
    expect(firstWeekStart).toBe('2026-12-28');
    expect(Object.keys(byWeek)).toEqual(['2026-12-28', '2027-01-04']);
    expect(byWeek['2026-12-28'].cat_events).toHaveLength(6);
    expect(byWeek['2027-01-04'].cat_events).toHaveLength(1);
  });

  test('keeps one bucket per week across the autumn DST transition', () => {
    // 2026-10-19 (Mon) .. 2026-10-25 (Sun): Europe switches to standard time
    // on 2026-10-25. The grouping keys by calendar date, so no day is lost or
    // duplicated by the offset change.
    const aroundDst: Record<string, { cat_events: IEvent[] }> = {};
    for (let d = 19; d <= 25; d++) {
      aroundDst[`2026-10-${d}T04:00:00+02:00/2026-10-${d + 1}T04:00:00+02:00`] = {
        cat_events: [event(['Work'], 3600)],
      };
    }
    const { byWeek } = groupDaysIntoWeeks(aroundDst, 'Monday');
    expect(Object.keys(byWeek)).toEqual(['2026-10-19']);
    expect(byWeek['2026-10-19'].cat_events).toHaveLength(7);
  });

  test('handles empty input', () => {
    expect(groupDaysIntoWeeks({}, 'Monday')).toEqual({ firstWeekStart: null, byWeek: {} });
  });
});
