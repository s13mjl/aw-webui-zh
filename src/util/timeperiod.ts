import moment from 'moment';
import { get_day_start_with_offset } from './time';
import { i18n } from '~/i18n';
import { useSettingsStore } from '~/stores/settings';

/**
 * Resolve a local wall-clock time (YYYY-MM-DDTHH:mm) to the instant(s) that
 * display it. A normal time has one instant; a spring-forward gap has none;
 * a fall-back overlap has two. We never silently pick one.
 */
export function wallTimeInstants(wallTime: string): Date[] {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(wallTime);
  if (!match) return [];
  const [, yearStr, monthStr, dayStr, hourStr, minuteStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (hour > 23 || minute > 59) return [];

  // The constructor normalizes invalid dates (2026-02-30 -> March), so verify
  // the components survived unchanged before scanning.
  const anchor = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    anchor.getFullYear() !== year ||
    anchor.getMonth() !== month - 1 ||
    anchor.getDate() !== day
  ) {
    return [];
  }

  // Offsets range from UTC-12 to UTC+14; scan a margin around the anchor and
  // match the local components. A minute step is enough for wall-clock input.
  const matches: Date[] = [];
  const seen = new Set<number>();
  const marginMs = 26 * 60 * 60 * 1000;
  for (let ms = anchor.getTime() - marginMs; ms <= anchor.getTime() + marginMs; ms += 60 * 1000) {
    const candidate = new Date(ms);
    if (
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day &&
      candidate.getHours() === hour &&
      candidate.getMinutes() === minute &&
      !seen.has(ms)
    ) {
      seen.add(ms);
      matches.push(candidate);
    }
  }
  return matches;
}

export interface TimePeriod {
  start: string;
  length: [number, string];
}

export function dateToTimeperiod(
  date: string,
  offset: string,
  duration?: [number, string]
): TimePeriod {
  return { start: get_day_start_with_offset(date, offset), length: duration || [1, 'day'] };
}

export function timeperiodToStr(tp: TimePeriod): string {
  const start = moment(tp.start).format();
  const end = moment(start)
    .add(tp.length[0], tp.length[1] as moment.unitOfTime.DurationConstructor)
    .format();
  return [start, end].join('/');
}

export function dateformat(periodLength: string) {
  if (periodLength === 'day') {
    return 'YYYY-MM-DD';
  } else if (periodLength === 'week') {
    return 'YYYY[ W]WW';
  } else if (periodLength === 'month') {
    return 'YYYY-MM';
  } else if (periodLength === 'year') {
    return 'YYYY';
  } else {
    return 'YYYY-MM-DD';
  }
}

export function periodReadable(timeperiod: TimePeriod) {
  if (timeperiod.length[0] === 1) {
    return moment(timeperiod.start).format(dateformat(timeperiod.length[1]));
  } else {
    return (
      moment(timeperiod.start).format(dateformat(timeperiod.length[1])) +
      ' ' +
      (i18n.t('common.rangeTo') as string) +
      ' ' +
      moment(timeperiod.start)
        .add(timeperiod.length[0], timeperiod.length[1] as moment.unitOfTime.DurationConstructor)
        .format(dateformat(timeperiod.length[1]))
    );
  }
}

export function periodLengthConvertMoment(periodLength: string) {
  const settingsStore = useSettingsStore();
  if (periodLength === 'day') {
    return 'day';
  } else if (periodLength === 'week') {
    /* This is necessary so the week starts on Monday instead of Sunday */
    return settingsStore.startOfWeek == 'Monday' ? 'isoWeek' : 'week';
  } else if (periodLength === 'month') {
    return 'month';
  } else if (periodLength === 'year') {
    return 'year';
  } else {
    console.error(`Invalid periodLength ${periodLength}, defaulting to "day"`);
    return 'day';
  }
}

const WEEKDAY_INDEX = { Sunday: 0, Monday: 1, Saturday: 6 };

// Snaps a YYYY-MM-DD date to the first day of the day/week/month/year containing it.
// Weeks start on the configured start of week, independent of moment's locale.
export function periodStartDate(date: string, periodLength: string): string {
  const m = moment(date);
  if (periodLength === 'week') {
    const settingsStore = useSettingsStore();
    const weekStart = WEEKDAY_INDEX[settingsStore.startOfWeek] ?? WEEKDAY_INDEX.Monday;
    return m
      .subtract((m.day() - weekStart + 7) % 7, 'days')
      .startOf('day')
      .format('YYYY-MM-DD');
  }
  return m.startOf(periodLengthConvertMoment(periodLength)).format('YYYY-MM-DD');
}

