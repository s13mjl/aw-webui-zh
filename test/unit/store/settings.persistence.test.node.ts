const mockGetSettings = jest.fn();
const mockPost = jest.fn();
const mockDefaults = { timeout: 0 };

jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    get_settings: mockGetSettings,
    req: { post: mockPost, defaults: mockDefaults },
  }),
}));

import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from '~/stores/settings';

const copy = value => JSON.parse(JSON.stringify(value));
const postedKeys = () => mockPost.mock.calls.map(([url]) => url.replace('/0/settings/', ''));

// node 环境没有 localStorage；提供一个可枚举键的最小实现，供 load/save 使用。
function installLocalStorage() {
  const ls = {};
  Object.defineProperties(ls, {
    getItem: { value: k => (k in ls ? ls[k] : null) },
    setItem: { value: (k, v) => { ls[k] = String(v); } },
    removeItem: { value: k => { delete ls[k]; } },
    clear: { value: () => Object.keys(ls).forEach(k => delete ls[k]) },
  });
  (global as any).localStorage = ls;
}

describe('settings 仅持久化显式更新的键', () => {
  let server;
  const newSession = () => {
    setActivePinia(createPinia());
    return useSettingsStore();
  };

  beforeEach(() => {
    installLocalStorage();
    server = { theme: 'auto', startOfWeek: 'Monday' };
    mockDefaults.timeout = 0;
    mockGetSettings.mockReset().mockImplementation(async () => copy(server));
    mockPost.mockReset().mockImplementation(async (url, value) => {
      server[url.replace('/0/settings/', '')] = copy(value);
      return {};
    });
  });

  test('update 只提交本次显式改动的键，不回写整份状态', async () => {
    const a = newSession();
    const b = newSession();
    await a.load();
    await b.load();
    await a.update({ theme: 'dark' });
    mockPost.mockClear();

    await b.update({ startOfWeek: 'Sunday' });

    expect(postedKeys()).toEqual(['startOfWeek']);
    expect(server).toEqual({ theme: 'dark', startOfWeek: 'Sunday' });
  });

  test('save([]) 不写任何键，也不会提交仅存在于本地的差异', async () => {
    const store = newSession();
    await store.load();
    server.theme = 'dark';
    store.theme = 'light';

    await store.save([]);

    expect(postedKeys()).toEqual([]);
    expect(store.theme).toBe('dark');
  });

  test('save 在网络等待前捕获嵌套值快照', async () => {
    const store = newSession();
    await store.load();
    store.$patch({ newReleaseCheckData: { timesChecked: 2 } });
    let release;
    const read = new Promise(resolve => { release = resolve; });
    mockGetSettings.mockImplementationOnce(async () => {
      await read;
      return copy(server);
    });

    const saving = store.save(['newReleaseCheckData']);
    store.$patch({ newReleaseCheckData: { timesChecked: 3 } });
    release();
    await saving;

    expect(postedKeys()).toEqual(['newReleaseCheckData']);
    expect(server.newReleaseCheckData.timesChecked).toBe(2);
  });

  test('a delayed read cannot undo a newer supporter save', async () => {
    server.supporter = false;
    const store = newSession();
    await store.load();
    let release;
    const gate = new Promise(resolve => {
      release = resolve;
    });
    const oldSettings = copy(server);
    mockGetSettings.mockImplementationOnce(async () => {
      await gate;
      return oldSettings;
    });

    const homeReload = store.load();
    await store.update({ supporter: true });
    expect(store.supporter).toBe(true);
    release();
    await homeReload;

    expect(server.supporter).toBe(true);
    expect(store.supporter).toBe(true);
  });

  test('newer reads supersede older responses within a store, not across sessions', async () => {
    const a = newSession();
    const b = newSession();
    let release;
    const gate = new Promise(resolve => {
      release = resolve;
    });
    const oldSettings = copy(server);
    mockGetSettings.mockImplementationOnce(async () => {
      await gate;
      return oldSettings;
    });
    const older = a.load();
    server.theme = 'dark';
    await a.load();
    // Loading another session must not invalidate a's latest response.
    await b.load();
    release();
    await older;

    expect(a.theme).toBe('dark');
    expect(b.theme).toBe('dark');
  });

  test("a read in another session does not discard this session's pending refresh", async () => {
    const a = newSession();
    const b = newSession();
    server.theme = 'dark';
    let release;
    const gate = new Promise(resolve => {
      release = resolve;
    });
    mockGetSettings.mockImplementationOnce(async () => {
      await gate;
      return copy(server);
    });
    const pendingRead = a.load();
    await b.load();
    release();
    await pendingRead;

    expect(a.loaded).toBe(true);
    expect(a.theme).toBe('dark');
    expect(b.theme).toBe('dark');
  });
});
