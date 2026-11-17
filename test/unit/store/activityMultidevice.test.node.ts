import moment from 'moment';
import { setActivePinia, createPinia } from 'pinia';
import { useActivityStore } from '~/stores/activity';
import { useBucketsStore } from '~/stores/buckets';
import { useSettingsStore } from '~/stores/settings';
import { IEvent, IBucket } from '~/util/interfaces';
import { exactIntervalToTimeperiod } from '~/util/timeperiod';

// 本地适配说明：上游该文件通过 ensure_loaded_multidevice 入口调用多设备查询；
// 本分支 store 尚无上流该 action，多设备路由在 run_queries 内按 useMultidevice 触发，
// 因此这里走 ensure_loaded → run_queries 同一路径，断言条件保持一致。
jest.mock('~/util/awclient', () => ({
  getClient: jest.fn(),
}));

const { getClient } = require('~/util/awclient');

function bucket(id: string, hostname: string, type: string): IBucket {
  return {
    id,
    hostname,
    type,
    data: {},
    last_updated: '2024-01-01T00:00:00Z',
    first_seen: '2024-01-01T00:00:00Z',
  } as IBucket;
}

const exactTp = exactIntervalToTimeperiod({
  start: '2026-10-20T13:00:00Z',
  end: '2026-10-20T14:00:00Z',
});

describe('Activity store multidevice exact interval (#1168)', () => {
  let activityStore: ReturnType<typeof useActivityStore>;
  let multideviceSpy: jest.SpyInstance;
  let categorySpy: jest.SpyInstance;
  let activeHistorySpy: jest.SpyInstance;

  beforeEach(() => {
    setActivePinia(createPinia());
    getClient.mockReturnValue({
      controller: new AbortController(),
      req: { defaults: { headers: {} } },
      abort: jest.fn(),
      getBuckets: jest.fn(async () => []),
      getEvents: jest.fn(async () => []),
      query: jest.fn(async () => []),
    });

    const settings = useSettingsStore();
    settings.$patch({
      _loaded: true,
      startOfDay: '00:00',
      useMultidevice: true,
      filter_afk: false,
      include_audible: false,
      include_stopwatch: false,
      always_active_pattern: '',
    });

    const bucketsStore = useBucketsStore();
    bucketsStore.update_buckets([
      bucket('aw-watcher-window_laptop', 'laptop', 'currentwindow'),
      bucket('aw-watcher-afk_laptop', 'laptop', 'afkstatus'),
      bucket('aw-watcher-window_desktop', 'desktop', 'currentwindow'),
      bucket('aw-watcher-afk_desktop', 'desktop', 'afkstatus'),
    ]);

    activityStore = useActivityStore();
    multideviceSpy = jest
      .spyOn(activityStore, 'query_multidevice_full')
      .mockResolvedValue(undefined as unknown as IEvent);
    categorySpy = jest
      .spyOn(activityStore, 'query_category_time_by_period')
      .mockResolvedValue(undefined as unknown as IEvent);
    activeHistorySpy = jest
      .spyOn(activityStore, 'query_active_history')
      .mockResolvedValue(undefined as unknown as IEvent);
  });

  test('queries all qualifying devices for the exact interval, category buckets per interval, no active history', async () => {
    await activityStore.ensure_loaded({
      host: 'laptop',
      timeperiod: exactTp,
      skip_active_history: true,
      force: true,
    });

    expect(multideviceSpy).toHaveBeenCalledTimes(1);
    const [options, hosts] = multideviceSpy.mock.calls[0];
    expect(moment(options.timeperiod.start).valueOf()).toBe(moment(exactTp.start).valueOf());
    expect(options.timeperiod.length).toEqual([3600000, 'milliseconds']);
    expect(hosts).toEqual(expect.arrayContaining(['laptop', 'desktop']));

    expect(categorySpy).toHaveBeenCalledTimes(1);
    const categoryOptions = categorySpy.mock.calls[0][0];
    expect(moment(categoryOptions.timeperiod.start).valueOf()).toBe(
      moment(exactTp.start).valueOf()
    );
    expect(categoryOptions.skip_active_history).toBe(true);

    expect(activeHistorySpy).not.toHaveBeenCalled();
  });
});