export function timeperiodsAroundTimeperiod(timeperiod: TimePeriod): TimePeriod[] {
  const periods = [];
  for (let i = -15; i <= 15; i++) {
    const start = moment(timeperiod.start)
      .add(i * timeperiod.length[0], timeperiod.length[1] as moment.unitOfTime.DurationConstructor)
      .format();
    periods.push({ ...timeperiod, start });
  }
  return periods;
}

export function timeperiodsHoursOfPeriod(timeperiod: TimePeriod): TimePeriod[] {
  if (timeperiod.length[1] !== 'milliseconds') {
    const periods = [];
    const _length: [number, string] = [1, 'hour'];
    for (let i = 0; i < 24; i++) {
      const start = moment(timeperiod.start)
        .add(i * _length[0], _length[1] as moment.unitOfTime.DurationConstructor)
        .format();
      periods.push({ start, length: _length });
    }
    return periods;
  }
  // Exact interval: clip the final bucket at the end bound instead of emitting
  // a full 24-hour day of hourly buckets.
  const start = moment(timeperiod.start);
  const end = start
    .clone()
    .add(timeperiod.length[0], timeperiod.length[1] as moment.unitOfTime.DurationConstructor);
  const periods: TimePeriod[] = [];
  let cur = start.clone();
  while (cur.isBefore(end)) {
    let next = cur.clone().add(1, 'hour');
    let hours = 1;
    if (next.isAfter(end)) {
      next = end.clone();
      hours = next.diff(cur, 'hours', true);
    }
    periods.push({ start: cur.format(), length: [hours, 'hour'] });
    cur = next;
  }
  return periods;
}

