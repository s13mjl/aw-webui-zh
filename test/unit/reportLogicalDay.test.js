import moment from 'moment';
import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { get_today_with_offset } from '~/util/time';
import WorkReportComponent from '~/views/WorkReport.vue';

const WorkReport = WorkReportComponent;

function expectWindow(dateRange, firstDate, lastDate) {
  const settingsStore = useSettingsStore();
  const ctx = { settingsStore, dateRange };
  const work = WorkReport.methods.getTimeperiods.call(ctx);
  const dates = [];
  for (const date = moment(firstDate); date.isSameOrBefore(lastDate, 'day'); date.add(1, 'day')) {
    dates.push(date.format('YYYY-MM-DD'));
  }
  expect(work).toHaveLength(dates.length);
  work.forEach((period, i) => {
    const [start, end] = period.split('/').map(value => moment(value));
    expect(start.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(
      `${dates[i]} ${settingsStore.startOfDay}:00.000`
    );
    expect(end.format('YYYY-MM-DD HH:mm:ss.SSS')).toBe(
      `${moment(dates[i]).add(1, 'day').format('YYYY-MM-DD')} ${settingsStore.startOfDay}:00.000`
    );
    if (i > 0) expect(period.split('/')[0]).toBe(work[i - 1].split('/')[1]);
  });
  return work;
}

describe('报表逻辑日锚定', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useSettingsStore().startOfDay = '04:00';
    useSettingsStore().startOfWeek = 'Monday';
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test.each([
    [new Date(2026, 9, 1, 3, 59, 59, 999), '2026-09-30'],
    [new Date(2026, 9, 1, 4, 0), '2026-10-01'],
    [new Date(2026, 10, 1, 3, 59, 59, 999), '2026-10-31'],
    [new Date(2026, 10, 1, 4, 0), '2026-11-01'],
  ])('get_today_with_offset 以本地日界判断今天 %s', (now, today) => {
    jest.setSystemTime(now);
    expect(get_today_with_offset('04:00')).toBe(today);
  });

  test.each([
    [new Date(2026, 10, 1, 3, 59, 59, 999), '2026-10-01', '2026-10-31'],
    [new Date(2026, 10, 1, 4, 0), '2026-11-01', '2026-11-01'],
    [new Date(2027, 0, 1, 2), '2026-12-01', '2026-12-31'],
  ])('thisMonth 锚定到配置的逻辑月 %s', (now, firstDate, lastDate) => {
    jest.setSystemTime(now);
    expectWindow('thisMonth', firstDate, lastDate);
  });

  test.each([
    ['last7d', '2026-09-24'],
    ['last30d', '2026-09-01'],
  ])('%s 包含逻辑今天而非未来日 %s', (range, firstDate) => {
    jest.setSystemTime(new Date(2026, 9, 1, 2, 34, 47, 321));
    expectWindow(range, firstDate, '2026-09-30');
  });

  test('thisWeek 在日界之前保留上一个逻辑周', () => {
    jest.setSystemTime(new Date(2026, 9, 18, 2));
    expectWindow('thisWeek', '2026-10-12', '2026-10-17');
    jest.setSystemTime(new Date(2026, 9, 18, 4));
    expectWindow('thisWeek', '2026-10-12', '2026-10-18');
  });

  test('整个计算过程只有一个逻辑锚点', () => {
    const before = new Date(2026, 10, 1, 3, 59, 59, 999).valueOf();
    const after = new Date(2026, 10, 1, 4).valueOf();
    jest.spyOn(moment, 'now').mockReturnValueOnce(before).mockReturnValue(after);
    const periods = WorkReport.methods.getTimeperiods.call({
      settingsStore: useSettingsStore(),
      dateRange: 'thisMonth',
    });
    expect(moment(periods[0].split('/')[0]).format('YYYY-MM-DD')).toBe('2026-10-01');
    expect(moment(periods[periods.length - 1].split('/')[1]).format('YYYY-MM-DD')).toBe(
      '2026-11-01'
    );
    expect(periods).toHaveLength(31);
  });
});
