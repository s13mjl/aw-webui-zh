const mockGetBuckets = jest.fn();
const mockGetEvents = jest.fn();
const mockInsertEvents = jest.fn();

jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    getBuckets: mockGetBuckets,
    getEvents: mockGetEvents,
    insertEvents: mockInsertEvents,
  }),
}));

import { shallowMount } from '@vue/test-utils';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import BucketMerge from '~/components/BucketMerge.vue';

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

const inner = { id: 'inner', timestamp: '2026-10-19T00:00:10Z', duration: 10 };
const outer = { id: 'outer', timestamp: '2026-10-19T00:00:00Z', duration: 30 };
const disjoint = { id: 'disjoint', timestamp: '2026-10-19T01:00:00Z', duration: 10 };

async function mountWith(fromEvents, toEvents) {
  mockGetEvents.mockImplementation(async bucket_id =>
    bucket_id === 'from' ? fromEvents : toEvents
  );
  const wrapper = shallowMount(BucketMerge, {
    global: { plugins: [i18nInstance, { install: installBootstrapVue }] },
  });
  await flushPromises();
  await wrapper.vm.$nextTick();
  wrapper.vm.bucket_from = 'from';
  wrapper.vm.bucket_to = 'to';
  await flushPromises();
  await wrapper.vm.$nextTick();
  return wrapper;
}

describe('BucketMerge', () => {
  beforeEach(() => {
    mockGetBuckets.mockReset();
    mockGetEvents.mockReset();
    mockGetBuckets.mockResolvedValue({ from: {}, to: {} });
  });

  test('refuses to merge when a source event contains a destination event', async () => {
    // The contained interval is in the destination, so the source interval
    // strictly contains it. Merge must still be blocked.
    const wrapper = await mountWith([outer], [inner]);

    expect(wrapper.vm.overlappingEvents).toHaveLength(1);
    expect(wrapper.vm.validate).toBe(false);
  });

  test('refuses to merge when a destination event contains a source event', async () => {
    const wrapper = await mountWith([inner], [outer]);

    expect(wrapper.vm.overlappingEvents).toHaveLength(1);
    expect(wrapper.vm.validate).toBe(false);
  });

  test('allows merging disjoint buckets', async () => {
    const wrapper = await mountWith([inner], [disjoint]);

    expect(wrapper.vm.overlappingEvents).toHaveLength(0);
    expect(wrapper.vm.validate).toBe(true);
  });
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function mountLoaded(fromEvents = [inner]) {
  mockGetEvents.mockImplementation(async id => (id === 'from' ? fromEvents : [disjoint]));
  mockInsertEvents.mockReset().mockResolvedValue([]);
  const wrapper = shallowMount(BucketMerge, {
    global: {
      plugins: [i18nInstance, { install: installBootstrapVue }],
      // Production routes async watcher rejections to the global errorHandler.
      config: { errorHandler: () => {} },
    },
  });
  await flushPromises();
  wrapper.vm.bucket_from = 'from';
  wrapper.vm.bucket_to = 'to';
  await flushPromises();
  await wrapper.vm.$nextTick();
  expect(wrapper.vm.validate).toBe(true);
  return wrapper;
}

describe('BucketMerge selection ownership', () => {
  test('blocks while a replacement load is pending and ignores a stale response', async () => {
    const wrapper = await mountLoaded();
    const older = deferred();
    const newer = deferred();
    mockGetEvents.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    wrapper.vm.bucket_from = 'B';
    await flushPromises();
    expect(wrapper.vm.events_from).toBeNull();
    expect(wrapper.vm.validate).toBe(false);
    await wrapper.vm.merge();
    expect(mockInsertEvents).not.toHaveBeenCalled();

    wrapper.vm.bucket_from = 'C';
    await flushPromises();
    newer.resolve([inner]);
    await flushPromises();
    older.resolve([disjoint]);
    await flushPromises();

    expect(wrapper.vm.events_from).toEqual([inner]);
    expect(wrapper.vm.loaded_from).toBe('C');
    expect(wrapper.vm.validate).toBe(true);
  });

  test('a failed or cleared load leaves inputs unavailable and merge blocked', async () => {
    const wrapper = await mountLoaded();
    const failed = deferred();
    mockGetEvents.mockReturnValueOnce(failed.promise);
    wrapper.vm.bucket_to = 'B';
    await flushPromises();
    expect(wrapper.vm.validate).toBe(false);

    failed.reject(new Error('load failed'));
    await flushPromises();
    expect(wrapper.vm.events_to).toBeNull();
    expect(wrapper.vm.loaded_to).toBeNull();
    expect(wrapper.vm.validate).toBe(false);
    await wrapper.vm.merge();
    expect(mockInsertEvents).not.toHaveBeenCalled();

    // Clearing the selection clears its events and does not accept late data.
    wrapper.vm.bucket_to = null;
    await flushPromises();
    expect(wrapper.vm.events_to).toBeNull();
    expect(wrapper.vm.validate).toBe(false);
  });

  test('merge inserts the current source into the current destination only when valid', async () => {
    const wrapper = await mountLoaded();
    const from = deferred();
    const to = deferred();
    mockGetEvents.mockReturnValueOnce(from.promise).mockReturnValueOnce(to.promise);
    wrapper.vm.bucket_from = 'B';
    wrapper.vm.bucket_to = 'C';
    await flushPromises();

    from.resolve([disjoint]);
    await flushPromises();
    expect(wrapper.vm.validate).toBe(false); // destination still loading
    to.resolve([inner]);
    await flushPromises();
    expect(wrapper.vm.validate).toBe(true);

    await wrapper.vm.merge();
    expect(mockInsertEvents).toHaveBeenCalledTimes(1);
    expect(mockInsertEvents).toHaveBeenCalledWith('C', [disjoint]);
  });
});
