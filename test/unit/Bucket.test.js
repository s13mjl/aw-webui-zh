import { reactive } from 'vue';
import { shallowMount } from '@vue/test-utils';
import Bucket from '~/views/Bucket.vue';
import i18nInstance from '~/i18n';
import { installBootstrapVue } from '~/compat/bootstrap-vue';
import { filters } from '~/util/filters';

const mockCountEvents = jest.fn();
const mockGetBucketWithEvents = jest.fn();
const mockLoadBuckets = jest.fn();
const mockEnsureLoaded = jest.fn().mockResolvedValue(undefined);
const knownBucket = {
  id: 'aw-watcher-window_host',
  type: 'currentwindow',
  hostname: 'host',
  client: 'test',
};
// Reactive like the real Pinia store, so the view's `bucket` computed sees a refresh.
const mockState = reactive({ buckets: [] });

jest.mock('~/util/awclient', () => ({
  getClient: () => ({ countEvents: mockCountEvents }),
}));

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: mockEnsureLoaded,
    loadBuckets: mockLoadBuckets,
    getBucket: id => mockState.buckets.find(b => b.id === id),
    getBucketWithEvents: mockGetBucketWithEvents,
  }),
}));

// Like the real input-timeinterval, emit an initial date range on mount
// (Vue 3 v-model uses update:modelValue instead of input).
const InputTimeIntervalStub = {
  template: '<div class="timeinterval" />',
  mounted() {
    const t = iso => ({ format: () => iso });
    this.$emit('update:modelValue', [t('2026-10-01T00:00:00Z'), t('2026-10-02T00:00:00Z')]);
  },
};

function mountBucket(id) {
  return shallowMount(Bucket, {
    props: { id },
    global: {
      plugins: [i18nInstance, { install: installBootstrapVue }],
      config: {
        globalProperties: { $filters: filters },
      },
      stubs: {
        'b-alert': { template: '<div class="alert"><slot /></div>' },
        'router-link': { template: '<a><slot /></a>' },
        'input-timeinterval': InputTimeIntervalStub,
        'vis-timeline': true,
        'aw-eventlist': true,
      },
    },
  });
}

