import Component from '~/visualizations/TopBucketData.vue';

const TopBucketData: any = Component;
const mockGetEvents = jest.fn();
jest.mock('~/util/awclient', () => ({ getClient: () => ({ getEvents: mockGetEvents }) }));
jest.mock('~/stores/activity', () => ({ useActivityStore: () => ({ query_options: {} }) }));
jest.mock('~/stores/buckets', () => ({ useBucketsStore: () => ({}) }));

function deferred<T = any>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  // 防止 Node 在 catch 处理器挂载前把 reject 判为未处理拒绝。
  promise.catch(() => undefined);
  return { promise, resolve, reject };
}
const events = (label: string) => [{ duration: 10, data: { label } }];
const tick = () => Promise.resolve();
function instance() {
  const vm: any = {
    ...TopBucketData.data.call({}),
    selectedBucketId: 'bucket-a',
    selectedField: 'label',
    timeRange: { start: '2026-10-20', end: '2026-10-21' },
    $t: (key: string) => key,
  };
  Object.defineProperty(vm, 'selectedFieldValue', {
    get: () => (vm.selectedField === '__custom' ? vm.customField : vm.selectedField),
  });
  for (const [key, method] of Object.entries(TopBucketData.methods)) {
    vm[key] = (method as (...args: any[]) => any).bind(vm);
  }
  return vm;
}

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

test.each(['日期变化', '刷新', '切换 bucket 后返回'])('%s 忽略过期成功结果', async mode => {
  const old = deferred();
  const middle = deferred();
  const current = deferred();
  mockGetEvents.mockReturnValueOnce(old.promise);
  if (mode === '切换 bucket 后返回') mockGetEvents.mockReturnValueOnce(middle.promise);
  mockGetEvents.mockReturnValueOnce(current.promise);
  const vm = instance();
  const first = vm.loadEvents();
  await tick();
  if (mode === '日期变化') vm.timeRange = { start: '2026-10-21', end: '2026-10-22' };
  if (mode === '切换 bucket 后返回') {
    vm.selectedBucketId = 'bucket-b';
    const midLoad = vm.loadEvents();
    await tick();
    middle.resolve(events('BUCKET B'));
    await midLoad;
    vm.selectedBucketId = 'bucket-a';
  }
  const second = vm.loadEvents();
  await tick();
  current.resolve(events('NEW'));
  await second;
  old.resolve(events('OLD'));
  await first;
  expect(vm.events).toEqual(events('NEW'));
  expect(vm.aggregated[0].data.display).toBe('NEW');
  expect(vm.error).toBe('');
  expect(vm.loading).toBe(false);
});

test('过期失败不会清掉当前结果或发布错误', async () => {
  const old = deferred();
  mockGetEvents.mockReturnValueOnce(old.promise).mockResolvedValueOnce(events('NEW'));
  const vm = instance();
  const first = vm.loadEvents();
  await tick();
  await vm.loadEvents();
  old.reject(new Error('OLD FAILURE'));
  await first;
  expect(vm.events).toEqual(events('NEW'));
  expect(vm.fieldOptions).toEqual(['label']);
  expect(vm.error).toBe('');
});

test.each(['成功', '失败'])('过期 %s 不能提前关闭仍在进行的加载', async outcome => {
  const old = deferred();
  const current = deferred();
  mockGetEvents.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
  const vm = instance();
  const first = vm.loadEvents();
  await tick();
  const second = vm.loadEvents();
  await tick();
  if (outcome === '成功') old.resolve(events('OLD'));
  else old.reject(new Error('OLD FAILURE'));
  await first;
  expect(vm.loading).toBe(true);
  expect(vm.events).toEqual([]);
  current.resolve(events('NEW'));
  await second;
  expect(vm.loading).toBe(false);
});

test.each(['空 bucket', '缺少时间范围'])('%s 使进行中的请求失效', async mode => {
  const old = deferred();
  mockGetEvents.mockReturnValueOnce(old.promise);
  const vm = instance();
  const first = vm.loadEvents();
  await tick();
  if (mode === '空 bucket') vm.selectedBucketId = '';
  else vm.timeRange = null;
  await vm.loadEvents();
  old.resolve(events('OLD'));
  await first;
  expect(vm.events).toEqual([]);
  expect(vm.aggregated).toEqual([]);
  expect(vm.loading).toBe(false);
});

test('当前加载失败时上报并清除旧结果', async () => {
  mockGetEvents.mockRejectedValue(new Error('CURRENT FAILURE'));
  const vm = instance();
  vm.events = events('PREVIOUS');
  await vm.loadEvents();
  expect(vm.events).toEqual([]);
  expect(vm.fieldOptions).toEqual([]);
  expect(vm.error).toBe('CURRENT FAILURE');
  expect(vm.loading).toBe(false);
});

test('顺序加载保留各自时间范围并正常发现字段', async () => {
  mockGetEvents.mockResolvedValueOnce(events('FIRST')).mockResolvedValueOnce(events('SECOND'));
  const vm = instance();
  vm.selectedField = '';
  await vm.loadEvents();
  expect(vm.selectedField).toBe('label');
  vm.timeRange = { start: '2026-10-21', end: '2026-10-22' };
  await vm.loadEvents();
  expect(mockGetEvents.mock.calls.map(call => call[1])).toEqual([
    { start: '2026-10-20', end: '2026-10-21', limit: -1 },
    { start: '2026-10-21', end: '2026-10-22', limit: -1 },
  ]);
  expect(vm.events).toEqual(events('SECOND'));
});
