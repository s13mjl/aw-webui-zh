import moment from 'moment';
import { setActivePinia, createPinia } from 'pinia';
import { useActivityStore, uncachedHistoryPeriods } from '~/stores/activity';
import { useBucketsStore } from '~/stores/buckets';
import { useSettingsStore } from '~/stores/settings';
import { getClient } from '~/util/awclient';

jest.mock('~/i18n', () => ({
  i18n: { t: key => key, locale: 'en' },
}));

jest.mock('~/util/awclient', () => ({
  getClient: jest.fn(),
  queryLong: jest.fn(),
  getEventsLong: jest.fn(),
}));

const timeperiod = { start: moment().startOf('day').format(), length: [1, 'day'] };

function bucket(id: string, type: string, hostname: string) {
  return { id, type, hostname, data: {}, last_updated: '' };
}

function setupStores() {
  setActivePinia(createPinia());

  useSettingsStore().$patch({ _loaded: true, startOfDay: '00:00', requestTimeout: 30 });

  useBucketsStore().$patch({
    buckets: [
      bucket('aw-watcher-window_laptop', 'currentwindow', 'laptop'),
      bucket('aw-watcher-afk_laptop', 'afkstatus', 'laptop'),
      bucket('aw-watcher-window_desktop', 'currentwindow', 'desktop'),
      bucket('aw-watcher-afk_desktop', 'afkstatus', 'desktop'),
      bucket('aw-watcher-editor_laptop', 'app.editor.activity', 'laptop'),
    ],
  });

  return { activity: useActivityStore(), buckets: useBucketsStore() };
}

function setupClient() {
  const controller = new AbortController();
  const client = {
    get controller() {
      return controller;
    },
    abort: jest.fn(),
    query: jest.fn(async (periods, _query, opts = {}) => {
      if (opts.name === 'multidevice') {
        return [
          {
            window: {
              duration: 0,
              app_events: [],
              title_events: [],
              cat_events: [],
              active_events: [],
            },
            browser: {},
            stopwatch: {},
          },
        ];
      }
      if (opts.name === 'multideviceActivityQuery') return periods.map(() => 0);
      if (opts.name === 'categoryQuery') return [{ cat_events: [] }];
      if (opts.name === 'editorActivityQuery') return [{}];
      return [{}];
    }),
  };
  getClient.mockReturnValue(client);
  return client;
}

const queryOptions = (overrides = {}) => ({
  timeperiod,
  filter_afk: true,
  include_audible: false,
  include_stopwatch: false,
  filter_categories: null,
  always_active_pattern: '',
  skip_active_history: true,
  ...overrides,
});

describe('multidevice host resolution', () => {
  test('@all resolves to every eligible desktop host', () => {
    const { activity } = setupStores();
    expect(activity.resolve_multidevice_hosts('@all')).toEqual(['laptop', 'desktop']);
  });

  test('an explicit list intersects eligible hosts', () => {
    const { activity } = setupStores();
    expect(activity.resolve_multidevice_hosts('desktop,laptop')).toEqual(['laptop', 'desktop']);
  });

  test('a plain single host resolves to the single-device path (empty list)', () => {
    const { activity } = setupStores();
    expect(activity.resolve_multidevice_hosts('laptop')).toEqual([]);
  });

  test("multidevice params carry each host's actual bucket IDs", () => {
    const { activity } = setupStores();
    const params = activity.multidevice_params(queryOptions(), ['laptop', 'desktop']);
    expect(params.hosts).toEqual(['laptop', 'desktop']);
    expect(params.host_params).toEqual({
      laptop: { bid_window: 'aw-watcher-window_laptop', bid_afk: 'aw-watcher-afk_laptop' },
      desktop: { bid_window: 'aw-watcher-window_desktop', bid_afk: 'aw-watcher-afk_desktop' },
    });
  });
});

describe('multidevice loading', () => {
  test('marks window/active/category available, browser/stopwatch/android unavailable', async () => {
    const { activity } = setupStores();
    setupClient();

    await activity.ensure_loaded_multidevice(queryOptions(), ['laptop', 'desktop']);

    expect(activity.query_hosts).toEqual(['laptop', 'desktop']);
    expect(activity.window.available).toBe(true);
    expect(activity.active.available).toBe(true);
    expect(activity.category.available).toBe(true);
    expect(activity.browser.available).toBe(false);
    expect(activity.stopwatch.available).toBe(false);
    expect(activity.android.available).toBe(false);
    // Editor buckets only come from hosts that have one
    expect(activity.editor.available).toBe(true);
  });

  test('history key tracks selected hosts and afk buckets; changes clear cached history', async () => {
    const { activity } = setupStores();
    setupClient();

    await activity.ensure_loaded_multidevice(queryOptions(), ['laptop', 'desktop']);
    const afkBuckets = ['aw-watcher-afk_laptop', 'aw-watcher-afk_desktop'];
    expect(activity.active.history_key).toBe(JSON.stringify([['laptop', 'desktop'], afkBuckets]));

    activity.active.history = { '2026-01-01/2026-01-02': [] };
    activity.query_hosts = ['laptop'];
    activity.buckets.afk = ['aw-watcher-afk_laptop'];
    activity.set_history_key();

    expect(activity.active.history).toEqual({});
    expect(activity.active.history_key).toBe(
      JSON.stringify([['laptop'], ['aw-watcher-afk_laptop']])
    );
  });
});

describe('uncachedHistoryPeriods', () => {
  test('skips future and cached periods, keeps the growing current period', () => {
    const now = new Date('2026-01-02T12:00:00.000Z');
    const periods = [
      '2026-01-01/2026-01-02', // past, uncached
      '2026-01-02/2026-01-03', // current, uncached, still growing
      '2026-01-03/2026-01-04', // future
      '2025-12-31/2026-01-01', // past, cached
    ];
    const cached = { '2025-12-31/2026-01-01': [] };
    expect(uncachedHistoryPeriods(periods, cached, now)).toEqual([
      '2026-01-01/2026-01-02',
      '2026-01-02/2026-01-03',
    ]);
  });
});
