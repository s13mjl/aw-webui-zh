import moment from 'moment';
import { get_day_start_with_offset } from './time';
import { i18n } from '~/i18n';
import { useSettingsStore } from '~/stores/settings';

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
