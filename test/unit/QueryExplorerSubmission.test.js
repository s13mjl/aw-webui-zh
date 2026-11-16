import QueryExplorer from '~/views/QueryExplorer.vue';
import { i18n } from '~/i18n';

const mockCategories = { classes_for_query: [] };
jest.mock('~/stores/categories', () => ({ useCategoryStore: () => mockCategories }));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const oldEvents = [{ duration: 10, data: { title: 'Old' } }];
const newEvents = [{ duration: 20, data: { title: 'New' } }];
const initialEvents = [{ duration: 30, data: { title: 'Initial' } }];

function makeVm(query) {
  return {
    $t: (key, values) => i18n.t(key, values),
    $aw: { query },
    query_code: 'RETURN = "old";',
    startdate: '2026-10-01',
    enddate: '2026-10-03',
    events: initialEvents,
    error: '',
    query_request: null,
  };
}

function overlappingQueries() {
  const old = deferred();
  const recent = deferred();
  const query = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise);
  const vm = makeVm(query);
  const first = QueryExplorer.methods.query.call(vm);
  vm.query_code = 'RETURN = "new";';
  const second = QueryExplorer.methods.query.call(vm);
  expect(query).toHaveBeenCalledTimes(2);
  return { vm, old, recent, first, second };
}

describe('Query Explorer 最新提交归属', () => {
  beforeEach(() => {
    mockCategories.classes_for_query = [];
  });

  test.each(['old-first', 'new-first'])('只有最新成功结果会发布（%s）', async order => {
    const { vm, old, recent, first, second } = overlappingQueries();
    if (order === 'old-first') {
      old.resolve([oldEvents]);
      await first;
      expect(vm.events).toEqual(initialEvents);
    }
    recent.resolve([newEvents]);
    await second;
    if (order === 'new-first') {
      old.resolve([oldEvents]);
      await first;
    }
    expect(vm.events).toEqual(newEvents);
    expect(vm.error).toBe('');
  });

  test.each(['old-first', 'new-first'])('过期失败不影响最新成功（%s）', async order => {
    const { vm, old, recent, first, second } = overlappingQueries();
    if (order === 'old-first') {
      old.reject({ response: { data: { message: 'Old failure' } } });
      await first;
      expect(vm.error).toBe('');
    }
    recent.resolve([newEvents]);
    await second;
    if (order === 'new-first') {
      old.reject({ response: { data: { message: 'Old failure' } } });
      await first;
    }
    expect(vm.events).toEqual(newEvents);
    expect(vm.error).toBe('');
  });

  test.each(['old-first', 'new-first'])('过期成功不会清除当前失败（%s）', async order => {
    const { vm, old, recent, first, second } = overlappingQueries();
    if (order === 'old-first') {
      old.resolve([oldEvents]);
      await first;
      expect(vm.events).toEqual(initialEvents);
    }
    recent.reject({ response: { data: { message: 'Current failure' } } });
    await second;
    if (order === 'new-first') {
      old.resolve([oldEvents]);
      await first;
    }
    expect(vm.events).toEqual(initialEvents);
    expect(vm.error).toBe('Current failure');
  });

  test('过期失败不能替换当前失败', async () => {
    const { vm, old, recent, first, second } = overlappingQueries();
    recent.reject({ response: { data: { message: 'Current failure' } } });
    await second;
    old.reject(new Error('Old offline failure'));
    await expect(first).resolves.toBeUndefined();
    expect(vm.error).toBe('Current failure');
  });

  test.each([
    [{ response: { data: { message: 'Invalid query' } }, message: 'Request failed' }, 'Invalid query'],
    [new Error('offline'), 'offline'],
    [{ response: {} }, 'The query request failed.'],
    [null, 'The query request failed.'],
    [undefined, 'The query request failed.'],
    ['Connection lost', 'Connection lost'],
  ])('安全地提取当前失败信息：%p', async (failure, message) => {
    const vm = makeVm(jest.fn().mockRejectedValue(failure));
    await expect(QueryExplorer.methods.query.call(vm)).resolves.toBeUndefined();
    expect(vm.error).toBe(message);
    expect(vm.events).toEqual(initialEvents);
  });

  test.each(['success', 'failure'])(
    '新提交的校验失败会作废待处理请求（%s）',
    async outcome => {
      const request = deferred();
      const query = jest.fn().mockReturnValue(request.promise);
      const vm = makeVm(query);
      const first = QueryExplorer.methods.query.call(vm);
      vm.query_code = 'RETURN = __CATEGORIES__;';
      await QueryExplorer.methods.query.call(vm);
      const message = i18n.t('queryExplorer.categoriesMissing');
      expect(vm.error).toBe(message);
      expect(query).toHaveBeenCalledTimes(1);
      if (outcome === 'success') request.resolve([oldEvents]);
      else request.reject({ response: { data: { message: 'Obsolete failure' } } });
      await first;
      expect(vm.events).toEqual(initialEvents);
      expect(vm.error).toBe(message);
    }
  );
});
