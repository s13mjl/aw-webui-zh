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
    setItem: {
      value: (k, v) => {
        ls[k] = String(v);
      },
    },
    removeItem: {
      value: k => {
        delete ls[k];
      },
    },
    clear: { value: () => Object.keys(ls).forEach(k => delete ls[k]) },
  });
  (global as any).localStorage = ls;
}

const newSession = () => {
  setActivePinia(createPinia());
  return useSettingsStore();
};

describe('settings 仅持久化显式更新的键', () => {
  let server;

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
    const read = new Promise(resolve => {
      release = resolve;
    });
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
});

describe('settings 布局偏好（文字大小 / 内容宽度）', () => {
  let server;

  beforeEach(() => {
    installLocalStorage();
    server = { theme: 'auto', startOfWeek: 'Monday' };
    mockGetSettings.mockReset().mockImplementation(async () => copy(server));
    mockPost.mockReset().mockImplementation(async (url, value) => {
      server[url.replace('/0/settings/', '')] = copy(value);
      return {};
    });
  });

  test('默认文字大小 100、宽度 0（自动）', async () => {
    const store = newSession();
    await store.load();
    expect(store.textSize).toBe(100);
    expect(store.contentWidth).toBe(0);
  });

  test('本地回退生效，服务端值优先', async () => {
    localStorage.setItem('textSize', '80');
    localStorage.setItem('contentWidth', '600');
    const store = newSession();
    await store.load();
    expect([store.textSize, store.contentWidth]).toEqual([80, 600]);

    mockGetSettings.mockResolvedValue({ textSize: 150, contentWidth: 2400 });
    await store.load();
    expect([store.textSize, store.contentWidth]).toEqual([150, 2400]);
  });

  test.each([null, true, '120', -1, 79, 151, NaN, Infinity, {}, 110.5])(
    '非法服务端文字大小 %p 回退默认值',
    async value => {
      const store = newSession();
      store.$patch({ textSize: 125 });
      mockGetSettings.mockResolvedValue({ textSize: value });
      await store.load();
      expect(store.textSize).toBe(100);
    }
  );

  test.each([null, false, '1000', -1, 1, 599, 2401, NaN, Infinity, {}, 800.5])(
    '非法服务端宽度 %p 回退自动（0）',
    async value => {
      mockGetSettings.mockResolvedValue({ contentWidth: value });
      const store = newSession();
      await store.load();
      expect(store.contentWidth).toBe(0);
    }
  );

  test.each(['', 'null', 'bad', 'true', 'Infinity', '-1', '79', '151'])(
    '非法本地文字大小 %p 回退默认值',
    async value => {
      localStorage.setItem('textSize', value);
      const store = newSession();
      await store.load();
      expect(store.textSize).toBe(100);
    }
  );

  test.each(['', 'null', 'bad', 'false', 'Infinity', '-1', '599', '2401', '900.5'])(
    '非法本地宽度 %p 回退自动（0）',
    async value => {
      localStorage.setItem('contentWidth', value);
      const store = newSession();
      await store.load();
      expect(store.contentWidth).toBe(0);
    }
  );

  test('非法更新在落库与提交前被拒绝，两项均保持原值', async () => {
    const store = newSession();
    await store.load();
    await expect(store.update({ textSize: 120, contentWidth: 599 })).rejects.toThrow('Invalid');
    expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
    expect(postedKeys()).toEqual([]);
  });

  test('重载时服务端缺失的键回退默认，不保留过期状态', async () => {
    const store = newSession();
    await store.load();
    store.$patch({ textSize: 140, contentWidth: 1800 });
    mockGetSettings.mockResolvedValue({});
    await store.load();
    expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
  });

  test('两项独立更新可跨会话持久化，重置后本地不残留键', async () => {
    let store = newSession();
    await store.load();
    await store.update({ textSize: 140 });
    expect(store.contentWidth).toBe(0);
    await store.update({ contentWidth: 1800 });
    expect(store.textSize).toBe(140);

    setActivePinia(createPinia());
    store = useSettingsStore();
    await store.load();
    expect([store.textSize, store.contentWidth]).toEqual([140, 1800]);

    await store.update({ textSize: 100, contentWidth: 0 });
    setActivePinia(createPinia());
    store = useSettingsStore();
    await store.load();
    expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
    expect(localStorage.getItem('textSize')).toBeNull();
    expect(localStorage.getItem('contentWidth')).toBeNull();
  });

  test('保存失败只回滚本次改动的外观值，不影响另一项', async () => {
    const store = newSession();
    await store.load();
    await store.update({ contentWidth: 1200 });
    mockPost.mockRejectedValue(new Error('offline'));
    await expect(store.update({ textSize: 130 })).rejects.toThrow('offline');
    expect([store.textSize, store.contentWidth]).toEqual([100, 1200]);
  });
});
