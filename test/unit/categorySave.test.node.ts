import { createPinia, setActivePinia } from 'pinia';
import { useCategoryStore } from '~/stores/categories';
import { Category } from '~/util/classes';

const mockUpdate = jest.fn();
jest.mock('~/stores/settings', () => ({
  useSettingsStore: () => ({ update: mockUpdate }),
}));

// 走真实的持久化 helper（含其 payload 构造），仅绕过 test 模式的禁写保护，
// 不绕过 store 的异步保存路径。同步上游 #1228。
jest.mock('~/util/classes', () => {
  const actual = jest.requireActual('~/util/classes');
  return {
    ...actual,
    saveCategories: (...args) => {
      const env = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        return actual.saveCategories(...args);
      } finally {
        process.env.NODE_ENV = env;
      }
    },
  };
});

const category = (name: string): Category => ({
  name: [name],
  rule: { type: 'regex', regex: name.toLowerCase() },
});
const deferred = () => {
  let resolve: () => void;
  let reject: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: () => resolve(), reject: (error: Error) => reject(error) };
};
const clone = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
let store: ReturnType<typeof useCategoryStore>;
let writes: any[];
let requests: ReturnType<typeof deferred>[];

beforeEach(() => {
  setActivePinia(createPinia());
  store = useCategoryStore();
  store.category_sets = [
    { id: 'mine', categories: [category('A')] },
    { id: 'other', categories: [category('Other')] },
  ];
  store.active_set_ids = ['mine'];
  store.discardChanges();
  store.classes_unsaved_changes = true;
  writes = [];
  requests = [];
  mockUpdate.mockReset().mockImplementation(value => {
    writes.push(value);
    const request = deferred();
    requests.push(request);
    return request.promise;
  });
});

test('未变更的完成只确认已保存的隔离快照', async () => {
  const saving = store.save();
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  expect(store.classes_unsaved_changes).toBe(true);
  expect(writes[0].classes.map(c => c.name)).toEqual([['A']]);
  expect(writes[0].active_set_ids).toEqual(['mine']);
  requests[0].resolve();
  await saving;
  expect(store.classes_unsaved_changes).toBe(false);
});

const mutations: [string, (s: ReturnType<typeof useCategoryStore>) => void][] = [
  ['add', s => s.addClass(category('B'))],
  ['edit', s => s.updateClass({ ...s.get_category(['A']), rule: { type: 'regex', regex: 'edited' } })],
  ['remove', s => s.removeClass(s.classes[0].id)],
  ['append rule', s => s.appendClassRule(s.classes[0].id, 'new')],
  ['import', s => s.import([category('Imported')])],
  ['clear', s => s.clearAll()],
  ['restore defaults', s => s.restoreDefaultClasses()],
  ['create set', s => s.createSet('new')],
  ['delete set', s => s.deleteSet('other')],
  ['rename set', s => s.renameSet('mine', 'renamed')],
  ['switch set', s => s.switchToSet('other')],
  ['active sets', s => s.setActiveSets(['mine', 'other'])],
  // 设置页也会直接改写导入集合的内容。
  ['direct set edit', s => s.category_sets[1].categories.push(category('Imported'))],
  ['direct active IDs edit', s => s.active_set_ids.push('other')],
];

test.each(mutations)('%s 在持久化进行中修改时保持未保存', async (_name, mutate) => {
  const saving = store.save();
  const submitted = clone(writes[0]);
  mutate(store);
  expect(writes[0]).toEqual(submitted);
  requests[0].resolve();
  await saving;
  expect(store.classes_unsaved_changes).toBe(true);
});

test('写入失败保留脏状态且未变更的重试可确认', async () => {
  const saving = store.save();
  requests[0].reject(new Error('offline'));
  await expect(saving).rejects.toThrow('offline');
  expect(store.classes_unsaved_changes).toBe(true);
  const retry = store.save();
  expect(mockUpdate).toHaveBeenCalledTimes(2);
  requests[1].resolve();
  await retry;
  expect(store.classes_unsaved_changes).toBe(false);
});

test.each([false, true])('重叠保存串行写入（首个失败：%s）', async failFirst => {
  const first = store.save();
  const firstResult = first.catch(error => error);
  store.addClass(category('B'));
  const second = store.save();
  store.addClass(category('C'));
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  if (failFirst) requests[0].reject(new Error('offline'));
  else requests[0].resolve();
  await firstResult;
  await flush();
  expect(mockUpdate).toHaveBeenCalledTimes(2);
  expect(writes[1].classes.map(c => c.name)).toEqual([['A'], ['B']]);
  expect(store.classes_unsaved_changes).toBe(true);
  requests[1].resolve();
  await second;
  expect(store.classes_unsaved_changes).toBe(true); // C 从未提交。
  const third = store.save();
  requests[2].resolve();
  await third;
  expect(store.classes_unsaved_changes).toBe(false);
});

test('较早的相同快照在另一份快照排队时仍保持脏状态', async () => {
  const first = store.save();
  store.addClass(category('B'));
  const second = store.save();
  store.removeClass(store.get_category(['B']).id); // 当前内容又和第一份一致。
  requests[0].resolve();
  await first;
  await flush();
  expect(store.classes_unsaved_changes).toBe(true);
  requests[1].resolve();
  await second;
  expect(store.classes_unsaved_changes).toBe(true); // 已持久化 B，当前无 B。
});

test('不同 Pinia store 之间互不阻塞', async () => {
  const first = store.save();
  const other = useCategoryStore(createPinia());
  other.load([category('Separate')]);
  const second = other.save();
  expect(mockUpdate).toHaveBeenCalledTimes(2);
  requests[1].resolve(); // 独立 store 可以按相反顺序完成。
  await second;
  expect(other.classes_unsaved_changes).toBe(false);
  expect(store.classes_unsaved_changes).toBe(true);
  requests[0].resolve();
  await first;
});
