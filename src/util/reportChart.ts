import moment from 'moment';

import { Category } from './classes';
import { getColorFromCategory } from './color';
import { IEvent } from './interfaces';
import { TimePeriod, timeperiodsForPeriod } from './timeperiod';

/**
 * 用与图表标签相同的时间分段，把报表查询返回的事件分桶成数据集。
 * 这样图表与事件列表都来自同一次成功查询，而不是读取可被其他查询改动的共享 store。
 * 分段直接复用 timeperiodsForPeriod，保证数据集长度与 TimelineBarChart 的标签一一对应。
 * 同步上游 https://github.com/ActivityWatch/aw-webui/pull/1205
 */
export function reportChartDatasets(events: IEvent[], period: TimePeriod, classes: Category[]) {
  const buckets = timeperiodsForPeriod(period).map(bucket => {
    const start = moment(bucket.start);
    const end = start
      .clone()
      .add(bucket.length[0], bucket.length[1] as moment.unitOfTime.DurationConstructor);
    return [start.valueOf(), end.valueOf()] as [number, number];
  });
  const datasets = new Map<string, { label: string; backgroundColor: string; data: number[] }>();
  for (const event of events) {
    const path: string[] = event.data.$category || [];
    const key = JSON.stringify(path);
    if (!datasets.has(key)) {
      datasets.set(key, {
        label: path.length ? path.join(' > ') : 'Uncategorized',
        backgroundColor: getColorFromCategory(
          classes.find(c => JSON.stringify(c.name) === key),
          classes
        ),
        data: buckets.map(() => 0),
      });
    }
    const start = moment(event.timestamp).valueOf();
    const end = start + event.duration * 1000;
    buckets.forEach(([bucketStart, bucketEnd], i) => {
      const overlap = Math.max(0, Math.min(end, bucketEnd) - Math.max(start, bucketStart));
      datasets.get(key).data[i] += overlap / 3600000;
    });
  }
  return [...datasets.values()];
}