async function flush() {
  for (let i = 0; i < 3; i++) await new Promise(resolve => setTimeout(resolve, 0));
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

const listedEvents = () => [
  { id: 11, timestamp: '2026-10-01T12:00:00Z', duration: 5, data: { title: 'a' } },
  { id: 12, timestamp: '2026-10-01T12:01:00Z', duration: 5, data: { title: 'b' } },
];

describe('Bucket view', () => {
  beforeEach(() => {
    mockState.buckets = [knownBucket];
    mockCountEvents.mockReset();
    mockLoadBuckets.mockReset().mockResolvedValue(undefined);
    mockEnsureLoaded.mockReset().mockResolvedValue(undefined);
    mockGetBucketWithEvents.mockReset().mockResolvedValue({ ...knownBucket, events: [] });
  });

  test('shows the event count returned by countEvents', async () => {
    mockCountEvents.mockResolvedValue(49828);
    const wrapper = mountBucket('aw-watcher-window_host');
    await flush();

    expect(mockCountEvents).toHaveBeenCalledWith('aw-watcher-window_host');
    expect(wrapper.vm.eventcount).toBe(49828);
    expect(wrapper.text()).toContain('49828');
    expect(wrapper.find('.alert').exists()).toBe(false);
    expect(mockGetBucketWithEvents).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'aw-watcher-window_host' })
    );
  });

  test('shows a count of 0 when aw-client returns the raw response', async () => {
    mockCountEvents.mockResolvedValue({ data: 0, status: 200 });
    const wrapper = mountBucket('aw-watcher-window_host');
    await flush();

    expect(wrapper.vm.eventcount).toBe(0);
  });

  test('refreshes a stale bucket list before calling a bucket missing', async () => {
    const newBucket = { ...knownBucket, id: 'aw-watcher-new_host' };
    mockLoadBuckets.mockImplementation(async () => {
      mockState.buckets = [knownBucket, newBucket];
    });
    mockCountEvents.mockResolvedValue(3);
    const wrapper = mountBucket('aw-watcher-new_host');
    await flush();

    expect(mockLoadBuckets).toHaveBeenCalled();
    expect(wrapper.find('.alert').exists()).toBe(false);
    expect(mockCountEvents).toHaveBeenCalledWith('aw-watcher-new_host');
    expect(wrapper.vm.eventcount).toBe(3);
  });

  test('renders a not-found state for an unknown bucket', async () => {
    const wrapper = mountBucket('does-not-exist');
    await flush();

    expect(mockLoadBuckets).toHaveBeenCalled();
    expect(mockCountEvents).not.toHaveBeenCalled();
    expect(mockGetBucketWithEvents).not.toHaveBeenCalled();
    expect(wrapper.find('.alert').text()).toContain('No bucket named "does-not-exist".');
    expect(wrapper.find('table').exists()).toBe(false);
  });

  test('hides the Data row when the bucket has no data', async () => {
    mockCountEvents.mockResolvedValue(1);

    // knownBucket has no `data` field at all (undefined must not throw in Object.keys)
    const withoutData = mountBucket('aw-watcher-window_host');
    await flush();
    expect(withoutData.find('table').exists()).toBe(true);
    expect(withoutData.text()).not.toContain('Data:');

    const emptyData = { ...knownBucket, id: 'aw-watcher-empty_host', data: {} };
    mockState.buckets = [...mockState.buckets, emptyData];
    const withEmptyData = mountBucket('aw-watcher-empty_host');
    await flush();
    expect(withEmptyData.text()).not.toContain('Data:');

    const withData = { ...knownBucket, id: 'aw-watcher-full_host', data: { client: 'c' } };
    mockState.buckets = [...mockState.buckets, withData];
    const withRealData = mountBucket('aw-watcher-full_host');
    await flush();
    expect(withRealData.text()).toContain('Data:');
  });

  const originalWarn = console.warn;
  afterEach(() => {
    console.warn = originalWarn;
  });

  test('a confirmed deletion removes its row, resets and refreshes the total', async () => {
    const all = listedEvents();
    mockGetBucketWithEvents.mockResolvedValue({ ...knownBucket, events: all });
    mockCountEvents.mockResolvedValue(2);
    const wrapper = mountBucket('aw-watcher-window_host');
    await flush();
    expect(wrapper.vm.events.map(e => e.id)).toEqual([11, 12]);

    mockGetBucketWithEvents.mockResolvedValueOnce({ ...knownBucket, events: [all[1]] });
    mockCountEvents.mockResolvedValueOnce(1);
    await wrapper.vm.removeEvent(all[0], 'aw-watcher-window_host');
    await flush();

    expect(wrapper.vm.events.map(e => e.id)).toEqual([12]);
    expect(wrapper.vm.eventcount).toBe(1);
  });

  test('a late confirmed deletion from another bucket is ignored', async () => {
    const all = listedEvents();
    mockGetBucketWithEvents.mockResolvedValue({ ...knownBucket, events: all });
    mockCountEvents.mockResolvedValue(2);
    const wrapper = mountBucket('aw-watcher-window_host');
    await flush();

    await wrapper.vm.removeEvent(all[0], 'another-bucket');
    expect(wrapper.vm.events.map(e => e.id)).toEqual([11, 12]);
    expect(wrapper.vm.eventcount).toBe(2);
  });

  test('a pre-delete load cannot restore a confirmed-deleted row', async () => {
    const all = listedEvents();
    mockGetBucketWithEvents.mockResolvedValue({ ...knownBucket, events: all });
    mockCountEvents.mockResolvedValue(2);
    const wrapper = mountBucket('aw-watcher-window_host');
    await flush();

    const stale = deferred();
    mockGetBucketWithEvents.mockReturnValueOnce(stale.promise);
    const loading = wrapper.vm.getEvents('aw-watcher-window_host');

    mockGetBucketWithEvents.mockResolvedValueOnce({ ...knownBucket, events: [all[1]] });
    mockCountEvents.mockResolvedValueOnce(1);
    await wrapper.vm.removeEvent(all[0], 'aw-watcher-window_host');
    await flush();

    stale.resolve({ ...knownBucket, events: all });
    await loading;
    await flush();
    expect(wrapper.vm.events.map(e => e.id)).toEqual([12]);
    expect(wrapper.vm.eventcount).toBe(1);
  });

  test('a failed refresh keeps the local removal and invalidates the total', async () => {
    console.warn = jest.fn();
    const all = listedEvents();
    mockGetBucketWithEvents.mockResolvedValue({ ...knownBucket, events: all });
    mockCountEvents.mockResolvedValue(2);
    const wrapper = mountBucket('aw-watcher-window_host');
    await flush();

    mockGetBucketWithEvents.mockRejectedValueOnce(new Error('offline'));
    mockCountEvents.mockRejectedValueOnce(new Error('offline'));
    await wrapper.vm.removeEvent(all[0], 'aw-watcher-window_host');
    await flush();

    expect(wrapper.vm.events.map(e => e.id)).toEqual([12]);
    expect(wrapper.vm.eventcount).toBe('?');
    expect(console.warn).toHaveBeenCalledWith(
      '[bucket] Failed to refresh after deletion:',
      expect.any(Error)
    );
  });
});

