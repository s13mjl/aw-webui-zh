import _ from 'lodash';
import moment from 'moment';

import { split_by_hour_into_data } from '~/util/transforms';
import { getColorFromCategory } from '~/util/color';
import { Category } from '~/util/classes';
import { IEvent } from './interfaces';
import { useCategoryStore } from '~/stores/categories';
import { i18n } from '~/i18n';

interface HourlyData {
  cat_events: IEvent[];
}

interface Dataset {
  label: string;
  backgroundColor: string;
  data: number[];
}

export function buildBarchartDataset(data_by_hour: HourlyData[], classes: Category[]): Dataset[] {
  const SEP = '>>>';
  const data = data_by_hour;
  if (data) {
    const category_names: Set<string> = new Set(
      Object.values(data)
        .map(result => {
          return result.cat_events.map(e => e.data['$category'].join(SEP));
        })
        .flat()
    );
    const ds: Dataset[] = [...category_names]
      .map(c_ => {
        const categoryStore = useCategoryStore();
        const c = categoryStore.get_category(c_.split(SEP));

        if (c) {
          const values = Object.values(data).map(results => {
            const matching = results.cat_events.filter(e => _.isEqual(e.data['$category'], c.name));
            if (matching.length) {
              const total = matching.reduce((a, e) => a + (e.duration || 0), 0);
              return Math.round((total / (60 * 60)) * 1000) / 1000;
            } else return null;
          });
          return {
            label: c.name.join(' > '),
            backgroundColor: getColorFromCategory(c, classes),
            data: values,
          } as Dataset;
        } else {
          // FIXME: This shouldn't happen
          // This may for example happen if one doesn't have an 'Uncategorized' category,
          // as can happen when one upgrades from an old version where there wasn't one in the default classes.
          console.error('missing category:', c_);
        }
      })
      .filter(x => x);
    return ds;
  } else {
    return [];
  }
}

const ISO_WEEKDAY: Record<string, number> = { Monday: 1, Saturday: 6, Sunday: 7 };

/**
 * Groups per-day barchart entries (keyed by "start/end" period strings, in
 * chronological order) into weeks beginning on `startOfWeek`.
 *
 * Returns the week-start date of the first bucket and one entry per week,
 * oldest first. Edge weeks only contain the days inside the queried range.
 */
export function groupDaysIntoWeeks(
  byDay: Record<string, HourlyData>,
  startOfWeek: string
): { firstWeekStart: string | null; byWeek: Record<string, HourlyData> } {
  const weekStartIso = ISO_WEEKDAY[startOfWeek] || 1;
  const byWeek: Record<string, HourlyData> = {};
  for (const [period, entry] of Object.entries(byDay)) {
    // Read the calendar date as written, ignoring the timezone offset, so a
    // day's bucket never moves to its neighbour.
    const day = moment.parseZone(period.split('/')[0]);
    const back = (day.isoWeekday() - weekStartIso + 7) % 7;
    const key = day.clone().subtract(back, 'days').format('YYYY-MM-DD');
    if (!byWeek[key]) byWeek[key] = { cat_events: [] };
    byWeek[key].cat_events = byWeek[key].cat_events.concat(entry?.cat_events || []);
  }
  const keys = Object.keys(byWeek);
  return { firstWeekStart: keys.length ? keys[0] : null, byWeek };
}

export function buildBarchartDatasetActive(events_active: IEvent[]) {
  const data = split_by_hour_into_data(events_active);
  return [
    {
      label: i18n.t('datasets.totalTime') as string,
      backgroundColor: '#6699ff',
      data,
    },
  ];
}
