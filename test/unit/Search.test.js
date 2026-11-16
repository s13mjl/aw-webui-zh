import Search from '~/views/Search.vue';

const mockBuckets = {
  ensureLoaded: jest.fn(),
  bucketsBrowser: jest.fn(),
};

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => mockBuckets,
}));

const browserEvent = {
  id: 1,
  timestamp: '2026-10-16T12:00:00Z',
  duration: 10,
  data: { url: 'https://example.com', title: 'Example' },
};
const windowEvent = {
  timestamp: '2026-10-16T11:00:00Z',
  duration: 20,
  data: { app: 'Firefox', title: 'Example', $category: ['searched'] },
};

function searchVm(query) {
  return {
    ...Search.data(),
    pattern: 'example',
    queryOptions: {
      hostname: 'browser-only',
      start: '2026-10-16',
      stop: '2026-10-17',
      filter_afk: true,
    },
    $aw: { query },
    $t: (key, params) => `${key}: ${params?.error ?? ''}`,
  };
}

describe('Search query failure isolation（同步上游 #1025）', () => {
  beforeEach(() => {
    mockBuckets.ensureLoaded.mockResolvedValue(undefined);
    mockBuckets.bucketsBrowser.mockReturnValue(['aw-watcher-web-firefox_browser-only']);
    jest.spyOn(console, 'error').mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('窗口查询在仅浏览器主机上失败时仍保留浏览器结果', async () => {
    const query = jest
      .fn()
      .mockRejectedValueOnce({ response: { data: { message: 'Window bucket not found' } } })
      .mockResolvedValueOnce([[browserEvent, browserEvent]]);
    const vm = searchVm(query);

    await Search.methods.search.call(vm);

    expect(vm.browserEvents).toEqual([browserEvent]);
    expect(vm.events).toEqual([]);
    expect(vm.error).toContain('Window bucket not found');
    expect(vm.status).toBeNull();
  });

  test('浏览器查询失败时保留窗口结果并去掉合成分类', async () => {
    const vm = searchVm(
      jest
        .fn()
        .mockResolvedValueOnce([[windowEvent]])
        .mockRejectedValueOnce(new Error('Browser failed'))
    );

    await Search.methods.search.call(vm);

    expect(vm.events).toEqual([{ ...windowEvent, data: { app: 'Firefox', title: 'Example' } }]);
    expect(vm.browserEvents).toEqual([]);
    expect(vm.error).toContain('Browser failed');
    expect(vm.status).toBeNull();
  });

  test('两边都失败时清空旧结果并报告错误', async () => {
    const vm = searchVm(jest.fn().mockRejectedValue(new Error('Invalid regex')));
    vm.events = [windowEvent];
    vm.browserEvents = [browserEvent];

    await Search.methods.search.call(vm);

    expect(vm.events).toEqual([]);
    expect(vm.browserEvents).toEqual([]);
    expect(vm.error).toContain('Invalid regex');
    expect(vm.status).toBeNull();
  });

  test('没有浏览器存储桶时只查窗口', async () => {
    mockBuckets.bucketsBrowser.mockReturnValue([]);
    const query = jest.fn().mockResolvedValue([[windowEvent]]);
    const vm = searchVm(query);

    await Search.methods.search.call(vm);

    expect(query).toHaveBeenCalledTimes(1);
    expect(vm.events).toHaveLength(1);
    expect(vm.browserEvents).toEqual([]);
    expect(vm.error).toBe('');
  });

  test('浏览器存储桶发现失败时仍搜索窗口', async () => {
    mockBuckets.ensureLoaded.mockRejectedValueOnce(new Error('Bucket list unavailable'));
    const query = jest.fn().mockResolvedValue([[windowEvent]]);
    const vm = searchVm(query);

    await Search.methods.search.call(vm);

    expect(query).toHaveBeenCalledTimes(1);
    expect(vm.events).toHaveLength(1);
    expect(vm.browserEvents).toEqual([]);
    expect(vm.status).toBeNull();
  });

  test('过期搜索的结果不覆盖新提交', async () => {
    let release;
    const gate = new Promise(resolve => (release = resolve));
    const query = jest.fn(async () => {
      await gate;
      return [[windowEvent]];
    });
    const vm = searchVm(query);
    const inFlight = Search.methods.search.call(vm);

    vm.events = [{ timestamp: 'fresh' }];
    vm.browserEvents = [];
    vm.searchSequence += 1;
    release();
    await inFlight;

    expect(vm.events).toEqual([{ timestamp: 'fresh' }]);
  });
});