describe('Bucket view navigation', () => {
  const bucketA = { ...knownBucket, id: 'bucket-a' };
  const bucketB = { ...knownBucket, id: 'bucket-b' };
  const eventsFor = id => [
    { id: 1, timestamp: '2026-10-02T10:00:00Z', duration: 1, data: { from: id } },
  ];

  beforeEach(() => {
    mockState.buckets = [bucketA, bucketB];
    mockCountEvents.mockReset().mockImplementation(async id => (id === 'bucket-a' ? 10 : 20));
    mockLoadBuckets.mockReset().mockResolvedValue(undefined);
    mockGetBucketWithEvents
      .mockReset()
      .mockImplementation(async ({ id }) => ({ id, events: eventsFor(id) }));
  });

  test('reloads events and count when navigating to another bucket', async () => {
    const wrapper = mountBucket('bucket-a');
    await flush();
    expect(wrapper.vm.events[0].data.from).toBe('bucket-a');
    expect(wrapper.vm.eventcount).toBe(10);

    // The router reuses the component, only changing the prop.
    await wrapper.setProps({ id: 'bucket-b' });
    await flush();
    expect(wrapper.vm.events[0].data.from).toBe('bucket-b');
    expect(wrapper.vm.eventcount).toBe(20);
  });

  test('shows the not-found state when navigating to an unknown bucket', async () => {
    const wrapper = mountBucket('bucket-a');
    await flush();
    mockCountEvents.mockClear();
    mockGetBucketWithEvents.mockClear();

    await wrapper.setProps({ id: 'does-not-exist' });
    await flush();
    expect(mockLoadBuckets).toHaveBeenCalled();
    expect(mockCountEvents).not.toHaveBeenCalled();
    expect(mockGetBucketWithEvents).not.toHaveBeenCalled();
    expect(wrapper.find('.alert').text()).toContain('No bucket named "does-not-exist"');
  });

  // Returns a promise plus a function to resolve it later.
  function deferred() {
    let resolve;
    const promise = new Promise(r => (resolve = r));
    return { promise, resolve };
  }

  test('ignores late responses for a bucket the user navigated away from', async () => {
    const lateEvents = deferred();
    const lateCount = deferred();
    mockGetBucketWithEvents.mockImplementationOnce(() => lateEvents.promise);
    mockCountEvents.mockImplementationOnce(() => lateCount.promise);

    const wrapper = mountBucket('bucket-a');
    await flush();

    await wrapper.setProps({ id: 'bucket-b' });
    await flush();
    expect(wrapper.vm.events[0].data.from).toBe('bucket-b');
    expect(wrapper.vm.eventcount).toBe(20);

    // bucket-a's first requests finish only now.
    lateEvents.resolve({ id: 'bucket-a', events: [{ id: 9, data: { from: 'late bucket-a' } }] });
    lateCount.resolve(999);
    await flush();
    expect(wrapper.vm.events[0].data.from).toBe('bucket-b');
    expect(wrapper.vm.eventcount).toBe(20);
  });

  test('ignores a late response for an older time range of the same bucket', async () => {
    const lateEvents = deferred();
    mockGetBucketWithEvents.mockImplementationOnce(() => lateEvents.promise);

    const wrapper = mountBucket('bucket-a');
    await flush();

    // A -> B -> A with a new time range, while the first A request is still pending.
    await wrapper.setProps({ id: 'bucket-b' });
    await wrapper.setProps({ id: 'bucket-a' });
    const t = iso => ({ format: () => iso });
    wrapper.setData({ daterange: [t('2026-09-30T00:00:00Z'), t('2026-10-02T00:00:00Z')] });
    await flush();
    expect(wrapper.vm.events[0].data.from).toBe('bucket-a');

    lateEvents.resolve({ id: 'bucket-a', events: [{ id: 9, data: { from: 'stale range' } }] });
    await flush();
    expect(wrapper.vm.events[0].data.from).toBe('bucket-a');
  });
});

