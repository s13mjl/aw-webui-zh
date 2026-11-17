import { createPinia, setActivePinia } from 'pinia';

import { useActivityStore } from '~/stores/activity';
import { createClient, getClient } from '~/util/awclient';

createClient();

const timeperiod = { start: '2024-01-01T00:00:00Z', length: [1, 'day'] };

const appResult = {
  app_events: [],
  app_cat_events: [],
  title_events: [],
  cat_events: [],
  duration: 3600,
};

function setupStore(androidBuckets: string[], browserBuckets: string[]) {
  setActivePinia(createPinia());
  const store = useActivityStore();
  store.buckets.android = androidBuckets;
  store.buckets.browser = browserBuckets;
  store.browser.available = browserBuckets.length > 0;
  return store;
}

describe('Android 浏览器融合（同步上游 #1091）', () => {
  afterEach(() => jest.restoreAllMocks());

  test('Android 应用桶 + web 桶时，浏览器数据经融合查询填充', async () => {
    const store = setupStore(['aw-watcher-android_device'], ['aw-watcher-web-chrome']);
    const query = jest.spyOn(getClient(), 'query').mockImplementation(async (_periods, q, opts) => {
      if (opts?.name === 'androidBrowserQuery') {
        return [
          {
            browser: {
              domains: [{ duration: 120, data: { $domain: 'example.com' } }],
              urls: [{ duration: 120, data: { url: 'https://example.com' } }],
              titles: [{ duration: 120, data: { title: 'Example' } }],
              duration: 120,
            },
          },
        ];
      }
      return [appResult];
    });

    await store.query_android({ timeperiod, filter_categories: [] } as any);

    expect(query).toHaveBeenCalledTimes(2);
    const browserCall = query.mock.calls.find(c => c[2]?.name === 'androidBrowserQuery');
    expect(browserCall).toBeDefined();
    const browserQuery = (browserCall && browserCall[1].join('\n')) || '';
    expect(browserQuery).toContain('filter_keyvals(events, "package",');
    expect(browserQuery).toContain('com.android.chrome');
    expect(store.browser.top_domains).toEqual([
      { duration: 120, data: { $domain: 'example.com' } },
    ]);
    expect(store.browser.top_urls).toEqual([
      { duration: 120, data: { url: 'https://example.com' } },
    ]);
    expect(store.browser.top_titles).toEqual([{ duration: 120, data: { title: 'Example' } }]);
    expect(store.browser.duration).toBe(120);
  });

  test('应用查询无结果时，浏览器状态置空', async () => {
    const store = setupStore(['aw-watcher-android_device'], ['aw-watcher-web-chrome']);
    store.browser.top_domains = null;
    store.browser.top_urls = null;
    store.browser.top_titles = null;
    jest.spyOn(getClient(), 'query').mockResolvedValue([]);

    await store.query_android({ timeperiod, filter_categories: [] } as any);

    expect(store.browser.top_domains).toEqual([]);
    expect(store.browser.top_urls).toEqual([]);
    expect(store.browser.top_titles).toEqual([]);
    expect(store.browser.duration).toBe(0);
  });

  test('浏览器片段失败（无 browser 键）时，浏览器状态置空', async () => {
    const store = setupStore(['aw-watcher-android_device'], ['aw-watcher-web-chrome']);
    store.browser.top_domains = null;
    store.browser.top_urls = null;
    store.browser.top_titles = null;
    store.browser.duration = 123;
    jest.spyOn(getClient(), 'query').mockResolvedValueOnce([appResult]).mockResolvedValueOnce([]);

    await store.query_android({ timeperiod, filter_categories: [] } as any);

    expect(store.browser.top_domains).toEqual([]);
    expect(store.browser.top_urls).toEqual([]);
    expect(store.browser.top_titles).toEqual([]);
    expect(store.browser.duration).toBe(0);
  });

  test('ScreenTime(iOS) 桶不做浏览器前台融合，只发一次查询', async () => {
    const store = setupStore(['aw-import-screentime_device'], ['aw-watcher-web-chrome']);
    const query = jest.spyOn(getClient(), 'query').mockResolvedValue([appResult]);

    await store.query_android({ timeperiod, filter_categories: [] } as any);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][2]?.name).not.toBe('androidBrowserQuery');
  });
});
