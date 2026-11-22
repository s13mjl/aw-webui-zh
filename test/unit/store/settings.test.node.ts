import { setActivePinia, createPinia } from 'pinia';

import { useSettingsStore } from '~/stores/settings';
import * as awclient from '~/util/awclient';
import { createClient, getClient } from '~/util/awclient';

describe('settings store', () => {
  setActivePinia(createPinia());
  const settingsStore = useSettingsStore();

  beforeEach(() => {
    settingsStore.$reset();
    jest.restoreAllMocks();
  });

  test('load({save:true}) 在被并发加载取代后仍履行保存意图', async () => {
    // 复现：先发起 load({save:true})，在首个响应到达前完成第二次 load()。
    // 过期响应守卫仍需保留 save 意图，而不是静默丢弃。
    (global as any).localStorage = {
      getItem: () => null,
      setItem: jest.fn(),
      length: 0,
      key: () => null,
    };
    Object.defineProperty(global.localStorage, Symbol.iterator, {
      value: [][Symbol.iterator].bind([]),
      configurable: true,
    });

    let resolveFirst!: (v: Record<string, unknown>) => void;
    const fakeClient = {
      get_settings: jest
        .fn()
        // 首次调用阻塞
        .mockImplementationOnce(
          () =>
            new Promise(resolve => {
              resolveFirst = resolve;
            })
        )
        // 第二次调用立即返回
        .mockResolvedValueOnce({}),
      req: { defaults: {} },
    };
    jest.spyOn(awclient, 'getClient').mockReturnValue(fakeClient as any);

    const save = jest.spyOn(settingsStore, 'save').mockResolvedValue();

    const firstLoad = settingsStore.load({ save: true });
    // 让第二次加载先于第一次完成
    await settingsStore.load();

    expect(save).not.toHaveBeenCalled(); // 第二次加载没有保存意图

    resolveFirst({});
    await firstLoad;

    expect(save).toHaveBeenCalledTimes(1);

    delete (global as any).localStorage;
  });

  test('ensureLoaded coalesces concurrent loads', async () => {
    let resolveLoad!: () => void;
    const loadMock = jest.spyOn(settingsStore, 'load').mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveLoad = () => {
            settingsStore.$patch({ _loaded: true });
            resolve();
          };
        })
    );

    const firstLoad = settingsStore.ensureLoaded();
    const secondLoad = settingsStore.ensureLoaded();

    expect(loadMock).toHaveBeenCalledTimes(1);

    resolveLoad();
    await Promise.all([firstLoad, secondLoad]);

    expect(settingsStore.loaded).toBe(true);
  });

  test('category builder ignored words default to empty and persist via update', async () => {
    expect(settingsStore.category_builder_ignored_words).toEqual([]);
    const save = jest.spyOn(settingsStore, 'save').mockResolvedValue();
    jest.spyOn(settingsStore, 'ensureLoaded').mockResolvedValue();

    await settingsStore.update({ category_builder_ignored_words: ['github'] });

    expect(save).toHaveBeenCalledTimes(1);
    expect(settingsStore.category_builder_ignored_words).toEqual(['github']);
  });

  test('update waits for settings to load before patching state', async () => {
    const savedQueries = [
      {
        id: 'daily-coding-time',
        name: 'Daily Coding Time',
        query_code: 'RETURN = [];',
        start_day_offset: 0,
        end_day_offset: -1,
        event_type: 'currentwindow',
      },
    ];
    const steps: string[] = [];

    jest.spyOn(settingsStore, 'ensureLoaded').mockImplementation(async () => {
      steps.push('ensureLoaded');
      expect(settingsStore.saved_queries).toEqual([]);
      settingsStore.$patch({ _loaded: true });
    });

    jest.spyOn(settingsStore, 'save').mockImplementation(async () => {
      steps.push('save');
      expect(settingsStore.saved_queries).toEqual(savedQueries);
    });

    await settingsStore.update({ saved_queries: savedQueries });

    expect(steps).toEqual(['ensureLoaded', 'save']);
    expect(settingsStore.saved_queries).toEqual(savedQueries);
  });

  describe('supporter flag', () => {
    beforeAll(() => {
      try {
        createClient();
      } catch {
        // Another suite in this file already instantiated the global client.
      }
      (global as any).localStorage = { setItem: jest.fn() };
    });
    afterAll(() => {
      delete (global as any).localStorage;
    });

    function fakeServer(initial: Record<string, unknown> = { theme: 'light' }) {
      const post = jest.fn().mockResolvedValue({});
      jest.spyOn(getClient(), 'get_settings').mockResolvedValue(initial);
      (getClient() as any).req = { post, defaults: {} };
      jest.spyOn(settingsStore, 'load').mockImplementation(async () => {
        const posted = post.mock.calls.map(([url]) => url.split('/').pop());
        settingsStore.$patch({
          _storedKeys: [...new Set([...settingsStore._storedKeys, ...posted])],
        });
      });
      settingsStore.$patch({ _loaded: true, _storedKeys: Object.keys(initial) });
      return post;
    }

    const postedUrls = (post: jest.Mock) => post.mock.calls.map(([url]) => url);

    test('defaults to false and stays unsaved until set', async () => {
      expect(settingsStore.supporter).toBe(false);
      const post = fakeServer();
      settingsStore.$patch({ theme: 'dark' });
      await settingsStore.save();
      expect(postedUrls(post)).not.toContain('/0/settings/supporter');
    });

    test('setting it stores it in the server settings store', async () => {
      const post = fakeServer();
      await settingsStore.update({ supporter: true });
      expect(post).toHaveBeenCalledWith('/0/settings/supporter', true, expect.anything());
      expect(settingsStore.supporter).toBe(true);
    });

    test('clearing it saves false when the server already had true', async () => {
      const post = fakeServer({ theme: 'light', supporter: true });
      settingsStore.$patch({ supporter: false });
      await settingsStore.update({ supporter: false });
      expect(post).toHaveBeenCalledWith('/0/settings/supporter', false, expect.anything());
    });
  });
});