const range = () => [{ format: () => 'start' }, { format: () => 'end' }];

function makeVm(getBucketWithEvents, daterange = range()) {
  return {
    id: 'b',
    daterange,
    eventsRequestId: 0,
    events: [],
    showingMostRecent: false,
    lastEventTime: null,
    bucket: { id: 'b', metadata: { end: '2020-01-02T00:00:00Z' } },
    bucketsStore: { getBucketWithEvents },
  };
}

describe('Bucket.vue 最近事件回退（同步上游 #1030）', () => {
  test('区间为空时显示最近事件并记录最新时间', async () => {
    const recent = [{ timestamp: '2020-01-01T10:00:00Z' }, { timestamp: '2020-01-01T09:00:00Z' }];
    const get = jest.fn(async ({ limit }) => ({ events: limit ? recent : [] }));
    const vm = makeVm(get);

    await Bucket.methods.getEvents.call(vm, 'b');

    expect(get).toHaveBeenCalledTimes(2);
    expect(vm.events).toEqual(recent);
    expect(vm.showingMostRecent).toBe(true);
    expect(vm.lastEventTime).toBe('2020-01-01T10:00:00Z');
  });

  test('区间内有事件时不回退', async () => {
    const events = [{ timestamp: 'x' }];
    const get = jest.fn(async () => ({ events }));
    const vm = makeVm(get);

    await Bucket.methods.getEvents.call(vm, 'b');

    expect(get).toHaveBeenCalledTimes(1);
    expect(vm.showingMostRecent).toBe(false);
  });

  test('回退请求失败时静默处理', async () => {
    const get = jest.fn(async ({ limit }) => {
      if (limit) throw new Error('network error');
      return { events: [] };
    });
    const vm = makeVm(get);

    await expect(Bucket.methods.getEvents.call(vm, 'b')).resolves.not.toThrow();
    expect(vm.showingMostRecent).toBe(false);
    expect(vm.events).toEqual([]);
  });

  test('过期的回退结果不覆盖更新的选择', async () => {
    let release;
    const gate = new Promise(resolve => (release = resolve));
    const get = jest.fn(async ({ limit }) => {
      if (limit) {
        await gate;
        return { events: [{ timestamp: 'stale' }] };
      }
      return { events: [] };
    });
    const vm = makeVm(get);
    const inFlight = Bucket.methods.getEvents.call(vm, 'b');
    await flush();
    // 用户改选新的区间，并已拿到新数据。
    vm.eventsRequestId += 1;
    vm.events = [{ timestamp: 'fresh' }];
    release();
    await inFlight;
    expect(vm.events).toEqual([{ timestamp: 'fresh' }]);
    expect(vm.showingMostRecent).toBe(false);
  });
});
