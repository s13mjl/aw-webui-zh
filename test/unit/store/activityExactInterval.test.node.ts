import moment from 'moment';
import { setActivePinia, createPinia } from 'pinia';
import { useActivityStore } from '~/stores/activity';
import { useBucketsStore } from '~/stores/buckets';
import { useSettingsStore } from '~/stores/settings';
import { IEvent, IBucket } from '~/util/interfaces';
import { exactIntervalToTimeperiod } from '~/util/timeperiod';

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

describe('Activity store exact interval (#1168)', () => {
  let activityStore: ReturnType<typeof useActivityStore>;
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
      useMultidevice: false,
      filter_afk: false,
      include_audible: false,
      include_stopwatch: false,
      always_active_pattern: '',
    });

    const bucketsStore = useBucketsStore();
    bucketsStore.update_buckets([
      bucket('aw-watcher-window_testhost', 'testhost', 'currentwindow'),
      bucket('aw-watcher-afk_testhost', 'testhost', 'afkstatus'),
    ]);

    activityStore = useActivityStore();
    categorySpy = jest
      .spyOn(activityStore, 'query_category_time_by_period')
      .mockResolvedValue(undefined as unknown as IEvent);
    activeHistorySpy = jest
      .spyOn(activityStore, 'query_active_history')
      .mockResolvedValue(undefined as unknown as IEvent);
  });

  test('queries category buckets with the exact interval and skips active history', async () => {
    await activityStore.ensure_loaded({
      host: 'testhost',
      timeperiod: exactTp,
      skip_active_history: true,
      force: true,
    });

    expect(categorySpy).toHaveBeenCalledTimes(1);
    const options = categorySpy.mock.calls[0][0];
    expect(moment(options.timeperiod.start).valueOf()).toBe(moment(exactTp.start).valueOf());
    expect(options.timeperiod.length).toEqual([3600000, 'milliseconds']);
    expect(options.skip_active_history).toBe(true);
    expect(activeHistorySpy).not.toHaveBeenCalled();
  });

  test('does not reuse a calendar-unit period for the exact interval', async () => {
    await activityStore.ensure_loaded({
      host: 'testhost',
      timeperiod: exactTp,
      skip_active_history: true,
      force: true,
    });

    const options = categorySpy.mock.calls[0][0];
    expect(options.timeperiod.length[1]).toBe('milliseconds');
    expect(options.timeperiod.length[0]).toBe(3600000);
    expect(moment(options.timeperiod.start).valueOf()).toBe(moment(exactTp.start).valueOf());
  });
});
