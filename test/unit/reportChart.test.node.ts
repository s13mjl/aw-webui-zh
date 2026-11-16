import { reportChartDatasets } from '~/util/reportChart';
import { TimePeriod, timeperiodsForPeriod } from '~/util/timeperiod';

const event = (timestamp: string, duration: number, path?: string[]) => ({
  timestamp,
  duration,
  data: { $category: path },
});

function period(start: string, days: number): TimePeriod {
  return { start, length: [days, 'day'] };
}

test('splits boundary-crossing events into hourly buckets, clips to the range and preserves inputs', () => {
  const range = period('2026-10-01T00:00:00Z', 1);
  const events = [
    event('2026-10-01T12:00:00Z', 1800, ['Work']),
    event('2026-10-01T12:30:00Z', 3600, ['Work']),
    event('2026-09-30T23:30:00Z', 3600, ['Work']),
  ];
  const before = JSON.stringify(events);
  const datasets = reportChartDatasets(events, range, []);
  expect(datasets).toHaveLength(1);
  // 分桶数量必须与图表标签数量一致，否则柱子与事件列表会错位。
  expect(datasets[0].data).toHaveLength(timeperiodsForPeriod(range).length);
  expect(datasets[0].data).toHaveLength(24);
  expect(datasets[0].data[0]).toBeCloseTo(0.5, 8);
  expect(datasets[0].data[12]).toBeCloseTo(1, 8);
  expect(datasets[0].data[13]).toBeCloseTo(0.5, 8);
  expect(JSON.stringify(events)).toBe(before);
});

test('keeps distinct category paths and unclassified events', () => {
  const range = period('2026-10-01T00:00:00Z', 2);
  const classes: any = [
    { name: ['Work'], rule: { type: 'none' }, data: { color: '#123456' } },
    { name: ['A', 'B'], rule: { type: 'none' }, data: { color: '#654321' } },
  ];
  const datasets = reportChartDatasets(
    [
      event('2026-10-01T12:00:00Z', 60, ['A>>>B']),
      event('2026-10-01T12:00:00Z', 120, ['A', 'B']),
      event('2026-10-01T12:00:00Z', 180),
      event('2026-10-02T12:00:00Z', 3600, ['Work']),
    ],
    range,
    classes
  );
  expect(datasets.map(d => d.label)).toEqual(['A>>>B', 'A > B', 'Uncategorized', 'Work']);
  expect(datasets[1].backgroundColor).toBe('#654321');
  expect(reportChartDatasets([], range, [])).toEqual([]);
});

test('keeps fractional hours across calendar buckets and conserves total duration', () => {
  const range = period('2026-10-01T00:00:00Z', 3);
  const totalSeconds = 3 * 86400;
  const dataset = reportChartDatasets(
    [event(range.start, totalSeconds, ['Work'])],
    range,
    []
  )[0];
  expect(dataset.data).toHaveLength(timeperiodsForPeriod(range).length);
  expect(dataset.data.reduce((a: number, b: number) => a + b, 0)).toBeCloseTo(totalSeconds / 3600, 8);
});
