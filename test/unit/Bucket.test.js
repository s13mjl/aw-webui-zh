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
