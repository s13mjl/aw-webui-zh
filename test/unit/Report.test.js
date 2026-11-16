import { createPinia, setActivePinia } from 'pinia';
import { shallowMount } from '@vue/test-utils';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import Report from '~/views/Report.vue';
import { useCategoryStore } from '~/stores/categories';
import { getClient } from '~/util/awclient';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));
jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: jest.fn().mockResolvedValue(undefined),
    buckets: [],
  }),
}));

const event = (timestamp = '2026-10-01T12:00:00', duration = 60, category = ['Work']) => ({
  timestamp,
  duration,
  data: { $category: category, app: 'Editor', title: 'Report test' },
});
const query = jest.fn();

function mountReport() {
  const wrapper = shallowMount(Report, {
    global: {
      plugins: [i18nInstance, { install: installBootstrapVue }],
      stubs: {
        icon: true,
        'aw-timeline-barchart': true,
        'aw-selectable-eventview': true,
        'vis-timeline': true,
        'aw-select-categories-or-pattern': true,
        'aw-query-options': true,
      },
    },
  });
  const vm = wrapper.vm;
  vm.queryOptions = {
    hostname: 'requested-host',
    start: '2026-10-01',
    stop: '2026-10-03',
    filter_afk: true,
  };
  vm.filterCategories = [[['Work'], { type: 'none' }]];
  return { wrapper, vm };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  setActivePinia(createPinia());
  query.mockReset().mockResolvedValue([[event()]]);
  getClient.mockReturnValue({ query });
  useCategoryStore().classes = [
    { name: ['Work'], rule: { type: 'none' }, data: { color: '#123456' } },
    { name: ['Leisure'], rule: { type: 'none' }, data: { color: '#654321' } },
  ];
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

test('binds events, datasets and query window to one successful report', async () => {
  const { wrapper, vm } = mountReport();
  await vm.generate();
  await vm.$nextTick();
  expect(vm.error).toBe('');
  expect(vm.events).toEqual([event()]);
  expect(vm.datasets).toHaveLength(1);
  expect(vm.datasets[0].label).toBe('Work');
  expect(vm.datasets[0].backgroundColor).toBe('#123456');
  expect(vm.result.period.length).toEqual([2, 'day']);
  expect(vm.datasets[0].data).toHaveLength(2);
  expect(vm.datasets[0].data[0]).toBeCloseTo(1 / 60, 8);
  expect(query).toHaveBeenCalledTimes(1);
  expect(query.mock.calls[0][0]).toEqual([
    expect.stringMatching(/^2026-10-01T00:00:00.*\/2026-10-03T00:00:00/),
  ]);
  expect(query.mock.calls[0][1].join(';')).toContain('Work');
  wrapper.unmount();
});

test('control edits during and after a request cannot change its events or colors', async () => {
  const response = deferred();
  query.mockReturnValueOnce(response.promise);
  const { wrapper, vm } = mountReport();
  const request = vm.generate();
  vm.queryOptions.hostname = 'other-host';
  vm.queryOptions.start = '2026-09-01';
  vm.filterCategories[0][0][0] = 'Leisure';
  useCategoryStore().classes[0].data.color = '#ffffff';
  response.resolve([[event()]]);
  await request;
  await vm.$nextTick();
  const result = JSON.stringify(vm.result);
  expect(vm.datasets[0].label).toBe('Work');
  expect(vm.datasets[0].backgroundColor).toBe('#123456');
  expect(vm.result.period.start).toMatch(/^2026-10-01T00:00:00/);
  vm.queryOptions.stop = '2026-09-10';
  vm.filterCategories = [];
  await vm.$nextTick();
  expect(JSON.stringify(vm.result)).toBe(result);
  wrapper.unmount();
});

test('a rejected recalculation retains the previous successful chart and events', async () => {
  const { wrapper, vm } = mountReport();
  await vm.generate();
  const result = vm.result;
  query.mockRejectedValueOnce(new Error('offline'));
  vm.queryOptions.start = '2026-09-01';
  await vm.generate();
  expect(vm.error).toBe('offline');
  expect(vm.result).toBe(result);
  expect(vm.status).toBeNull();
  wrapper.unmount();
});

test('an older request cannot overwrite a newer success', async () => {
  const old = deferred();
  query.mockReturnValueOnce(old.promise);
  const { wrapper, vm } = mountReport();
  const request = vm.generate();
  vm.filterCategories = [[['Leisure'], { type: 'none' }]];
  query.mockResolvedValueOnce([[event('2026-10-01T13:00:00', 3600, ['Leisure'])]]);
  await vm.generate();
  const result = vm.result;
  old.resolve([[event()]]);
  await request;
  expect(vm.result).toBe(result);
  expect(vm.datasets[0].label).toBe('Leisure');
  expect(vm.error).toBe('');
  expect(vm.status).toBeNull();
  wrapper.unmount();
});

test('an invalid query window reports an i18n error without querying', async () => {
  const { wrapper, vm } = mountReport();
  vm.queryOptions.start = '2026-10-03';
  vm.queryOptions.stop = '2026-10-01';
  await vm.generate();
  expect(vm.error).toBeTruthy();
  expect(vm.status).toBeNull();
  expect(query).not.toHaveBeenCalled();
  wrapper.unmount();
});