export function hourlyLabels(timeperiod: TimePeriod): string[] {
  const periods = timeperiodsHoursOfPeriod(timeperiod);
  const labels = periods.map(p => {
    const m = moment(p.start);
    return m.minute() === 0 ? m.format('H') : m.format('H:mm');
  });
  const counts = labels.reduce<Record<string, number>>((acc, label) => {
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return periods.map((p, i) =>
    counts[labels[i]] > 1 ? `${labels[i]} (${moment(p.start).format('Z')})` : labels[i]
  );
}

export function timeperiodsDaysOfPeriod(timeperiod: TimePeriod): TimePeriod[] {
  const periods = [];
  const _length: [number, string] = [1, 'day'];

  let count: number;
  if (timeperiod.length[1].startsWith('day')) {
    count = timeperiod.length[0];
  } else if (timeperiod.length[1].startsWith('week')) {
    count = 7;
  } else if (timeperiod.length[1].startsWith('month')) {
    count = moment(timeperiod.start).daysInMonth();
  } else {
    throw new Error(`Invalid periodLength ${timeperiod.length[1]}`);
  }

  for (let i = 0; i < count; i++) {
    const start = moment(timeperiod.start)
      .add(i * _length[0], _length[1] as moment.unitOfTime.DurationConstructor)
      .format();
    periods.push({ start, length: _length });
  }
  return periods;
}

/**
 * Split a timeperiod into consecutive sub-periods of the given unit.
 *
 * Unlike `timeperiodsMonthsOfPeriod`, this works for arbitrary ranges
 * (custom date ranges, all-time) and never returns periods outside the
 * original range. Sub-periods are expressed in days so that their end
 * timestamp is exact even when the range doesn't start on a unit boundary.
 */
export function timeperiodsSplitBy(timeperiod: TimePeriod, unit: 'month' | 'year'): TimePeriod[] {
  const periods: TimePeriod[] = [];
  const end = moment(timeperiod.start).add(
    timeperiod.length[0],
    timeperiod.length[1] as moment.unitOfTime.DurationConstructor
  );
  let cursor = moment(timeperiod.start);

  while (cursor.isBefore(end)) {
    let next = cursor.clone().add(1, unit);
    if (next.isAfter(end)) {
      next = end.clone();
    }
    const days = Math.max(next.diff(cursor, 'days'), 1);
    periods.push({ start: cursor.format(), length: [days, 'day'] as [number, string] });
    cursor = next;
  }
  return periods;
}

/**
 * Pick a sensible granularity for a timeperiod and return its sub-periods.
 *
 * Short ranges are split into hours/days, medium ranges into months, and
 * multi-year ranges into years. This keeps the number of sequential queries
 * (and the number of bars in the barchart) bounded for custom/all-time ranges.
 */
export function timeperiodsForPeriod(timeperiod: TimePeriod): TimePeriod[] {
  const [count, unit] = timeperiod.length;
  const end = moment(timeperiod.start).add(count, unit as moment.unitOfTime.DurationConstructor);
  const days = end.diff(moment(timeperiod.start), 'days');

  if (unit.startsWith('day') && count === 1) {
    return timeperiodsHoursOfPeriod(timeperiod);
  }
  if (days <= 62) {
    return timeperiodsDaysOfPeriod(timeperiod);
  }
  if (days <= 5 * 366) {
    return timeperiodsSplitBy(timeperiod, 'month');
  }
  return timeperiodsSplitBy(timeperiod, 'year');
}

export function timeperiodsMonthsOfPeriod(timeperiod: TimePeriod): TimePeriod[] {
  const periods = [];
  const _length: [number, string] = [1, 'month'];

  const count = 12;
  for (let i = 0; i < count; i++) {
    const start = moment(timeperiod.start)
      .add(i * _length[0], _length[1] as moment.unitOfTime.DurationConstructor)
      .format();
    periods.push({ start, length: _length });
  }
  return periods;
}

/** Exact intervals up to one elapsed day use hourly buckets. */
export const EXACT_HOURLY_MAX_MS = 24 * 3600 * 1000;
/** Exact intervals are limited to 92 days, matching the date-range budget. */
export const MAX_INTERVAL_MS = 92 * 24 * 3600 * 1000;

const EXACT_INTERVAL_SEP = '..';
const INSTANT_RE =
  /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/;
const INSTANT_FORMAT = 'YYYY-MM-DDTHH:mm:ss[Z]';

function parseInstant(str: string): moment.Moment | null {
  if (!INSTANT_RE.test(str)) return null;
  const m = moment.parseZone(str, moment.ISO_8601, true);
  // Reject impossible dates/times (e.g. 2026-02-30, 24:00, offsets beyond +-23:59)
  return m.isValid() ? m : null;
}

export function formatInstant(instant: string | moment.Moment): string {
  return moment.utc(instant).format(INSTANT_FORMAT);
}

/**
 * Exact intervals are encoded in the Activity URL as one path segment,
 * `START..END`, under the `interval` period. Both ends are whole-second RFC3339
 * instants with a `Z` or numeric offset, and the interval is end-exclusive.
 * Unlike the date-range period, no start-of-day offset applies and ends are not
 * inclusive days.
 */
export interface ExactInterval {
  start: string;
  end: string;
}

export function parseExactInterval(str: string | undefined | null): ExactInterval | null {
  if (!str) return null;
  const parts = str.split(EXACT_INTERVAL_SEP);
  if (parts.length !== 2) return null;
  const start = parseInstant(parts[0]);
  const end = parseInstant(parts[1]);
  if (!start || !end) return null;
  const span = end.valueOf() - start.valueOf();
  if (span <= 0 || span > MAX_INTERVAL_MS) return null;
  return { start: formatInstant(start), end: formatInstant(end) };
}

export function formatExactInterval(interval: ExactInterval): string {
  return `${interval.start}${EXACT_INTERVAL_SEP}${interval.end}`;
}

/** The elapsed interval as a TimePeriod, so existing query code applies as-is. */
export function exactIntervalToTimeperiod(interval: ExactInterval): TimePeriod {
  const start = moment(interval.start);
  return {
    start: start.format(),
    length: [moment(interval.end).valueOf() - start.valueOf(), 'milliseconds'],
  };
}

/** Shift both bounds by the elapsed duration (direction -1 = previous, +1 = next). */
export function shiftExactInterval(interval: ExactInterval, direction: number): ExactInterval {
  const span = moment(interval.end).valueOf() - moment(interval.start).valueOf();
  return {
    start: formatInstant(moment(interval.start).add(direction * span, 'milliseconds')),
    end: formatInstant(moment(interval.end).add(direction * span, 'milliseconds')),
  };
}

/** Whether a TimePeriod is an exact elapsed interval (as opposed to calendar units). */
export function isExactTimeperiod(timeperiod: TimePeriod): boolean {
  return timeperiod.length[1] === 'milliseconds';
}

const WALL_FORMAT = 'YYYY-MM-DDTHH:mm:ss';
const WALL_INPUT_FORMATS = [WALL_FORMAT, 'YYYY-MM-DDTHH:mm'];

/**
 * UTC instants a local wall time (`YYYY-MM-DDTHH:mm[:ss]`) can mean in the
 * browser's zone: none in a spring-forward gap, one normally, two for the
 * repeated hour when clocks go back. Callers must not silently pick an
 * occurrence.
 */
export function wallTimeInstants(wall: string): string[] {
  const naive = moment.utc(wall, WALL_INPUT_FORMATS, true);
  if (!naive.isValid()) return [];
  const local = moment(wall, WALL_INPUT_FORMATS, true);
  const offsets = new Set<number>();
  for (let h = -3; h <= 3; h++) offsets.add(local.clone().add(h, 'hours').utcOffset());
  const found: string[] = [];
  offsets.forEach(offset => {
    const instant = naive.clone().subtract(offset, 'minutes');
    // Only offsets that really apply at that instant produce this wall time
    if (moment(instant.valueOf()).format(WALL_FORMAT) === naive.format(WALL_FORMAT)) {
      found.push(formatInstant(instant));
    }
  });
  return found.sort();
}

/** Local wall time (`YYYY-MM-DDTHH:mm:ss`) of an instant, for datetime-local inputs. */
export function instantToWall(instant: string): string {
  return moment(instant).format(WALL_FORMAT);
}

/**
 * Human-readable label for an exact interval: local date and time, with the
 * end date shown only when it differs. Never reads as a date-only day.
 */
export function exactIntervalReadable(timeperiod: TimePeriod): string {
  const start = moment(timeperiod.start);
  const end = start.clone().add(timeperiod.length[0], 'milliseconds');
  const sameDay = start.format('YYYY-MM-DD') === end.format('YYYY-MM-DD');
  const fmt = (m: moment.Moment, withDate: boolean) =>
    m.format(withDate ? 'YYYY-MM-DD HH:mm:ss Z' : 'HH:mm:ss Z');
  return `${fmt(start, true)} — ${fmt(end, !sameDay)}`;
}

/**
 * Hourly buckets for an exact interval up to one elapsed day are produced by
 * timeperiodsHoursOfPeriod; longer ones are cut into calendar-day chunks from
 * the start instant, with the final chunk clipped to the end bound.
 */
export function timeperiodsExactDaysOfPeriod(timeperiod: TimePeriod): TimePeriod[] {
  const start = moment(timeperiod.start);
  const end = start.clone().add(timeperiod.length[0], 'milliseconds');
  const periods: TimePeriod[] = [];
  let cur = start.clone();
  while (cur.isBefore(end)) {
    let next = cur.clone().add(1, 'day');
    let bucketLength: [number, string] = [1, 'day'];
    if (next.isAfter(end)) {
      next = end.clone();
      bucketLength = [next.valueOf() - cur.valueOf(), 'milliseconds'];
    }
    periods.push({ start: cur.format(), length: bucketLength });
    cur = next;
  }
  return periods;
}

/**
 * One label per bucket of `timeperiodsForBarchart` for an exact interval:
 * hour labels up to a day (repeated fall-back hours carry their offset), the
 * chunk start date (and time when not midnight) for longer intervals.
 */
export function exactBucketLabels(timeperiod: TimePeriod): string[] {
  if (timeperiod.length[0] <= EXACT_HOURLY_MAX_MS) return hourlyLabels(timeperiod);
  return timeperiodsExactDaysOfPeriod(timeperiod).map(p => {
    const m = moment(p.start);
    return m.format(m.hours() === 0 && m.minutes() === 0 ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm');
  });
}

/** Exact-interval buckets, or the repository's adaptive custom/all-time buckets. */
export function timeperiodsForBarchart(timeperiod: TimePeriod): TimePeriod[] {
  if (isExactTimeperiod(timeperiod)) {
    return timeperiod.length[0] <= EXACT_HOURLY_MAX_MS
      ? timeperiodsHoursOfPeriod(timeperiod)
      : timeperiodsExactDaysOfPeriod(timeperiod);
  }
  return timeperiodsForPeriod(timeperiod);
}
