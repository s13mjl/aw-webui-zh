import moment from 'moment';
import { setActivePinia, createPinia } from 'pinia';
import { useActivityStore } from '~/stores/activity';
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

const host = 'testhost';

function setupStores() {
  setActivePinia(createPinia());

  useSettingsStore().$patch({
    _loaded: true,
    startOfDay: '00:00',
    useMultidevice: false,
    requestTimeout: 30,
  });

  useBucketsStore().$patch({
    buckets: [
      { id: `aw-watcher-window_${host}`, type: 'currentwindow', hostname: host, data: {} },
      { id: `aw-watcher-afk_${host}`, type: 'afkstatus', hostname: host, data: {} },
    ],
  });

  return { activity: useActivityStore() };
}

// Mirrors the global AWClient from aw-client: abort() cancels the current
// controller and immediately swaps in a fresh one.
function setupClient({ failDesktopOnce = false } = {}) {
  let controller = new AbortController();
  let desktopFailed = false;
  const client = {
    get controller() {
      return controller;
    },
    abort: jest.fn(() => {
      controller.abort();
      controller = new AbortController();
    }),
    query: jest.fn(async (periods, query, opts = {}) => {
      if (opts.name === 'fullDesktopQuery') {
        if (failDesktopOnce && !desktopFailed) {
          desktopFailed = true;
          throw new Error('Request failed: timeout');
        }
        return [
          {
            window: {
              duration: 3600,
              app_events: [{ duration: 3600, data: { app: 'some-app' } }],
              title_events: [],
              cat_events: [],
              active_events: [],
            },
            browser: { duration: 0, domains: [], urls: [], titles: [] },
            stopwatch: { stopwatch_events: [] },
          },
        ];
      }
      if (opts.name === 'activityQuery') return periods.map(() => []);
      if (opts.name === 'categoryQuery') return [{ cat_events: [] }];
      return [{}];
    }),
  };
  getClient.mockReturnValue(client);
  return client;
}

const desktopCalls = client =>
  client.query.mock.calls.filter(call => (call[2] || {}).name === 'fullDesktopQuery').length;

const timeperiod = { start: moment().startOf('day').format(), length: [1, 'day'] };

function queryOptions(overrides = {}) {
  return {
    timeperiod,
    host,
    filter_afk: true,
    include_audible: true,
    include_stopwatch: false,
    filter_categories: null,
    always_active_pattern: '',
    skip_active_history: false,
    ...overrides,
  };
}

describe('activity store loading lifecycle', () => {
  test('re-entering the activity page re-queries after the unmount reset', async () => {
    const { activity } = setupStores();
    const client = setupClient();

    await activity.ensure_loaded(queryOptions());
    expect(desktopCalls(client)).toBe(1);
    expect(activity.window.top_apps).toEqual(expect.any(Array));
    expect(activity.category.by_period).not.toBeNull();

    // Activity.vue beforeUnmount() clears the data to stop rendering it.
    await activity.reset();

    // Activity.vue mounted() on the next visit, with identical options.
    await activity.ensure_loaded(queryOptions());

    expect(desktopCalls(client)).toBe(2);
    expect(activity.window.top_apps).toEqual(expect.any(Array));
    expect(activity.category.by_period).not.toBeNull();
  });

  test('a failed query is retried when ensure_loaded runs again with identical options', async () => {
    const { activity } = setupStores();
    const client = setupClient({ failDesktopOnce: true });

    await expect(activity.ensure_loaded(queryOptions())).rejects.toThrow('timeout');
    expect(activity.window.top_apps).toBeNull();

    await activity.ensure_loaded(queryOptions());

    expect(desktopCalls(client)).toBe(2);
    expect(activity.window.top_apps).toEqual(expect.any(Array));
    expect(activity.category.by_period).not.toBeNull();
  });
});
