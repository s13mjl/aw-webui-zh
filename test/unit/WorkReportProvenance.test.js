import { createPinia, setActivePinia } from 'pinia';
import WorkReportComponent from '~/views/WorkReport.vue';
import { getClient } from '~/util/awclient';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));

const WorkReport = WorkReportComponent;
const periods = ['2026-10-29T04:00:00Z/2026-10-30T04:00:00Z'];
const result = () => [{ events: [], duration: 3600 }];
let query;

function context() {
  const ctx = {
    ...WorkReport.data(),
    $t: key => key,
  };
  for (const [key, method] of Object.entries(WorkReport.methods)) {
    ctx[key] = method.bind(ctx);
  }
  for (const [key, getter] of Object.entries(WorkReport.computed)) {
    Object.defineProperty(ctx, key, { get: () => getter.call(ctx) });
  }
  ctx.downloadFile = jest.fn();
  ctx.getTimeperiods = () => [...periods];
  ctx.selectedHosts = ['desktop'];
  ctx.selectedCategories = ['["Work"]'];
  ctx.categoryStore = {
    all_categories: [['Work'], ['Work', 'Code'], ['Leisure']],
    classes_for_query: [],
  };
  ctx.bucketsStore = {
    buckets: [
      { id: 'aw-watcher-window_desktop', hostname: 'desktop', type: 'currentwindow' },
      { id: 'aw-watcher-afk_desktop', hostname: 'desktop', type: 'afkstatus' },
    ],
  };
  return ctx;
}

function exported(ctx) {
  ctx.exportJSON();
  return JSON.parse(ctx.downloadFile.mock.calls.slice(-1)[0][0]);
}

beforeEach(() => {
  setActivePinia(createPinia());
  query = jest.fn().mockResolvedValue(result());
  getClient.mockReturnValue({ query });
  jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

test('导出实际产出结果的计算输入与有效查询范围', async () => {
  const ctx = context();
  await ctx.loadData();
  const data = exported(ctx);
  expect(data.parameters).toEqual({
    categories: ['["Work"]'],
    breakTime: 5,
    dateRange: 'last7d',
    hosts: ['desktop'],
    timeperiods: periods,
    expandedCategories: [['Work'], ['Work', 'Code']],
  });
  expect(data.summary.totalDuration).toBe(3600);
  expect(data.rawEvents).toEqual(result());
  expect(query.mock.calls[0][0]).toEqual(data.parameters.timeperiods);
});

test('生成后修改表单与嵌套分类不会改写已有报告', async () => {
  const ctx = context();
  await ctx.loadData();
  const original = exported(ctx);
  ctx.selectedCategories.splice(0, 1, '["Leisure"]');
  ctx.selectedHosts.push('other');
  ctx.categoryStore.all_categories[1].push('Changed');
  ctx.breakTime = 30;
  ctx.dateRange = 'last30d';
  expect(exported(ctx)).toEqual(original);
});

test('查询未完成时捕获的输入与随后返回的结果一起发布', async () => {
  const ctx = context();
  let resolve;
  query.mockImplementation(() => new Promise(r => (resolve = r)));
  const calculation = ctx.loadData();
  ctx.selectedCategories[0] = '["Leisure"]';
  ctx.selectedHosts[0] = 'other';
  ctx.breakTime = 30;
  ctx.dateRange = 'last30d';
  ctx.categoryStore.all_categories[1].push('Changed');
  resolve(result());
  await calculation;
  expect(exported(ctx).parameters).toEqual({
    categories: ['["Work"]'],
    breakTime: 5,
    dateRange: 'last7d',
    hosts: ['desktop'],
    timeperiods: periods,
    expandedCategories: [['Work'], ['Work', 'Code']],
  });
});

test('重新计算失败保留上次成功的数据与元数据', async () => {
  const ctx = context();
  await ctx.loadData();
  const original = exported(ctx);
  ctx.selectedCategories = ['["Leisure"]'];
  ctx.breakTime = 30;
  query.mockRejectedValueOnce(new Error('offline'));
  await ctx.loadData();
  expect(exported(ctx)).toEqual(original);
  expect(ctx.loading).toBe(false);
});

test('后续成功会同时替换数据与元数据', async () => {
  const ctx = context();
  await ctx.loadData();
  ctx.selectedCategories = ['["Leisure"]'];
  ctx.breakTime = 30;
  ctx.dateRange = 'last30d';
  query.mockResolvedValueOnce([{ events: [], duration: 7200 }]);
  await ctx.loadData();
  const data = exported(ctx);
  expect(data.parameters.categories).toEqual(['["Leisure"]']);
  expect(data.parameters.breakTime).toBe(30);
  expect(data.parameters.dateRange).toBe('last30d');
  expect(data.summary.totalDuration).toBe(7200);
});

test('第二次生成不能与未完成的查询竞争', async () => {
  const ctx = context();
  let resolve;
  query.mockImplementation(() => new Promise(r => (resolve = r)));
  const calculation = ctx.loadData();
  ctx.selectedCategories = ['["Leisure"]'];
  await ctx.loadData();
  expect(query).toHaveBeenCalledTimes(1);
  expect(ctx.loading).toBe(true);
  resolve(result());
  await calculation;
  expect(exported(ctx).parameters.categories).toEqual(['["Work"]']);
  expect(ctx.loading).toBe(false);
});

test('计算失败（结果为空）保留完整旧报告并提示错误', async () => {
  const ctx = context();
  await ctx.loadData();
  const original = exported(ctx);
  ctx.selectedCategories = ['["Leisure"]'];
  query.mockResolvedValueOnce([null]);
  await ctx.loadData();
  expect(exported(ctx)).toEqual(original);
  expect(window.alert).toHaveBeenCalledWith('workReport.errLoading');
});
