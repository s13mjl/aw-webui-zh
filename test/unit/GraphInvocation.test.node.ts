import GraphComponent from '~/views/Graph.vue';
import { getClient as getClientImpl } from '~/util/awclient';
import { i18n } from '~/i18n';

// 上游 #1248：Graph Generate 的请求归属/竞态修复。本地用纯逻辑方式驱动
// 组件方法（不经 DOM），验证只有最近一次调用能发布结果与错误、并快照选项。
jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));

const Graph: any = GraphComponent;
const getClient = getClientImpl as jest.Mock;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const event = (name: string) => ({
  timestamp: '2026-01-01T12:00:00Z',
  duration: 60,
  data: { title: `TITLE_${name}`, app: `APP_${name}`, $category: [name] },
});

function makeVm(overrides: Record<string, any> = {}) {
  return {
    queryOptions: { hostname: 'OLD', filter_afk: true, start: '2026-01-01', stop: '2026-01-02' },
    excludeUncategorized: false,
    maxDepth: 3,
    status: null,
    error: '',
    events: null,
    graphdata: {},
    queryTime: null,
    generateRequest: null,
    categoryStore: { classes_for_query: [], get_category_color: () => '#336699' },
    $t: (key: string, values?: any) => i18n.t(key, values),
    generate: Graph.methods.generate,
    fetchEvents: Graph.methods.fetchEvents,
    // 本分支仍是旧的 Set + for...of 实现，在 jest 的 ES5 降级转译下不产生节点；
    // 图数据本身属 #1219 范畴，这里用一个可检视的桩只验证“结果发布归属”。
    generateGraphData: jest.fn((events: any[]) => ({
      nodes: events.map(e => ({ id: e.data.$category.join('>') })),
      links: [],
    })),
    ...overrides,
  } as any;
}

function nodeIds(vm: any): string[] {
  return (vm.graphdata.nodes || []).map((n: any) => n.id);
}

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('Graph Generate 请求归属', () => {
  test('乱序完成时只发布最新一次 Generate 的结果，并各自快照 hostname', async () => {
    const old = deferred<any[]>();
    const recent = deferred<any[]>();
    const query = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise);
    getClient.mockReturnValue({ query });
    const vm = makeVm();

    const first = vm.generate();
    vm.queryOptions = { ...vm.queryOptions, hostname: 'NEW' };
    const second = vm.generate();
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][1].join('\n')).toContain('aw-watcher-window_OLD');
    expect(query.mock.calls[1][1].join('\n')).toContain('aw-watcher-window_NEW');

    // 新请求先完成，再完成旧请求：旧结果不得覆盖新结果。
    recent.resolve([[event('NEW')]]);
    await second;
    old.resolve([[event('OLD')]]);
    await first;

    expect(nodeIds(vm)).toEqual(['NEW']);
    expect(vm.events).toEqual([event('NEW')]);
    expect(vm.error).toBe('');
    expect(vm.status).toBeNull();
  });

  test('过期失败不能清除进行中的状态或替换已有结果', async () => {
    const old = deferred<any[]>();
    const recent = deferred<any[]>();
    const query = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise);
    getClient.mockReturnValue({ query });
    const vm = makeVm();

    const first = vm.generate();
    vm.queryOptions = { ...vm.queryOptions, hostname: 'NEW' };
    const second = vm.generate();

    old.reject(new Error('OLD FAILURE'));
    await first;
    expect(vm.status).toBe('searching');
    expect(vm.error).toBe('');
    expect(nodeIds(vm)).not.toEqual(['OLD']);

    recent.resolve([[event('NEW')]]);
    await second;
    expect(vm.status).toBeNull();
    expect(nodeIds(vm)).toEqual(['NEW']);
  });

  test('过期成功不能清除当前失败', async () => {
    const old = deferred<any[]>();
    const recent = deferred<any[]>();
    const query = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise);
    getClient.mockReturnValue({ query });
    const vm = makeVm();

    const first = vm.generate();
    vm.queryOptions = { ...vm.queryOptions, hostname: 'NEW' };
    const second = vm.generate();

    recent.reject({ response: { data: { message: 'Current failure' } } });
    await second;
    old.resolve([[event('OLD')]]);
    await first;

    expect(vm.error).toBe('Current failure');
    expect(vm.events).toBeNull();
    expect(vm.graphdata).toEqual({});
    expect(vm.status).toBeNull();
  });

  test('生成期间控件变化不影响已提交的深度快照', async () => {
    const response = deferred<any[]>();
    getClient.mockReturnValue({ query: jest.fn().mockReturnValue(response.promise) });
    const vm = makeVm({ maxDepth: 1 });

    const generation = vm.generate();
    vm.maxDepth = 2;
    const submitted = event('Work');
    submitted.data.$category = ['Work', 'Code'];
    response.resolve([[submitted]]);
    await generation;

    expect(vm.maxDepth).toBe(2);
    // 渲染必须使用提交时的深度快照（1），而不是当前控件值（2）。
    expect(vm.generateGraphData.mock.calls[0][1]).toBe(1);
    expect(nodeIds(vm)).toEqual(['Work>Code']);
    expect(vm.events).toEqual([submitted]);
    expect(vm.status).toBeNull();
  });

  test.each([
    [{ response: { data: { message: 'Invalid query' } }, message: 'Request failed' }, 'Invalid query'],
    [new Error('synthetic offline'), 'synthetic offline'],
    [{ response: {} }, 'The request failed.'],
    [null, 'The request failed.'],
    ['Connection lost', 'Connection lost'],
  ])('失败文案与清空逻辑（i18n 键不硬编码）', async (failure, message) => {
    getClient.mockReturnValue({ query: jest.fn().mockRejectedValue(failure) });
    const vm = makeVm();

    await vm.generate();

    expect(vm.error).toBe(message);
    expect(vm.events).toBeNull();
    expect(vm.graphdata).toEqual({});
    expect(vm.status).toBeNull();
  });

  test('失败后重试可以发布新图', async () => {
    const retry = deferred<any[]>();
    const query = jest
      .fn()
      .mockRejectedValueOnce(new Error('synthetic offline'))
      .mockReturnValueOnce(retry.promise);
    getClient.mockReturnValue({ query });
    const vm = makeVm();

    await vm.generate();
    expect(vm.error).toBe('synthetic offline');

    const second = vm.generate();
    expect(vm.status).toBe('searching');
    expect(vm.error).toBe('');
    retry.resolve([[event('RETRY')]]);
    await second;

    expect(vm.error).toBe('');
    expect(nodeIds(vm)).toEqual(['RETRY']);
    expect(vm.status).toBeNull();
  });
});
